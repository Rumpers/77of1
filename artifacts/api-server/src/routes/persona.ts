import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import { requireCreatorAuth } from "../middlewares/require-creator-auth.js";

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

// ── DB helpers (PATTERNS S1 — lazy import keeps tests runnable without DATABASE_URL) ──

async function getDb() {
  const { db, personasTable, twinConfigsTable } = await import("@workspace/db");
  const { eq, sql } = await import("drizzle-orm");
  return { db, personasTable, twinConfigsTable, eq, sql };
}

// ── Response mappers (Drizzle camelCase → API snake_case) ──────────────────

function toPersonaResponse(row: Record<string, unknown>) {
  return {
    id:                 row["id"],
    creator_id:         row["creatorId"],
    greeting_style:     row["greetingStyle"],
    fan_endearment:     row["fanEndearment"],
    emoji_usage:        row["emojiUsage"],
    hard_stops:         row["hardStops"],
    treatment_style:    row["treatmentStyle"],
    personality_traits: row["personalityTraits"],
    message_style:      row["messageStyle"],
    intensity_level:    row["intensityLevel"],
    created_at:         row["createdAt"],
    updated_at:         row["updatedAt"],
  };
}

function toTwinConfigResponse(row: Record<string, unknown>) {
  return {
    id:                       row["id"],
    kill_switch:               row["killSwitch"],
    kill_switch_activated_at: row["killSwitchActivatedAt"],
    updated_at:               row["updatedAt"],
  };
}

function dbErr(res: Response, msg: string, err: unknown) {
  console.error(`[persona] ${msg}`, err);
  res.status(500).json({ error: msg });
}

// ── Routes ─────────────────────────────────────────────────────────────────

// GET /api/creator/persona
router.get("/creator/persona", requireCreatorAuth, async (req: Request, res: Response) => {
  const creatorId = res.locals.creatorId as string;

  let ctx: Awaited<ReturnType<typeof getDb>>;
  try { ctx = await getDb(); } catch {
    res.status(503).json({ error: "Database not configured" }); return;
  }
  const { db, personasTable, twinConfigsTable, eq } = ctx;

  const cfg = await db
    .select({
      id:                    twinConfigsTable.id,
      personaId:             twinConfigsTable.personaId,
      killSwitch:            twinConfigsTable.killSwitch,
      killSwitchActivatedAt: twinConfigsTable.killSwitchActivatedAt,
      updatedAt:             twinConfigsTable.updatedAt,
    })
    .from(twinConfigsTable)
    .where(eq(twinConfigsTable.creatorId, creatorId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!cfg) { res.json({ persona: null, twin_config: null }); return; }

  let persona = null;
  if (cfg.personaId) {
    const row = await db
      .select()
      .from(personasTable)
      .where(eq(personasTable.id, cfg.personaId))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (row) persona = toPersonaResponse(row as Record<string, unknown>);
  }

  res.json({
    persona,
    twin_config: toTwinConfigResponse(cfg as Record<string, unknown>),
  });
});

// POST /api/creator/persona — Create or replace creator persona.
router.post("/creator/persona", requireCreatorAuth, async (req: Request, res: Response) => {
  const creatorId = res.locals.creatorId as string;

  const parsed = PersonaInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid persona fields", details: parsed.error.issues });
    return;
  }
  const input = parsed.data;

  let ctx: Awaited<ReturnType<typeof getDb>>;
  try { ctx = await getDb(); } catch {
    res.status(503).json({ error: "Database not configured" }); return;
  }
  const { db, personasTable, twinConfigsTable, sql } = ctx;

  const personaRow = await db
    .insert(personasTable)
    .values({
      creatorId,
      greetingStyle:     input.greeting_style,
      fanEndearment:     input.fan_endearment,
      emojiUsage:        input.emoji_usage,
      hardStops:         input.hard_stops,
      treatmentStyle:    input.treatment_style,
      personalityTraits: input.personality_traits,
      messageStyle:      input.message_style,
      intensityLevel:    input.intensity_level,
    })
    .returning()
    .then((r) => r[0] ?? null);

  if (!personaRow) { dbErr(res, "Failed to save persona", null); return; }

  const cfgRow = await db
    .insert(twinConfigsTable)
    .values({ creatorId, personaId: personaRow.id })
    .onConflictDoUpdate({
      target: twinConfigsTable.creatorId,
      set: { personaId: personaRow.id, updatedAt: sql`now()` },
    })
    .returning({
      id:                    twinConfigsTable.id,
      killSwitch:            twinConfigsTable.killSwitch,
      killSwitchActivatedAt: twinConfigsTable.killSwitchActivatedAt,
      updatedAt:             twinConfigsTable.updatedAt,
    })
    .then((r) => r[0] ?? null);

  if (!cfgRow) { dbErr(res, "Failed to save twin config", null); return; }

  res.status(201).json({
    persona:     toPersonaResponse(personaRow as Record<string, unknown>),
    twin_config: toTwinConfigResponse(cfgRow as Record<string, unknown>),
  });
});

// PATCH /api/creator/persona — Partially update creator persona fields.
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

  let ctx: Awaited<ReturnType<typeof getDb>>;
  try { ctx = await getDb(); } catch {
    res.status(503).json({ error: "Database not configured" }); return;
  }
  const { db, personasTable, twinConfigsTable, eq } = ctx;

  const cfg = await db
    .select({ personaId: twinConfigsTable.personaId })
    .from(twinConfigsTable)
    .where(eq(twinConfigsTable.creatorId, creatorId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!cfg?.personaId) {
    res.status(404).json({ error: "No persona configured — use POST to create one first" });
    return;
  }

  const setFields: Partial<{
    greetingStyle: string; fanEndearment: string; emojiUsage: string;
    hardStops: unknown[]; treatmentStyle: string; personalityTraits: unknown[];
    messageStyle: string; intensityLevel: string;
  }> = {};
  if (input.greeting_style     !== undefined) setFields.greetingStyle     = input.greeting_style;
  if (input.fan_endearment      !== undefined) setFields.fanEndearment     = input.fan_endearment;
  if (input.emoji_usage         !== undefined) setFields.emojiUsage        = input.emoji_usage;
  if (input.hard_stops          !== undefined) setFields.hardStops         = input.hard_stops;
  if (input.treatment_style     !== undefined) setFields.treatmentStyle    = input.treatment_style;
  if (input.personality_traits  !== undefined) setFields.personalityTraits = input.personality_traits;
  if (input.message_style       !== undefined) setFields.messageStyle      = input.message_style;
  if (input.intensity_level     !== undefined) setFields.intensityLevel    = input.intensity_level;

  const personaRow = await db
    .update(personasTable)
    .set(setFields)
    .where(eq(personasTable.id, cfg.personaId))
    .returning()
    .then((r) => r[0] ?? null);

  if (!personaRow) { dbErr(res, "Failed to update persona", null); return; }

  res.json({ persona: toPersonaResponse(personaRow as Record<string, unknown>) });
});

// POST /api/creator/twin-config/kill-switch — Enable or disable twin kill switch.
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

    let ctx: Awaited<ReturnType<typeof getDb>>;
    try { ctx = await getDb(); } catch {
      res.status(503).json({ error: "Database not configured" }); return;
    }
    const { db, twinConfigsTable, sql } = ctx;

    const cfgRow = await db
      .insert(twinConfigsTable)
      .values({
        creatorId,
        killSwitch:            enabled,
        killSwitchActivatedAt: enabled ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: twinConfigsTable.creatorId,
        set: {
          killSwitch:            enabled,
          killSwitchActivatedAt: enabled ? new Date() : null,
          updatedAt:             sql`now()`,
        },
      })
      .returning({
        id:                    twinConfigsTable.id,
        killSwitch:            twinConfigsTable.killSwitch,
        killSwitchActivatedAt: twinConfigsTable.killSwitchActivatedAt,
      })
      .then((r) => r[0] ?? null);

    if (!cfgRow) { dbErr(res, "Failed to update kill switch", null); return; }

    res.json({
      kill_switch:              cfgRow.killSwitch,
      kill_switch_activated_at: cfgRow.killSwitchActivatedAt,
    });
  },
);

export default router;
