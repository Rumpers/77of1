import { Router, type IRouter, type Request, type Response } from "express";
import { getSupabase } from "../lib/supabase.js";
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
router.get("/creator/jobs/failed", requireCreatorAuth, async (req: Request, res: Response) => {
  const creatorId = res.locals.creatorId as string;

  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const { data: jobs, error: jobsErr } = await supabase
    .from("generation_jobs")
    .select("id, modality, error_message, created_at, status")
    .eq("creator_id", creatorId)
    .eq("status", "dlq")
    .order("created_at", { ascending: false })
    .limit(50);

  if (jobsErr) {
    console.error(`[creator/jobs/failed] query error: ${jobsErr.message}`);
    res.status(500).json({ error: "Failed to fetch failed jobs" });
    return;
  }

  const result = (jobs ?? []).map((j) => ({
    id: j.id as string,
    modality: j.modality as string,
    error: toFanFacingError(j.error_message as string | null),
    created_at: j.created_at as string,
    fan_facing_status: "Failed",
  }));

  res.json({ jobs: result });
});

// GET /api/creator/notifications
// Lightweight poll for DLQ alert flag.
router.get("/creator/notifications", requireCreatorAuth, async (req: Request, res: Response) => {
  const creatorId = res.locals.creatorId as string;

  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const { data: notif, error: notifErr } = await supabase
    .from("creator_notifications")
    .select("has_dlq_jobs, last_dlq_at")
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (notifErr) {
    console.error(`[creator/notifications] query error: ${notifErr.message}`);
    res.status(500).json({ error: "Failed to fetch notifications" });
    return;
  }

  res.json({
    has_dlq_jobs: notif?.has_dlq_jobs ?? false,
    last_dlq_at: notif?.last_dlq_at ?? null,
  });
});

// POST /api/creator/notifications/dismiss
router.post(
  "/creator/notifications/dismiss",
  requireCreatorAuth,
  async (req: Request, res: Response) => {
    const creatorId = res.locals.creatorId as string;

    let supabase: ReturnType<typeof getSupabase>;
    try {
      supabase = getSupabase();
    } catch {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const { error: updateErr } = await supabase
      .from("creator_notifications")
      .upsert(
        {
          creator_id: creatorId,
          has_dlq_jobs: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "creator_id" },
      );

    if (updateErr) {
      console.error(`[creator/notifications/dismiss] update error: ${updateErr.message}`);
      res.status(500).json({ error: "Failed to dismiss notification" });
      return;
    }

    res.json({ dismissed: true });
  },
);

export default router;
