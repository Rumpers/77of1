// 6-layer moderation pipeline wrappers (MOD-01 + MOD-03 + MOD-04/05/06).
// Splices into routes/twin.ts and the worker text-generation job (Phase 2
// scope is api-server only; worker integration lands in plan 02-06b).
//
// Layers covered by this module:
//   L1 (input)   — runL1Moderation called BEFORE LLM
//   L3 (output)  — runL3Moderation called AFTER LLM, before persist
//   L4 (deflect) — composeFlaggedReply pulls strings from deflections.ts
//   L5 (notify)  — notifyFounderAsync fired on high-severity flags
//   L6 (audit)   — writeSafetyAuditLog written on every flagged turn
//
// L2 (system-prompt guardrail) is owned by lib/system-prompt.ts (D-02-15) and
// is NOT re-implemented here. The LLM already sees the L2 instructions in its
// system message; this module is responsible only for input + output checks.
//
// Provider registration (added in plan 02-06a refactor):
//   The api-server (and worker) MUST call `setModeratorProviderFactory()` at
//   bootstrap, supplying its `getModeratorProvider` function. twin-runtime is
//   provider-agnostic — it owns the moderation _pipeline_ but the concrete
//   IModeratorProvider implementation (OpenAI, mock) lives in the consumer.
//   See `artifacts/api-server/src/lib/moderation.ts` for the registration shim.

import type { IModeratorProvider, ModerationResult } from "./provider-types.js";
import { ProviderError, ProviderTransientError } from "./provider-types.js";
import { getDeflection } from "./deflections.js";
import { getHelpline } from "./helplines.js";
import { notifyFounderAsync } from "./notify-founder.js";
import { writeSafetyAuditLog, type CrisisLevel } from "./safety-audit.js";
import { logger } from "./logger.js";

// ─── Provider injection ──────────────────────────────────────────────────────
// twin-runtime does not know about the OpenAI / mock provider classes —
// those live in api-server's `providers/` tree. The consumer registers a
// factory at bootstrap; moderation pulls the active provider through it.

export type ModeratorProviderFactory = () => IModeratorProvider;

let _moderatorProviderFactory: ModeratorProviderFactory | null = null;

export function setModeratorProviderFactory(
  factory: ModeratorProviderFactory,
): void {
  _moderatorProviderFactory = factory;
}

function getRegisteredModeratorProvider(): IModeratorProvider {
  if (!_moderatorProviderFactory) {
    throw new Error(
      "Moderator provider factory not registered. Call setModeratorProviderFactory() at app bootstrap " +
        "(see artifacts/api-server/src/lib/moderation.ts for the registration shim).",
    );
  }
  return _moderatorProviderFactory();
}

export type Severity = "none" | "low" | "medium" | "high";

export interface ModerationContext {
  text: string;
  locale: string;
  creatorId: string;
  fanIdHash: string;
  sessionId: string;
}

export interface ModerationOutcome {
  flagged: boolean;
  reply?: string;            // when flagged=true, the deflection (+ helpline) reply to send
  primaryCategory?: string;  // for caller logging
  severity?: Severity;
  categoryScores?: Record<string, number>; // raw OpenAI category_scores for escalation scorer
}

/**
 * Map OpenAI moderation categories onto our 4-level severity ladder.
 * High → notifyFounderAsync + safety_audit_log crisis_level=high
 * Medium → safety_audit_log crisis_level=medium
 * Low → audit only
 * None → no audit
 *
 * NOTE: severity is derived from OpenAI categories (not fan-controlled input)
 * to defuse T-02-05-05 (fan can't fake escalation to spam founder).
 */
export function severityFromCategories(categories: string[]): Severity {
  if (categories.length === 0) return "none";
  for (const c of categories) {
    if (
      c === "self-harm" ||
      c.startsWith("self-harm/") ||
      c === "sexual" ||
      c === "sexual/minors" ||
      c === "violence" ||
      c.startsWith("violence/")
    ) {
      return "high";
    }
  }
  for (const c of categories) {
    if (c === "harassment" || c.startsWith("harassment/")) return "medium";
  }
  return "low";
}

/**
 * Compose the safe reply text sent back to the fan when moderation flags.
 * If categories include any self-harm flag, the helpline string is prepended
 * (separated by "\n\n") BEFORE the deflection — per UI-SPEC the client splits
 * on "\n\n" to render the helpline in its own CrisisHelplineBubble.
 */
export function composeFlaggedReply(
  mod: ModerationResult,
  locale: string,
): string {
  const hasSelfHarm = mod.categories.some(
    (c) => c === "self-harm" || c.startsWith("self-harm/"),
  );
  const deflection = getDeflection(locale, mod.primaryCategory);
  if (hasSelfHarm) {
    return `${getHelpline(locale)}\n\n${deflection}`;
  }
  return deflection;
}

function severityToCrisisLevel(sev: Severity): CrisisLevel {
  if (sev === "high") return "high";
  if (sev === "medium") return "medium";
  if (sev === "low") return "low";
  return "none";
}

/**
 * Run the moderation provider, then dispatch L5 (notify) + L6 (audit) writes,
 * and return the composed safe reply. Shared engine for both L1 (input) and
 * L3 (output) wrappers.
 */
async function runModeration(
  layer: "L1" | "L3",
  ctx: ModerationContext,
): Promise<ModerationOutcome> {
  let mod: ModerationResult;
  try {
    mod = await getRegisteredModeratorProvider().moderate(ctx.text);
  } catch (err) {
    // On moderation provider failure we FAIL OPEN (let the turn through) but
    // log loudly. This is a discretionary call — closed-fail would mean every
    // OpenAI outage takes the twin down. Document this trade-off:
    //   - Moderation is defense in depth (L2 system prompt is the in-band
    //     guardrail; L1/L3 are belt-and-braces).
    //   - SB 243 self-harm coverage uses category SCORES from OpenAI — without
    //     them we cannot meaningfully inject the helpline anyway.
    //   - When OpenAI is down, the LLM still runs and the L2 guardrail still
    //     applies. The audit log captures the failure for the chat operator.
    const transient = err instanceof ProviderTransientError;
    const permanent = err instanceof ProviderError;
    logger.error(
      {
        event: `moderation.${layer}.provider_failed`,
        transient,
        permanent,
        err: (err as Error).message,
      },
      `[moderation/${layer}] provider failed — failing open`,
    );
    return { flagged: false };
  }

  if (!mod.flagged) {
    return { flagged: false, categoryScores: mod.scores };
  }

  const severity = severityFromCategories(mod.categories);
  const reply = composeFlaggedReply(mod, ctx.locale);
  const primary = mod.primaryCategory ?? mod.categories[0] ?? "unknown";

  // L6 — audit log (fire-and-forget, hashes only)
  writeSafetyAuditLog({
    creatorId: ctx.creatorId,
    fanId: ctx.fanIdHash,
    sessionId: ctx.sessionId,
    messageText: ctx.text,
    crisisLevel: severityToCrisisLevel(severity),
    crisisType: primary,
    locale: ctx.locale,
    categoryScores: mod.scores,
    responseSent: true,
    twinPaused: false,
  });

  // L5 — founder notify on high severity only
  if (severity === "high") {
    notifyFounderAsync(
      `*Safety flag* (${layer}) creator=${ctx.creatorId} session=${ctx.sessionId} category=${primary}`,
    );
  }

  return {
    flagged: true,
    reply,
    primaryCategory: primary,
    severity,
    categoryScores: mod.scores,
  };
}

/**
 * Write a per-turn non-flagged snapshot to safety_audit_log for the escalation
 * scorer (MOD-07). Called by consumers AFTER runL1Moderation returns flagged=false,
 * BEFORE the LLM call. Stores raw category_scores with retentionCategory='ephemeral_30d'
 * so the scorer can accumulate cross-turn signals without inflating the audit log.
 */
export function writeNonFlaggedScores(args: {
  creatorId: string;
  fanIdHash: string;
  sessionId: string;
  messageText: string;
  locale: string;
  categoryScores: Record<string, number>;
}): void {
  writeSafetyAuditLog({
    creatorId: args.creatorId,
    fanId: args.fanIdHash,
    sessionId: args.sessionId,
    messageText: args.messageText,
    crisisLevel: "none",
    locale: args.locale,
    categoryScores: args.categoryScores,
    responseSent: false,
    twinPaused: false,
    retentionCategory: "ephemeral_30d",
  });
}

/**
 * L1 — moderate fan input BEFORE the LLM call. When flagged, the caller MUST
 * skip the LLM and send `outcome.reply` directly.
 */
export function runL1Moderation(
  ctx: ModerationContext,
): Promise<ModerationOutcome> {
  return runModeration("L1", ctx);
}

/**
 * L3 — moderate LLM OUTPUT before delivery. When flagged, the caller MUST
 * replace the LLM content with `outcome.reply`.
 */
export function runL3Moderation(
  ctx: ModerationContext,
): Promise<ModerationOutcome> {
  return runModeration("L3", ctx);
}
