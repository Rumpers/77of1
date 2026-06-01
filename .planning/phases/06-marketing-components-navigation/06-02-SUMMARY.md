---
phase: 06-marketing-components-navigation
plan: "02"
subsystem: marketing-ui
tags: [marketing, react, framer-motion, i18n, sb-243, mkt-01, mkt-02, mkt-03, mkt-06]
dependency_graph:
  requires: ["06-01"]
  provides: [HeroSection, ValuePropSection, FourPillarsSection, DemoTranscriptSection]
  affects: ["artifacts/web/src/pages/home.tsx"]
tech_stack:
  added: []
  patterns:
    - framer-motion motion.div wrapper for LCP-safe entrance animation
    - PillarCard inline sub-component with coming-soon badge
    - Static transcript constant with role-based bubble rendering
    - SB-243 disclosure pill pattern (violet border, fuchsia dot)
key_files:
  created:
    - artifacts/web/src/components/marketing/HeroSection.tsx
    - artifacts/web/src/components/marketing/ValuePropSection.tsx
    - artifacts/web/src/components/marketing/FourPillarsSection.tsx
    - artifacts/web/src/components/marketing/DemoTranscriptSection.tsx
  modified: []
decisions:
  - "LCP rule: motion.div wrapper animates (opacity 0→1, y 16→0); <h1> text node renders at full opacity on first paint — prevents LCP regression in client-rendered SPA"
  - "Demo transcript hardcoded as EN constant for Phase 6; Phase 7 adds i18n keys after native-speaker review"
  - "Hero disclosure pill text 'AI twin · not a real person' is required SB-243 compliance copy, not a MKT-19 violation"
  - "FourPillarsSection: live=true cards (Chat, Voice) no badge; live=false cards (Image, Video) render coming-soon badge from i18n keys"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-01"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 0
---

# Phase 6 Plan 02: HeroSection, ValuePropSection, FourPillarsSection, DemoTranscriptSection Summary

**One-liner:** Four marketing section components (MKT-01/02/03/06) using --mkt-* tokens, framer-motion LCP-safe hero animation, and SB-243 disclosure pill.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | HeroSection (MKT-01) | 56e9d82 | HeroSection.tsx |
| 2 | ValuePropSection + FourPillarsSection (MKT-02, MKT-03) | a2c9590 | ValuePropSection.tsx, FourPillarsSection.tsx |
| 3 | DemoTranscriptSection (MKT-06) | 46b13e3 | DemoTranscriptSection.tsx |

## What Was Built

### HeroSection (MKT-01)
Asymmetric two-column hero grid (`grid-cols-[1.15fr_0.85fr]` on lg+). Outer `<section>` has `overflow-hidden` to contain the 600px HeroOrb and prevent horizontal scroll at 375px. A `motion.div` wrapper provides the entrance animation (`opacity: 0→1, y: 16→0`); the `<h1>` text node itself renders at full opacity on first paint (LCP-safe rule). Renders eyebrow, headline from `t.hero.headline`, subheadline, CtaButton, and a SB-243 disclosure pill ("AI twin · not a real person") with a fuchsia dot and violet border.

### ValuePropSection (MKT-02)
Minimal centered statement section. Heading (`t.value_prop.title`) + subtitle (`t.value_prop.subtitle`) at max-w-640px, text-center. No feature list — deferred to Phase 7 per UI-SPEC recommendation.

### FourPillarsSection (MKT-03)
Responsive `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` with inline `PillarCard` sub-component. Chat (`MessageCircle`) and Voice (`Mic`) cards have `live=true` and render no badge. Image and Video cards have `live=false` and render coming-soon badges sourced from `t.pillars.image_coming_soon` / `t.pillars.video_coming_soon`. All grid children carry `min-w-0`.

### DemoTranscriptSection (MKT-06)
Static 2-turn hardcoded transcript (EN for all locales in Phase 6). Fan bubble right-aligned (`bg-[--mkt-surface-2]`); twin bubble left-aligned with `color-mix(in oklch, var(--mkt-accent) 15%, transparent)` background. "AI twin · @claire_ai" attribution line below each twin bubble (SB-243 inline disclosure). MKT-19 compliant: no prohibited phrases.

## Decisions Made

1. **LCP-safe motion pattern:** `motion.div` wrapper animates with `initial={{ opacity:0, y:16 }}` but the `<h1>` headline text node is never given `initial opacity:0`. For a client-rendered SPA, this is the correct approach to avoid LCP regression while still providing entrance animation.

2. **Demo transcript locale handling:** Hardcoded English constant in `DemoTranscriptSection.tsx` for Phase 6. Phase 7 adds `marketing.demo.fan_message` + `marketing.demo.twin_response` i18n keys once native-speaker copies are available for JA and ZH-TW.

3. **"AI twin · not a real person" in hero pill:** This SB-243 compliance text contains the phrase "real person." It is NOT a MKT-19 violation — MKT-19 prohibits deceptive promotional claims; the disclosure pill is the opposite (an explicit compliance disclosure). The text is required per DESIGN.md and UI-SPEC Contract 4.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `@claire_ai` in DemoTranscriptSection is a required i18n placeholder (not a real creator handle). Phase 7 may parameterize this via `t.demo.label` or keep generic per MKT-19 copywriting guardrails.
- Demo transcript content is English-only for Phase 6 (all 3 locales see the same text). Phase 7 resolves with native-speaker copies.

These stubs do not prevent MKT-06's goal (demo transcript renders with AI attribution). They are intentional Phase 6 scaffolding.

## Threat Surface Scan

No new security-relevant surface introduced. All components are static rendering with no user input, no API calls, and no `dangerouslySetInnerHTML`. All copy rendered as React JSX text children (auto-escaped). T-06-04 (XSS via section copy) and T-06-05 (MKT-19 compliance) mitigations confirmed present.

## Self-Check: PASSED

Files exist:
- `artifacts/web/src/components/marketing/HeroSection.tsx` — FOUND
- `artifacts/web/src/components/marketing/ValuePropSection.tsx` — FOUND
- `artifacts/web/src/components/marketing/FourPillarsSection.tsx` — FOUND
- `artifacts/web/src/components/marketing/DemoTranscriptSection.tsx` — FOUND

Commits exist:
- 56e9d82 (HeroSection) — FOUND
- a2c9590 (ValuePropSection + FourPillarsSection) — FOUND
- 46b13e3 (DemoTranscriptSection) — FOUND

Named exports confirmed: `HeroSection`, `ValuePropSection`, `FourPillarsSection`, `DemoTranscriptSection`.
Barrel index.ts not modified (as required).
STATE.md and ROADMAP.md not modified (orchestrator owns those writes).
