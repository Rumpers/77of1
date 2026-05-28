// SB 243 AI disclosure footer (COMPLY-01, D-02-12).
//
// Single source of truth for the "AI twin · @{handle}_ai" footer. Both the
// web fan-page response (api-server /api/twin/chat) AND the Telegram fan-twin
// worker delivery (artifacts/worker text-generation) consume this helper.
//
// Handle is sanitised — only [a-zA-Z0-9_] survives — to prevent
// disclosure-string injection via crafted handles.
import type { Locale } from "./locale.js";

const FOOTER_PREFIX: Record<Locale, string> = {
  en: "AI twin",
  ja: "AIツイン",
  "zh-TW": "AI分身",
};

export function getDisclosureFooter(locale: Locale, handle: string): string {
  const prefix = FOOTER_PREFIX[locale] ?? FOOTER_PREFIX.en;
  const safeHandle = String(handle ?? "").replace(/[^a-zA-Z0-9_]/g, "");
  return `${prefix} · @${safeHandle}_ai`;
}
