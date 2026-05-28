// POST /api/twin/chat — full fan twin chat pipeline (CHAT-01, CHAT-03, CHAT-04,
// COMPLY-01, I18N-02, PERSONA-02).
//
// Pipeline order (D-02 PATTERNS A1 cross-cutting concern #4 — 3-gate sequence):
//   1. HMAC conversation_id  — verifyConversationId middleware (global, app.ts)
//   2. KYC gate              — kycGate('body') middleware (sets res.locals.creatorId)
//   3. pause / kill-switch   — inline (reads creators.kill_switch_active + creator_config.paused)
//   4. Fan auth / credits    — requireFanAccess (sets fanId + fanTrialCount)
//
// Post-gates pipeline:
//   - credit gate: trial count check (anon) OR atomic DB deduction (authenticated)
//   - detectLocale(req)
//   - loadHistory(conversationId, 20)
//   - load twin row (characterCard, twinId)
//   - load persona + twin_config rows (graceful-degrade if absent)
//   - readConstitution(creatorId)   (PERSONA-02 read side, never throws)
//   - buildSystemPrompt(card, locale, constitution, persona)
//   - persistTurn user row
//   - getTextProvider().generateText({ ...history, new user })
//   - persistTurn assistant row
//   - queue async voice note stub (fire-and-forget when REDIS_URL set)
//   - decide monetization_pivot
//   - respond { text, disclosure_footer, monetization_pivot, conversation_id }
//
// On provider error: ProviderTransientError → 503 twin_unavailable;
// ProviderError → 502 twin_error.
import crypto from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { kycGate } from "../middlewares/kyc-gate.js";
import { requireFanAccess } from "../middlewares/require-fan-access.js";
import { detectLocale } from "../lib/locale.js";
import { loadHistory, persistTurn } from "../lib/conversation.js";
import { buildSystemPrompt, type Persona } from "../lib/system-prompt.js";
import { getDisclosureFooter } from "../lib/disclosure.js";
import { readConstitution } from "../lib/constitution.js";
import { runL1Moderation, runL3Moderation } from "../lib/moderation.js";
import { atomicDeductCredit, TRIAL_LIMIT } from "../lib/credits.js";
import { TRIAL_COOKIE } from "../lib/auth.js";
import { getTextProvider } from "../providers/registry.js";
import {
  ProviderError,
  ProviderTransientError,
} from "../providers/interfaces.js";
import { logger } from "../lib/logger.js";

// Lazy DB import (PATTERNS S1) — keeps unit tests runnable without DATABASE_URL.
async function getDb() {
  const {
    db,
    creatorsTable,
    twinsTable,
    creatorConfigTable,
    personasTable,
    twinConfigsTable,
  } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  return { db, creatorsTable, twinsTable, creatorConfigTable, personasTable, twinConfigsTable, eq };
}

// responseTokenLimit maps twin_configs.response_length → maxTokens for the LLM.
const TOKEN_LIMITS: Record<string, number> = {
  short: 256,
  medium: 512,
  long: 1024,
};

const router: IRouter = Router();

// Hash the fan's stable session identifier (conversation_id) before passing it
// to the GMI / Helicone boundary. We never send the raw HMAC token, the cookie
// value, or any IP / email field across that boundary (COMPLY-03, T-02-03-04).
function hashFanId(conversationId: string): string {
  return crypto
    .createHash("sha256")
    .update(`fan:${conversationId}`, "utf8")
    .digest("hex")
    .slice(0, 32);
}

// POST /api/twin/chat
router.post(
  "/twin/chat",
  kycGate("body"),
  requireFanAccess,
  async (req: Request, res: Response) => {
    const { message } = req.body as {
      message?: string;
      handle?: string;
      locale?: string;
    };
    const handle = (req.body as { handle?: string }).handle ?? "";

    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    // res.locals is set by middleware. verifyConversationId runs globally in
    // app.ts and must mint or accept the HMAC cookie BEFORE we get here.
    const creatorId = res.locals.creatorId as string | undefined;
    const conversationId = res.locals.conversationId as string | undefined;
    if (!creatorId || !conversationId) {
      // Defensive — should never happen if middleware is wired correctly.
      res.status(500).json({ error: "Middleware not wired" });
      return;
    }

    // ── 3rd gate: pause / kill-switch ────────────────────────────────────────
    let dbCtx: Awaited<ReturnType<typeof getDb>>;
    try {
      dbCtx = await getDb();
    } catch {
      res.status(503).json({ error: "Database not configured" });
      return;
    }
    const { db, creatorsTable, twinsTable, creatorConfigTable, personasTable, twinConfigsTable, eq } = dbCtx;

    const creator = await db
      .select({
        id: creatorsTable.id,
        killSwitchActive: creatorsTable.killSwitchActive,
      })
      .from(creatorsTable)
      .where(eq(creatorsTable.id, creatorId))
      .limit(1)
      .then((r: Array<{ id: string; killSwitchActive: boolean }>) => r[0] ?? null);

    if (!creator) {
      // kycGate just resolved this row; if it's missing here we treat it as
      // a paused/unavailable creator rather than 404 (race between handle
      // lookup and id lookup is unlikely but cleaner this way).
      res.status(503).json({ code: "creator_paused" });
      return;
    }

    if (creator.killSwitchActive) {
      res.status(503).json({ code: "creator_paused" });
      return;
    }

    const cfg = await db
      .select({ paused: creatorConfigTable.paused })
      .from(creatorConfigTable)
      .where(eq(creatorConfigTable.creatorId, creatorId))
      .limit(1)
      .then((r: Array<{ paused: boolean }>) => r[0] ?? null);

    if (cfg?.paused === true) {
      res.status(503).json({ code: "creator_paused" });
      return;
    }

    // ── Credit gate (CHAT-02, D-02-10) ───────────────────────────────────────
    // Authenticated fan (fanId set by requireFanAccess): atomic DB deduction.
    // Anonymous fan (trial mode): check cookie counter; reject at TRIAL_LIMIT.
    const fanId = res.locals.fanId as string | undefined;
    if (fanId) {
      const deduct = await atomicDeductCredit(fanId);
      if (!deduct.allowed) {
        res.status(402).json({ code: "credits_required", creditsRemaining: 0 });
        return;
      }
    } else {
      // Trial mode — fanTrialCount is set by requireFanAccess from the cookie.
      const trialCount = (res.locals.fanTrialCount as number | undefined) ?? 0;
      if (trialCount >= TRIAL_LIMIT) {
        res.status(402).json({ code: "trial_exhausted", trialCount });
        return;
      }
    }

    // ── Pipeline ─────────────────────────────────────────────────────────────
    const locale = detectLocale(req);

    const history = await loadHistory(conversationId, 20);

    const twin = await db
      .select({
        id: twinsTable.id,
        characterCard: twinsTable.characterCard,
      })
      .from(twinsTable)
      .where(eq(twinsTable.creatorId, creatorId))
      .limit(1)
      .then((r: Array<{ id: string; characterCard: unknown }>) => r[0] ?? null);

    const constitution = await readConstitution(creatorId);

    // Load persona + twin_config rows (graceful-degrade: return null if absent
    // or if DB throws — these tables are optional enrichment, not gate logic).
    let persona: Persona | null = null;
    let twinConfigResponseLength = "medium";
    try {
      const [personaRow, twinCfgRow] = await Promise.all([
        db
          .select()
          .from(personasTable)
          .where(eq(personasTable.creatorId, creatorId))
          .limit(1)
          .then((r: Persona[]) => r[0] ?? null),
        db
          .select({ responseLength: twinConfigsTable.responseLength })
          .from(twinConfigsTable)
          .where(eq(twinConfigsTable.creatorId, creatorId))
          .limit(1)
          .then((r: Array<{ responseLength: string }>) => r[0] ?? null),
      ]);
      persona = personaRow;
      if (twinCfgRow?.responseLength) {
        twinConfigResponseLength = twinCfgRow.responseLength;
      }
    } catch {
      // Graceful degrade — persona/config absent, use defaults
    }

    // Character card may live in the JSONB column as `null` for cold-start
    // creators. buildSystemPrompt accepts null and falls back to a safe
    // placeholder prompt.
    const card =
      twin?.characterCard
        ? (twin.characterCard as Parameters<typeof buildSystemPrompt>[0])
        : null;
    const systemPrompt = buildSystemPrompt(card, locale, constitution, persona);

    const fanIdHash = hashFanId(conversationId);

    // ── L1 moderation (MOD-01) ───────────────────────────────────────────────
    // Always persist the user turn (audit trail) — but if L1 flags, we
    // short-circuit before the LLM call and persist a deflection assistant
    // turn instead.
    await persistTurn({
      conversationId,
      creatorId,
      twinId: twin?.id ?? null,
      role: "user",
      content: message,
    });

    const l1 = await runL1Moderation({
      text: message,
      locale,
      creatorId,
      fanIdHash,
      sessionId: conversationId,
    });
    if (l1.flagged && l1.reply) {
      await persistTurn({
        conversationId,
        creatorId,
        twinId: twin?.id ?? null,
        role: "assistant",
        content: l1.reply,
      });
      logger.info(
        {
          event: "twin.chat.l1_blocked",
          creatorId,
          category: l1.primaryCategory,
          severity: l1.severity,
        },
        "[twin/chat] L1 moderation blocked input",
      );
      res.json({
        text: l1.reply,
        disclosure_footer: getDisclosureFooter(locale, handle),
        monetization_pivot: false,
        conversation_id: conversationId,
      });
      return;
    }

    let llmContent: string;
    try {
      const llm = await getTextProvider().generateText({
        creatorId,
        fanId: fanIdHash,
        messages: [...history, { role: "user", content: message }],
        systemPrompt,
        maxTokens: TOKEN_LIMITS[twinConfigResponseLength] ?? 512,
      });
      llmContent = llm.content;
    } catch (err) {
      if (err instanceof ProviderTransientError) {
        logger.warn(
          { event: "twin.chat.provider_transient", creatorId },
          "[twin/chat] provider transient error",
        );
        res.status(503).json({ code: "twin_unavailable" });
        return;
      }
      if (err instanceof ProviderError) {
        logger.error(
          { event: "twin.chat.provider_error", creatorId },
          "[twin/chat] provider error",
        );
        res.status(502).json({ code: "twin_error" });
        return;
      }
      throw err;
    }

    // ── L3 moderation (MOD-03) ───────────────────────────────────────────────
    // Check LLM output before delivery; replace with deflection if flagged.
    const l3 = await runL3Moderation({
      text: llmContent,
      locale,
      creatorId,
      fanIdHash,
      sessionId: conversationId,
    });
    const safeReply = l3.flagged && l3.reply ? l3.reply : llmContent;
    if (l3.flagged) {
      logger.info(
        {
          event: "twin.chat.l3_blocked",
          creatorId,
          category: l3.primaryCategory,
          severity: l3.severity,
        },
        "[twin/chat] L3 moderation replaced output",
      );
    }

    await persistTurn({
      conversationId,
      creatorId,
      twinId: twin?.id ?? null,
      role: "assistant",
      content: safeReply,
    });

    // ── Async voice note stub (VOICE-01) ─────────────────────────────────────
    // Fire-and-forget: queue a voice generation job when REDIS_URL is set and
    // the fan is authenticated (fanId required for job tracking). Errors are
    // swallowed — voice note delivery is async and non-blocking for the HTTP
    // response (per D-02 PATTERNS A8: async queue for generation).
    if (fanId && process.env.REDIS_URL) {
      const redisUrl = process.env.REDIS_URL;
      Promise.resolve().then(async () => {
        try {
          const { createAllQueues } = await import("@workspace/queue");
          const { QUEUE_NAMES } = await import("@workspace/queue");
          const queues = createAllQueues(redisUrl);
          await queues.voiceGeneration.add("voice-note", {
            type: "voice-generation",
            jobDbId: crypto.randomUUID(),
            creatorId,
            fanId,
            consentGrantVersion: "1",
            transcript: safeReply,
            language: locale === "ja" ? "ja" : locale === "zh-TW" ? "zh-TW" : "en",
          });
          await queues.voiceGeneration.close();
          logger.info(
            { event: "twin.chat.voice_queued", creatorId, fanId },
            "[twin/chat] voice note queued",
          );
        } catch (err) {
          logger.warn(
            { event: "twin.chat.voice_queue_error", err: (err as Error).message },
            "[twin/chat] voice queue error (non-fatal)",
          );
        }
      });
    }

    // ── Increment trial cookie for anonymous fans ─────────────────────────────
    if (!fanId) {
      const newCount =
        ((res.locals.fanTrialCount as number | undefined) ?? 0) + 1;
      res.cookie(TRIAL_COOKIE, String(newCount), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }

    // Monetization-pivot heuristic (D-02-10): nudge on every 5th assistant
    // reply. Count assistant turns in history (excludes the one we just wrote)
    // plus this reply. Suppressed when the reply is a moderation deflection
    // (CHAT-05 + UI-SPEC: trial-style nudges are inappropriate next to a
    // crisis/safety message).
    const assistantTurnCount =
      history.filter((t) => t.role === "assistant").length + 1;
    const monetization_pivot = !l3.flagged && assistantTurnCount % 5 === 0;

    res.json({
      text: safeReply,
      disclosure_footer: getDisclosureFooter(locale, handle),
      monetization_pivot,
      conversation_id: conversationId,
    });
  },
);

export default router;
