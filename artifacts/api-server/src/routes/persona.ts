import { Router, type IRouter, type Request, type Response } from "express";
import { getReplitUser } from "../lib/auth.js";

const router: IRouter = Router();

type PersonaResponse = {
  prompt: string;
  answer: string;
};

// POST /api/onboarding/persona
// Body: { responses: Array<{ prompt: string, answer: string }> }
// PHASE-1 STUB: creator_persona_responses not in @workspace/db — restored in Phase 2
// Returns: { ok: true, saved_count: 0 } — accepts responses but does not persist them
router.post("/onboarding/persona", async (req: Request, res: Response) => {
  const { responses } = req.body as { responses?: PersonaResponse[] };

  if (!Array.isArray(responses)) {
    res.status(400).json({ error: "responses must be an array" });
    return;
  }

  const user = getReplitUser(req);

  // PHASE-1 STUB: creator_persona_responses table not in Phase 1 schema
  // Responses accepted but not persisted to DB until Phase 2.
  const validCount = Array.isArray(responses)
    ? responses.filter(
        (r) =>
          r &&
          typeof r.prompt === "string" &&
          r.prompt.trim() &&
          typeof r.answer === "string" &&
          r.answer.trim()
      ).length
    : 0;

  if (user) {
    req.log?.info?.(
      { userId: user.id, responseCount: validCount },
      "[onboarding/persona] PHASE-1 STUB — persona responses received but not persisted",
    );
  }

  res.json({ ok: true, saved_count: 0 });
});

export default router;
