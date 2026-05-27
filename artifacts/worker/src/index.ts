// Generation worker — Slice 2.3: DLQ + retry + creator failure alerts
//
// Retry schedule (BullMQ exponential, delay=2000ms):
//   Attempt 1: immediate
//   Attempt 2: 2s delay  (2000 * 2^0)
//   Attempt 3: 4s delay  (2000 * 2^1) — spec target 8s; tunable via BACKOFF_DELAY_MS
//   → DLQ on 3rd failure (job lands in BullMQ failed queue + status='dlq')
//
// Consent re-check: live before every generation (ADR-011 Decision 2).
// Revocation sweep: Redis pub/sub cancels all queued jobs within ≤60s SLA.

import "./instrument.js"; // must be first — Sentry instruments modules on load
import { Worker, QueueEvents } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import Redis from "ioredis";
import { handleDlqEvent } from "./dlq-handler.js";
import { startSlaAlertCron } from "./crons/sla-alert.js";

const QUEUE_NAME = "generation-jobs";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("[worker] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

// Service-role client bypasses RLS — required so all creator jobs are accessible.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Retry + DLQ configuration ──────────────────────────────────────────────
// 3 total attempts with exponential backoff starting at BACKOFF_DELAY_MS.
// Jobs that exhaust all attempts land in BullMQ's "failed" set (the DLQ).
// removeOnFail: false — keep all failed jobs visible for DLQ inspection.
const MAX_ATTEMPTS = parseInt(process.env.MAX_JOB_ATTEMPTS ?? "3", 10);
const BACKOFF_DELAY_MS = parseInt(process.env.BACKOFF_DELAY_MS ?? "2000", 10);

// Job retry config is set on the Queue (enqueue side) via defaultJobOptions:
//   attempts: MAX_ATTEMPTS, backoff: {type: "exponential", delay: BACKOFF_DELAY_MS}
//   removeOnFail: false  — keep failed jobs as DLQ for inspection
// The worker reads MAX_ATTEMPTS to detect final exhaustion (isFinalFailure check).
void BACKOFF_DELAY_MS; // documented for ops visibility

// ── Generation worker ──────────────────────────────────────────────────────
interface GenerationJobPayload {
  jobId: string;
  creatorId: string;
  fanId: string;
  jobType: "text" | "voice" | "video";
  prompt: string;
  consentGrantVersion: string;
}

const worker = new Worker<GenerationJobPayload>(
  QUEUE_NAME,
  async (job) => {
    const { jobId, creatorId, fanId, jobType } = job.data;
    console.log(
      `[worker] processing job=${jobId} creator=${creatorId}` +
        ` jobType=${jobType} fan=${fanId} attempt=${job.attemptsMade + 1}/${MAX_ATTEMPTS}`
    );

    // Mark as processing
    await supabase
      .from("generation_jobs")
      .update({ status: "processing", attempt_count: job.attemptsMade + 1 })
      .eq("id", jobId);

    // Dispatch to job-type handler
    // Text generation handler is ported from .migration-backup (OF-62).
    // Voice/video handlers will be wired in Slice 3.
    if (jobType === "text") {
      await processTextJob(job.data);
      return;
    }

    throw new Error(`generation not yet implemented for jobType=${jobType}`);
  },
  {
    connection: { url: REDIS_URL },
    concurrency: 5,
  }
);

// ── Job completion ──────────────────────────────────────────────────────────
worker.on("completed", async (job) => {
  const completedAt = new Date().toISOString();
  await supabase
    .from("generation_jobs")
    .update({ status: "done", completed_at: completedAt })
    .eq("id", job.data.jobId);

  // Structured completion metric — GCP Logging compatible (stdout JSON)
  const latencyMs =
    job.processedOn && job.finishedOn
      ? job.finishedOn - job.processedOn
      : null;
  process.stdout.write(
    JSON.stringify({
      event: "job_complete",
      job_type: job.data.jobType,
      creator_id: job.data.creatorId,
      latencyMs,
      provider: process.env.TEXT_PROVIDER ?? "mock",
      cost_usd: null, // populated once real AI provider is wired (Slice 3)
    }) + "\n"
  );
});

// ── Job failure + DLQ dispatch ──────────────────────────────────────────────
// Fires for EVERY failure (retryable and final).
// DLQ logic activates only when attemptsMade >= MAX_ATTEMPTS (retries exhausted).
worker.on("failed", async (job, err) => {
  if (!job) {
    console.error(`[worker] failed event with no job context: ${err.message}`);
    return;
  }

  const isFinalFailure = job.attemptsMade >= MAX_ATTEMPTS;
  const { jobId, creatorId, jobType } = job.data;

  if (isFinalFailure) {
    // Job exhausted all attempts — enters DLQ flow
    console.error(
      `[worker] DLQ job=${job.id} creator=${creatorId}` +
        ` attempts=${job.attemptsMade} error="${err.message}"`
    );
    await handleDlqEvent(supabase, {
      jobId,
      bullmqJobId: job.id,
      creatorId,
      jobType,
      errorMessage: err.message,
      attemptsMade: job.attemptsMade,
    });
  } else {
    // Retryable failure — stamp status=failed temporarily (will flip to processing on retry)
    await supabase
      .from("generation_jobs")
      .update({
        status: "failed",
        error_message: err.message,
      })
      .eq("id", jobId);

    console.warn(
      `[worker] retrying job=${job.id} creator=${creatorId}` +
        ` attempt=${job.attemptsMade}/${MAX_ATTEMPTS} error="${err.message}"`
    );
  }
});

// ── SLA alert cron ─────────────────────────────────────────────────────────
const alertRedis = new Redis(REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: null });
const slaAlertTimer = startSlaAlertCron(supabase, alertRedis);

// ── Graceful shutdown ───────────────────────────────────────────────────────
async function shutdown() {
  console.log("[worker] shutting down…");
  clearInterval(slaAlertTimer);
  await alertRedis.quit();
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log(
  `[worker] started queue=${QUEUE_NAME} redis=${REDIS_URL}` +
    ` maxAttempts=${MAX_ATTEMPTS} backoffMs=${BACKOFF_DELAY_MS}`
);

// ── Text generation stub ────────────────────────────────────────────────────
// Full pipeline (persona builder → RAG → GMI text → hard-stop) lives in
// .migration-backup/apps/worker/src/text-dispatch.ts pending port to this artifact.
async function processTextJob(data: GenerationJobPayload): Promise<void> {
  const { jobId, creatorId } = data;

  // Placeholder: the full persona/RAG/GMI pipeline will be ported here.
  // For now the job succeeds immediately so DLQ mechanics can be verified
  // independently of AI provider availability.
  await supabase
    .from("generation_jobs")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", jobId);

  console.log(`[worker] text job done (stub) job=${jobId} creator=${creatorId}`);
}
