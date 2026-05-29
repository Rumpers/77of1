// Hermes — single @7of1_bot creator management agent
// One bot, multi-tenant by creator_id. Webhook-based for production.
import { Telegraf, Scenes } from "telegraf";
import { createHash } from "crypto";
import {
  findCreatorByTelegramId,
  getCreatorStats,
  getCreatorPreferences,
  setPaused,
  getKycRow,
  setMaskReviewed,
} from "./db.js";
import { triggerPersonaRagIngest } from "./onboarding.js";
import {
  moderateImageBytes,
  moderateVideoWithThumbnail,
  writeAssetModerationAudit,
  insertApprovedAsset,
} from "./asset-moderator.js";
import { t } from "./i18n.js";
import { sessionMiddleware } from "./session.js";
import { consentWizard } from "./scenes/consent.scene.js";
import { personaWizard } from "./scenes/persona.scene.js";
import { voiceWizard } from "./scenes/voice.scene.js";
import { dsarWizard } from "./scenes/dsar.scene.js";
import { reviewMasksWizard } from "./scenes/review-masks.scene.js";
import { revokeVoice } from "./revoke-voice.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_LALA;
if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN_LALA is not set");

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const WEB_BASE_URL = process.env.WEB_BASE_URL ?? "https://7of1.app";

const bot = new Telegraf<Scenes.WizardContext>(BOT_TOKEN);

// Persistent session backing + Scenes.Stage wiring. Must be mounted BEFORE any
// command handler that calls ctx.scene.enter(...). Order matters:
//   1. sessionMiddleware (@telegraf/session/pg) — provides ctx.session
//   2. stage.middleware() — provides ctx.scene with wizard-context support
// Founder gate — protects /review_masks and mask callback handlers.
// FOUNDER_TELEGRAM_USER_ID is a comma-separated list of allowed Telegram user_ids.
const FOUNDER_IDS = new Set(
  (process.env.FOUNDER_TELEGRAM_USER_ID ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number),
);
if (FOUNDER_IDS.size === 0) {
  console.warn("[hermes] WARN FOUNDER_TELEGRAM_USER_ID not set — /review_masks is inaccessible");
}
function isFounder(tgUserId: number): boolean {
  return FOUNDER_IDS.has(tgUserId);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const stage = new Scenes.Stage<Scenes.WizardContext>([consentWizard, personaWizard, voiceWizard, dsarWizard, reviewMasksWizard]);
bot.use(sessionMiddleware);
bot.use(stage.middleware());

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

  // KYC-03: surface creator's KYC status (and pending signing URL when present).
  const kyc = await getKycRow(creator.id);
  let kycLine: string;
  if (!kyc) {
    kycLine = "KYC: ⏳ not-yet-started";
  } else if (kyc.status === "signed") {
    kycLine = "KYC: ✓ signed";
  } else if (kyc.status === "pending") {
    kycLine = kyc.signingUrl
      ? `KYC: ⏳ pending — sign here: ${kyc.signingUrl}`
      : "KYC: ⏳ pending";
  } else if (kyc.status === "rejected") {
    kycLine = "KYC: ✗ rejected — contact support";
  } else {
    kycLine = `KYC: ${kyc.status}`;
  }

  const msg = [
    `*${creator.display_name} — Status*`,
    ``,
    `Twin: ${twinState}`,
    `Active fans: ${stats.activeFanCount}`,
    `Credit balance: coming in Slice 2`,
    kycLine,
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
// Backed by Telegraf WizardScene + @telegraf/session/pg (D-02 carried-over).
// Scene state survives Replit restart; sending /consent mid-flow re-enters cleanly.
bot.command("consent", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Your Telegram account isn't linked. Use /start to connect.");
    return;
  }

  console.log(`[hermes] /consent started creator_id=${creator.id} (scene)`);
  await ctx.scene.enter("consent-wizard", { creatorId: creator.id, currentIndex: 0, answers: {} });
});

// /persona — onboarding Step 2 (NEW in 02-07): Character Card V2 wizard.
// Captures 6 persona fields + platform_name + platform_url; writes to
// twins.character_card JSONB; mirrors platform_url into creators.monetizationUrl
// (D-02-10 — CHAT-05 soft CTA data source); writes constitution.md stub to
// Replit Object Storage (D-02-13 — PERSONA-02).
bot.command("persona", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Your Telegram account isn't linked. Use /start to connect.");
    return;
  }

  console.log(`[hermes] /persona started creator_id=${creator.id} (scene)`);
  await ctx.scene.enter("persona-wizard", {
    creatorId: creator.id,
    creatorName: creator.display_name,
    currentIndex: 0,
    answers: {},
  });
});

// /voice — onboarding voice-sample component (D-02-02, ONBOARD-01).
// Enters voice-wizard scene; creator sends a 6+ second voice note, scene
// downloads from Telegram and uploads to Replit Object Storage at
// `creators/{creatorId}/voice_reference.{ogg|wav}`; URL written to
// twins.voice_reference_url. Graceful-degrade reply when bucket env unset.
bot.command("voice", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Your Telegram account isn't linked. Use /start to connect.");
    return;
  }

  console.log(`[hermes] /voice started creator_id=${creator.id} (scene)`);
  await ctx.scene.enter("voice-wizard", { creatorId: creator.id });
});

// /review_masks — ONBOARD-04. Founder-only inline review queue for fan-name masks.
bot.command("review_masks", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;
  const creator = await findCreatorByTelegramId(tgUserId);
  const prefs = creator ? await getCreatorPreferences(creator.id) : null;
  const hermesLang = prefs?.hermes_language ?? "en";
  const lang: "en" | "ja" | "zh-tw" =
    hermesLang === "ja" || hermesLang === "zh-tw" ? hermesLang : "en";
  if (!isFounder(tgUserId)) {
    await ctx.reply(t(lang).reviewMasksUnauthorized);
    return;
  }
  await ctx.scene.enter("review-masks-wizard", { lang });
});

// mask:(approve|reject):<uuid> — callback from review-masks inline buttons.
bot.action(/^mask:(approve|reject):(.+)$/, async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId || !isFounder(tgUserId)) {
    await ctx.answerCbQuery("Forbidden");
    return;
  }
  const decision = ctx.match[1];
  const id = ctx.match[2];
  if (!UUID_RE.test(id)) {
    await ctx.answerCbQuery("Invalid id");
    return;
  }
  await setMaskReviewed(id, decision === "approve");
  const creator = await findCreatorByTelegramId(tgUserId);
  const prefs = creator ? await getCreatorPreferences(creator.id) : null;
  const hermesLang = prefs?.hermes_language ?? "en";
  const lang: "en" | "ja" | "zh-tw" =
    hermesLang === "ja" || hermesLang === "zh-tw" ? hermesLang : "en";
  await ctx.answerCbQuery(
    decision === "approve" ? t(lang).reviewMasksApprovedAck : t(lang).reviewMasksRejectedAck,
  );
  try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch { /* message may be old */ }
  await ctx.scene.enter("review-masks-wizard", { lang });
});

// /dsar — COMPLY-04. Creator requests full data deletion; twin goes offline
// immediately and a 24h-delayed worker sweep clears all data.
bot.command("dsar", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Use /start to link first.");
    return;
  }

  const prefs = await getCreatorPreferences(creator.id);
  const hermesLang = prefs?.hermes_language ?? 'en';
  const lang: 'en' | 'ja' | 'zh-tw' =
    hermesLang === 'ja' || hermesLang === 'zh-tw' ? hermesLang : 'en';

  console.log(`[hermes] /dsar started creator_id=${creator.id} lang=${lang}`);
  await ctx.scene.enter("dsar-wizard", { creatorId: creator.id, lang });
});

// /revoke_voice — ONBOARD-03. Revoke voice consent; cancel in-flight voice
// generations via the consent-revocation worker within ≤60s SLA. The DB write
// (consent_grants.granted=false + revokedAt) is the legal-source-of-truth and
// runs synchronously; the BullMQ job sweeps generation_jobs WHERE
// consent_grant_id matches AND status IN ('queued','processing').
bot.command("revoke_voice", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Your Telegram account isn't linked. Use /start to connect.");
    return;
  }

  const result = await revokeVoice(creator.id);

  if (!result.ok && result.reason === "no_active_grant") {
    await ctx.reply("Voice consent is not currently active — nothing to revoke.");
    return;
  }

  const queuedNote = result.queued
    ? "In-flight voice generations are being cancelled now."
    : "DB grant updated. (Queue worker offline — manual sweep may be needed.)";
  await ctx.reply(`Voice consent revoked. ${queuedNote}`);
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

// ── Asset upload handlers (HID-059) ──────────────────────────────────────────
// Handles photos and videos sent by creators during onboarding Step 1.
// Every file is moderated via GMI vision before being stored.
// Telegram file size limits: photos ≤20 MB, videos ≤20 MB for bot downloads;
// larger files (sent as documents) are handled by the "document" handler below.

async function downloadTelegramFile(
  bot: Telegraf,
  fileId: string,
): Promise<Buffer | null> {
  try {
    const link = await bot.telegram.getFileLink(fileId);
    const res = await fetch(link.href);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf;
  } catch (err) {
    console.error(`[hermes] file download failed fileId=${fileId}: ${(err as Error).message}`);
    return null;
  }
}

bot.on("photo", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Your Telegram account isn't linked. Use /start to connect.");
    return;
  }

  // Telegram sends an array of PhotoSize; pick the highest resolution.
  const photos = ctx.message.photo;
  const largest = photos[photos.length - 1];
  if (!largest) return;

  await ctx.reply("🔍 Checking your photo…");

  const bytes = await downloadTelegramFile(bot, largest.file_id);
  if (!bytes) {
    await ctx.reply("❌ Could not download your photo. Please try again.");
    return;
  }

  let result;
  try {
    result = await moderateImageBytes(bytes, "image/jpeg");
  } catch (err) {
    console.error(`[hermes] photo moderation error creator=${creator.id}: ${(err as Error).message}`);
    await ctx.reply("⚠️ Content check temporarily unavailable. Please try again in a moment.");
    return;
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storagePath = `creators/${creator.id}/assets/${sha256}.jpg`;

  if (!result.passed) {
    const categories = result.flaggedCategories.length
      ? result.flaggedCategories.join(", ")
      : "content policy";
    await writeAssetModerationAudit({
      creatorId: creator.id as string,
      assetId: null,
      assetType: "photo",
      channel: "telegram",
      result,
    });
    console.warn(
      `[hermes] photo rejected creator=${creator.id} categories=${categories} confidence=${result.confidence.toFixed(2)}`,
    );
    await ctx.reply(
      `❌ This photo was rejected by our content safety system (${categories}).\n\n` +
        "Please upload a different photo. If you think this is an error, contact support.",
    );
    return;
  }

  const assetId = await insertApprovedAsset({
    creatorId: creator.id as string,
    assetType: "photo",
    storagePath,
  });

  await writeAssetModerationAudit({
    creatorId: creator.id as string,
    assetId,
    assetType: "photo",
    channel: "telegram",
    result,
  });

  console.log(`[hermes] photo approved creator=${creator.id} assetId=${assetId}`);
  await ctx.reply("✅ Photo received and approved.");
});

bot.on("video", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) {
    await ctx.reply("Your Telegram account isn't linked. Use /start to connect.");
    return;
  }

  const video = ctx.message.video;
  if (!video) return;

  await ctx.reply("🔍 Checking your video…");

  // Download video bytes and thumbnail (if available).
  const [videoBytes, thumbBytes] = await Promise.all([
    downloadTelegramFile(bot, video.file_id),
    video.thumbnail?.file_id
      ? downloadTelegramFile(bot, video.thumbnail.file_id)
      : Promise.resolve(null),
  ]);

  if (!videoBytes) {
    await ctx.reply("❌ Could not download your video. Please try again.");
    return;
  }

  let result;
  try {
    result = await moderateVideoWithThumbnail(thumbBytes, videoBytes);
  } catch (err) {
    console.error(`[hermes] video moderation error creator=${creator.id}: ${(err as Error).message}`);
    await ctx.reply("⚠️ Content check temporarily unavailable. Please try again in a moment.");
    return;
  }

  const sha256 = createHash("sha256").update(videoBytes).digest("hex");
  const storagePath = `creators/${creator.id}/assets/${sha256}.mp4`;

  if (!result.passed) {
    const categories = result.flaggedCategories.length
      ? result.flaggedCategories.join(", ")
      : "content policy";
    await writeAssetModerationAudit({
      creatorId: creator.id as string,
      assetId: null,
      assetType: "video",
      channel: "telegram",
      result,
    });
    console.warn(
      `[hermes] video rejected creator=${creator.id} categories=${categories}`,
    );
    await ctx.reply(
      `❌ This video was rejected by our content safety system (${categories}).\n\n` +
        "Please upload a different video. If you think this is an error, contact support.",
    );
    return;
  }

  const assetId = await insertApprovedAsset({
    creatorId: creator.id as string,
    assetType: "video",
    storagePath,
  });

  await writeAssetModerationAudit({
    creatorId: creator.id as string,
    assetId,
    assetType: "video",
    channel: "telegram",
    result,
  });

  console.log(`[hermes] video approved creator=${creator.id} assetId=${assetId}`);
  await ctx.reply("✅ Video received and approved.");
});

// Documents (files > 20 MB sent as documents) — moderate as photo or video
// based on MIME type reported by Telegram.
bot.on("document", async (ctx) => {
  const tgUserId = ctx.from?.id;
  if (!tgUserId) return;

  const creator = await findCreatorByTelegramId(tgUserId);
  if (!creator) return;

  const doc = ctx.message.document;
  const mimeType = doc.mime_type ?? "";
  const isPhoto = mimeType.startsWith("image/");
  const isVideo = mimeType.startsWith("video/");
  if (!isPhoto && !isVideo) return; // not an asset type we care about

  await ctx.reply(`🔍 Checking your ${isPhoto ? "photo" : "video"}…`);

  const bytes = await downloadTelegramFile(bot, doc.file_id);
  if (!bytes) {
    await ctx.reply("❌ Could not download the file. Please try again.");
    return;
  }

  let result;
  try {
    result = isPhoto
      ? await moderateImageBytes(bytes, mimeType)
      : await moderateVideoWithThumbnail(null, bytes);
  } catch (err) {
    console.error(`[hermes] document moderation error creator=${creator.id}: ${(err as Error).message}`);
    await ctx.reply("⚠️ Content check temporarily unavailable. Please try again in a moment.");
    return;
  }

  const assetType = isPhoto ? "photo" : "video";
  const ext = mimeType.split("/")[1] ?? (isPhoto ? "jpg" : "mp4");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storagePath = `creators/${creator.id}/assets/${sha256}.${ext}`;

  if (!result.passed) {
    await writeAssetModerationAudit({
      creatorId: creator.id as string,
      assetId: null,
      assetType,
      channel: "telegram",
      result,
    });
    const categories = result.flaggedCategories.join(", ") || "content policy";
    await ctx.reply(
      `❌ This file was rejected by our content safety system (${categories}).\n\n` +
        "Please upload a different file.",
    );
    return;
  }

  const assetId = await insertApprovedAsset({
    creatorId: creator.id as string,
    assetType,
    storagePath,
  });

  await writeAssetModerationAudit({
    creatorId: creator.id as string,
    assetId,
    assetType,
    channel: "telegram",
    result,
  });

  await ctx.reply(`✅ File received and approved.`);
});

// Note: free-form text is now consumed by the active Scenes.Stage (consent or
// persona wizard). When no scene is active, text messages are ignored — there
// is no free-form LLM on Hermes (creators talk to fans via the fan-twin bot).

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
