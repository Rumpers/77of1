// [HID-035] DSAR self-service portal — OF-135
// §16: fans get 30-day download window; creators get 72-hour self-export.
//
// PHASE-1 STUB: fan_accounts, fan_subscriptions, fan_credits, credit_transactions,
// fan_ai_usage, dsar_requests tables not in @workspace/db Phase 1 schema.
// Restored in Phase 2 when fan/DSAR tables are migrated to Drizzle.
//
// POST /api/dsar/request   — submit a DSAR (rate-limited: once per 30 days)
// GET  /api/dsar            — get current request status
// GET  /api/dsar/download   — download data package (query: ?token=xxx)

import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

// POST /api/dsar/request
// PHASE-1 STUB: fan_accounts, dsar_requests not in Phase 1 schema — restored in Phase 2
router.post("/dsar/request", async (_req: Request, res: Response) => {
  // PHASE-1 STUB: fan_accounts, dsar_requests not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

// GET /api/dsar
// PHASE-1 STUB: dsar_requests not in Phase 1 schema — restored in Phase 2
router.get("/dsar", async (_req: Request, res: Response) => {
  // PHASE-1 STUB: dsar_requests not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

// GET /api/dsar/download
// PHASE-1 STUB: dsar_requests, fan data tables not in Phase 1 schema — restored in Phase 2
router.get("/dsar/download", async (_req: Request, res: Response) => {
  // PHASE-1 STUB: dsar_requests not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

// POST /api/dsar/creator/request
// PHASE-1 STUB: dsar_requests not in Phase 1 schema — restored in Phase 2
router.post("/dsar/creator/request", async (_req: Request, res: Response) => {
  // PHASE-1 STUB: dsar_requests not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

// GET /api/dsar/creator
// PHASE-1 STUB: dsar_requests not in Phase 1 schema — restored in Phase 2
router.get("/dsar/creator", async (_req: Request, res: Response) => {
  // PHASE-1 STUB: dsar_requests not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

// GET /api/dsar/creator/download
// PHASE-1 STUB: dsar_requests not in Phase 1 schema — restored in Phase 2
router.get("/dsar/creator/download", async (_req: Request, res: Response) => {
  // PHASE-1 STUB: dsar_requests not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

export default router;
