/**
 * HeroSection — MKT-01 hero with localized headline, subheadline, bloom, and primary CTA.
 *
 * Layout: asymmetric two-column grid (1.15fr / 0.85fr) on lg+; single column mobile.
 * LCP rule: <h1> text node renders at full opacity on first paint. Only the outer
 * motion.div wrapper animates (initial opacity:0 → 1). This avoids LCP regression
 * for client-rendered SPAs where the headline IS the LCP element.
 *
 * MKT-11 overflow invariant: outer <section> has overflow-hidden so the 600px HeroOrb
 * cannot cause horizontal scroll at 375px viewport.
 *
 * SB-243 disclosure: compact pill rendered below CTA (hero-level visible disclosure).
 *
 * Font note: inline style={{ fontFamily }} rather than the Tailwind utility class because
 * that utility class resolves to --app-font-sans (Inter, fan stack), not --mkt-font-sans (Geist).
 */

import { motion } from "framer-motion";
import { CtaButton } from "./CtaButton";
import { HeroOrb } from "./HeroOrb";
import type { Locale } from "@/lib/i18n";
import type { getMessages } from "@/lib/i18n";

type MarketingMessages = ReturnType<typeof getMessages>["marketing"];

export function HeroSection({
  locale: _locale,
  t,
}: {
  locale: Locale;
  t: MarketingMessages;
}) {
  return (
    <section className="relative overflow-hidden w-full">
      <HeroOrb />
      <div className="w-full max-w-[1120px] mx-auto px-6 py-24 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
          {/* Left column: text stack — motion.div wrapper animates; <h1> renders at full opacity */}
          <motion.div
            className="flex flex-col"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {/* Eyebrow */}
            <span
              className="text-[0.875rem] font-medium uppercase tracking-[0.14em] text-[--mkt-accent] mb-4"
              style={{ fontFamily: "var(--mkt-font-sans)" }}
            >
              lala.la
            </span>

            {/* h1 — must render at full opacity on first paint (LCP element) */}
            <h1
              className="text-[--mkt-fg] leading-[1.04] tracking-[-0.02em]"
              style={{
                fontFamily: "var(--mkt-font-display)",
                fontWeight: 700,
                fontSize: "clamp(2.25rem, 5vw, 4rem)",
              }}
            >
              {t.hero.headline}
            </h1>

            <p
              className="mt-4 text-[1rem] leading-[1.6] text-[--mkt-muted-fg]"
              style={{ fontFamily: "var(--mkt-font-sans)" }}
            >
              {t.hero.subheadline}
            </p>

            <div className="mt-8">
              <CtaButton
                label={t.hero.cta_primary}
                fallbackLabel={t.hero.cta_no_telegram}
              />
            </div>

            {/* SB-243 disclosure pill — visible AI companion disclosure in hero */}
            <div
              className="mt-6 inline-flex items-center gap-2 self-start
                border border-[--mkt-accent] rounded-[--mkt-radius-pill] px-3 py-1"
            >
              <span
                className="h-2 w-2 rounded-full bg-[--mkt-glow-to] flex-shrink-0"
                aria-hidden="true"
              />
              <span
                className="text-[0.875rem] text-[--mkt-muted-fg]"
                style={{ fontFamily: "var(--mkt-font-sans)" }}
              >
                AI twin · not a real person
              </span>
            </div>
          </motion.div>

          {/* Right column: decorative spacer — HeroOrb is absolutely positioned */}
          <div className="hidden lg:block relative h-[480px]" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
