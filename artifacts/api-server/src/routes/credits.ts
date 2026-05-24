import { Router, type IRouter, type Request, type Response } from "express";
import { getSupabase } from "../lib/supabase.js";
import { DeductCreditsBody } from "@workspace/api-zod";

const router: IRouter = Router();

// POST /api/credits/deduct
router.post("/credits/deduct", async (req: Request, res: Response) => {
  const parsed = DeductCreditsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing required fields: creatorId, fanId, interactionId, cost" });
    return;
  }

  const { creatorId, fanId, interactionId, cost } = parsed.data;

  if (!Number.isInteger(cost) || cost <= 0) {
    res.status(400).json({ error: "cost must be a positive integer" });
    return;
  }

  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }
  const { data, error } = await supabase.rpc("deduct_credits", {
    p_fan_id: fanId,
    p_creator_id: creatorId,
    p_interaction_id: interactionId,
    p_cost: cost,
  });

  if (error) {
    req.log.error({ err: error.message }, "[credits/deduct] rpc error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  const result = data as { success: boolean; error?: string; remainingBalance?: number };

  if (!result.success) {
    switch (result.error) {
      case "insufficient_credits":
        res.status(402).json({
          error: "Insufficient credits",
          remainingBalance: result.remainingBalance ?? 0,
        });
        return;
      case "fan_not_found":
        res.status(404).json({ error: "Fan account not found" });
        return;
      case "duplicate_transaction":
        res.status(409).json({ error: "Duplicate interaction ID" });
        return;
      default:
        res.status(422).json({ error: result.error ?? "Unknown error" });
        return;
    }
  }

  res.json({ success: true, remainingBalance: result.remainingBalance });
});

export default router;
