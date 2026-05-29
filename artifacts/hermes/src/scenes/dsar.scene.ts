// DSAR (Data Subject Access Request) wizard — COMPLY-04.
//
// Creator types /dsar in Hermes → receives locale-appropriate warning →
// types CONFIRM → twin goes offline IMMEDIATELY (kill_switch_active=true) →
// 24h-delayed BullMQ job sweeps all creator data.
//
// Pitfall 8 ordering: setKillSwitchActive BEFORE enqueue — prevents new fan
// turns from creating data during the grace window (KYC gate returns 423 on
// kill_switch_active=true).
//
// W3 guard: REDIS_URL checked explicitly before any side effects — ioredis
// constructor throws synchronously if URL is invalid, bypassing try/catch.

import { Scenes } from "telegraf";
import { t } from "../i18n.js";
import { setKillSwitchActive, recordDsarRequest } from "../db.js";
import { createAllQueues } from "@workspace/queue";
import type { DsarDeletionPayload } from "@workspace/queue";

interface DsarWizardState {
  creatorId: string;
  lang: 'en' | 'ja' | 'zh-tw';
}

type Ctx = Scenes.WizardContext;

function state(ctx: Ctx): DsarWizardState {
  return ctx.wizard.state as DsarWizardState;
}

export const dsarWizard = new Scenes.WizardScene<Ctx>(
  "dsar-wizard",
  // Step 0 — entry: show deletion warning + confirm prompt
  async (ctx) => {
    const s = state(ctx);
    if (!s.creatorId) {
      await ctx.reply("Could not start DSAR — creator not resolved. Please /start.");
      return ctx.scene.leave();
    }
    await ctx.reply(
      `${t(s.lang).dsarHeader}\n\n${t(s.lang).dsarWarning}\n\n${t(s.lang).dsarConfirmPrompt}`,
    );
    return ctx.wizard.next();
  },
  // Step 1 — CONFIRM gate: validate input, flip kill-switch, enqueue sweep
  async (ctx) => {
    const s = state(ctx);
    const text = (ctx.message as { text?: string } | undefined)?.text;

    if (text !== "CONFIRM") {
      await ctx.reply(t(s.lang).dsarCancelled);
      return ctx.scene.leave();
    }

    // W3: guard REDIS_URL BEFORE any side effects (ioredis throws in constructor)
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      await ctx.reply(t(s.lang).dsarError);
      return ctx.scene.leave();
    }

    try {
      // Pitfall 8: flip kill-switch FIRST — stops new fan turns during grace window
      await setKillSwitchActive(s.creatorId, true);

      const { auditId } = await recordDsarRequest(s.creatorId);

      const queues = createAllQueues(redisUrl);

      const rawDelay = parseInt(process.env.DSAR_TEST_DELAY_MS ?? "", 10);
      const delay =
        !isNaN(rawDelay) && rawDelay > 0 && rawDelay < 24 * 60 * 60 * 1000
          ? rawDelay
          : 24 * 60 * 60 * 1000;

      const payload: DsarDeletionPayload = {
        type: "dsar-deletion",
        creatorId: s.creatorId,
        auditId,
        requestedAt: new Date().toISOString(),
      };

      await queues.dsarDeletion.add("dsar", payload, {
        delay,
        attempts: 3,
        backoff: { type: "exponential", delay: 60_000 },
        jobId: auditId,
      });
      await queues.dsarDeletion.close();

      console.log(
        `[hermes] /dsar confirmed creator=${s.creatorId} auditId=${auditId} delay=${delay}ms`,
      );

      await ctx.reply(
        t(s.lang).dsarConfirmedTemplate.replace("{auditId}", auditId),
      );
    } catch (err) {
      // Kill-switch may already be active — leave it (safe-fail, prevents new data)
      console.error(
        `[hermes] /dsar error creator=${s.creatorId}: ${(err as Error).message}`,
      );
      await ctx.reply(t(s.lang).dsarError);
    }

    return ctx.scene.leave();
  },
);
