// Inline locale detection (I18N-02) — per D-02-14 (no i18next-http-middleware).
//
// Resolution order:
//   1. Explicit body.locale or query.locale (creator/fan can override)
//   2. Accept-Language header (parsed with priority — first matching tag wins)
//   3. Default "en"
//
// Supported locales: en | ja | zh-TW.
import type { Request } from "express";

export type Locale = "en" | "ja" | "zh-TW";

export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "ja", "zh-TW"];
export const DEFAULT_LOCALE: Locale = "en";

const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && SUPPORTED_LOCALES.includes(value as Locale);

// Map an Accept-Language tag fragment to our 3-locale set. Order matters —
// zh-TW / zh-Hant must come before bare `zh` so Hong Kong / Taiwan resolve
// correctly. PRC `zh-CN` deliberately falls through to default `en` because
// the phase-2 product is JP / TW / HK only (per CLAUDE.md).
function matchLocaleTag(tag: string): Locale | null {
  const lower = tag.toLowerCase().trim();
  if (lower === "zh-tw" || lower === "zh-hant" || lower.startsWith("zh-hant")) {
    return "zh-TW";
  }
  if (lower === "ja" || lower.startsWith("ja-")) return "ja";
  if (lower === "en" || lower.startsWith("en-")) return "en";
  return null;
}

function parseAcceptLanguage(header: string): Locale | null {
  // Header shape: `ja,en;q=0.9,zh;q=0.8` — split on `,`, strip q-values, take
  // first supported tag. We don't sort by q-weight at N=1 (every real client
  // lists in priority order). Revisit if a real client requires q-weight sort.
  const parts = header.split(",");
  for (const part of parts) {
    const tag = part.split(";")[0]?.trim() ?? "";
    if (!tag) continue;
    const matched = matchLocaleTag(tag);
    if (matched) return matched;
  }
  return null;
}

// detectLocale — Express request → Locale.
// Tolerates partial req shapes (we only read body/query/headers).
export function detectLocale(
  req: Pick<Request, "body" | "query" | "headers"> | {
    body?: unknown;
    query?: unknown;
    headers?: Record<string, string | string[] | undefined>;
  },
): Locale {
  // 1. Explicit override (body wins over query — body is the chat path; query is
  //    the fan-page link path)
  const body = (req.body ?? {}) as Record<string, unknown>;
  const query = (req.query ?? {}) as Record<string, unknown>;
  if (isLocale(body.locale)) return body.locale;
  if (isLocale(query.locale)) return query.locale;

  // 2. Accept-Language header
  const headers = req.headers ?? {};
  const raw = headers["accept-language"];
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (typeof header === "string" && header.length > 0) {
    const matched = parseAcceptLanguage(header);
    if (matched) return matched;
  }

  // 3. Default
  return DEFAULT_LOCALE;
}
