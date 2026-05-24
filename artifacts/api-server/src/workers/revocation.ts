// Consent-revocation pipeline — OF-103
// Cancels all queued/processing generation jobs within ≤60s of consent revocation.
//
// Two execution paths:
//   1. BullMQ path: API enqueues to "consent-revocation" queue; worker (artifacts/worker) processes it.
//   2. DB fallback: if Redis is unavailable, API calls runRevocationSweep() inline.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "pino";
import type { ConsentRevocationPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";

// Re-export the shared payload type under a shorter alias for internal use.
export type RevocationPayload = ConsentRevocationPayload;

interface SweepOptions {
  creatorId: string;
  consentGrantId: string | null;
  killSwitch: boolean;
}

interface DbJob {
  id: string;
  bullmq_job_id: string | null;
  status: string;
}

// Attempts to cancel BullMQ jobs. Returns count removed from queue.
async function cancelBullMQJobs(
  bullmqIds: string[],
  redisUrl: string,
  log: Logger,
): Promise<number> {
  if (bullmqIds.length === 0) return 0;

  let removed = 0;
  try {
    const { Queue } = await import("bullmq");
    const queue = new Queue("generation-jobs", { connection: { url: redisUrl } });

    for (const bullmqId of bullmqIds) {
      try {
        const job = await queue.getJob(bullmqId);
        if (!job) continue;
        const state = await job.getState();
        if (state === "waiting" || state === "delayed") {
          await job.remove();
          removed++;
        } else if (state === "active") {
          // Signal the generation worker to abort before delivering output
          await job.updateData({ ...job.data, cancelled: true });
        }
      } catch (e) {
        log.warn({ bullmqId, err: (e as Error).message }, "[revocation] bullmq job cancel error");
      }
    }

    await queue.close();
  } catch (e) {
    log.warn({ err: (e as Error).message }, "[revocation] bullmq unavailable, skipping queue ops");
  }

  return removed;
}

// Core sweep: finds all queued/processing generation jobs matching the revocation
// criteria, cancels them in BullMQ and marks them cancelled in the DB.
// Returns the number of jobs cancelled.
export async function runRevocationSweep(
  db: SupabaseClient,
  opts: SweepOptions,
  log: Logger,
): Promise<number> {
  const t0 = Date.now();

  // Build query — kill-switch cancels ALL active jobs for the creator.
  let query = db
    .from("generation_jobs")
    .select("id, bullmq_job_id, status")
    .eq("creator_id", opts.creatorId)
    .in("status", ["queued", "processing"]);

  if (!opts.killSwitch && opts.consentGrantId) {
    query = query.eq("consent_grant_id", opts.consentGrantId);
  }

  const { data: jobs, error: queryErr } = await query;

  if (queryErr) {
    log.error({ err: queryErr.message, creatorId: opts.creatorId }, "[revocation] job query error");
    return 0;
  }

  const matched = (jobs ?? []) as DbJob[];

  if (matched.length === 0) {
    log.info({ creatorId: opts.creatorId, killSwitch: opts.killSwitch }, "[revocation] no active jobs");
    await writeAuditLog(db, opts, 0, 0, t0, log);
    return 0;
  }

  const jobIds = matched.map((j) => j.id);
  const bullmqIds = matched.filter((j) => j.bullmq_job_id).map((j) => j.bullmq_job_id as string);

  // Cancel BullMQ jobs (best-effort; DB update is authoritative)
  const redisUrl = process.env.REDIS_URL;
  const bullmqRemoved = redisUrl
    ? await cancelBullMQJobs(bullmqIds, redisUrl, log)
    : 0;

  // Mark all matched jobs as cancelled in DB (authoritative state)
  const { error: updateErr } = await db
    .from("generation_jobs")
    .update({
      status: "cancelled",
      error_message: opts.killSwitch ? "kill_switch" : "consent_revoked",
      completed_at: new Date().toISOString(),
    })
    .in("id", jobIds);

  if (updateErr) {
    log.error({ err: updateErr.message }, "[revocation] db update error");
  }

  await writeAuditLog(db, opts, jobIds.length, bullmqRemoved, t0, log);

  log.info(
    {
      creatorId: opts.creatorId,
      killSwitch: opts.killSwitch,
      jobsCancelled: jobIds.length,
      bullmqRemoved,
      sweepMs: Date.now() - t0,
    },
    "[revocation] sweep complete",
  );

  return jobIds.length;
}

async function writeAuditLog(
  db: SupabaseClient,
  opts: SweepOptions,
  jobsCancelled: number,
  bullmqRemoved: number,
  t0: number,
  log: Logger,
): Promise<void> {
  const { error } = await db.from("audit_log").insert({
    creator_id: opts.creatorId,
    event_type: opts.killSwitch ? "kill_switch" : "consent_revoke",
    payload: {
      consent_grant_id: opts.consentGrantId,
      jobs_cancelled: jobsCancelled,
      bullmq_removed: bullmqRemoved,
      sweep_ms: Date.now() - t0,
    },
  });

  if (error) {
    log.error({ err: error.message }, "[revocation] audit log write error");
  }
}

// Starts the BullMQ consent-revocation worker in-process.
// Returns a cleanup fn; safe to call even if Redis is unavailable (worker is skipped).
export async function startRevocationWorker(log: Logger): Promise<() => Promise<void>> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    log.warn("[revocation-worker] REDIS_URL not set — worker skipped, DB fallback active");
    return async () => {};
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    log.warn("[revocation-worker] SUPABASE env vars not set — worker skipped");
    return async () => {};
  }

  const { Worker } = await import("bullmq");
  const { createClient } = await import("@supabase/supabase-js");

  const db = createClient(supabaseUrl, supabaseKey);

  const worker = new Worker<RevocationPayload>(
    QUEUE_NAMES.consentRevocation,
    async (job) => {
      const { creatorId, consentGrantId, killSwitch } = job.data;
      log.info({ jobId: job.id, creatorId, killSwitch }, "[revocation-worker] processing");

      await runRevocationSweep(
        db,
        { creatorId, consentGrantId: killSwitch ? null : consentGrantId, killSwitch },
        log,
      );
    },
    {
      connection: { url: redisUrl },
      concurrency: 10,
    },
  );

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err: err.message }, "[revocation-worker] job failed");
  });

  log.info("[revocation-worker] started");

  return async () => {
    await worker.close();
    log.info("[revocation-worker] closed");
  };
}
