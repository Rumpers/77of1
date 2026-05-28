// Detect locale from Telegram context (I18N-02).
//
// Reads `ctx.from.language_code` (ISO 639-1 from Telegram client). Maps:
//   - "ja", "ja-*"              → "ja"
//   - "zh", "zh-tw", "zh-hant*" → "zh-TW"
//   - "en", "en-*"              → "en"
//   - anything else / missing   → "en"
//
// We deliberately collapse bare `zh` to `zh-TW` because phase-2 product is
// JP / TW / HK only (per CLAUDE.md). Mainland China `zh-cn` falls through to
// the default `en`.

import type { Locale } from "@workspace/twin-runtime/locale";

interface TelegramFromShape {
  language_code?: string;
}

interface TelegramCtxShape {
  from?: TelegramFromShape;
}

export function detectLocaleFromTelegramCtx(ctx: TelegramCtxShape): Locale {
  const raw = ctx?.from?.language_code;
  if (typeof raw !== "string" || raw.length === 0) return "en";
  const lower = raw.toLowerCase();
  if (lower === "ja" || lower.startsWith("ja-")) return "ja";
  if (
    lower === "zh" ||
    lower === "zh-tw" ||
    lower.startsWith("zh-hant") ||
    lower.startsWith("zh-tw")
  ) {
    return "zh-TW";
  }
  if (lower === "en" || lower.startsWith("en-")) return "en";
  return "en";
}
