/**
 * DemoTranscriptSection — MKT-06 static 2-turn demo conversation card.
 *
 * Renders a hardcoded English transcript for Phase 6 (all locales show EN for now;
 * Phase 7 will add localized copies when native-speaker review is complete).
 *
 * MKT-19 compliance guardrails:
 * - Does NOT name a real creator; uses the generic "@claire_ai" handle placeholder
 * - All copy complies with MKT-19 prohibited phrases policy (see 06-UI-SPEC.md)
 * - AI attribution ("AI twin · @claire_ai") appears below every twin bubble
 *
 * SB-243: AI attribution line satisfies the inline disclosure requirement per
 * DESIGN.md and UI-SPEC Contract 10.
 *
 * Token isolation: zero fan-page semantic utilities.
 * Font application: inline style={{ fontFamily }} only.
 */

import type { getMessages } from "@/lib/i18n";

type MarketingMessages = ReturnType<typeof getMessages>["marketing"];

const DEMO_TRANSCRIPT = [
  { role: "fan" as const, text: "Are you really her?" },
  {
    role: "twin" as const,
    text: "I'm her AI twin — same energy, available whenever you are. The real one will check in too 💜",
  },
] as const;

export function DemoTranscriptSection({ t }: { t: MarketingMessages }) {
  return (
    <section className="w-full py-20">
      <div className="w-full max-w-[1120px] mx-auto px-6">
        <h2
          className="text-[--mkt-fg] leading-[1.04] tracking-[-0.02em] mb-10 text-center"
          style={{
            fontFamily: "var(--mkt-font-display)",
            fontWeight: 700,
            fontSize: "clamp(2.25rem, 5vw, 4rem)",
          }}
        >
          {t.demo.title}
        </h2>

        <div
          className="max-w-lg mx-auto rounded-[--mkt-radius-lg] border border-[--mkt-border]
                     bg-[--mkt-surface-1] p-6 flex flex-col gap-4"
        >
          {DEMO_TRANSCRIPT.map((turn, idx) =>
            turn.role === "fan" ? (
              /* Fan bubble — right-aligned */
              <div key={idx} className="flex justify-end">
                <div
                  className="max-w-[80%] rounded-[--mkt-radius-md] px-4 py-2
                             text-[0.875rem] leading-[1.6] text-[--mkt-fg]
                             bg-[--mkt-surface-2]"
                  style={{ fontFamily: "var(--mkt-font-sans)" }}
                >
                  {turn.text}
                </div>
              </div>
            ) : (
              /* Twin bubble — left-aligned with AI attribution */
              <div key={idx} className="flex flex-col items-start gap-1">
                <div
                  className="max-w-[80%] rounded-[--mkt-radius-md] px-4 py-2
                             text-[0.875rem] leading-[1.6] text-[--mkt-fg]"
                  style={{
                    fontFamily: "var(--mkt-font-sans)",
                    background:
                      "color-mix(in oklch, var(--mkt-accent) 15%, transparent)",
                  }}
                >
                  {turn.text}
                </div>
                {/* AI twin attribution — SB-243 inline disclosure */}
                <span
                  className="pl-1 text-[0.875rem] text-[--mkt-muted-fg]"
                  style={{ fontFamily: "var(--mkt-font-sans)" }}
                >
                  AI twin · @claire_ai
                </span>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
