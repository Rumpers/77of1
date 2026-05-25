// Hermes — single @7of1_bot creator management agent
// One bot, multi-tenant by creator_id. Webhook-based for production.
import { Telegraf, Markup } from "telegraf";
import {
  findCreatorByTelegramId,
  getCreatorStats,
  setPaused,
  getTotpRecord,
  saveTotpEnabled,
  disableTotpRecord,
  updateRecoveryCodes,
  listFansForCreator,
  blockFan,
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
import {
  generateTotpSecret,
  buildOtpAuthUri,
  buildQrCodeBuffer,
  verifyTotpCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyAndConsumeCode,
} from "./totp.js";
import {
  startTotpSession,
  getTotpSession,
  clearTotpSession,
} from "./totp-session.js";

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

// /setup_2fa — start TOTP setup flow (multi-turn: send QR → user confirms with 6-digit code)
bot.command("setup_2fa", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Your Telegram account isn't linked. Use /start to connect.");
    return;
  }

  const existing = await getTotpRecord(creator.id);
  if (existing?.totp_enabled) {
    await ctx.reply(
      "✅ 2FA is already enabled on your account.\n\nUse /disable_2fa to turn it off, or /2fa_status to check your status."
    );
    return;
  }

  const secret = generateTotpSecret();
  const otpauthUri = buildOtpAuthUri(secret, creator.display_name);

  startTotpSession(tgUserId, "setup", creator.id, secret);

  try {
    const qrBuffer = await buildQrCodeBuffer(otpauthUri);
    await ctx.replyWithPhoto(
      { source: qrBuffer },
      {
        caption:
          "📱 *Set up 2FA — Step 1 of 2*\n\n" +
          "Scan this QR code with *Authy* or *Google Authenticator*.\n\n" +
          "Or enter this key manually:\n`" +
          secret +
          "`\n\n" +
          "Once you've added the account, send me the *6-digit code* it shows.",
        parse_mode: "Markdown",
      }
    );
  } catch {
    await ctx.reply(
      "📱 *Set up 2FA — Step 1 of 2*\n\n" +
        "Add this key manually to *Authy* or *Google Authenticator*:\n`" +
        secret +
        "`\n\nOnce added, send me the *6-digit code* it shows.",
      { parse_mode: "Markdown" }
    );
  }
});

// /disable_2fa — disable TOTP (requires current 6-digit code to confirm)
bot.command("disable_2fa", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Your Telegram account isn't linked. Use /start to connect.");
    return;
  }

  const record = await getTotpRecord(creator.id);
  if (!record?.totp_enabled) {
    await ctx.reply("2FA is not enabled on your account.");
    return;
  }

  startTotpSession(tgUserId, "disable", creator.id);
  await ctx.reply(
    "⚠️ To disable 2FA, send your current *6-digit TOTP code* from your authenticator app.",
    { parse_mode: "Markdown" }
  );
});

// /2fa_status — show current 2FA state
bot.command("2fa_status", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Your Telegram account isn't linked. Use /start to connect.");
    return;
  }

  const record = await getTotpRecord(creator.id);
  if (!record?.totp_enabled) {
    await ctx.reply(
      "🔓 *2FA is not enabled.*\n\nEnable it now with /setup_2fa\n\n_Required before payout can be enabled._",
      { parse_mode: "Markdown" }
    );
    return;
  }

  const codesLeft = record.recovery_codes.length;
  await ctx.reply(
    `🔐 *2FA is enabled.*\n\nRecovery codes remaining: ${codesLeft}/8\n\nUse /disable_2fa to turn off.`,
    { parse_mode: "Markdown" }
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

// /fans — list recent fans with inline block buttons (OF-131)
bot.command("fans", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Your Telegram account isn't linked. Use /start to connect.");
    return;
  }

  const fans = await listFansForCreator(creator.id);
  if (fans.length === 0) {
    await ctx.reply("No fans found for your account yet.");
    return;
  }

  await ctx.reply(`*${creator.display_name} — Fans* (${fans.length} shown)\n\nTap 🚫 to block a fan and refund their credits.`, {
    parse_mode: "Markdown",
  });

  for (const fan of fans) {
    const label = fan.replit_user_id ? `@${fan.replit_user_id}` : `Fan ${fan.id.slice(0, 8)}`;
    const since = new Date(fan.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    await ctx.reply(
      `${label} · ${fan.tier} · joined ${since}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("🚫 Block this fan", `block_fan:${fan.id}`)],
      ])
    );
  }
});

// Inline button callback: execute fan block (OF-131)
// Triggered by "🚫 Block this fan" buttons in /fans listing.
// SLA: block write ≤5s. Refunds remaining credits automatically.
bot.action(/^block_fan:(.+)$/, async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const fanId = ctx.match[1];

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.answerCbQuery("Account not linked. Use /start.", { show_alert: true });
    return;
  }

  try {
    const t0 = Date.now();
    const { elapsed, creditsRefunded } = await blockFan(creator.id, fanId);
    const total = Date.now() - t0;
    console.log(
      `[hermes] block_fan callback tg_user_id=${tgUserId} creator_id=${creator.id} fan_id=${fanId} total_ms=${total}`
    );

    const refundText = creditsRefunded > 0
      ? `\n\n💰 ${creditsRefunded} credit${creditsRefunded === 1 ? "" : "s"} refunded.`
      : "";

    await ctx.editMessageText(
      `✅ Fan blocked. They can no longer reach your twin.${refundText}\n\n_(Block write: ${elapsed}ms)_`,
      { parse_mode: "Markdown" }
    );
    await ctx.answerCbQuery();
  } catch (err) {
    console.error(
      `[hermes] block_fan failed creator_id=${creator.id} fan_id=${fanId}`,
      err
    );
    await ctx.answerCbQuery("Block failed. Please try again.", { show_alert: true });
  }
});

// /delete_account — initiate creator account deletion (HID-006 / §8.4, §16)
// Requires the creator to confirm their intent by replying CONFIRM within 60s.
// Actual deletion is processed via the API server; grace window is 7 days.
bot.command("delete_account", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Your Telegram account isn't linked. Use /start to connect.");
    return;
  }

  const WEB_DELETE_URL = `${WEB_BASE_URL}/en/dashboard/settings/delete-account`;
  await ctx.reply(
    [
      "⚠️ *Account Deletion — Permanent Action*",
      "",
      "Deleting your creator account will permanently remove:",
      "• AI Twin persona (text, voice, video models)",
      "• RAG knowledge base and LoRA fine-tune",
      "• Voice clone and all derived assets",
      "• All fan conversation history",
      "",
      "Consent records and audit trail are retained per legal requirements (§8.3).",
      "",
      "You will have a *7-day grace window* to cancel after submitting.",
      "Deletion is completed within *72 hours* after the grace window.",
      "",
      "To proceed, use the web dashboard:",
      WEB_DELETE_URL,
      "",
      "_Telegram-initiated deletion requires web confirmation for account security._",
    ].join("\n"),
    { parse_mode: "Markdown" }
  );
});

// General text handler — TOTP codes during 2FA setup/disable, then consent session YES/NO/CONFIRM.
// All other messages ignored (no free-form LLM in Slice 1).
bot.on("text", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  // Route 6-digit codes to active TOTP session (setup or disable)
  const totpSession = getTotpSession(tgUserId);
  if (totpSession) {
    const text = ctx.message.text.replace(/\s/g, "");
    const is6Digits = /^\d{6}$/.test(text);

    if (!is6Digits) {
      await ctx.reply("Please send the 6-digit code from your authenticator app.");
      return;
    }

    if (totpSession.mode === "setup") {
      const valid = verifyTotpCode(totpSession.secret!, text);
      if (!valid) {
        await ctx.reply(
          "❌ Invalid code. Check your authenticator app and try again, or send /setup_2fa to restart."
        );
        return;
      }

      clearTotpSession(tgUserId);
      const rawCodes = generateRecoveryCodes();
      const hashedCodes = rawCodes.map(hashRecoveryCode);

      try {
        await saveTotpEnabled(totpSession.creatorId, totpSession.secret!, hashedCodes);
      } catch (err) {
        console.error(`[hermes] 2FA save failed creator_id=${totpSession.creatorId}`, err);
        await ctx.reply("Something went wrong saving your 2FA setup. Please try /setup_2fa again.");
        return;
      }

      const codesText = rawCodes.map((c, i) => `${i + 1}. \`${c}\``).join("\n");
      await ctx.reply(
        "🔐 *2FA enabled!*\n\n" +
          "Save these recovery codes somewhere safe — each can be used once if you lose your authenticator:\n\n" +
          codesText +
          "\n\n⚠️ These codes will not be shown again.",
        { parse_mode: "Markdown" }
      );
      console.log(`[hermes] 2FA enabled creator_id=${totpSession.creatorId}`);
      return;
    }

    if (totpSession.mode === "disable") {
      const creator = await findCreatorByTelegramId(tgUserId);
      if (!creator) {
        clearTotpSession(tgUserId);
        return;
      }

      const record = await getTotpRecord(creator.id);
      if (!record?.totp_enabled) {
        clearTotpSession(tgUserId);
        await ctx.reply("2FA is not enabled.");
        return;
      }

      let valid = verifyTotpCode(record.totp_secret, text);

      if (!valid) {
        const { valid: recoveryValid, remaining } = verifyAndConsumeCode(text, record.recovery_codes);
        if (recoveryValid) {
          await updateRecoveryCodes(creator.id, remaining);
          valid = true;
        }
      }

      if (!valid) {
        await ctx.reply("❌ Invalid code. Send /disable_2fa to try again.");
        clearTotpSession(tgUserId);
        return;
      }

      clearTotpSession(tgUserId);
      await disableTotpRecord(creator.id);
      console.log(`[hermes] 2FA disabled creator_id=${creator.id}`);
      await ctx.reply("🔓 2FA has been disabled. Use /setup_2fa to re-enable it.");
      return;
    }

    return;
  }

  const session = getConsentSession(tgUserId);
  if (!session) return;

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
