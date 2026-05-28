// fan-twin — public-facing AI digital twin Telegram bot.
//
// Architecture (CHAT-02 + CHAT-06):
//   Telegram → POST webhook → bot.on('text') handler:
//     1. resolveCreatorForFanTwinBot() — single-tenant per D-02-01
//     2. deriveTelegramConversationId(chatId, creatorId) — deterministic (CHAT-03)
//     3. detectLocaleFromTelegramCtx(ctx) — Telegram language_code → locale (I18N-02)
//     4. textGeneration.add(...) with jobId=`tg-${update_id}` for dedup (Pitfall #12)
//     5. RETURN immediately — Telegraf ACKs HTTP 200 to Telegram (CHAT-06)
//   No ctx.reply here. The worker (artifacts/worker/text-generation.ts) is the
//   single delivery point for moderated reply + disclosure footer.
//
// Launch mode: webhook in prod (`WEBHOOK_URL_FAN_TWIN` + optional secret token),
// long-poll in dev. Port 3002 per D-02-06.

import { Telegraf, type Context } from "telegraf";
import { Queue } from "bullmq";
import {
  QUEUE_NAMES,
  JOB_OPTIONS,
  type TextGenerationPayload,
} from "@workspace/queue";
import { sessionMiddleware } from "./session.js";
import { detectLocaleFromTelegramCtx } from "./locale.js";
import {
  deriveTelegramConversationId,
  resolveCreatorForFanTwinBot,
} from "./conversation.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_FAN_TWIN;
if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN_FAN_TWIN is not set");

const WEBHOOK_URL = process.env.WEBHOOK_URL_FAN_TWIN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET_FAN_TWIN;
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// ─── BullMQ textGeneration queue (singleton) ────────────────────────────────
// Constructed at module load — same Queue instance used by the worker side.
// Lazy by env: if a test imports this module without REDIS_URL set the default
// localhost connection is harmless (no connection attempted until .add()).
export const textGeneration = new Queue<TextGenerationPayload>(
  QUEUE_NAMES.textGeneration,
  {
    connection: { url: REDIS_URL },
    defaultJobOptions: JOB_OPTIONS.textGeneration,
  },
);

const bot = new Telegraf(BOT_TOKEN);

// Session middleware MUST be mounted before any handler that touches
// ctx.session. Even if fan-twin Phase 2 doesn't yet read ctx.session
// (Phase 2 is stateless beyond the conversation_id), mounting it now
// avoids a future-migration footgun and matches the hermes shape.
bot.use(sessionMiddleware);

// ─── /start — friendly intro + disclosure ───────────────────────────────────
// We bypass the full pipeline (no moderation needed for "/start") and reply
// inline with the creator's Character Card V2 `first_mes` if available,
// plus the locale-appropriate disclosure footer.
bot.start(async (ctx) => {
  try {
    const creator = await resolveCreatorForFanTwinBot();
    const locale = detectLocaleFromTelegramCtx(ctx);

    // Pull twin row to read first_mes (best-effort — null when not onboarded)
    let intro: string;
    try {
      const { db, twinsTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      const twin = await db
        .select({ characterCard: twinsTable.characterCard })
        .from(twinsTable)
        .where(eq(twinsTable.creatorId, creator.id))
        .limit(1)
        .then((r: Array<{ characterCard: unknown }>) => r[0] ?? null);
      const firstMes = (twin?.characterCard as { data?: { first_mes?: string } })
        ?.data?.first_mes;
      intro = firstMes || `Hi! I'm @${creator.handle}'s AI twin. Say hi 👋`;
    } catch {
      intro = `Hi! I'm @${creator.handle}'s AI twin. Say hi 👋`;
    }

    const { getDisclosureFooter } = await import(
      "@workspace/twin-runtime/disclosure"
    );
    const footer = getDisclosureFooter(locale, creator.handle);
    await ctx.reply(`${intro}\n\n— ${footer}`);
  } catch (err) {
    console.error(`[fan-twin] /start failed: ${(err as Error).message}`);
    // Don't crash the webhook — return 200 anyway by completing the handler.
  }
});

// ─── on('text') — async enqueue, NO reply (CHAT-06) ─────────────────────────
bot.on("text", async (ctx: Context) => {
  // Type-guard the message + chat shape Telegraf hands us.
  const message = ctx.message;
  const chat = ctx.chat;
  const from = ctx.from;
  const update = ctx.update;
  if (
    !message ||
    !("text" in message) ||
    typeof message.text !== "string" ||
    !chat ||
    !from ||
    !update
  ) {
    return;
  }
  const text = message.text;
  const chatId = chat.id;
  const fanTelegramId = from.id;
  const updateId = (update as { update_id?: number }).update_id;

  try {
    const creator = await resolveCreatorForFanTwinBot();
    const conversationId = deriveTelegramConversationId(chatId, creator.id);
    const locale = detectLocaleFromTelegramCtx(ctx);
    const jobId = `tg-${updateId}`;

    await textGeneration.add(
      "fan-text",
      {
        type: "text-generation",
        jobDbId: jobId, // pseudo-id for tracing; not a real generation_jobs row
        creatorId: creator.id,
        fanId: String(fanTelegramId),
        consentGrantVersion: "v1.0",
        prompt: text,
        locale,
        conversationId,
        deliveryChannel: "telegram",
        telegramChatId: chatId,
        handle: creator.handle,
      },
      { jobId },
    );
    // NO ctx.reply here — Pitfall #7. Worker handles delivery.
  } catch (err) {
    console.error(`[fan-twin] enqueue failed: ${(err as Error).message}`);
    // Swallow — Telegraf ACKs 200 once the handler resolves. We do NOT want
    // Telegram to retry on our enqueue failure (jobId dedup would still drop
    // the duplicate but the LLM would have already replied to the original).
  }
});

// ─── Launch — webhook in prod, long-poll in dev ─────────────────────────────
// Mirrors hermes pattern (PATTERNS S5).
function launch(): void {
  if (WEBHOOK_URL) {
    const webhookOpts: Parameters<typeof bot.launch>[0] = {
      webhook: {
        domain: WEBHOOK_URL,
        port: Number(process.env.PORT ?? 3002),
        ...(WEBHOOK_SECRET ? { secretToken: WEBHOOK_SECRET } : {}),
      },
    };
    void bot.launch(webhookOpts);
    console.log(`[fan-twin] webhook mode domain=${WEBHOOK_URL}`);
  } else {
    void bot.launch();
    console.log("[fan-twin] long-poll mode (dev only)");
  }

  process.once("SIGTERM", () => bot.stop("SIGTERM"));
  process.once("SIGINT", () => bot.stop("SIGINT"));
}

// Side-effect launch only when run as the entrypoint module. Tests import
// this file to invoke bot.handleUpdate without triggering .launch().
const isEntry = (() => {
  try {
    const argv1 = process.argv[1] ?? "";
    return (
      argv1.endsWith("fan-twin/src/index.ts") ||
      argv1.endsWith("fan-twin/dist/index.mjs") ||
      argv1.endsWith("fan-twin/dist/index.js")
    );
  } catch {
    return false;
  }
})();

if (isEntry) launch();

// Exports for tests + ops introspection.
export { bot };
