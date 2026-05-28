// Consent-revocation pipeline — OF-103
// Cancels all queued/processing generation jobs within ≤60s of consent revocation.
//
// Two execution paths:
//   1. BullMQ path: API enqueues to "consent-revocation" queue; worker (artifacts/worker) processes it.
//   2. DB fallback: if Redis is unavailable, API calls runRevocationSweep() inline.
import { db, generationJobsTable } from "@workspace/db";
import { eq, inArray, and } from "drizzle-orm";
import type { Logger } from "pino";
import type { ConsentRevocationPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";

// Re-export the shared payload type under a shorter alias for internal use.
export type RevocationPayload = ConsentRevocationPayload;

// Type alias for the Drizzle db instance.
type DrizzleDb = typeof db;

interface SweepOptions {
  creatorId: string;
  consentGrantId: string | null;
  killSwitch: boolean;
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
  drizzleDb: DrizzleDb,
  opts: SweepOptions,
  log: Logger,
): Promise<number> {
  const t0 = Date.now();

  try {
    // Build query conditions — kill-switch cancels ALL active jobs for the creator;
    // normal consent revocation filters by the specific consentGrantId.
    const conditions =
      opts.killSwitch || !opts.consentGrantId
        ? and(
            eq(generationJobsTable.creatorId, opts.creatorId),
            inArray(generationJobsTable.status, ["queued", "processing"]),
          )
        : and(
            eq(generationJobsTable.creatorId, opts.creatorId),
            eq(generationJobsTable.consentGrantId, opts.consentGrantId),
            inArray(generationJobsTable.status, ["queued", "processing"]),
          );

    const jobs = await drizzleDb
      .select({
        id: generationJobsTable.id,
        bullmqJobId: generationJobsTable.bullmqJobId,
        status: generationJobsTable.status,
      })
      .from(generationJobsTable)
      .where(conditions);

    if (jobs.length === 0) {
      log.info(
        { creatorId: opts.creatorId, killSwitch: opts.killSwitch },
        "[revocation] no active jobs",
      );
      writeAuditEntry(opts, 0, 0, t0, log);
      return 0;
    }

    const jobIds = jobs.map((j) => j.id);
    const bullmqIds = jobs
      .filter((j) => j.bullmqJobId)
      .map((j) => j.bullmqJobId as string);

    // Cancel BullMQ jobs (best-effort; DB update is authoritative)
    const redisUrl = process.env.REDIS_URL;
    const bullmqRemoved = redisUrl
      ? await cancelBullMQJobs(bullmqIds, redisUrl, log)
      : 0;

    // Mark all matched jobs as cancelled in DB (authoritative state)
    await drizzleDb
      .update(generationJobsTable)
      .set({
        status: "cancelled",
        errorMessage: opts.killSwitch ? "kill_switch" : "consent_revoked",
        completedAt: new Date(),
      })
      .where(inArray(generationJobsTable.id, jobIds));

    writeAuditEntry(opts, jobIds.length, bullmqRemoved, t0, log);

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
  } catch (e) {
    log.error(
      { err: (e as Error).message, creatorId: opts.creatorId },
      "[revocation] sweep error",
    );
    return 0;
  }
}

// Writes a structured audit entry via pino. No audit_log Drizzle table exists yet
// (tracked as deferred in 01-04c SUMMARY — Phase 2 backlog). This is best-effort.
function writeAuditEntry(
  opts: SweepOptions,
  jobsCancelled: number,
  bullmqRemoved: number,
  t0: number,
  log: Logger,
): void {
  log.info(
    {
      audit: true,
      creatorId: opts.creatorId,
      eventType: opts.killSwitch ? "kill_switch" : "consent_revoke",
      consentGrantId: opts.consentGrantId,
      jobsCancelled,
      bullmqRemoved,
      sweepMs: Date.now() - t0,
    },
    "[revocation] audit",
  );
}

// Starts the BullMQ consent-revocation worker in-process.
// Returns a cleanup fn; safe to call even if Redis is unavailable (worker is skipped).
export async function startRevocationWorker(log: Logger): Promise<() => Promise<void>> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    log.warn("[revocation-worker] REDIS_URL not set — worker skipped, DB fallback active");
    return async () => {};
  }

  const { Worker } = await import("bullmq");

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
