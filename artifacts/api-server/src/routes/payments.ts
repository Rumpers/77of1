// Payments routes — checkout, Stripe webhooks, dunning
// PHASE-1 STUB: credit_packs, fan_subscriptions, fan_credits, dunning_audit_log,
// audit_log tables not in @workspace/db Phase 1 schema.
// Stripe is dormant per product spec (no fan payment loop).
// Restored in Phase 2 when payment tables are migrated to Drizzle.

import { Router, type IRouter, type Request, type Response } from "express";
import { CreateCheckoutBody } from "@workspace/api-zod";

const router: IRouter = Router();

// POST /api/payments/checkout
// PHASE-1 STUB: credit_packs, fan_credits not in Phase 1 schema — restored in Phase 2
router.post("/payments/checkout", async (req: Request, res: Response) => {
  const parsed = CreateCheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing required fields: creatorId, fanId, packId" });
    return;
  }
  // PHASE-1 STUB: credit_packs, fan_credits not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

// POST /api/webhooks/stripe
// PHASE-1 STUB: fan_subscriptions, dunning_audit_log, audit_log not in Phase 1 schema — restored in Phase 2
router.post("/webhooks/stripe", async (_req: Request, res: Response) => {
  // PHASE-1 STUB: fan_subscriptions, dunning_audit_log, audit_log not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

// GET /api/admin/dunning-metrics
// PHASE-1 STUB: fan_subscriptions, dunning_audit_log not in Phase 1 schema — restored in Phase 2
router.get("/admin/dunning-metrics", async (_req: Request, res: Response) => {
  // PHASE-1 STUB: fan_subscriptions, dunning_audit_log not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

export default router;
