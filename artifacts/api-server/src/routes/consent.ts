// Consent revocation API — OF-103
// PATCH /api/creator/consent/:modalityId  — revoke one modality
// POST  /api/creator/kill-switch          — cancel ALL jobs for the creator
import { Router, type IRouter, type Request, type Response } from "express";
import { getReplitUser } from "../lib/auth.js";
import { getSupabase } from "../lib/supabase.js";
import { runRevocationSweep, type RevocationPayload } from "../workers/revocation.js";
import { QUEUE_NAMES } from "@workspace/queue";

const VALID_MODALITIES = ["text", "voice", "video", "image"] as const;
type Modality = (typeof VALID_MODALITIES)[number];

// Enqueues a revocation job at highest priority. Returns true if queued, false on Redis error.
async function tryEnqueue(payload: RevocationPayload): Promise<boolean> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return false;

  try {
    const { Queue } = await import("bullmq");
    const queue = new Queue(QUEUE_NAMES.consentRevocation, { connection: { url: redisUrl } });
    const dedupeKey = payload.killSwitch
      ? `ks:${payload.creatorId}`
      : `rev:${payload.creatorId}:${payload.consentGrantId}`;

    await queue.add("revoke", payload, {
      priority: 1,  // highest — picked up before generation jobs
      jobId: dedupeKey,
      attempts: 5,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: { count: 500, age: 86400 },
    });
    await queue.close();
    return true;
  } catch {
    return false;
  }
}

const router: IRouter = Router();

// PATCH /api/creator/consent/:modalityId
// Revokes a specific consent grant and cancels all matching in-flight jobs.
router.patch("/creator/consent/:modalityId", async (req: Request, res: Response) => {
  const user = getReplitUser(req);
  if (!user) {
    res.status(401).json({ error: "Creator auth required" });
    return;
  }

  const { modalityId } = req.params;
  if (!VALID_MODALITIES.includes(modalityId as Modality)) {
    res
      .status(400)
      .json({ error: `Invalid modalityId. Must be one of: ${VALID_MODALITIES.join(", ")}` });
    return;
  }

  let db: ReturnType<typeof getSupabase>;
  try {
    db = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const { data: creator, error: creatorErr } = await db
    .from("creators")
    .select("id")
    .eq("replit_user_id", user.id)
    .maybeSingle();

  if (creatorErr || !creator) {
    res.status(403).json({ error: "Not a linked creator account" });
    return;
  }

  const creatorId = creator.id as string;
  const revokedAt = new Date().toISOString();

  // Atomically stamp revoked_at on the active grant for this modality.
  const { data: grant, error: revokeErr } = await db
    .from("consent_grants")
    .update({ revoked_at: revokedAt })
    .eq("creator_id", creatorId)
    .eq("modality", modalityId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (revokeErr) {
    req.log.error({ err: revokeErr.message }, "[consent/revoke] db update error");
    res.status(500).json({ error: "Failed to revoke consent" });
    return;
  }

  if (!grant) {
    res.status(404).json({ error: "No active consent grant found for this modality" });
    return;
  }

  const consentGrantId = grant.id as string;
  const payload: RevocationPayload = {
    type: "consent-revocation",
    creatorId,
    consentGrantId,
    modality: modalityId,
    killSwitch: false,
  };

  // Primary path: enqueue to consent-revocation BullMQ queue.
  const queued = await tryEnqueue(payload);

  if (!queued) {
    // DB fallback: Redis unavailable — run the sweep synchronously before returning.
    // The ≤60s SLA is met because we complete inline.
    req.log.warn(
      { creatorId, consentGrantId },
      "[consent/revoke] Redis unavailable — running DB fallback sweep",
    );
    await runRevocationSweep(db, { creatorId, consentGrantId, killSwitch: false }, req.log);
  }

  req.log.info(
    { creatorId, consentGrantId, modalityId, queued },
    "[consent/revoke] revocation initiated",
  );

  res.json({ ok: true, modalityId, consentGrantId, queued });
});

// POST /api/creator/kill-switch
// Cancels ALL in-flight generation jobs for the creator regardless of modality (§16 kill switch).
router.post("/creator/kill-switch", async (req: Request, res: Response) => {
  const user = getReplitUser(req);
  if (!user) {
    res.status(401).json({ error: "Creator auth required" });
    return;
  }

  let db: ReturnType<typeof getSupabase>;
  try {
    db = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const { data: creator, error: creatorErr } = await db
    .from("creators")
    .select("id")
    .eq("replit_user_id", user.id)
    .maybeSingle();

  if (creatorErr || !creator) {
    res.status(403).json({ error: "Not a linked creator account" });
    return;
  }

  const creatorId = creator.id as string;
  const payload: RevocationPayload = {
    type: "consent-revocation",
    creatorId,
    consentGrantId: null,
    modality: null,
    killSwitch: true,
  };

  const queued = await tryEnqueue(payload);

  if (!queued) {
    req.log.warn({ creatorId }, "[consent/kill-switch] Redis unavailable — DB fallback sweep");
    await runRevocationSweep(db, { creatorId, consentGrantId: null, killSwitch: true }, req.log);
  }

  req.log.info({ creatorId, queued }, "[consent/kill-switch] kill switch triggered");

  res.json({ ok: true, killSwitch: true, queued });
});

export default router;
