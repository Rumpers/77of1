/**
 * MarketingFooter — site footer for the marketing surface.
 *
 * MKT-07: company name (tagline), contact email, privacy-policy link, AI-disclosure notice.
 * MKT-08: third CTA repeat position — identical wording to hero + mid-page CtaButton instances.
 * MKT-14: mobile-accessible MarketingLocaleSwitcher duplicate (nav hides it below sm).
 *
 * Privacy link routes to /:locale/account/data-request (existing DsarPortal route — a known
 * multi-segment path, never a bare /:locale/:handle that would hit the fan page). T-06-06 mitigation:
 * locale is one of the 3 allow-listed LOCALES strings, not free-form user input.
 *
 * Token isolation: uses only --mkt-* tokens; no fan-page utility classes.
 * Font rule: inline style={{ fontFamily: "var(--mkt-font-sans)" }} for body/legal text;
 * never uses the Tailwind font utility class (which resolves to fan Inter stack).
 */

import { CtaButton } from "./CtaButton";
import { MarketingLocaleSwitcher } from "./MarketingLocaleSwitcher";
import type { Locale } from "@/lib/i18n";

type Marketing = ReturnType<typeof import("@/lib/i18n").getMessages>["marketing"];

export function MarketingFooter({ locale, t }: { locale: Locale; t: Marketing }) {
  return (
    <footer className="w-full py-16 border-t border-[--mkt-border] bg-[--mkt-bg]">
      <div className="max-w-[1120px] mx-auto px-6 flex flex-col items-center gap-8 text-center">
        {/* Top block: CTA repeat (MKT-08) + mobile-accessible locale switcher (MKT-14) */}
        <CtaButton label={t.cta.button} fallbackLabel={t.cta.no_telegram} />
        <MarketingLocaleSwitcher />

        {/* Legal row — tagline, privacy link, contact, AI-disclosure */}
        <div className="flex flex-wrap gap-4 justify-center items-center">
          <span
            className="text-[0.875rem] text-[--mkt-muted-fg]"
            style={{ fontFamily: "var(--mkt-font-sans)" }}
          >
            {t.footer.tagline}
          </span>
          <a
            href={`/${locale}/account/data-request`}
            className="text-[0.875rem] text-[--mkt-muted-fg] underline underline-offset-4
                       hover:text-[--mkt-fg] transition-colors"
            style={{ fontFamily: "var(--mkt-font-sans)" }}
          >
            {t.footer.privacy}
          </a>
          <a
            href="mailto:contact@lala.la"
            className="text-[0.875rem] text-[--mkt-muted-fg] underline underline-offset-4
                       hover:text-[--mkt-fg] transition-colors"
            style={{ fontFamily: "var(--mkt-font-sans)" }}
          >
            {t.footer.contact}
          </a>
          <span
            className="text-[0.875rem] text-[--mkt-muted-fg]"
            style={{ fontFamily: "var(--mkt-font-sans)" }}
          >
            {t.footer.ai_disclosure}
          </span>
        </div>
      </div>
    </footer>
  );
}
