/**
 * CtaButton — reusable Telegram CTA primitive for the marketing surface.
 *
 * Reads VITE_HERMES_BOT_URL and VITE_CONTACT_EMAIL once at module load (build-time
 * env injection by Vite — not runtime). When the bot URL is absent, the primary
 * anchor href is undefined so it does not navigate; the mailto fallback is always
 * rendered below to satisfy MKT-09 graceful-fallback requirement.
 *
 * Security: every external <a> carries target="_blank" rel="noopener noreferrer"
 * to prevent tab-napping (T-06-01 mitigation).
 *
 * Font note: uses style={{ fontFamily: "var(--mkt-font-sans)" }} rather than the
 * Tailwind `font-sans` utility class because `font-sans` resolves to the fan-page
 * Inter stack (--app-font-sans), not --mkt-font-sans (Geist).
 */

import { Send } from "lucide-react";

const HERMES_BOT_URL = import.meta.env.VITE_HERMES_BOT_URL ?? "";
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL ?? "contact@lala.la";

export function CtaButton({
  label,
  fallbackLabel,
  size = "md",
}: {
  label: string;
  fallbackLabel: string;
  size?: "sm" | "md";
}) {
  const padding = size === "sm" ? "px-4 py-2" : "px-6 py-3";

  return (
    <div className="flex flex-col items-center gap-2">
      <a
        href={HERMES_BOT_URL || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 rounded-[--mkt-radius-pill]
          bg-[--mkt-accent] text-[--mkt-accent-fg] font-semibold
          transition-colors min-h-[44px]
          hover:bg-[--mkt-accent-hover] active:scale-[0.98]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--mkt-accent]
          focus-visible:ring-offset-2 focus-visible:ring-offset-[--mkt-bg]
          ${padding}`}
        style={{
          fontFamily: "var(--mkt-font-sans)",
          boxShadow: "0 0 24px color-mix(in oklch, var(--mkt-glow-from) 40%, transparent)",
        }}
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        {label}
      </a>
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="text-[0.875rem] text-[--mkt-muted-fg] underline underline-offset-4
                   hover:text-[--mkt-fg] transition-colors"
        style={{ fontFamily: "var(--mkt-font-sans)" }}
      >
        {fallbackLabel}
      </a>
    </div>
  );
}
