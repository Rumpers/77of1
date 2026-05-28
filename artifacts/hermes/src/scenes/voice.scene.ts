// Telegraf WizardScene for the /voice intake flow.
//
// Closes the voice-sample component of ONBOARD-01 (D-02-02): downloads the
// creator's Telegram voice note, uploads it to Replit Object Storage at
// `creators/{creatorId}/voice_reference.{ogg|wav}`, and writes the resulting
// URL onto twins.voice_reference_url.
//
// Two steps:
//   0. Entry — prompt "send me a 6+ second voice note", advance to capture
//   1. Capture — on ctx.message.voice:
//        * reject duration < MIN_VOICE_DURATION_SECONDS (stay in scene to retry)
//        * downloadTelegramFile via existing pattern
//        * uploadVoiceReference (catches missing-bucket error → graceful-degrade reply)
//        * writeVoiceReferenceUrl
//        * success reply → leave
//
// Per D-02-02, XTTS synthesis stays Phase 3; this plan only owns the storage hop.
//
// Per the plan's <must_haves.truths>:
//   "Voice scene defers gracefully if Replit Object Storage bucket not yet set
//    up — replies with 'Voice upload not yet available — your other onboarding
//    is complete' and exits."
// The graceful-degrade is implemented by catching the "REPLIT_OBJECT_STORAGE_BUCKET
// (or REPLIT_OBJECT_STORAGE_BASE_URL) is not set" error from object-storage.ts.

import { Scenes } from "telegraf";
import { uploadVoiceReference } from "../lib/object-storage.js";
import { writeVoiceReferenceUrl } from "../db.js";

export const MIN_VOICE_DURATION_SECONDS = 6;

interface VoiceWizardState {
  creatorId: string;
}

type Ctx = Scenes.WizardContext;
function state(ctx: Ctx): VoiceWizardState {
  return ctx.wizard.state as VoiceWizardState;
}

// Heuristic to detect the missing-bucket error vs a genuine storage outage.
// object-storage.ts throws with this exact prefix when neither env var is set.
function isMissingBucketError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /REPLIT_OBJECT_STORAGE_BUCKET/.test(err.message);
}

// Telegram voice messages carry a `voice` object with file_id, duration (seconds)
// and an optional mime_type ("audio/ogg" in practice for Telegram clients).
interface TelegramVoice {
  file_id: string;
  duration: number;
  mime_type?: string;
}

function readVoice(ctx: Ctx): TelegramVoice | null {
  const msg = ctx.message as { voice?: TelegramVoice } | undefined;
  return msg?.voice ?? null;
}

// Download the voice file bytes. Inlined here (not imported from index.ts) to
// keep the scene self-contained and testable without mounting the bot. Mirrors
// the pattern from index.ts `downloadTelegramFile`.
async function downloadVoiceFile(ctx: Ctx, fileId: string): Promise<Buffer | null> {
  try {
    const link = await ctx.telegram.getFileLink(fileId);
    const res = await fetch(link.href);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error(
      `[hermes] voice download failed fileId=${fileId}: ${(err as Error).message}`,
    );
    return null;
  }
}

const enterStep = async (ctx: Ctx): Promise<unknown> => {
  const s = state(ctx);
  if (!s.creatorId) {
    await ctx.reply("Could not start voice wizard — creator not resolved. Please /start.");
    return ctx.scene.leave();
  }
  await ctx.reply(
    `Send me a ${MIN_VOICE_DURATION_SECONDS}+ second voice note in your natural ` +
      "speaking voice. I'll use it as the reference clip for your AI twin's voice.\n\n" +
      "Record directly in Telegram (microphone icon → hold to record).",
  );
  return ctx.wizard.next();
};

const captureStep = async (ctx: Ctx): Promise<unknown> => {
  const s = state(ctx);
  const voice = readVoice(ctx);

  if (!voice) {
    await ctx.reply(
      "I need a voice note (microphone icon → hold to record). " +
        "Text, photos, and other files won't work for this step. " +
        "Try again or send /cancel to exit.",
    );
    return undefined; // stay in scene
  }

  if (voice.duration < MIN_VOICE_DURATION_SECONDS) {
    await ctx.reply(
      `That voice note was ${voice.duration}s — too short. ` +
        `Please send one at least ${MIN_VOICE_DURATION_SECONDS} seconds long.`,
    );
    return undefined; // stay in scene to retry
  }

  const buffer = await downloadVoiceFile(ctx, voice.file_id);
  if (!buffer) {
    await ctx.reply(
      "Couldn't download that voice note from Telegram. Please try sending it again.",
    );
    return undefined; // stay in scene
  }

  const mimeType = voice.mime_type ?? "audio/ogg";

  try {
    const { url } = await uploadVoiceReference(s.creatorId, buffer, { mimeType });
    const { updated } = await writeVoiceReferenceUrl(s.creatorId, url);
    if (!updated) {
      console.warn(
        `[hermes] voice ref uploaded but no twins row to update creator=${s.creatorId}`,
      );
      await ctx.reply(
        "Voice sample uploaded, but you haven't completed /persona yet. " +
          "Run /persona first to create your twin profile.",
      );
    } else {
      await ctx.reply(
        "Voice sample stored. Use /done to finish onboarding, or /status to check your twin.",
      );
    }
    return ctx.scene.leave();
  } catch (err) {
    if (isMissingBucketError(err)) {
      console.warn(
        `[hermes] /voice graceful-degrade — bucket env unset creator=${s.creatorId}`,
      );
      await ctx.reply(
        "Voice upload not yet available — your other onboarding is complete. " +
          "We'll set this up before launch.",
      );
      return ctx.scene.leave();
    }
    console.error(
      `[hermes] /voice upload failed creator=${s.creatorId}: ${(err as Error).message}`,
    );
    await ctx.reply(
      "Something went wrong storing your voice sample. Please send /voice to try again.",
    );
    return ctx.scene.leave();
  }
};

export const voiceWizard = new Scenes.WizardScene<Ctx>(
  "voice-wizard",
  enterStep,
  captureStep,
);
