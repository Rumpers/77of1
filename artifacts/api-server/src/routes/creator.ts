import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { generationJobsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireCreatorAuth } from "../middlewares/require-creator-auth.js";

const router: IRouter = Router();

const GENERIC_ERROR_MAP: Record<string, string> = {
  consent_revoked: "Generation stopped — creator consent was revoked.",
  consent_pending: "Generation pending consent approval.",
  consent_expired: "Generation stopped — consent expired.",
  insufficient_credits: "Fan had insufficient credits.",
  provider_error: "AI generation failed. Will retry automatically.",
  moderation_block: "Content blocked by safety filters.",
};

function toFanFacingError(rawError: string | null): string {
  if (!rawError) return "Generation failed. Will retry automatically.";
  const key = Object.keys(GENERIC_ERROR_MAP).find((k) =>
    rawError.toLowerCase().includes(k),
  );
  return key ? GENERIC_ERROR_MAP[key]! : "Generation failed. Will retry automatically.";
}

// GET /api/creator/jobs/failed
// Returns generation_jobs with status='dlq' for the authenticated creator.
// Uses Drizzle — generationJobsTable is Phase 1.
router.get("/creator/jobs/failed", requireCreatorAuth, async (req: Request, res: Response) => {
  const creatorId = res.locals.creatorId as string;

  const jobs = await db
    .select({
      id: generationJobsTable.id,
      jobType: generationJobsTable.jobType,
      errorMessage: generationJobsTable.errorMessage,
      createdAt: generationJobsTable.createdAt,
      status: generationJobsTable.status,
    })
    .from(generationJobsTable)
    .where(
      and(
        eq(generationJobsTable.creatorId, creatorId),
        eq(generationJobsTable.status, "dlq"),
      ),
    )
    .orderBy(generationJobsTable.createdAt)
    .limit(50);

  const result = jobs.map((j) => ({
    id: j.id,
    modality: j.jobType,
    error: toFanFacingError(j.errorMessage),
    created_at: j.createdAt?.toISOString() ?? null,
    fan_facing_status: "Failed",
  }));

  res.json({ jobs: result });
});

// GET /api/creator/notifications
// PHASE-1 STUB: creator_notifications not in @workspace/db — restored in Phase 2
router.get("/creator/notifications", requireCreatorAuth, async (_req: Request, res: Response) => {
  // PHASE-1 STUB: creator_notifications table not in Phase 1 schema
  // Return a sensible default (no DLQ alerts) so callers don't error.
  res.json({
    has_dlq_jobs: false,
    last_dlq_at: null,
  });
});

// POST /api/creator/notifications/dismiss
// PHASE-1 STUB: creator_notifications not in @workspace/db — restored in Phase 2
router.post(
  "/creator/notifications/dismiss",
  requireCreatorAuth,
  async (_req: Request, res: Response) => {
    // PHASE-1 STUB: creator_notifications table not in Phase 1 schema
    res.json({ dismissed: true });
  },
);

export default router;
