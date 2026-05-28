// SB 243 crisis helpline strings — HARDCODED per locale (Pitfall #13: never
// LLM-generated). One row per supported locale; en is the fallback.
//
// Source of truth: D-02-05 (Phase 2 locked decision) + UI-SPEC Copywriting
// Contract → "Crisis helpline — self-harm flagged". CLAUDE.md's stale JP
// number (0120-783-556) is OVERRIDDEN here per D-02-05.
//
// Sources:
//   - JP: よりそいホットライン 0120-279-338 (24h/365d) — D-02-05
//   - EN: 988 Suicide & Crisis Lifeline (US, 24/7)
//   - zh-TW: 1925 安心專線 (TW, 24h, free)
//   - zh-HK: 撒瑪利亞防止自殺會 2389 2222 (HK, 24h fallback)
//
// COMPLY-02: this string MUST be prepended to the L4 deflection whenever an
// OpenAI moderation category starts with "self-harm". The whole reply is the
// helpline + "\n\n" + deflection.

export type HelplineLocale = "en" | "ja" | "zh-TW" | "zh-HK";

export const HELPLINES: Record<HelplineLocale, string> = {
  en: "If you're going through something heavy, the 988 Suicide & Crisis Lifeline is there 24/7. Call or text 988.",
  ja: "つらいときは、よりそいホットライン 0120-279-338 に電話できるよ。24時間365日つながるからね。",
  "zh-TW":
    "如果你正在面對很難的時刻，可以打 1925 安心專線（24小時免費）。我會在這裡等你回來。",
  "zh-HK":
    "如果你正在面對很難的時刻，可以聯絡撒瑪利亞防止自殺會 2389 2222（24小時）。",
};

/**
 * Returns the locale-keyed helpline string. Unknown locales fall back to EN
 * (the broadest 988 lifeline). zh-HK is opportunistic — Phase 2 routes only
 * en/ja/zh-TW from the client, but the string is ready for IP-based HK
 * detection in a later phase.
 */
export function getHelpline(locale: string): string {
  if (locale === "ja") return HELPLINES.ja;
  if (locale === "zh-TW") return HELPLINES["zh-TW"];
  if (locale === "zh-HK") return HELPLINES["zh-HK"];
  return HELPLINES.en;
}
