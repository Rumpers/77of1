// Hermes — single @7of1_bot creator management agent
// Architecture: one bot, multi-tenant per creator_id (see PRD §22.2)
// Webhook-based, not polling
import { Telegraf } from "telegraf";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set");

const WEBHOOK_URL = process.env.WEBHOOK_URL;

const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
  // TODO: check if Telegram user_id is linked to a creator account
  // If not: send OAuth deep-link to connect
  // If yes: load creator context and greet
  await ctx.reply(
    "Welcome to 7of1 Hermes. Connect your creator account to get started.\n\n/connect to link your account."
  );
});

bot.command("connect", async (ctx) => {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return;
  // TODO: generate magic link for creator account linkage
  await ctx.reply(`Connect your account at: [7of1 connect link — TODO]`);
});

bot.command("status", async (ctx) => {
  // TODO: load creator context and return dashboard summary
  await ctx.reply("Status: not yet implemented");
});

if (WEBHOOK_URL) {
  bot.launch({ webhook: { domain: WEBHOOK_URL, port: 3001 } });
  console.log(`[hermes] webhook mode url=${WEBHOOK_URL}`);
} else {
  bot.launch();
  console.log("[hermes] long-poll mode (dev only)");
}

process.on("SIGTERM", () => bot.stop("SIGTERM"));
process.on("SIGINT", () => bot.stop("SIGINT"));
