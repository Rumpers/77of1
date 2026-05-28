// Credits route — credit balance and deduction endpoints for fan interactions.

import { Router, type IRouter, type Request, type Response } from "express";
import { DeductCreditsBody } from "@workspace/api-zod";
import { requireFanAccess } from "../middlewares/require-fan-access.js";
import { atomicDeductCredit, totalCreditsRemaining } from "../lib/credits.js";

const router: IRouter = Router();

// POST /api/credits/deduct
// Atomically deducts one credit from the authenticated fan's oldest non-empty pack.
// Requires a valid session cookie (requireFanAccess sets res.locals.fanId).
// Returns 401 when not authenticated, 402 when credits exhausted, 200 on success.
router.post(
  "/credits/deduct",
  requireFanAccess,
  async (req: Request, res: Response) => {
    const parsed = DeductCreditsBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error:
            "Missing required fields: creatorId, fanId, interactionId, cost",
        });
      return;
    }

    const fanId = res.locals.fanId as string | undefined;
    if (!fanId) {
      res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
      return;
    }

    const result = await atomicDeductCredit(fanId);
    if (!result.allowed) {
      res
        .status(402)
        .json({ error: "Insufficient credits", code: "CREDITS_EXHAUSTED", creditsRemaining: 0 });
      return;
    }

    res.json({ ok: true, creditsRemaining: result.creditsRemaining });
  },
);

// GET /api/credits/balance
// Returns the total credits remaining for the authenticated fan.
router.get(
  "/credits/balance",
  requireFanAccess,
  async (_req: Request, res: Response) => {
    const fanId = res.locals.fanId as string | undefined;
    if (!fanId) {
      res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
      return;
    }

    const creditsRemaining = await totalCreditsRemaining(fanId);
    res.json({ creditsRemaining });
  },
);

export default router;
