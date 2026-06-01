/**
 * CtaSection — MKT-08 mid-page CTA repeat
 *
 * Repeats the primary CTA between content sections using the shared CtaButton
 * primitive with the same i18n keys as hero (06-02) and footer (06-04).
 * This guarantees identical wording and the same Telegram deep-link across
 * all three CTA positions (MKT-08 requirement).
 *
 * CRITICAL: uses t.cta.button / t.cta.no_telegram keys — do NOT substitute
 * different label strings or inline a raw <a> element here.
 *
 * Token rule: all styling via --mkt-* tokens (Tailwind arbitrary-value syntax).
 * Font family is always applied via inline style to avoid resolving to the fan-page stack.
 */

import { CtaButton } from "./CtaButton";
import type { getMessages } from "@/lib/i18n";

type MarketingMessages = ReturnType<typeof getMessages>["marketing"];

export function CtaSection({ t }: { t: MarketingMessages }) {
  return (
    <section className="w-full py-20">
      <div className="w-full max-w-[1120px] mx-auto px-6 text-center">
        <h2
          className="text-[--mkt-fg] leading-[1.04] tracking-[-0.02em]"
          style={{
            fontFamily: "var(--mkt-font-display)",
            fontWeight: 700,
            fontSize: "clamp(2.25rem, 5vw, 4rem)",
          }}
        >
          {t.cta.headline}
        </h2>
        <p
          className="mt-4 text-[1rem] leading-[1.6] text-[--mkt-muted-fg]"
          style={{ fontFamily: "var(--mkt-font-sans)" }}
        >
          {t.cta.subheadline}
        </p>
        <div className="mt-8 flex justify-center">
          <CtaButton label={t.cta.button} fallbackLabel={t.cta.no_telegram} />
        </div>
      </div>
    </section>
  );
}
