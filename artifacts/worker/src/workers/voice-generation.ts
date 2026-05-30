// Voice-generation worker — GMI TTS async queue + Telegram sendAudio delivery.
// Lifecycle: queued → processing → complete | failed | cancelled
//
// Pipeline (03-06 / VOICE-01, VOICE-02):
//   1. Mark processing
//   2. Cancellation check (consent-revocation interlock)
//   3. SB 243 self-harm short-circuit — abort voice if recent self-harm audit entry
//   4. Load creator + twin; resolve voice_id (clone or fallback preset)
//   5. Pre-call consent check (creator_kyc.voice_synthesis_consent_granted +
//      active consent_grants(voice) row)
//   -- HANDOFF: Task 3b --
//   6. Call gmiTtsBreaker.fire() — submit→poll→fetch inside the client
//   7. Mid-flight consent recheck (Pitfall 7 — IMMEDIATELY before storage write)
//   8. Object Storage upload — creators/{creatorId}/generations/{jobDbId}.mp3
//   9. Set result_url (storage key, NOT the raw GCS URL — 03-07 wraps with HMAC)
//   -- HANDOFF: Task 3c --
//   10. Telegram delivery via bot.telegram.sendAudio (mp3 ≠ voice note)
//   11. Mark complete
//   12. Failure handler

import { Worker } from "bullmq";
import { Telegraf } from "telegraf";
import { db, generationJobsTable, twinsTable, creatorsTable, creatorKycTable, consentGrantsTable, safetyAuditLogTable } from "@workspace/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { createHash } from "crypto";
import type { ProviderRegistry, VoiceGenerationPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";
import { gmiTtsBreaker, type GmiTtsInput } from "@workspace/providers";
import { getDisclosureFooter } from "@workspace/twin-runtime/disclosure";
import { logger } from "@workspace/twin-runtime/logger";
import type { Locale } from "@workspace/twin-runtime/locale";

// ─── Object Storage (via raw fetch — mirrors hermes/src/lib/object-storage.ts) ─
// @replit/object-storage SDK is not yet installed (03-01 Task 2 deployment gate
// is pending). We use the same raw PUT pattern as hermes for consistency.
// [Rule 3 deviation: @replit/object-storage listed as precondition but absent;
//  using the hermes fetch-based pattern which is confirmed working in production]

async function uploadMp3ToObjectStorage(
  key: string,
  audioBytes: Buffer,
): Promise<void> {
  const bucket = process.env["REPLIT_OBJECT_STORAGE_BUCKET"];
  const baseOverride = process.env["REPLIT_OBJECT_STORAGE_BASE_URL"];

  if (!bucket && !baseOverride) {
    throw new Error(
      "REPLIT_OBJECT_STORAGE_BUCKET (or REPLIT_OBJECT_STORAGE_BASE_URL) is not set — " +
      "cannot upload voice file"
    );
  }

  const base = baseOverride
    ? baseOverride.replace(/\/$/, "")
    : `https://storage.replit.com/v1/buckets/${encodeURIComponent(bucket!)}/objects`;

  const url = `${base}/${key}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "audio/mpeg" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: audioBytes as any,
  });

  if (!res.ok) {
    throw new Error(
      `Object Storage PUT ${key} returned ${res.status} ${res.statusText}`
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashFanId(fanId: string): string {
  return createHash("sha256").update(`fan:${fanId}`, "utf8").digest("hex").slice(0, 32);
}

// ─── Outbound Telegraf client (NO .launch()) ─────────────────────────────────
// Module-scope singleton — same pattern as text-generation.ts.
let _fanTwinOut: Telegraf | null = null;
function getFanTwinOut(): Telegraf {
  if (_fanTwinOut) return _fanTwinOut;
  const token = process.env.TELEGRAM_BOT_TOKEN_FAN_TWIN;
  if (!token) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN_FAN_TWIN is not set — required for voice Telegram delivery"
    );
  }
  _fanTwinOut = new Telegraf(token);
  return _fanTwinOut;
}

// ─── DB queries ──────────────────────────────────────────────────────────────

async function findActiveVoiceConsentGrantWorker(
  creatorId: string,
): Promise<{ id: string } | null> {
  const rows = await db
    .select({ id: consentGrantsTable.id })
    .from(consentGrantsTable)
    .where(
      and(
        eq(consentGrantsTable.creatorId, creatorId),
        eq(consentGrantsTable.modality, "voice"),
        eq(consentGrantsTable.granted, true),
        isNull(consentGrantsTable.revokedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function checkVoiceConsentOk(creatorId: string): Promise<boolean> {
  // Check 1: creator_kyc.voice_synthesis_consent_granted must be true
  const kycRow = await db
    .select({ voiceSynthesisConsentGranted: creatorKycTable.voiceSynthesisConsentGranted })
    .from(creatorKycTable)
    .where(eq(creatorKycTable.creatorId, creatorId))
    .limit(1)
    .then((rows: Array<{ voiceSynthesisConsentGranted: boolean }>) => rows[0] ?? null);

  if (!kycRow || !kycRow.voiceSynthesisConsentGranted) return false;

  // Check 2: active consent_grants(modality=voice, granted=true, revokedAt IS NULL)
  const grant = await findActiveVoiceConsentGrantWorker(creatorId);
  return grant !== null;
}

// ─── CONCURRENCY ──────────────────────────────────────────────────────────────
const CONCURRENCY = 5;

// ─── Worker ──────────────────────────────────────────────────────────────────

export function createWorker(
  _registry: ProviderRegistry,
  redisUrl: string,
): Worker<VoiceGenerationPayload> {
  const worker = new Worker<VoiceGenerationPayload>(
    QUEUE_NAMES.voiceGeneration,
    async (job) => {
      const payload = job.data;
      const { jobDbId, creatorId, fanId } = payload;
      const fanIdHash = hashFanId(fanId);

      // ── Step 1: Mark processing ────────────────────────────────────────────
      await db
        .update(generationJobsTable)
        .set({
          status: "processing",
          bullmqJobId: job.id,
          attemptCount: job.attemptsMade + 1,
        })
        .where(eq(generationJobsTable.id, jobDbId));

      logger.info(
        { event: "voice-gen.start", jobDbId, creatorId, fanIdHash, attempt: job.attemptsMade + 1 },
        "[voice-gen] start",
      );

      // ── Step 2: Cancellation check (consent-revocation interlock) ─────────
      // The consent-revocation worker sets job.data.cancelled when it kills
      // in-flight jobs for a revoked consent grant.
      if ((payload as unknown as { cancelled?: boolean }).cancelled) {
        await db
          .update(generationJobsTable)
          .set({ status: "cancelled", errorMessage: "cancelled-by-revocation", completedAt: new Date() })
          .where(eq(generationJobsTable.id, jobDbId));
        logger.info({ jobDbId }, "[voice-gen] cancelled by revocation interlock");
        return;
      }

      // ── Step 3: SB 243 self-harm short-circuit ────────────────────────────
      // Query the most recent safety_audit_log row for this (creatorId, fanIdHash)
      // within the past 60 seconds. If it has crisis_type="self-harm" OR
      // categoryScores['self-harm'] > 0.5, abort voice — do NOT call GMI TTS.
      // (Defense in depth beyond L3's deflection swap — RESEARCH Security Domain)
      {
        const sixtySecondsAgo = new Date(Date.now() - 60_000);
        const recentAudit = await db
          .select({
            crisisType: safetyAuditLogTable.crisisType,
            categoryScores: safetyAuditLogTable.categoryScores,
          })
          .from(safetyAuditLogTable)
          .where(
            and(
              eq(safetyAuditLogTable.creatorId, creatorId),
              eq(safetyAuditLogTable.fanIdHash, fanIdHash),
            ),
          )
          .orderBy(desc(safetyAuditLogTable.createdAt))
          .limit(1)
          .then(
            (rows: Array<{ crisisType: string | null; categoryScores: unknown }>) =>
              rows[0] ?? null,
          );

        if (recentAudit) {
          const isSelfHarmType =
            recentAudit.crisisType === "self-harm" ||
            (typeof recentAudit.crisisType === "string" &&
              recentAudit.crisisType.startsWith("self-harm"));

          const scores = recentAudit.categoryScores as Record<string, number> | null;
          const selfHarmScore = scores?.["self-harm"] ?? 0;

          if (isSelfHarmType || selfHarmScore > 0.5) {
            await db
              .update(generationJobsTable)
              .set({
                status: "failed",
                errorMessage: "self-harm-defense-in-depth",
                completedAt: new Date(),
              })
              .where(eq(generationJobsTable.id, jobDbId));
            logger.warn(
              { jobDbId, crisisType: recentAudit.crisisType, selfHarmScore },
              "[voice-gen] SB 243 self-harm defense-in-depth: voice aborted",
            );
            return;
          }
        }
      }

      // ── Step 4: Load creator + twin; resolve voice_id ─────────────────────
      const creatorRow = await db
        .select({ id: creatorsTable.id, handle: creatorsTable.handle })
        .from(creatorsTable)
        .where(eq(creatorsTable.id, creatorId))
        .limit(1)
        .then((rows: Array<{ id: string; handle: string }>) => rows[0] ?? null);

      if (!creatorRow) {
        await db
          .update(generationJobsTable)
          .set({ status: "failed", errorMessage: "creator-not-found", completedAt: new Date() })
          .where(eq(generationJobsTable.id, jobDbId));
        return;
      }

      const twinRow = await db
        .select({
          id: twinsTable.id,
          voiceReferenceUrl: twinsTable.voiceReferenceUrl,
          voiceId: twinsTable.voiceId,
        })
        .from(twinsTable)
        .where(eq(twinsTable.creatorId, creatorId))
        .limit(1)
        .then(
          (rows: Array<{ id: string; voiceReferenceUrl: string | null; voiceId: string | null }>) =>
            rows[0] ?? null,
        );

      if (!twinRow || !twinRow.voiceReferenceUrl) {
        await db
          .update(generationJobsTable)
          .set({ status: "failed", errorMessage: "no-reference", completedAt: new Date() })
          .where(eq(generationJobsTable.id, jobDbId));
        logger.info({ jobDbId, creatorId }, "[voice-gen] no voice_reference_url — skip");
        return;
      }

      // Resolve synth voice_id: use twin's cloned voice_id when present (clone Step A),
      // else fall back to preset GMI_TTS_FALLBACK_VOICE_ID (testable before onboarding).
      const resolvedVoiceId =
        twinRow.voiceId ??
        process.env["GMI_TTS_FALLBACK_VOICE_ID"] ??
        "English_expressive_narrator";

      // ── Step 5: Pre-call consent check ────────────────────────────────────
      const consentOk = await checkVoiceConsentOk(creatorId);
      if (!consentOk) {
        await db
          .update(generationJobsTable)
          .set({ status: "cancelled", errorMessage: "consent-revoked", completedAt: new Date() })
          .where(eq(generationJobsTable.id, jobDbId));
        logger.info({ jobDbId, creatorId }, "[voice-gen] pre-call consent check failed");
        return;
      }

      // HANDOFF: Task 3b — breaker call begins below

      // ── Step 6: Call the breaker (submit→poll→fetch inside the client) ────
      const ttsInput: GmiTtsInput = {
        text: payload.transcript,
        voiceId: resolvedVoiceId,
        language: payload.language,
        creatorId: creatorId,
      };

      const ttsOut = await gmiTtsBreaker.fire(ttsInput);

      if (ttsOut === null) {
        // Breaker open or fallback fired — no audio. Text reply already went out.
        await db
          .update(generationJobsTable)
          .set({ status: "failed", errorMessage: "circuit-open", completedAt: new Date() })
          .where(eq(generationJobsTable.id, jobDbId));
        logger.warn({ jobDbId }, "[voice-gen] circuit breaker open — voice skipped, text-only");
        return;
      }
      // ttsOut.audioBytes are the mp3 bytes the client fetched from outcome.media_urls[0].url

      // ── Step 7: Mid-flight consent recheck (Pitfall 7 — IMMEDIATELY before storage write)
      // Re-query the same consent predicates as pre-call check (Step 5).
      // If consent was revoked between Step 5 and now, discard audio bytes.
      const consentStillOk = await checkVoiceConsentOk(creatorId);
      if (!consentStillOk) {
        // Discard ttsOut.audioBytes — never write to storage.
        await db
          .update(generationJobsTable)
          .set({ status: "cancelled", errorMessage: "consent-revoked-mid-flight", completedAt: new Date() })
          .where(eq(generationJobsTable.id, jobDbId));
        logger.info({ jobDbId, creatorId }, "[voice-gen] mid-flight consent revoked — audio discarded");
        return;
      }

      // ── Step 8: Object Storage upload — .mp3 (D-02-13 storage path pattern) ─
      if (!process.env["REPLIT_OBJECT_STORAGE_BUCKET"] && !process.env["REPLIT_OBJECT_STORAGE_BASE_URL"]) {
        await db
          .update(generationJobsTable)
          .set({ status: "failed", errorMessage: "storage-unavailable", completedAt: new Date() })
          .where(eq(generationJobsTable.id, jobDbId));
        logger.warn({ jobDbId }, "[voice-gen] REPLIT_OBJECT_STORAGE_BUCKET not set — storage unavailable");
        return;
      }

      const storageKey = `creators/${creatorId}/generations/${jobDbId}.mp3`;
      await uploadMp3ToObjectStorage(storageKey, ttsOut.audioBytes);

      logger.info(
        { jobDbId, storageKey, audioSize: ttsOut.audioBytes.length },
        "[voice-gen] mp3 uploaded to object storage",
      );

      // ── Step 9: Set result_url (storage key — NOT the raw GCS URL) ─────────
      // 03-07 wraps it with HMAC + TTL; never expose the raw GCS URL to the fan.
      await db
        .update(generationJobsTable)
        .set({ resultUrl: storageKey })
        .where(eq(generationJobsTable.id, jobDbId));

      // HANDOFF: Task 3c — delivery & completion below

      // ── Step 10: Telegram delivery (if deliveryChannel === "telegram") ─────
      if (payload.deliveryChannel === "telegram") {
        const locale = (payload.language ?? "en") as Locale;
        const handle = payload.handle ?? creatorRow.handle;

        // Always use sendAudio for mp3. mp3 is NOT a valid Telegram voice note
        // (sendVoice requires OGG/Opus encoding).
        // DEFERRED: sendVoice (OGG/Opus) requires transcoding mp3→opus — not added in 03-06.
        const caption = `${payload.transcript}\n\n— ${getDisclosureFooter(locale, handle)}`;

        try {
          const fanTwinOut = getFanTwinOut();
          if (payload.telegramChatId) {
            await fanTwinOut.telegram.sendAudio(
              payload.telegramChatId,
              { source: ttsOut.audioBytes },
              { caption },
            );
            logger.info({ jobDbId, chatId: payload.telegramChatId }, "[voice-gen] sent audio via Telegram");
          }
        } catch (sendErr) {
          // Delivery failure: audio is in storage; don't throw — job is still complete.
          logger.error(
            { jobDbId, err: (sendErr as Error).message },
            "[voice-gen] Telegram sendAudio failed — audio in storage, delivery skipped",
          );
        }
      }
      // Web path: fan-page polls /api/voice/:jobId (03-07 proxy) — no delivery needed here.

      // ── Step 11: Mark complete ─────────────────────────────────────────────
      // Terminal status is "complete" per the generationJobStatus enum.
      await db
        .update(generationJobsTable)
        .set({ status: "complete", completedAt: new Date() })
        .where(eq(generationJobsTable.id, jobDbId));

      logger.info({ jobDbId }, "[voice-gen] complete");
    },
    { connection: { url: redisUrl }, concurrency: CONCURRENCY },
  );

  // ── Step 12: Failure handler ───────────────────────────────────────────────
  // Mirror the text-generation.ts pattern: increment attemptCount on transient,
  // mark status=failed on final attempt. Breaker events are logged by the breaker itself.
  worker.on("failed", async (job, err) => {
    if (!job) return;
    const isFinal = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (isFinal) {
      await db
        .update(generationJobsTable)
        .set({
          status: "failed",
          errorMessage: err.message,
          completedAt: new Date(),
        })
        .where(eq(generationJobsTable.id, job.data.jobDbId));
    } else {
      await db
        .update(generationJobsTable)
        .set({ attemptCount: job.attemptsMade })
        .where(eq(generationJobsTable.id, job.data.jobDbId));
    }
    logger.error(
      { event: "voice-gen.failed", jobId: job.id, jobDbId: job.data.jobDbId, attempt: job.attemptsMade, err: err.message },
      "[voice-gen] failed",
    );
  });

  return worker;
}
