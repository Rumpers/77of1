// L4 safe-deflection strings — HARDCODED per locale + category.
// Source: UI-SPEC Copywriting Contract → "Moderation deflection" rows.
// VERBATIM strings, do not paraphrase (translation review pending — see
// UI-SPEC Open Issues #6).
//
// Tone contract (UI-SPEC §Voice / tone):
//   - warm, calm, parasocial-friendly — never clinical or apologetic
//   - forbidden phrases: "I'm just an AI", "As an artificial intelligence",
//     "I cannot help with that"
//
// Self-harm deflection uses the SAME text as `default` — the helpline string
// from helplines.ts is prepended separately, never combined into one string.

export type DeflectionLocale = "en" | "ja" | "zh-TW";
export type DeflectionCategory = "default" | "sexual" | "harassment";

type DeflectionTable = Record<
  DeflectionLocale,
  Record<DeflectionCategory, string>
>;

export const DEFLECTIONS: DeflectionTable = {
  en: {
    default: "Let's talk about something else.",
    sexual:
      "That's not something I want to talk about. Tell me about your day instead?",
    harassment: "I'd rather we keep this kind. What's on your mind?",
  },
  ja: {
    default: "他のことを話そうね。",
    sexual: "その話はちょっと…。今日はどんな一日だった？",
    harassment: "優しい話がしたいな。他に何かある？",
  },
  "zh-TW": {
    default: "我們聊點別的吧。",
    sexual: "這個話題我不太想聊耶。今天過得怎麼樣？",
    harassment: "我們和氣一點聊好嗎？最近怎樣？",
  },
};

/**
 * Map an OpenAI moderation category onto our small DeflectionCategory enum.
 * Self-harm uses `default` text (helpline is prepended elsewhere). Any
 * category that begins with `sexual` or `violence` collapses to sexual /
 * default respectively.
 */
function bucketCategory(category: string | null): DeflectionCategory {
  if (!category) return "default";
  if (category.startsWith("sexual")) return "sexual";
  if (category === "harassment" || category.startsWith("harassment"))
    return "harassment";
  // self-harm/*, violence/*, other → use the neutral default deflection
  return "default";
}

/**
 * Returns the locale + category-specific deflection string. Falls back to EN
 * default if locale is unsupported.
 */
export function getDeflection(
  locale: string,
  primaryCategory: string | null,
): string {
  const bucket = bucketCategory(primaryCategory);
  const localeKey: DeflectionLocale =
    locale === "ja" || locale === "zh-TW" ? locale : "en";
  return DEFLECTIONS[localeKey][bucket];
}
