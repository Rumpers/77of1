/**
 * ValuePropSection — MKT-02 value proposition statement.
 *
 * Renders the managed-service outcome statement: a centered heading + subtitle
 * at max-width 640px. No feature list — deferred to Phase 7 per UI-SPEC recommendation.
 *
 * Token isolation: zero fan-page semantic utilities. All tokens via --mkt-* arbitrary values.
 * Font application: inline style={{ fontFamily }} — Tailwind's utility resolves to
 * --app-font-sans (Inter, fan stack) rather than --mkt-font-sans (Geist).
 */

import type { getMessages } from "@/lib/i18n";

type MarketingMessages = ReturnType<typeof getMessages>["marketing"];

export function ValuePropSection({ t }: { t: MarketingMessages }) {
  return (
    <section className="w-full py-20">
      <div className="w-full max-w-[1120px] mx-auto px-6">
        <div className="text-center mx-auto" style={{ maxWidth: "640px" }}>
          <h2
            className="text-[--mkt-fg] leading-[1.04] tracking-[-0.02em]"
            style={{
              fontFamily: "var(--mkt-font-display)",
              fontWeight: 700,
              fontSize: "clamp(2.25rem, 5vw, 4rem)",
            }}
          >
            {t.value_prop.title}
          </h2>
          <p
            className="mt-4 text-[1rem] leading-[1.6] text-[--mkt-muted-fg]"
            style={{ fontFamily: "var(--mkt-font-sans)" }}
          >
            {t.value_prop.subtitle}
          </p>
        </div>
      </div>
    </section>
  );
}
