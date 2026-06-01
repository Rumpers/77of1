/**
 * HowItWorksSection — MKT-04
 *
 * 3-step non-technical creator onboarding sequence. Open layout (no card borders).
 * Step numerals: weight 800, var(--mkt-font-display), --mkt-accent color.
 * Step labels: weight 600, var(--mkt-font-display) uses inline style only.
 *
 * Token rule: all styling via --mkt-* tokens (Tailwind arbitrary-value syntax).
 * Font family is always applied via inline style to avoid resolving to the fan-page stack.
 */

import type { getMessages } from "@/lib/i18n";

type MarketingMessages = ReturnType<typeof getMessages>["marketing"];

function StepCard({
  numeral,
  label,
  desc,
}: {
  numeral: string;
  label: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <span
        className="text-[1.5rem] leading-[1.04] text-[--mkt-accent]"
        style={{ fontFamily: "var(--mkt-font-display)", fontWeight: 800 }}
        aria-hidden="true"
      >
        {numeral}
      </span>
      <h3
        className="text-[1.5rem] font-semibold leading-[1.2] text-[--mkt-fg]"
        style={{ fontFamily: "var(--mkt-font-sans)" }}
      >
        {label}
      </h3>
      <p
        className="text-[1rem] leading-[1.6] text-[--mkt-muted-fg]"
        style={{ fontFamily: "var(--mkt-font-sans)" }}
      >
        {desc}
      </p>
    </div>
  );
}

export function HowItWorksSection({ t }: { t: MarketingMessages }) {
  return (
    <section className="w-full py-20">
      <div className="w-full max-w-[1120px] mx-auto px-6">
        <h2
          className="text-[--mkt-fg] leading-[1.04] tracking-[-0.02em]"
          style={{
            fontFamily: "var(--mkt-font-display)",
            fontWeight: 700,
            fontSize: "clamp(2.25rem, 5vw, 4rem)",
          }}
        >
          {t.onboarding.title}
        </h2>
        <p
          className="mt-4 text-[1rem] leading-[1.6] text-[--mkt-muted-fg]"
          style={{ fontFamily: "var(--mkt-font-sans)" }}
        >
          {t.onboarding.subtitle}
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <StepCard
            numeral="01"
            label={t.onboarding.step1_label}
            desc={t.onboarding.step1_desc}
          />
          <StepCard
            numeral="02"
            label={t.onboarding.step2_label}
            desc={t.onboarding.step2_desc}
          />
          <StepCard
            numeral="03"
            label={t.onboarding.step3_label}
            desc={t.onboarding.step3_desc}
          />
        </div>
      </div>
    </section>
  );
}
