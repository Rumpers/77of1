// DSAR deletion worker — COMPLY-04.
//
// 8-step destructive sweep triggered 24h after creator types /dsar in Hermes.
// kill_switch_active=true is already set by the Hermes scene before this job
// runs, so no new fan data can arrive during the grace window.
//
// Order invariants:
//   - DB deletes (steps 1-4) before twin/creator anonymize (steps 5,7)
//   - generation_jobs deleted BEFORE consent_grants (FK constraint)
//   - creator_deletion_log.completedAt written LAST (step 8)
//   - creatorsTable is NEVER deleted — only anonymized in place (Pitfall 4)
//
// Object Storage sweep (step 6) is best-effort — bucket misconfiguration or
// storage outage logs a warning and continues; DB sweeps are authoritative.

import { Worker } from "bullmq";
import {
  db,
  conversationMessagesTable,
  safetyAuditLogTable,
  generationJobsTable,
  consentGrantsTable,
  twinsTable,
  creatorsTable,
  creatorDeletionLogTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import type { ProviderRegistry, DsarDeletionPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";

const CONCURRENCY = 1;

async function sweepObjectStorage(creatorId: string): Promise<void> {
  const baseUrl = process.env.REPLIT_OBJECT_STORAGE_BASE_URL?.replace(/\/$/, "");
  const bucketName = process.env.REPLIT_OBJECT_STORAGE_BUCKET;
  const base = baseUrl ??
    (bucketName
      ? `https://storage.replit.com/v1/buckets/${encodeURIComponent(bucketName)}/objects`
      : null);

  if (!base) {
    console.warn(
      `[dsar] Object Storage sweep skipped — REPLIT_OBJECT_STORAGE_BUCKET not configured creator=${creatorId}`,
    );
    return;
  }

  try {
    const prefix = `creators/${creatorId}/`;
    const listRes = await fetch(`${base}?prefix=${encodeURIComponent(prefix)}`);
    if (!listRes.ok) {
      console.warn(
        `[dsar] Object Storage list failed status=${listRes.status} creator=${creatorId}`,
      );
      return;
    }
    const data = (await listRes.json()) as { objects?: Array<{ name: string }> };
    const objects = data.objects ?? [];
    for (const obj of objects) {
      const delRes = await fetch(`${base}/${encodeURIComponent(obj.name)}`, {
        method: "DELETE",
      });
      if (!delRes.ok) {
        console.warn(
          `[dsar] Object Storage delete failed key=${obj.name} status=${delRes.status} creator=${creatorId}`,
        );
      }
    }
    console.log(
      `[dsar] Object Storage sweep completed keys=${objects.length} creator=${creatorId}`,
    );
  } catch (err) {
    console.warn(
      `[dsar] Object Storage sweep failed (non-fatal) creator=${creatorId}: ${(err as Error).message}`,
    );
  }
}

export function createDsarDeletionWorker(
  _registry: ProviderRegistry,
  redisUrl: string,
): Worker<DsarDeletionPayload> {
  const worker = new Worker<DsarDeletionPayload>(
    QUEUE_NAMES.dsarDeletion,
    async (job) => {
      const { creatorId, auditId } = job.data;
      const t0 = Date.now();

      console.log(
        `[dsar] processing creator=${creatorId} auditId=${auditId} job=${job.id}`,
      );

      // Defense-in-depth: verify a Hermes-written audit row exists for this auditId.
      // Prevents a forged BullMQ job (attacker with Redis access) from deleting
      // another creator's data — only Hermes wizard writes the audit row.
      const auditRows = await db
        .select({ auditId: creatorDeletionLogTable.auditId })
        .from(creatorDeletionLogTable)
        .where(eq(creatorDeletionLogTable.auditId, auditId))
        .limit(1);

      if (auditRows.length === 0) {
        throw new Error(
          `[dsar] no audit row for auditId=${auditId} — possible forged job, aborting`,
        );
      }

      // Step 1: delete conversation_messages
      await db
        .delete(conversationMessagesTable)
        .where(eq(conversationMessagesTable.creatorId, creatorId));

      // Step 2: delete safety_audit_log
      await db
        .delete(safetyAuditLogTable)
        .where(eq(safetyAuditLogTable.creatorId, creatorId));

      // Step 3: delete generation_jobs (before consent_grants — FK dependency)
      await db
        .delete(generationJobsTable)
        .where(eq(generationJobsTable.creatorId, creatorId));

      // Step 4: delete consent_grants
      await db
        .delete(consentGrantsTable)
        .where(eq(consentGrantsTable.creatorId, creatorId));

      // Step 5: anonymize twins (characterCard + voiceReferenceUrl cleared)
      await db
        .update(twinsTable)
        .set({ characterCard: null, voiceReferenceUrl: null, status: "deleted" })
        .where(eq(twinsTable.creatorId, creatorId));

      // Step 6: sweep Object Storage prefix creators/{creatorId}/ (best-effort)
      await sweepObjectStorage(creatorId);

      // Step 7: anonymize creators row — NEVER delete (Pitfall 4: no FK cascade
      // to creator_deletion_log; row must survive as audit anchor)
      await db
        .update(creatorsTable)
        .set({
          displayName: "DELETED",
          telegramUserId: null,
          replitUserId: null,
          monetizationUrl: null,
          config: {},
          updatedAt: new Date(),
        })
        .where(eq(creatorsTable.id, creatorId));

      const sweepLatencyMs = Date.now() - t0;
      if (sweepLatencyMs > 60_000) {
        console.error(
          `[dsar] WARN sweep exceeded 60s SLA sweepMs=${sweepLatencyMs} creator=${creatorId}`,
        );
      }

      // Step 8: write audit completion LAST — null completedAt on failure triggers retry
      await db
        .update(creatorDeletionLogTable)
        .set({ completedAt: new Date(), sweepLatencyMs })
        .where(eq(creatorDeletionLogTable.auditId, auditId));

      console.log(
        `[dsar] completed creator=${creatorId} auditId=${auditId} sweepMs=${sweepLatencyMs}`,
      );
    },
    { connection: { url: redisUrl }, concurrency: CONCURRENCY },
  );

  worker.on("failed", (job, err) => {
    console.error(
      `[dsar] failed job=${job?.id} creator=${job?.data?.creatorId} auditId=${job?.data?.auditId} error=${err.message}`,
    );
  });

  return worker;
}
