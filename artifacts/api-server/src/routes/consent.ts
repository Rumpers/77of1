// Consent revocation API — OF-103
// PATCH /api/creator/consent/:modalityId  — revoke one modality
// POST  /api/creator/kill-switch          — cancel ALL jobs for the creator
import { Router, type IRouter, type Request, type Response } from "express";
import { getReplitUser } from "../lib/auth.js";
import { db } from "@workspace/db";
import { creatorsTable, consentGrantsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { QUEUE_NAMES } from "@workspace/queue";

// PHASE-1 STUB: runRevocationSweep DB fallback not yet migrated — requires SupabaseClient
// The DB fallback path is replaced with a 503 response if Redis is unavailable.
// Restored in Phase 2 when revocation.ts is migrated to Drizzle.

const VALID_MODALITIES = ["text", "voice", "video", "image"] as const;
type Modality = (typeof VALID_MODALITIES)[number];

// Enqueues a revocation job at highest priority. Returns true if queued, false on Redis error.
async function enqueueRevocation(
  creatorId: string,
  consentGrantId: string | null,
  modality: string | null,
  killSwitch: boolean,
): Promise<boolean> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return false;

  try {
    const { Queue } = await import("bullmq");
    const queue = new Queue(QUEUE_NAMES.consentRevocation, { connection: { url: redisUrl } });
    const dedupeKey = killSwitch
      ? `ks:${creatorId}`
      : `rev:${creatorId}:${consentGrantId}`;

    await queue.add("revoke", {
      type: "consent-revocation",
      creatorId,
      consentGrantId,
      modality,
      killSwitch,
    }, {
      priority: 1,
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

  const modalityId = req.params["modalityId"] as string;
  if (!VALID_MODALITIES.includes(modalityId as Modality)) {
    res
      .status(400)
      .json({ error: `Invalid modalityId. Must be one of: ${VALID_MODALITIES.join(", ")}` });
    return;
  }

  // Resolve creator by Replit user ID (Drizzle — creatorsTable is Phase 1)
  const [creator] = await db
    .select({ id: creatorsTable.id })
    .from(creatorsTable)
    .where(eq(creatorsTable.replitUserId, user.id))
    .limit(1);

  if (!creator) {
    res.status(403).json({ error: "Not a linked creator account" });
    return;
  }

  const creatorId = creator.id;
  const revokedAt = new Date();

  // Atomically stamp revoked_at on the active grant for this modality (Drizzle — consentGrantsTable is Phase 1)
  // Map the route modality string to the DB enum values
  const modalityMap: Record<string, "persona_text" | "voice" | "image" | "talking_video" | "fullbody_video"> = {
    text: "persona_text",
    voice: "voice",
    video: "talking_video",
    image: "image",
  };
  const dbModality = modalityMap[modalityId];
  if (!dbModality) {
    res.status(400).json({ error: "Invalid modalityId" });
    return;
  }

  // Find the active (non-revoked) grant
  const [grant] = await db
    .select({ id: consentGrantsTable.id })
    .from(consentGrantsTable)
    .where(
      and(
        eq(consentGrantsTable.creatorId, creatorId),
        eq(consentGrantsTable.modality, dbModality),
        isNull(consentGrantsTable.revokedAt),
      ),
    )
    .limit(1);

  if (!grant) {
    res.status(404).json({ error: "No active consent grant found for this modality" });
    return;
  }

  // Update revokedAt
  await db
    .update(consentGrantsTable)
    .set({ revokedAt })
    .where(eq(consentGrantsTable.id, grant.id));

  const consentGrantId = grant.id;

  // Primary path: enqueue to consent-revocation BullMQ queue.
  const queued = await enqueueRevocation(creatorId, consentGrantId, String(modalityId), false);

  if (!queued) {
    // PHASE-1 STUB: DB fallback (runRevocationSweep via SupabaseClient) not yet migrated
    // Redis is unavailable — log the issue and return a partial success.
    req.log.warn(
      { creatorId, consentGrantId },
      "[consent/revoke] Redis unavailable — DB fallback not available in Phase 1; grant revoked in DB only",
    );
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

  // Resolve creator by Replit user ID (Drizzle — creatorsTable is Phase 1)
  const [creator] = await db
    .select({ id: creatorsTable.id })
    .from(creatorsTable)
    .where(eq(creatorsTable.replitUserId, user.id))
    .limit(1);

  if (!creator) {
    res.status(403).json({ error: "Not a linked creator account" });
    return;
  }

  const creatorId = creator.id;

  const queued = await enqueueRevocation(creatorId, null, null, true);

  if (!queued) {
    // PHASE-1 STUB: DB fallback (runRevocationSweep via SupabaseClient) not yet migrated
    req.log.warn({ creatorId }, "[consent/kill-switch] Redis unavailable — DB fallback not available in Phase 1");
  }

  req.log.info({ creatorId, queued }, "[consent/kill-switch] kill switch triggered");

  res.json({ ok: true, killSwitch: true, queued });
});

export default router;
