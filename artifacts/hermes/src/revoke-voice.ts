// /revoke_voice orchestration helper (ONBOARD-03).
//
// Extracted out of index.ts so it's directly unit-testable without mounting
// the Telegraf bot. The /revoke_voice command in index.ts is a thin wrapper
// that resolves the creator (by Telegram user id) and calls revokeVoice(...).
//
// Flow:
//   1. findActiveVoiceConsentGrant(creatorId) → null means nothing to revoke
//   2. markVoiceConsentRevoked(grantId) → sets granted=false, revokedAt=now()
//   3. clearVoiceReferenceUrl(creatorId) → nulls twins.voice_reference_url
//   4. enqueueRevocation → BullMQ consent-revocation job (priority 1)
//      Worker (artifacts/worker/src/workers/consent-revocation.ts) sweeps any
//      in-flight voice-generation jobs scoped to the revoked consent grant.
//
// SLA: ONBOARD-03 mandates the in-flight sweep completes within 60s of /revoke_voice
// reply. The DB write is the SLA-critical part visible from Hermes; the worker
// sweep is the SLA-critical part owned by artifacts/worker (which logs its own
// elapsed time and warns at >60s).
//
// Redis disposition (mirrors api-server/routes/consent.ts):
//   - REDIS_URL unset OR Queue.add throws → queued=false; the DB grant update
//     is still authoritative (granted=false, revokedAt set), so consent is
//     legally revoked even if the worker never runs. The founder should restart
//     Redis manually in that case; a future Phase 4 metric alerts on this.

import {
  findActiveVoiceConsentGrant,
  markVoiceConsentRevoked,
  clearVoiceReferenceUrl,
} from "./db.js";
import { QUEUE_NAMES, type ConsentRevocationPayload } from "@workspace/queue";

const SLA_DB_WRITE_WARN_MS = 2000;

export interface RevokeVoiceResult {
  ok: boolean;
  reason?: "no_active_grant";
  consentGrantId?: string;
  queued?: boolean;
  dbWriteMs?: number;
  elapsedMs?: number;
}

async function enqueueRevocation(
  creatorId: string,
  consentGrantId: string,
): Promise<boolean> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return false;

  try {
    const { Queue } = await import("bullmq");
    const queue = new Queue(QUEUE_NAMES.consentRevocation, {
      connection: { url: redisUrl },
    });
    const payload: ConsentRevocationPayload = {
      type: "consent-revocation",
      creatorId,
      consentGrantId,
      modality: "voice",
      killSwitch: false,
    };
    try {
      await queue.add("revoke", payload, {
        priority: 1,
        // Dedupe: identical /revoke_voice invocations within the BullMQ
        // retention window collapse into one job.
        jobId: `rev:${creatorId}:${consentGrantId}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { count: 500, age: 86400 },
      });
      return true;
    } finally {
      await queue.close();
    }
  } catch (err) {
    console.error(
      `[hermes] /revoke_voice enqueue failed creator=${creatorId} grant=${consentGrantId}: ${(err as Error).message}`,
    );
    return false;
  }
}

export async function revokeVoice(creatorId: string): Promise<RevokeVoiceResult> {
  const t0 = Date.now();

  const grant = await findActiveVoiceConsentGrant(creatorId);
  if (!grant) {
    return { ok: false, reason: "no_active_grant" };
  }

  const { elapsed: dbWriteMs } = await markVoiceConsentRevoked(grant.id);
  if (dbWriteMs > SLA_DB_WRITE_WARN_MS) {
    console.error(
      `[hermes] WARN /revoke_voice db write took ${dbWriteMs}ms — approaching SLA (creator=${creatorId})`,
    );
  }

  await clearVoiceReferenceUrl(creatorId);

  const queued = await enqueueRevocation(creatorId, grant.id);

  const elapsedMs = Date.now() - t0;
  console.log(
    `[hermes] /revoke_voice creator=${creatorId} grant=${grant.id} queued=${queued} db_write_ms=${dbWriteMs} total_ms=${elapsedMs}`,
  );

  return {
    ok: true,
    consentGrantId: grant.id,
    queued,
    dbWriteMs,
    elapsedMs,
  };
}
