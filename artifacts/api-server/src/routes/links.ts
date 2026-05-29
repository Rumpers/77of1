// Link tracking routes
// PHASE-1 STUB: creator_links, link_clicks tables not in @workspace/db Phase 1 schema.
// Restored in Phase 2/3 when link tracking tables are migrated to Drizzle + Object Storage.
// Original file with Supabase client: see git history / main branch untracked.

import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

// GET /:handle — redirect stub
// PHASE-1 STUB: creator_links, link_clicks not in Phase 1 schema — restored in Phase 2
router.get("/:handle", (_req: Request, res: Response) => {
  // PHASE-1 STUB: creator_links, link_clicks not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

// GET /api/links/:handle/stats — stats stub
// PHASE-1 STUB: link_clicks not in Phase 1 schema — restored in Phase 2
router.get("/api/links/:handle/stats", (_req: Request, res: Response) => {
  // PHASE-1 STUB: link_clicks not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

// POST /api/links — create link stub
// PHASE-1 STUB: creator_links not in Phase 1 schema — restored in Phase 2
router.post("/api/links", (_req: Request, res: Response) => {
  // PHASE-1 STUB: creator_links not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

export default router;
