// Consent-revocation worker — OF-103
// Cancels all in-flight generation jobs within ≤60s SLA (PRD §8/§16).
// Highest priority (priority: 1) — picks up within ≤10s of enqueue.
import { Worker } from "bullmq";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProviderRegistry, ConsentRevocationPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";

const CONCURRENCY = 10;

interface DbJob {
  id: string;
  bullmq_job_id: string | null;
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
  supabase: SupabaseClient,
  creatorId: string,
  consentGrantId: string | null,
  killSwitch: boolean,
  jobsCancelled: number,
  bullmqRemoved: number,
  sweepMs: number,
): Promise<void> {
  const { error } = await supabase.from("audit_log").insert({
    creator_id: creatorId,
    event_type: killSwitch ? "kill_switch" : "consent_revoke",
    payload: {
      consent_grant_id: consentGrantId,
      jobs_cancelled: jobsCancelled,
      bullmq_removed: bullmqRemoved,
      sweep_ms: sweepMs,
    },
  });

  if (error) {
    console.error(`[revocation] audit log error: ${error.message}`);
  }
}

export function createWorker(
  _registry: ProviderRegistry,
  redisUrl: string,
  supabase: SupabaseClient,
): Worker<ConsentRevocationPayload> {
  const worker = new Worker<ConsentRevocationPayload>(
    QUEUE_NAMES.consentRevocation,
    async (job) => {
      const { creatorId, consentGrantId, killSwitch } = job.data;
      const t0 = Date.now();

      console.log(
        `[revocation] processing creator=${creatorId} killSwitch=${killSwitch} job=${job.id}`,
      );

      // Query matching active jobs
      let query = supabase
        .from("generation_jobs")
        .select("id, bullmq_job_id, status")
        .eq("creator_id", creatorId)
        .in("status", ["queued", "processing"]);

      if (!killSwitch && consentGrantId) {
        query = query.eq("consent_grant_id", consentGrantId);
      }

      const { data: jobs, error: queryErr } = await query;

      if (queryErr) {
        throw new Error(`[revocation] job query failed: ${queryErr.message}`);
      }

      const matched = (jobs ?? []) as DbJob[];

      if (matched.length === 0) {
        console.log(`[revocation] no active jobs creator=${creatorId}`);
        await writeAuditLog(supabase, creatorId, consentGrantId ?? null, !!killSwitch, 0, 0, Date.now() - t0);
        return;
      }

      const jobIds = matched.map((j) => j.id);
      const bullmqIds = matched.filter((j) => j.bullmq_job_id).map((j) => j.bullmq_job_id as string);

      // Cancel BullMQ jobs (best-effort)
      const bullmqRemoved = await cancelBullMQJobs(bullmqIds, redisUrl);

      // Authoritative: mark all matched jobs cancelled in DB
      const { error: updateErr } = await supabase
        .from("generation_jobs")
        .update({
          status: "cancelled",
          error_message: killSwitch ? "kill_switch" : "consent_revoked",
          completed_at: new Date().toISOString(),
        })
        .in("id", jobIds);

      if (updateErr) {
        throw new Error(`[revocation] db update failed: ${updateErr.message}`);
      }

      const sweepMs = Date.now() - t0;

      await writeAuditLog(
        supabase,
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
