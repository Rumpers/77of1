// Hermes — single @7of1_bot creator management agent
// One bot, multi-tenant by creator_id. Webhook-based for production.
import { Telegraf } from "telegraf";
import {
  findCreatorByTelegramId,
  getCreatorStats,
  setPaused,
} from "./db.js";

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
