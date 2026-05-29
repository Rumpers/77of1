// ONBOARD-04: founder review queue for OCR-extracted fan-name masks.
// OCR ingestion is deferred to creator #3+; this ships the review UI scaffold.
// bot.action callbacks live in index.ts (must be at bot scope, not scene scope).

import { Scenes, Markup } from "telegraf";
import { t } from "../i18n.js";
import { getNextPendingMask } from "../db.js";

interface ReviewMasksWizardState {
  lang: 'en' | 'ja' | 'zh-tw';
}

type Ctx = Scenes.WizardContext;

function state(ctx: Ctx): ReviewMasksWizardState {
  return ctx.wizard.state as ReviewMasksWizardState;
}

export const reviewMasksWizard = new Scenes.WizardScene<Ctx>(
  "review-masks-wizard",
  async (ctx) => {
    const { lang } = state(ctx);

    const next = await getNextPendingMask();
    if (!next) {
      await ctx.reply(t(lang).reviewMasksEmpty);
      return ctx.scene.leave();
    }

    const body = t(lang).reviewMasksRowTemplate
      .replace("{n}", "1")
      .replace("{creatorHandle}", next.creatorHandle)
      .replace("{handle}", next.handle)
      .replace("{candidate}", next.candidate)
      .replace("{source}", next.source ?? "OCR");

    await ctx.reply(body, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        Markup.button.callback(
          t(lang).reviewMasksApproveButton,
          `mask:approve:${next.id}`,
        ),
        Markup.button.callback(
          t(lang).reviewMasksRejectButton,
          `mask:reject:${next.id}`,
        ),
      ]),
    });
    // Stay in scene; bot.action handler calls ctx.scene.enter to show next row.
  },
);
