// Subscriptions route — OF-168
// PHASE-1 STUB: fan_subscriptions table not in @workspace/db Phase 1 schema.
// Restored in Phase 2 when fan subscription tables are migrated to Drizzle.

import { Router, type IRouter, type Request, type Response } from "express";
import { requireFanAccess } from "../middlewares/require-fan-access.js";

const router: IRouter = Router();

// POST /api/subscriptions/:id/retry
// PHASE-1 STUB: fan_subscriptions not in Phase 1 schema — restored in Phase 2
router.post(
  "/subscriptions/:id/retry",
  requireFanAccess,
  async (_req: Request, res: Response) => {
    // PHASE-1 STUB: fan_subscriptions not in Phase 1 schema — restored in Phase 2
    res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
  },
);

export default router;
