import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const VALID_CATEGORIES = ["off_topic", "abusive", "inappropriate", "fraud"] as const;
type ReportCategory = (typeof VALID_CATEGORIES)[number];

// POST /api/reports
// Body: { message_id, category, message_text?, handle, locale?, fan_id? }
// Non-blocking — fires and responds immediately; DB write is best-effort.
// Returns: { ok: true } always (no UX block on failure)
router.post("/reports", async (req: Request, res: Response) => {
  const { message_id, category, message_text, handle, locale, fan_id } = req.body as {
    message_id?: string;
    category?: string;
    message_text?: string;
    handle?: string;
    locale?: string;
    fan_id?: string;
  };

  // Respond immediately — acceptance criteria: <2s, no UX block
  res.json({ ok: true });

  // Validate before async write
  if (!message_id || !category || !VALID_CATEGORIES.includes(category as ReportCategory)) {
    return;
  }

  // Best-effort async DB write
  setImmediate(async () => {
    try {
      const { getSupabase } = await import("../lib/supabase.js");
      const supabase = getSupabase();

      // Resolve creator_id from handle
      let creator_id: string | null = null;
      if (handle) {
        const { data: creator } = await supabase
          .from("creators")
          .select("id")
          .eq("handle", handle)
          .single();
        creator_id = creator?.id ?? null;
      }

      await supabase.from("fan_reports").insert({
        creator_id,
        fan_id: fan_id ?? null,
        message_id: String(message_id),
        category: category as ReportCategory,
        message_text: message_text ? String(message_text).slice(0, 2000) : null,
        locale: locale ?? "en",
        status: "pending",
      });
    } catch (err) {
      // Silently swallow — report failure must never surface to fan
      console.error("[reports] db write failed", err);
    }
  });
});

export default router;
