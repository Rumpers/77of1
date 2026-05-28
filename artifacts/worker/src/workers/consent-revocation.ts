// Consent-revocation worker — OF-103
// Cancels all in-flight generation jobs within ≤60s SLA (PRD §8/§16).
// Highest priority (priority: 1) — picks up within ≤10s of enqueue.
//
// Phase 1: generation_jobs status updates use Drizzle (@workspace/db).
// audit_log writes are stubbed (table not in Phase 1 schema; wired in Phase 2).
import { Worker } from "bullmq";
import { db, generationJobsTable } from "@workspace/db";
import { eq, inArray, and } from "drizzle-orm";
import type { ProviderRegistry, ConsentRevocationPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";

const CONCURRENCY = 10;

interface DbJob {
  id: string;
  bullmqJobId: string | null;
  status: string;
}

async function cancelBullMQJobs(
  bullmqIds: string[],
  redisUrl: string,
): Promise<number> {
  if (bullmqIds.length === 0) return 0;

  let removed = 0;
  try {
    const { Queue } = await import("bullmq");
    // Cancel across all generation queues
    const queueNames = [
      QUEUE_NAMES.textGeneration,
      QUEUE_NAMES.voiceGeneration,
      QUEUE_NAMES.videoGeneration,
    ];

    for (const queueName of queueNames) {
      const q = new Queue(queueName, { connection: { url: redisUrl } });
      for (const bullmqId of bullmqIds) {
        try {
          const job = await q.getJob(bullmqId);
          if (!job) continue;
          const state = await job.getState();
          if (state === "waiting" || state === "delayed") {
            await job.remove();
            removed++;
          } else if (state === "active") {
            // Signal the generation worker to abort before delivering output
            await job.updateData({ ...job.data, cancelled: true });
          }
        } catch {
          // Best-effort; DB update below is authoritative
        }
      }
      await q.close();
    }
  } catch {
    // Redis unavailable; DB sweep is the authoritative path
  }

  return removed;
}

async function writeAuditLog(
  creatorId: string,
  consentGrantId: string | null,
  killSwitch: boolean,
  jobsCancelled: number,
  bullmqRemoved: number,
  sweepMs: number,
): Promise<void> {
  // STUB: audit_log table is out-of-scope in Phase 1 schema.
  // Phase 2: replace with db.insert(auditLogTable).values({...})
  console.log(
    `[revocation] STUB: audit_log write deferred to Phase 2` +
      ` creator=${creatorId} consentGrantId=${consentGrantId ?? "null"}` +
      ` killSwitch=${killSwitch} jobsCancelled=${jobsCancelled}` +
      ` bullmqRemoved=${bullmqRemoved} sweepMs=${sweepMs}`
  );
}

export function createWorker(
  _registry: ProviderRegistry,
  redisUrl: string,
): Worker<ConsentRevocationPayload> {
  const worker = new Worker<ConsentRevocationPayload>(
    QUEUE_NAMES.consentRevocation,
    async (job) => {
      const { creatorId, consentGrantId, killSwitch } = job.data;
      const t0 = Date.now();

      console.log(
        `[revocation] processing creator=${creatorId} killSwitch=${killSwitch} job=${job.id}`,
      );

      // Query matching active jobs using Drizzle
      let query = db
        .select({
          id: generationJobsTable.id,
          bullmqJobId: generationJobsTable.bullmqJobId,
          status: generationJobsTable.status,
        })
        .from(generationJobsTable)
        .where(
          and(
            eq(generationJobsTable.creatorId, creatorId),
            inArray(generationJobsTable.status, ["queued", "processing"])
          )
        );

      // For non-kill-switch: scope to the specific consent grant
      if (!killSwitch && consentGrantId) {
        query = db
          .select({
            id: generationJobsTable.id,
            bullmqJobId: generationJobsTable.bullmqJobId,
            status: generationJobsTable.status,
          })
          .from(generationJobsTable)
          .where(
            and(
              eq(generationJobsTable.creatorId, creatorId),
              eq(generationJobsTable.consentGrantId, consentGrantId),
              inArray(generationJobsTable.status, ["queued", "processing"])
            )
          );
      }

      const matched: DbJob[] = await query;

      if (matched.length === 0) {
        console.log(`[revocation] no active jobs creator=${creatorId}`);
        await writeAuditLog(creatorId, consentGrantId ?? null, !!killSwitch, 0, 0, Date.now() - t0);
        return;
      }

      const jobIds = matched.map((j) => j.id);
      const bullmqIds = matched
        .filter((j) => j.bullmqJobId)
        .map((j) => j.bullmqJobId as string);

      // Cancel BullMQ jobs (best-effort)
      const bullmqRemoved = await cancelBullMQJobs(bullmqIds, redisUrl);

      // Authoritative: mark all matched jobs cancelled in DB
      await db
        .update(generationJobsTable)
        .set({
          status: "cancelled",
          errorMessage: killSwitch ? "kill_switch" : "consent_revoked",
          completedAt: new Date(),
        })
        .where(inArray(generationJobsTable.id, jobIds));

      const sweepMs = Date.now() - t0;

      await writeAuditLog(
        creatorId,
        consentGrantId ?? null,
        !!killSwitch,
        jobIds.length,
        bullmqRemoved,
        sweepMs,
      );

      console.log(
        `[revocation] cancelled=${jobIds.length} bullmqRemoved=${bullmqRemoved} sweepMs=${sweepMs} creator=${creatorId}`,
      );
    },
    { connection: { url: redisUrl }, concurrency: CONCURRENCY },
  );

  worker.on("failed", (job, err) => {
    console.error(
      `[revocation] failed job=${job?.id} creator=${job?.data?.creatorId} error=${err.message}`,
    );
  });

  return worker;
}
