// POST /api/twin/chat — full fan twin chat pipeline (CHAT-01, CHAT-03, CHAT-04,
// COMPLY-01, I18N-02, PERSONA-02).
//
// Pipeline order (D-02 PATTERNS A1 cross-cutting concern #4 — 3-gate sequence):
//   1. HMAC conversation_id  — verifyConversationId middleware (global, app.ts)
//   2. KYC gate              — kycGate('body') middleware (sets res.locals.creatorId)
//   3. pause / kill-switch   — inline (reads creators.kill_switch_active + creator_config.paused)
//
// Post-gates pipeline:
//   - detectLocale(req)
//   - loadHistory(conversationId, 20)
//   - load twin row (characterCard, twinId)
//   - readConstitution(creatorId)   (PERSONA-02 read side, never throws)
//   - buildSystemPrompt(card, locale, constitution)
//   - persistTurn user row
//   - getTextProvider().generateText({ ...history, new user })
//   - persistTurn assistant row
//   - decide monetization_pivot
//   - respond { text, disclosure_footer, monetization_pivot, conversation_id }
//
// On provider error: ProviderTransientError → 503 twin_unavailable;
// ProviderError → 502 twin_error.
import crypto from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { kycGate } from "../middlewares/kyc-gate.js";
import { detectLocale } from "../lib/locale.js";
import { loadHistory, persistTurn } from "../lib/conversation.js";
import { buildSystemPrompt } from "../lib/system-prompt.js";
import { getDisclosureFooter } from "../lib/disclosure.js";
import { readConstitution } from "../lib/constitution.js";
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
  } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  return { db, creatorsTable, twinsTable, creatorConfigTable, eq };
}

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
    const { db, creatorsTable, twinsTable, creatorConfigTable, eq } = dbCtx;

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
    // Character card may live in the JSONB column as `null` for cold-start
    // creators. buildSystemPrompt accepts null and falls back to a safe
    // placeholder prompt.
    const card =
      twin?.characterCard
        ? (twin.characterCard as Parameters<typeof buildSystemPrompt>[0])
        : null;
    const systemPrompt = buildSystemPrompt(card, locale, constitution);

    // Persist the user turn BEFORE the LLM call so we still capture the input
    // if the provider throws.
    await persistTurn({
      conversationId,
      creatorId,
      twinId: twin?.id ?? null,
      role: "user",
      content: message,
    });

    let llmContent: string;
    try {
      const llm = await getTextProvider().generateText({
        creatorId,
        fanId: hashFanId(conversationId),
        messages: [...history, { role: "user", content: message }],
        systemPrompt,
        maxTokens: 512,
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

    await persistTurn({
      conversationId,
      creatorId,
      twinId: twin?.id ?? null,
      role: "assistant",
      content: llmContent,
    });

    // Monetization-pivot heuristic (D-02-10): nudge on every 5th assistant
    // reply. Count assistant turns in history (excludes the one we just wrote)
    // plus this reply.
    const assistantTurnCount =
      history.filter((t) => t.role === "assistant").length + 1;
    const monetization_pivot = assistantTurnCount % 5 === 0;

    res.json({
      text: llmContent,
      disclosure_footer: getDisclosureFooter(locale, handle),
      monetization_pivot,
      conversation_id: conversationId,
    });
  },
);

export default router;
