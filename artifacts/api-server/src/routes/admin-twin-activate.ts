// POST /api/admin/twin/:creatorId/activate — founder-auth + eval gate (04-03, EVAL-01).
//
// Enforces the go-live gate: calls isGoLiveEligible(creatorId) from @workspace/eval,
// which checks the latest non-regression eval_run row for the creator.  Only when
// both hard-limit and prompt-injection categories passed at 100% does the handler
// flip twins.status to "active" — the flag that the fan chat route (routes/twin.ts)
// reads to decide whether the twin is reachable.
//
// Security properties (T-04-03-01 — T-04-03-05):
//   - founderAuth: ADMIN_API_TOKEN bearer, timingSafeEqual, fail-closed (Task 2)
//   - :creatorId validated as UUID before DB update (ASVS V5)
//   - 422 body does NOT enumerate which eval cases failed (ASVS V13 leak prevention)
//   - Drizzle parameterizes the UPDATE (no SQL injection)
//
// Route path: router.post("/admin/twin/:creatorId/activate", ...)
// Mounted in routes/index.ts BEFORE the linksRouter catch-all.
// Resolves at: POST /api/admin/twin/:creatorId/activate

import { Router, type IRouter, type Request, type Response } from "express";
import { founderAuth } from "../middleware/founder-auth.js";

// Lazy DB import (PATTERNS S1) — keeps unit tests runnable without DATABASE_URL.
async function getDb() {
  const { db, twinsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  return { db, twinsTable, eq };
}

// UUID v4 format — ASVS V5 input validation for :creatorId path param.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const router: IRouter = Router();

router.post(
  "/admin/twin/:creatorId/activate",
  founderAuth,
  async (req: Request, res: Response) => {
    // Express types params as ParamsDictionary (string | string[]).
    // Path params are always plain strings at runtime.
    const creatorId = req.params["creatorId"] as string;

    // Validate UUID format (T-04-03-05).
    if (!creatorId || !UUID_RE.test(creatorId)) {
      res.status(400).json({ code: "invalid_creator_id", message: "creatorId must be a UUID." });
      return;
    }

    // Check the eval gate: did the creator's latest non-regression eval run pass?
    // Lazy import so api-server does not create a circular dep on @workspace/eval
    // (eval already imports @workspace/twin-runtime which is used by api-server).
    const { isGoLiveEligible } = await import("@workspace/eval");
    const eligible = await isGoLiveEligible(creatorId);

    if (!eligible) {
      // 422 body is generic — do NOT list which cases failed (T-04-03-03 leak prevention).
      res.status(422).json({
        code: "eval_gate_failed",
        message:
          "Twin cannot be activated until the eval suite passes 100% on hard-limit and injection categories.",
      });
      return;
    }

    // Eval gate passed → flip twins.status to "active".
    // This is the flag that routes/twin.ts reads (the twin_inactive 503 gate).
    const { db, twinsTable, eq } = await getDb();
    await db
      .update(twinsTable)
      .set({ status: "active" })
      .where(eq(twinsTable.creatorId, creatorId));

    res.json({ status: "active" });
  },
);

export default router;
