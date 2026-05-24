import { Router, type IRouter, type Request, type Response } from "express";
import { getSupabase } from "../lib/supabase.js";
import { getReplitUser } from "../lib/auth.js";

const router: IRouter = Router();

type PersonaResponse = {
  prompt: string;
  answer: string;
};

// POST /api/onboarding/persona
// Body: { responses: Array<{ prompt: string, answer: string }> }
// Returns: { ok: true, saved_count: number }
// Saves to creator_persona_responses table (or stub if no DB)
router.post("/onboarding/persona", async (req: Request, res: Response) => {
  const { responses } = req.body as { responses?: PersonaResponse[] };

  if (!Array.isArray(responses)) {
    res.status(400).json({ error: "responses must be an array" });
    return;
  }

  const validResponses = responses.filter(
    (r) =>
      r &&
      typeof r.prompt === "string" &&
      r.prompt.trim() &&
      typeof r.answer === "string" &&
      r.answer.trim()
  );

  // Attempt DB write — fall back to stub if DB not configured
  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    // Slice 1 stub — DB not configured
    res.json({ ok: true, saved_count: 0 });
    return;
  }

  const user = getReplitUser(req);
  if (!user) {
    // Anonymous submit — accept for Slice 1
    res.json({ ok: true, saved_count: 0 });
    return;
  }

  try {
    const { data: creator } = await supabase
      .from("creators")
      .select("id")
      .eq("replit_user_id", user.id)
      .maybeSingle();

    if (!creator) {
      // Creator not linked — stub accept
      res.json({ ok: true, saved_count: 0 });
      return;
    }

    const rows = validResponses.map((r) => ({
      creator_id: creator.id as string,
      prompt: r.prompt,
      answer: r.answer,
      created_at: new Date().toISOString(),
    }));

    if (rows.length === 0) {
      res.json({ ok: true, saved_count: 0 });
      return;
    }

    const { error: insertError } = await supabase
      .from("creator_persona_responses")
      .insert(rows);

    if (insertError) {
      req.log?.error?.({ err: insertError.message }, "[onboarding/persona] insert error");
      // Graceful stub — don't block onboarding
      res.json({ ok: true, saved_count: 0 });
      return;
    }

    res.json({ ok: true, saved_count: rows.length });
  } catch (err) {
    req.log?.error?.({ err }, "[onboarding/persona] unexpected error");
    res.json({ ok: true, saved_count: 0 });
  }
});

export default router;
