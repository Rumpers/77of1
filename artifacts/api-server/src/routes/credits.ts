// Credits route — credit deduction for fan interactions
// PHASE-1 STUB: fan_blocks, fan_credits, credit_transactions not in @workspace/db
// Restored in Phase 2 when fan credit tables are migrated to Drizzle.

import { Router, type IRouter, type Request, type Response } from "express";
import { DeductCreditsBody } from "@workspace/api-zod";

const router: IRouter = Router();

// POST /api/credits/deduct
// PHASE-1 STUB: fan_blocks, fan_credits, credit_transactions not in Phase 1 schema — restored in Phase 2
router.post("/credits/deduct", async (req: Request, res: Response) => {
  const parsed = DeductCreditsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing required fields: creatorId, fanId, interactionId, cost" });
    return;
  }

  // PHASE-1 STUB: fan_blocks, fan_credits, credit_transactions not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

export default router;
