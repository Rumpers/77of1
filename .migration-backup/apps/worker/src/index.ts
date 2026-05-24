// Async generation worker
// Consent is checked live before every generation — never cached (ADR-011 Decision 2).
// Revocation arrives via Redis pub/sub and cancels all queued jobs within ≤60s SLA.
import { Worker } from "bullmq";
import { createClient, getSupabaseUrl, getSupabaseServiceKey } from "@7of1/db";
import { QUEUE_NAME, createBullMQAdapter } from "@7of1/queue";
import { ConsentStore, createRevocationBus } from "@7of1/consent";
import type { ConsentGrantType } from "@7of1/consent";
import type { GenerationJobPayload } from "@7of1/types";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// Service-role client bypasses RLS — required so consent checks always resolve.
const supabase = createClient(getSupabaseUrl(), getSupabaseServiceKey());
const consentStore = new ConsentStore(supabase);
const queue = createBullMQAdapter(REDIS_URL);
const revocationBus = createRevocationBus(REDIS_URL);

// ── Revocation sweep ─────────────────────────────────────────────────────────
// Triggered by Redis pub/sub when a creator revokes consent.
// Cancels BullMQ-queued jobs and marks the DB rows cancelled within ≤60s SLA.
async function handleRevocation(creatorId: string): Promise<void> {
  const sweepStart = Date.now();
  console.log(`[worker] revocation received creator=${creatorId}`);

  const cancelled = await queue.cancelByCreator(creatorId);

  const { error } = await supabase
    .from("generation_jobs")
    .update({
      status: "cancelled",
      error_message: "consent_revoked",
      completed_at: new Date().toISOString(),
    })
    .eq("creator_id", creatorId)
    .in("status", ["queued", "processing"]);

  if (error) {
    console.error(`[worker] db sweep error creator=${creatorId}: ${error.message}`);
  }
  console.log(
    `[worker] revocation sweep done creator=${creatorId}` +
      ` bullmq_cancelled=${cancelled} elapsed_ms=${Date.now() - sweepStart}`
  );
}

const unsubscribeRevocations = await revocationBus.subscribe(handleRevocation);

// ── Generation worker ─────────────────────────────────────────────────────────
const worker = new Worker<GenerationJobPayload>(
  QUEUE_NAME,
  async (job) => {
    const { jobId, creatorId, fanId, jobType } = job.data;
    console.log(
      `[worker] processing job=${jobId} creator=${creatorId} jobType=${jobType} fan=${fanId}`
    );

    // 1. Live consent check — must pass before any generation call (ADR-011).
    const GRANT_TYPE: Record<string, ConsentGrantType> = {
      text: "persona_text",
      voice: "voice",
      image: "image",
      video: "talking_video",
    };
    const grantType: ConsentGrantType = GRANT_TYPE[jobType] ?? "persona_text";
    const consent = await consentStore.checkConsent(creatorId, grantType);

    if (consent.status !== "granted") {
      await supabase
        .from("generation_jobs")
        .update({
          status: "cancelled",
          error_message: `consent_${consent.status}`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      console.log(
        `[worker] consent denied job=${jobId} creator=${creatorId} reason=${consent.reason}`
      );
      throw new Error(`consent_${consent.status}: ${consent.reason}`);
    }

    // 2. Stamp consent_grant_version on the job row (PRD §23).
    await supabase
      .from("generation_jobs")
      .update({
        status: "processing",
        consent_grant_version: consent.consentGrantVersion,
      })
      .eq("id", jobId);

    console.log(
      `[worker] consent ok job=${jobId} creator=${creatorId} grant=${consent.grantId}` +
        ` version=${consent.consentGrantVersion}`
    );

    // 3. Dispatch to provider adapter (OF-62: text → persona builder → GMI)
    if (jobType === "text") {
      const { dispatchTextGeneration } = await import("./text-dispatch.js");
      const result = await dispatchTextGeneration(
        { jobId, creatorId, fanId, prompt: job.data.prompt },
        supabase
      );
      await supabase
        .from("generation_jobs")
        .update({
          status: "done",
          result_url: null,
          completed_at: new Date().toISOString(),
          // Store text response inline for Slice 1; blob storage in Slice 2
          error_message: null,
        })
        .eq("id", jobId);
      console.log(
        `[worker] text done job=${jobId} tokens=${result.tokensUsed}` +
          ` model=${result.modelId} latency=${result.latencyMs}ms`
      );
      return;
    }

    throw new Error(`generation not yet implemented for jobType=${jobType}`);
  },
  {
    connection: { url: REDIS_URL },
    concurrency: 5,
  }
);

worker.on("completed", async (job) => {
  await supabase
    .from("generation_jobs")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", job.data.jobId);
  console.log(`[worker] done job=${job.id}`);
});

worker.on("failed", async (job, err) => {
  // Consent-denied failures are already stamped in the job processor above.
  if (job && !err.message.startsWith("consent_")) {
    await supabase
      .from("generation_jobs")
      .update({
        status: "failed",
        error_message: err.message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.data.jobId);
  }
  console.error(`[worker] failed job=${job?.id} error=${err.message}`);
});

async function shutdown() {
  await worker.close();
  await unsubscribeRevocations();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log(`[worker] started queue=${QUEUE_NAME} redis=${REDIS_URL}`);
