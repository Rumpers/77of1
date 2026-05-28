// PHASE-1 STUB: links.ts — link tracking routes not yet migrated to Drizzle
// Creator_links and link_clicks tables are out of Phase 1 scope.
// All routes return 503 until Phase 3 Replit Object Storage + Drizzle migration.
// Original file with Supabase client: see git history / main branch untracked.

import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

// GET /:handle — redirect stub
router.get("/:handle", (_req: Request, res: Response) => {
  res.status(503).json({
    error: "Link tracking temporarily unavailable",
    code: "LINK_TRACKING_PENDING",
  });
});

// GET /api/links/:handle/stats — stats stub
router.get("/api/links/:handle/stats", (_req: Request, res: Response) => {
  res.status(503).json({
    error: "Link stats temporarily unavailable",
    code: "LINK_TRACKING_PENDING",
  });
});

// POST /api/links — create link stub
router.post("/api/links", (_req: Request, res: Response) => {
  res.status(503).json({
    error: "Link creation temporarily unavailable",
    code: "LINK_TRACKING_PENDING",
  });
});

export default router;
