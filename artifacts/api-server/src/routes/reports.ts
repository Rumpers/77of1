// Fan reports route — POST /api/reports
// PHASE-1 STUB: fan_reports table not in @workspace/db Phase 1 schema.
// Restored in Phase 2 when fan reporting tables are migrated to Drizzle.

import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const VALID_CATEGORIES = ["off_topic", "abusive", "inappropriate", "fraud"] as const;
type ReportCategory = (typeof VALID_CATEGORIES)[number];

// POST /api/reports
// Returns { ok: true } immediately (non-blocking per spec) — DB write stubbed in Phase 1.
// PHASE-1 STUB: fan_reports not in Phase 1 schema — restored in Phase 2
router.post("/reports", async (req: Request, res: Response) => {
  const { message_id, category } = req.body as {
    message_id?: string;
    category?: string;
  };

  // Respond immediately — acceptance criteria: <2s, no UX block
  res.json({ ok: true });

  // PHASE-1 STUB: fan_reports not in Phase 1 schema — restored in Phase 2
  if (!message_id || !category || !VALID_CATEGORIES.includes(category as ReportCategory)) {
    return;
  }
  // DB write skipped in Phase 1 — fan_reports not in @workspace/db
});

export default router;
