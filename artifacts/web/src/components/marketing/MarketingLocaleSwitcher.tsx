/**
 * MarketingLocaleSwitcher — pill locale switcher for the marketing surface.
 *
 * Renders three pill buttons (EN | 日本語 | 繁中) that navigate to /:locale
 * (marketing home only — never /:locale/:handle which is the fan page).
 *
 * Deliberately NOT a copy of components/fan/LocaleSwitcher.tsx:
 * - Uses inline pill <button>s, not Radix DropdownMenu
 * - Navigates to `/${locale}` without a handle segment
 * - Uses --mkt-* tokens, not fan-page token classes
 *
 * MKT-14 requirement: locale switching must be isolated from the fan switcher.
 */

import { useParams, useLocation } from "wouter";
import { LOCALES, isValidLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  ja: "日本語",
  "zh-TW": "繁中",
};

export function MarketingLocaleSwitcher() {
  const params = useParams<{ locale: string }>();
  const [, setLocation] = useLocation();
  const currentLocale = isValidLocale(params.locale ?? "")
    ? (params.locale as Locale)
    : DEFAULT_LOCALE;

  return (
    <div className="flex gap-1">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          onClick={() => setLocation(`/${locale}`)}
          aria-current={locale === currentLocale ? "page" : undefined}
          className={`rounded-[--mkt-radius-pill] px-3 py-1 text-sm transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--mkt-accent]
            focus-visible:ring-offset-1 focus-visible:ring-offset-[--mkt-bg]
            ${
              locale === currentLocale
                ? "bg-[--mkt-accent] text-[--mkt-accent-fg]"
                : "text-[--mkt-muted-fg] hover:text-[--mkt-fg]"
            }`}
          style={{ fontFamily: "var(--mkt-font-sans)" }}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
