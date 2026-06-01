/**
 * HeroOrb — static violet→fuchsia decorative bloom for the marketing hero.
 *
 * Pure CSS decorative element (no framer-motion, no initial opacity:0).
 * Parent section MUST have overflow-hidden — the orb is 600px wide and
 * absolutely positioned; without it the orb causes horizontal scroll at 375px
 * (MKT-11 mobile overflow invariant).
 *
 * Breathing animation is deferred to Phase 7. Phase 6 renders at full opacity
 * on first paint per the UI-SPEC LCP contract.
 */

export function HeroOrb() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                   h-[600px] w-[600px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--mkt-glow-from) 30%, transparent) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
    </div>
  );
}
