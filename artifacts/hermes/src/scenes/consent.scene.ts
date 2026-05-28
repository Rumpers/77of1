// Telegraf WizardScene for the consent flow — replaces the in-memory Map state
// machine that lived in consent.ts (ONBOARD-01, D-02 carried-over from Phase 1).
//
// Source: RESEARCH Pattern 6 + PATTERNS D1.
//
// State persists in `ctx.scene.session.state` (typed `ConsentWizardState`); the
// outer Telegraf session is backed by @telegraf/session/pg so a Replit restart
// mid-flow does NOT lose progress.
//
// The original consent.ts re-ask semantics are preserved: persona_text is
// required; a YES advances normally, a first NO surfaces the "your twin needs
// this — want to grant it?" hard-block prompt, and a second NO ends the scene
// (creator can /consent again later).

import { Scenes } from "telegraf";
import {
  CONSENT_ITEMS,
  CONSENT_VERSION,
  commitConsent,
  telegramIpHash,
  hasPersonaTextGrant,
  buildIntro,
  buildSummary,
  type ConsentAnswers,
  type ConsentGrantType,
} from "../consent.js";

export interface ConsentWizardState {
  creatorId: string;
  currentIndex: number;
  answers: ConsentAnswers;
  awaitingPersonaReask?: boolean;
}

type Ctx = Scenes.WizardContext;

function state(ctx: Ctx): ConsentWizardState {
  return ctx.wizard.state as ConsentWizardState;
}

function promptFor(index: number): string {
  const item = CONSENT_ITEMS[index];
  return `${item.emoji} ${item.label}\n${item.prompt}`;
}

function parseYesNo(text: string | undefined): boolean | null {
  if (!text) return null;
  const upper = text.trim().toUpperCase();
  if (upper === "YES") return true;
  if (upper === "NO") return false;
  return null;
}

async function finish(ctx: Ctx): Promise<void> {
  const s = state(ctx);
  try {
    const tgUserId = ctx.from?.id;
    if (!tgUserId) {
      await ctx.reply("Could not identify your Telegram account. Please /consent again.");
      await ctx.scene.leave();
      return;
    }
    await commitConsent(s.creatorId, s.answers, telegramIpHash(tgUserId));
    const msg = hasPersonaTextGrant(s.answers)
      ? "🎉 Consent recorded. Your twin production is starting now.\nI'll message you when it's ready."
      : "✅ Consent recorded.\n\nNote: Persona / Text was not granted, so your AI twin won't start yet. You can grant it anytime via /consent.";
    console.log(`[hermes] consent confirmed creator_id=${s.creatorId} (scene)`);
    await ctx.reply(buildSummary(s.answers));
    await ctx.reply(msg);
  } catch (err) {
    console.error(`[hermes] consent commit failed creator_id=${s.creatorId} (scene)`, err);
    await ctx.reply(
      "Something went wrong saving your consent. Please send /consent to restart."
    );
  } finally {
    await ctx.scene.leave();
  }
}

export const consentWizard = new Scenes.WizardScene<Ctx>(
  "consent-wizard",
  // Step 0 — entry: initialise state, show intro + first prompt
  async (ctx) => {
    const s = state(ctx);
    if (!s.creatorId) {
      await ctx.reply("Could not start consent — creator not resolved. Please /start.");
      return ctx.scene.leave();
    }
    s.currentIndex = 0;
    s.answers = {};
    s.awaitingPersonaReask = false;
    await ctx.reply(buildIntro());
    await ctx.reply(promptFor(0));
    return ctx.wizard.next();
  },
  // Step 1 — loop: parse YES/NO for the current item; advance or branch.
  async (ctx) => {
    const s = state(ctx);
    const text = (ctx.message as { text?: string } | undefined)?.text;
    const answer = parseYesNo(text);
    if (answer === null) {
      await ctx.reply("Please reply YES or NO.");
      return; // stay on this step
    }

    const item = CONSENT_ITEMS[s.currentIndex];

    // ── persona_text re-ask branch (preserves original consent.ts behaviour) ──
    if (item.grantType === "persona_text" && s.awaitingPersonaReask) {
      if (!answer) {
        await ctx.reply(
          "No problem — your account is saved. When you're ready, send /consent to continue."
        );
        return ctx.scene.leave();
      }
      // Granted on re-ask — record and advance
      s.answers["persona_text"] = true;
      s.awaitingPersonaReask = false;
      s.currentIndex = 1;
      await ctx.reply("✅ PERSONA / TEXT TWIN — granted.");
      if (s.currentIndex >= CONSENT_ITEMS.length) {
        return finish(ctx);
      }
      await ctx.reply(promptFor(s.currentIndex));
      return;
    }

    // ── persona_text first-pass refusal: surface hard-block prompt ──
    if (item.grantType === "persona_text" && !answer) {
      s.answers["persona_text"] = false;
      s.awaitingPersonaReask = true;
      await ctx.reply(
        "Your AI twin needs the Persona / Text permission to work.\n" +
          "Without it, I can't create a twin for you.\n\n" +
          "Want to grant it? Reply YES to grant, NO to pause for now."
      );
      return;
    }

    // ── Normal answer ──
    s.answers[item.grantType as ConsentGrantType] = answer;
    const icon = answer ? "✅" : "❌";
    await ctx.reply(`${icon} ${item.label} — ${answer ? "granted" : "not granted"}.`);

    s.currentIndex += 1;
    if (s.currentIndex >= CONSENT_ITEMS.length) {
      return finish(ctx);
    }
    await ctx.reply(promptFor(s.currentIndex));
    return; // stay on this step until all items answered
  }
);

// Re-export for index.ts smoke tests and unit tests.
export { CONSENT_ITEMS, CONSENT_VERSION };
