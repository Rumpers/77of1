// Creator onboarding consent route — POST /api/onboarding/consent
// PHASE-1 STUB: creator_assets, creator_onboarding tables not in @workspace/db Phase 1 schema.
// The consent_grants insert is also stubbed because the full consent flow requires
// creator_assets and creator_onboarding to be in scope for the KYC+asset release logic.
// Restored in Phase 2 when all onboarding tables are migrated to Drizzle.

import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

// POST /api/onboarding/consent
// PHASE-1 STUB: creator_assets, creator_onboarding not in Phase 1 schema — restored in Phase 2
router.post("/onboarding/consent", async (_req: Request, res: Response) => {
  // PHASE-1 STUB: creator_assets, creator_onboarding not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

export default router;
