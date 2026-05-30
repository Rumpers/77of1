// Voice enqueue helpers — 03-06 / VOICE-01, VOICE-02
//
// Shared helpers for checking voice consent + enqueuing a voice-generation
// BullMQ job. Used by:
//   - artifacts/api-server/src/routes/twin.ts (03-07)
//   - artifacts/worker/src/workers/text-generation.ts (03-07)
//
// Wiring into callers is intentionally deferred to 03-07 so the HMAC proxy
// URL helper can be combined into one focused commit.
//
// shouldGenerateVoice: returns true when ALL of:
//   - twin.voiceReferenceUrl is not null (voice reference uploaded)
//   - creator_kyc.voice_synthesis_consent_granted === true
//   - active consent_grants row exists (modality=voice, granted=true, revokedAt IS NULL)
//   - creators.kill_switch_active === false
//   Returns false on any DB error (defensive — better to skip voice than crash text path)
//
// enqueueVoiceJob: creates a generation_jobs row (status=queued, kind=voice)
//   and adds a BullMQ job to the voiceGeneration queue.

import { Queue } from "bullmq";
import { QUEUE_NAMES, type VoiceGenerationPayload } from "@workspace/queue";

// ─── DB imports (lazy — PATTERNS S1 — avoids DATABASE_URL at module load) ────

async function getDb() {
  const mod = await import("@workspace/db");
  const { eq, and, isNull } = await import("drizzle-orm");
  return { ...mod, eq, and, isNull };
}

// ─── shouldGenerateVoice ──────────────────────────────────────────────────────

export interface TwinVoiceCheck {
  voiceReferenceUrl: string | null;
}

/**
 * Returns true when voice synthesis is enabled for this creator/twin pair.
 * Checks consent, KYC voice flag, reference clip, and kill switch.
 * Returns false on any DB error — better to skip voice than crash the text path.
 */
export async function shouldGenerateVoice(
  creatorId: string,
  twin: TwinVoiceCheck,
): Promise<boolean> {
  try {
    // ── Check 1: voice reference clip must exist ───────────────────────────
    if (!twin.voiceReferenceUrl) return false;

    const {
      db,
      creatorsTable,
      creatorKycTable,
      consentGrantsTable,
      eq,
      and,
      isNull,
    } = await getDb();

    // ── Check 2: kill_switch_active must be false ──────────────────────────
    const creatorRow = await db
      .select({ killSwitchActive: creatorsTable.killSwitchActive })
      .from(creatorsTable)
      .where(eq(creatorsTable.id, creatorId))
      .limit(1)
      .then(
        (rows: Array<{ killSwitchActive: boolean }>) => rows[0] ?? null,
      );

    if (!creatorRow || creatorRow.killSwitchActive) return false;

    // ── Check 3: creator_kyc.voice_synthesis_consent_granted must be true ─
    const kycRow = await db
      .select({ voiceSynthesisConsentGranted: creatorKycTable.voiceSynthesisConsentGranted })
      .from(creatorKycTable)
      .where(eq(creatorKycTable.creatorId, creatorId))
      .limit(1)
      .then(
        (rows: Array<{ voiceSynthesisConsentGranted: boolean }>) => rows[0] ?? null,
      );

    if (!kycRow || !kycRow.voiceSynthesisConsentGranted) return false;

    // ── Check 4: active consent_grants row (voice, granted, not revoked) ──
    const grant = await db
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
      .limit(1)
      .then((rows: Array<{ id: string }>) => rows[0] ?? null);

    return grant !== null;
  } catch (_err) {
    // Defensive: any DB error → skip voice (do not crash text path)
    return false;
  }
}

// ─── enqueueVoiceJob ──────────────────────────────────────────────────────────

export interface EnqueueVoiceJobArgs {
  /** UUID from crypto.randomUUID() — caller generates before calling */
  jobDbId: string;
  creatorId: string;
  fanIdHash: string;
  transcript: string;
  locale: "en" | "ja" | "zh-TW";
  conversationId: string;
  deliveryChannel: "web" | "telegram";
  telegramChatId?: number;
  handle?: string;
  twinId?: string;
}

// Lazy Redis URL singleton for the BullMQ queue.
// Matches the same REDIS_URL env var used in the worker and api-server.
let _voiceQueue: Queue<VoiceGenerationPayload> | null = null;
function getVoiceQueue(): Queue<VoiceGenerationPayload> {
  if (_voiceQueue) return _voiceQueue;
  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) throw new Error("REDIS_URL is required to enqueue voice jobs");
  _voiceQueue = new Queue<VoiceGenerationPayload>(QUEUE_NAMES.voiceGeneration, {
    connection: { url: redisUrl },
  });
  return _voiceQueue;
}

/**
 * Create a generation_jobs row (status=queued, jobType=voice) and add a
 * BullMQ job to the voiceGeneration queue. Returns void — job id is in args.jobDbId.
 *
 * Note: this function writes the DB row but does NOT validate consent — the
 * caller must call shouldGenerateVoice() first. The worker re-checks consent
 * at execution time (pre-call + mid-flight).
 */
export async function enqueueVoiceJob(args: EnqueueVoiceJobArgs): Promise<void> {
  const { db, generationJobsTable, consentGrantsTable, creatorsTable, creatorKycTable, eq, and, isNull } =
    await getDb();

  // Find the active voice consent grant id (required FK on generation_jobs).
  const grant = await db
    .select({ id: consentGrantsTable.id, version: consentGrantsTable.version })
    .from(consentGrantsTable)
    .where(
      and(
        eq(consentGrantsTable.creatorId, args.creatorId),
        eq(consentGrantsTable.modality, "voice"),
        eq(consentGrantsTable.granted, true),
        isNull(consentGrantsTable.revokedAt),
      ),
    )
    .limit(1)
    .then((rows: Array<{ id: string; version: number }>) => rows[0] ?? null);

  if (!grant) {
    throw new Error(
      `enqueueVoiceJob: no active voice consent grant for creator=${args.creatorId}`
    );
  }

  // Create the generation_jobs row.
  await db.insert(generationJobsTable).values({
    id: args.jobDbId,
    creatorId: args.creatorId,
    consentGrantId: grant.id,
    jobType: "voice",
    status: "queued",
    consentGrantVersion: grant.version,
    retentionCategory: "operational",
  });

  // Build the BullMQ payload — mirrors VoiceGenerationPayload in lib/queue/src/types.ts.
  const jobPayload: VoiceGenerationPayload = {
    type: "voice-generation",
    jobDbId: args.jobDbId,
    creatorId: args.creatorId,
    fanId: args.fanIdHash, // fanIdHash used as fanId in voice jobs (hashed at call site)
    consentGrantVersion: String(grant.version),
    transcript: args.transcript,
    language: args.locale,
    conversationId: args.conversationId,
    deliveryChannel: args.deliveryChannel,
    telegramChatId: args.telegramChatId,
    handle: args.handle,
    twinId: args.twinId,
  };

  const queue = getVoiceQueue();
  await queue.add("voice-generation", jobPayload);
}
