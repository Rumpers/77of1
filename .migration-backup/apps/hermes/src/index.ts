// Hermes — single @7of1_bot creator management agent
// One bot, multi-tenant by creator_id. Webhook-based for production.
import { Telegraf } from "telegraf";
import {
  findCreatorByTelegramId,
  getCreatorStats,
  setPaused,
} from "./db.js";
import { triggerPersonaRagIngest } from "./onboarding.js";
import {
  startConsentSession,
  getConsentSession,
  clearConsentSession,
  buildIntro,
  buildCurrentPrompt,
  buildSummary,
  processConsentMessage,
  commitConsent,
  telegramIpHash,
  hasPersonaTextGrant,
  CONSENT_ITEMS,
} from "./consent.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set");

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const WEB_BASE_URL = process.env.WEB_BASE_URL ?? "https://7of1.app";

const bot = new Telegraf(BOT_TOKEN);

// /start — send Replit Auth deep-link to link Telegram identity to creator account
bot.start(async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (creator) {
    const stats = await getCreatorStats(creator.id);
    const state = stats.paused ? "⏸ paused" : "▶️ active";
    await ctx.reply(
      `Welcome back, ${creator.display_name}! Your twin is ${state}.\n\nUse /status for a full snapshot.`
    );
    return;
  }

  const connectUrl = `${WEB_BASE_URL}/creator/connect?tg_uid=${tgUserId}`;
  await ctx.reply(
    `Welcome to Hermes — your 7of1 creator dashboard.\n\nYour Telegram account isn't linked to a creator profile yet.\n\nConnect here:\n${connectUrl}\n\nOnce linked, come back and use /status to check your twin.`
  );
});

// /pause — kill switch. Writes paused=true within ≤5s SLA (§19 launch gate).
bot.command("pause", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const t0 = Date.now();
  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Your Telegram account isn't linked. Use /start to connect.");
    return;
  }

  const { elapsed } = await setPaused(creator.id, true);
  const total = Date.now() - t0;
  console.log(
    `[hermes] /pause tg_user_id=${tgUserId} creator_id=${creator.id} total_ms=${total}`
  );

  await ctx.reply(
    `⏸ Twin paused. Your AI presence is offline.\n\nUse /resume to reactivate.\n\n_(DB write: ${elapsed}ms)_`,
    { parse_mode: "Markdown" }
  );
});

// /resume — reactivate twin.
bot.command("resume", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Your Telegram account isn't linked. Use /start to connect.");
    return;
  }

  const { elapsed } = await setPaused(creator.id, false);
  console.log(
    `[hermes] /resume tg_user_id=${tgUserId} creator_id=${creator.id} db_write_ms=${elapsed}`
  );

  await ctx.reply("▶️ Twin reactivated. Your AI presence is live again.");
});

// /status — twin state, fan count, credit balance.
bot.command("status", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Your Telegram account isn't linked. Use /start to connect.");
    return;
  }

  const stats = await getCreatorStats(creator.id);
  const twinState = stats.paused ? "⏸ Paused" : "▶️ Active";
  const msg = [
    `*${creator.display_name} — Status*`,
    ``,
    `Twin: ${twinState}`,
    `Active fans: ${stats.activeFanCount}`,
    `Credit balance: coming in Slice 2`,
  ].join("\n");

  await ctx.reply(msg, { parse_mode: "Markdown" });
});

// /persona_complete — onboarding Step 2: persona exercise done → RAG ingest
// Creator sends this after completing the persona exercise.
// Triggers embedding of all persona fields into creator_content_embeddings.
bot.command("persona_complete", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Your Telegram account isn't linked. Use /start to connect.");
    return;
  }

  await ctx.reply(
    "Indexing your persona for your AI twin... this takes a moment ⏳"
  );

  try {
    const { totalChunks, provider } = await triggerPersonaRagIngest(creator.id);
    console.log(
      `[hermes] /persona_complete creator_id=${creator.id} chunks=${totalChunks} provider=${provider}`
    );
    await ctx.reply(
      `✅ Your AI twin persona is indexed!\n\n${totalChunks} knowledge chunks stored (${provider}).\n\nYour twin will now respond authentically as you.`
    );
  } catch (err) {
    console.error(
      `[hermes] /persona_complete RAG ingest failed creator_id=${creator.id}`,
      err
    );
    await ctx.reply(
      "Something went wrong indexing your persona. Please try /persona_complete again."
    );
  }
});

// /consent — onboarding Step 3: collect consent grants for each AI modality.
// Multi-turn conversation: presents each item individually, then CONFIRM.
bot.command("consent", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Your Telegram account isn't linked. Use /start to connect.");
    return;
  }

  startConsentSession(tgUserId, creator.id);
  const session = getConsentSession(tgUserId)!;

  console.log(`[hermes] /consent started creator_id=${creator.id}`);
  await ctx.reply(buildIntro());
  await ctx.reply(buildCurrentPrompt(session));
});

// /consent_status — show current consent state (resume after drop-off)
bot.command("consent_status", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Your Telegram account isn't linked. Use /start to connect.");
    return;
  }

  const session = getConsentSession(tgUserId);
  if (!session) {
    await ctx.reply(
      "No active consent session. Send /consent to start or resume Step 3."
    );
    return;
  }

  if (session.state === 'confirming') {
    await ctx.reply(buildSummary(session.answers));
    return;
  }

  const answered = Object.keys(session.answers).length;
  await ctx.reply(
    `Consent in progress: ${answered}/${CONSENT_ITEMS.length} items answered.\n\n` +
    buildCurrentPrompt(session)
  );
});

// /revenue — GMV summary. Stub data in Slice 1; real ledger in Slice 2.
bot.command("revenue", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Your Telegram account isn't linked. Use /start to connect.");
    return;
  }

  const stats = await getCreatorStats(creator.id);
  const msg = [
    `*${creator.display_name} — Revenue*`,
    ``,
    `Today GMV: — _(ledger live in Slice 2)_`,
    `This week GMV: — _(ledger live in Slice 2)_`,
    `Credit pack sales: — _(ledger live in Slice 2)_`,
    ``,
    `Active fans: ${stats.activeFanCount}`,
    `Your share: 80% of GMV`,
  ].join("\n");

  await ctx.reply(msg, { parse_mode: "Markdown" });
});

// General text handler — routes YES/NO/CONFIRM/BACK to active consent session.
// All other messages are ignored (no free-form LLM in Slice 1).
bot.on("text", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const session = getConsentSession(tgUserId);
  if (!session) return; // no active session; ignore

  const reply = processConsentMessage(session, tgUserId, ctx.message.text);

  if (reply === null) {
    await ctx.reply("Please reply YES or NO.");
    return;
  }

  // CONFIRM sentinel — run DB write then reply
  if (reply === '__CONFIRM__') {
    try {
      const answers = { ...session.answers };
      const creatorId = session.creatorId;
      await commitConsent(creatorId, answers, telegramIpHash(tgUserId));
      clearConsentSession(tgUserId);
      const msg = hasPersonaTextGrant(answers)
        ? "🎉 Consent recorded. Your twin production is starting now.\nI'll message you when it's ready."
        : "✅ Consent recorded.\n\nNote: Persona / Text was not granted, so your AI twin won't start yet. You can grant it anytime via /consent.";
      console.log(`[hermes] consent confirmed creator_id=${creatorId}`);
      await ctx.reply(msg);
    } catch (err) {
      console.error(`[hermes] consent commit failed creator_id=${session.creatorId}`, err);
      await ctx.reply("Something went wrong saving your consent. Please try again or send /consent to restart.");
    }
    return;
  }

  await ctx.reply(reply);
});

// Launch — webhook in production, long-poll in dev
if (WEBHOOK_URL) {
  const webhookOpts: Parameters<typeof bot.launch>[0] = {
    webhook: {
      domain: WEBHOOK_URL,
      port: Number(process.env.PORT ?? 3001),
      ...(WEBHOOK_SECRET ? { secretToken: WEBHOOK_SECRET } : {}),
    },
  };
  bot.launch(webhookOpts);
  console.log(`[hermes] webhook mode domain=${WEBHOOK_URL}`);
} else {
  bot.launch();
  console.log("[hermes] long-poll mode (dev only)");
}

process.once("SIGTERM", () => bot.stop("SIGTERM"));
process.once("SIGINT", () => bot.stop("SIGINT"));
