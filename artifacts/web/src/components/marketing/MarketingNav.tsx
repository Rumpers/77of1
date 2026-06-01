/**
 * MarketingNav — sticky top navigation for the marketing surface.
 *
 * MKT-14: sticky nav with wordmark, locale switcher (desktop only), and CTA button.
 *
 * Layout: max-w-[1120px] inner container, 56px height (h-14).
 * Mobile collapse: MarketingLocaleSwitcher is hidden below sm breakpoint;
 * the footer provides a mobile-accessible duplicate.
 *
 * Token isolation: uses only --mkt-* tokens; no fan-page utility classes.
 * Font rule: inline style={{ fontFamily: "var(--mkt-font-display)" }} for wordmark;
 * never uses the Tailwind font utility class (which resolves to fan Inter stack).
 *
 * Security (T-06-01): CTA delegates to CtaButton which carries rel="noopener noreferrer".
 */

import { CtaButton } from "./CtaButton";
import { MarketingLocaleSwitcher } from "./MarketingLocaleSwitcher";
import type { Locale } from "@/lib/i18n";

type Marketing = ReturnType<typeof import("@/lib/i18n").getMessages>["marketing"];

export function MarketingNav({ locale: _locale, t }: { locale: Locale; t: Marketing }) {
  return (
    <nav
      className="sticky top-0 z-50 w-full border-b border-[--mkt-border] bg-[--mkt-bg]/90 backdrop-blur-md"
    >
      <div className="max-w-[1120px] mx-auto px-6 h-14 flex items-center justify-between">
        {/* Wordmark */}
        <span
          className="font-bold text-[--mkt-fg]"
          style={{ fontFamily: "var(--mkt-font-display)", fontWeight: 700 }}
        >
          lala.la
        </span>

        {/* Right side — desktop: locale switcher + CTA; mobile: CTA only */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex">
            <MarketingLocaleSwitcher />
          </div>
          <CtaButton
            label={t.nav.cta_creator}
            fallbackLabel={t.hero.cta_no_telegram}
            size="sm"
          />
        </div>
      </div>
    </nav>
  );
}
