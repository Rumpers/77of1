import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import { requireCreatorAuth } from "../middlewares/require-creator-auth.js";
import { getSupabase } from "../lib/supabase.js";

const router: IRouter = Router();

// ── Validation ─────────────────────────────────────────────────────────────

const EmojiUsage = z.enum(["none", "minimal", "moderate", "heavy"]);
const IntensityLevel = z.enum(["warm", "intimate", "explicit"]);

const PersonaInput = z.object({
  greeting_style:     z.string().max(500).default(""),
  fan_endearment:     z.string().max(100).default("fan"),
  emoji_usage:        EmojiUsage.default("minimal"),
  hard_stops:         z.array(z.string().max(200)).max(50).default([]),
  treatment_style:    z.string().max(500).default(""),
  personality_traits: z.array(z.string().max(100)).max(20).default([]),
  message_style:      z.string().max(500).default(""),
  intensity_level:    IntensityLevel.default("warm"),
});

const PersonaPatchInput = PersonaInput.partial();

// ── Helpers ────────────────────────────────────────────────────────────────

function dbErr(res: Response, msg: string, err: unknown) {
  console.error(`[persona] ${msg}`, err);
  res.status(500).json({ error: msg });
}

// ── Routes ─────────────────────────────────────────────────────────────────

// GET /api/creator/persona
// Returns current persona + twin config for the authenticated creator.
router.get("/creator/persona", requireCreatorAuth, async (req: Request, res: Response) => {
  const creatorId = res.locals.creatorId as string;

  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); } catch {
    res.status(503).json({ error: "Database not configured" }); return;
  }

  const { data: cfg, error: cfgErr } = await supabase
    .from("twin_configs")
    .select("id, persona_id, kill_switch, kill_switch_activated_at, updated_at")
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (cfgErr) { dbErr(res, "Failed to fetch twin config", cfgErr); return; }

  if (!cfg) {
    res.json({ persona: null, twin_config: null });
    return;
  }

  let persona = null;
  if (cfg.persona_id) {
    const { data: p, error: pErr } = await supabase
      .from("personas")
      .select("*")
      .eq("id", cfg.persona_id)
      .maybeSingle();
    if (pErr) { dbErr(res, "Failed to fetch persona", pErr); return; }
    persona = p;
  }

  res.json({
    persona,
    twin_config: {
      id: cfg.id,
      kill_switch: cfg.kill_switch,
      kill_switch_activated_at: cfg.kill_switch_activated_at,
      updated_at: cfg.updated_at,
    },
  });
});

// POST /api/creator/persona
// Creates or replaces the creator's persona and links it to twin_config (upsert).
router.post("/creator/persona", requireCreatorAuth, async (req: Request, res: Response) => {
  const creatorId = res.locals.creatorId as string;

  const parsed = PersonaInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid persona fields", details: parsed.error.issues });
    return;
  }
  const input = parsed.data;

  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); } catch {
    res.status(503).json({ error: "Database not configured" }); return;
  }

  const now = new Date().toISOString();

  // Insert new persona snapshot
  const { data: persona, error: pErr } = await supabase
    .from("personas")
    .insert({
      creator_id:         creatorId,
      greeting_style:     input.greeting_style,
      fan_endearment:     input.fan_endearment,
      emoji_usage:        input.emoji_usage,
      hard_stops:         input.hard_stops,
      treatment_style:    input.treatment_style,
      personality_traits: input.personality_traits,
      message_style:      input.message_style,
      intensity_level:    input.intensity_level,
      created_at:         now,
      updated_at:         now,
    })
    .select()
    .single();

  if (pErr || !persona) { dbErr(res, "Failed to save persona", pErr); return; }

  // Upsert twin_config linking to the new persona
  const { data: cfg, error: cfgErr } = await supabase
    .from("twin_configs")
    .upsert(
      {
        creator_id:  creatorId,
        persona_id:  persona.id,
        updated_at:  now,
      },
      { onConflict: "creator_id" },
    )
    .select("id, kill_switch, kill_switch_activated_at, updated_at")
    .single();

  if (cfgErr || !cfg) { dbErr(res, "Failed to save twin config", cfgErr); return; }

  res.status(201).json({ persona, twin_config: cfg });
});

// PATCH /api/creator/persona
// Updates persona fields in-place (partial update on the active persona).
router.patch("/creator/persona", requireCreatorAuth, async (req: Request, res: Response) => {
  const creatorId = res.locals.creatorId as string;

  const parsed = PersonaPatchInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid persona fields", details: parsed.error.issues });
    return;
  }
  const input = parsed.data;

  if (Object.keys(input).length === 0) {
    res.status(400).json({ error: "No fields provided" });
    return;
  }

  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); } catch {
    res.status(503).json({ error: "Database not configured" }); return;
  }

  // Resolve current persona_id
  const { data: cfg, error: cfgErr } = await supabase
    .from("twin_configs")
    .select("persona_id")
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (cfgErr) { dbErr(res, "Failed to fetch twin config", cfgErr); return; }

  if (!cfg?.persona_id) {
    res.status(404).json({ error: "No persona configured — use POST to create one first" });
    return;
  }

  const now = new Date().toISOString();

  const { data: persona, error: pErr } = await supabase
    .from("personas")
    .update({ ...input, updated_at: now })
    .eq("id", cfg.persona_id)
    .select()
    .single();

  if (pErr || !persona) { dbErr(res, "Failed to update persona", pErr); return; }

  res.json({ persona });
});

// POST /api/creator/twin-config/kill-switch
// Body: { enabled: boolean }
// Pauses or resumes twin responses within this single API call.
router.post(
  "/creator/twin-config/kill-switch",
  requireCreatorAuth,
  async (req: Request, res: Response) => {
    const creatorId = res.locals.creatorId as string;

    const parsed = z.object({ enabled: z.boolean() }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "enabled (boolean) is required" });
      return;
    }
    const { enabled } = parsed.data;

    let supabase: ReturnType<typeof getSupabase>;
    try { supabase = getSupabase(); } catch {
      res.status(503).json({ error: "Database not configured" }); return;
    }

    const now = new Date().toISOString();

    const { data: cfg, error: cfgErr } = await supabase
      .from("twin_configs")
      .upsert(
        {
          creator_id:                  creatorId,
          kill_switch:                 enabled,
          kill_switch_activated_at:    enabled ? now : null,
          updated_at:                  now,
        },
        { onConflict: "creator_id" },
      )
      .select("id, kill_switch, kill_switch_activated_at, updated_at")
      .single();

    if (cfgErr || !cfg) { dbErr(res, "Failed to update kill switch", cfgErr); return; }

    res.json({
      kill_switch:              cfg.kill_switch,
      kill_switch_activated_at: cfg.kill_switch_activated_at,
    });
  },
);

export default router;
