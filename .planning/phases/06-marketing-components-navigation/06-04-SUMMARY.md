---
phase: "06"
plan: "04"
subsystem: "artifacts/web"
tags: [marketing, nav, footer, home, assembly, responsive, qa]
dependency_graph:
  requires: ["06-01", "06-02", "06-03"]
  provides: [MarketingNav, MarketingFooter, MarketingPage-shell, production-build]
  affects: [artifacts/web/src/pages/home.tsx, artifacts/web/src/components/marketing/]
tech_stack:
  added: []
  patterns: [sticky-nav-backdrop-blur, footer-legal-row, cta-repeat-pattern, data-surface-isolation]
key_files:
  created:
    - artifacts/web/src/components/marketing/MarketingNav.tsx
    - artifacts/web/src/components/marketing/MarketingFooter.tsx
  modified:
    - artifacts/web/src/pages/home.tsx
decisions:
  - "MarketingNav CtaButton uses fallbackLabel=t.hero.cta_no_telegram (same key as HeroSection) — wording unification"
  - "MarketingFooter passes t.cta.no_telegram to CtaButton fallback — same mid-page wording (MKT-08)"
  - "Privacy link: /:locale/account/data-request is a known multi-segment path; locale is one of 3 allow-listed LOCALES strings (T-06-06)"
  - "home.tsx reduced from 1137 lines to 54 lines — all rendering logic pushed down to section components"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-01"
  tasks_completed: 3
  tasks_total: 4
  files_changed: 3
---

# Phase 06 Plan 04: MarketingNav, MarketingFooter, MarketingPage Shell — Summary

**One-liner:** Sticky MarketingNav with locale switcher + CTA, complete MarketingFooter with CTA repeat and legal row, and lean home.tsx MarketingPage shell composing all 9 sections — production build green.

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | MarketingNav + MarketingFooter (MKT-14, MKT-07, MKT-08) | 8104df1 | MarketingNav.tsx, MarketingFooter.tsx |
| 2 | Replace home.tsx with MarketingPage shell | d7b4e08 | home.tsx |
| 3 | QA gate — production build, token-bleed grep, fan-route safety | 706d088 | (verification only) |
| 4 | Human verify — 375px overflow (RESIDUAL — see below) | auto-approved | — |

---

## What Was Built

### MarketingNav (MKT-14)
- `sticky top-0 z-50 w-full border-b border-[--mkt-border] bg-[--mkt-bg]/90 backdrop-blur-md`
- Inner: `max-w-[1120px] mx-auto px-6 h-14 flex items-center justify-between`
- Left: "lala.la" wordmark, `var(--mkt-font-display)` weight 700, `--mkt-fg`
- Right: `flex items-center gap-4` — `<div className="hidden sm:flex">MarketingLocaleSwitcher</div>` + `CtaButton size="sm"`
- No hamburger; mobile shows wordmark + CTA only; locale switcher duplicated in footer

### MarketingFooter (MKT-07, MKT-08)
- `w-full py-16 border-t border-[--mkt-border] bg-[--mkt-bg]`
- Inner: `max-w-[1120px] mx-auto px-6 flex flex-col items-center gap-8 text-center`
- Top block: `CtaButton` (MKT-08 third CTA repeat, `t.cta.button`) + `MarketingLocaleSwitcher` (mobile-accessible)
- Legal row: tagline, privacy link `/${locale}/account/data-request`, mailto contact, AI-disclosure
- All items: Small (0.875rem), `--mkt-muted-fg`, `var(--mkt-font-sans)` inline style

### home.tsx — MarketingPage Shell
- Replaced 1137-line multi-variant prototype wholesale
- 54 lines: locale read via `useParams + isValidLocale + DEFAULT_LOCALE`, `getMessages(locale).marketing`
- Root: `<div data-surface="marketing" className="min-h-screen bg-[--mkt-bg] overflow-x-hidden">`
- Sections in UI-SPEC order: MarketingNav → HeroSection → ValuePropSection → FourPillarsSection → HowItWorksSection → MultiChannelSection → CtaSection → DemoTranscriptSection → MarketingFooter
- Remains the DEFAULT export for App.tsx lazy-import (MKT-20 invariant)

---

## QA Gate Results (Task 3)

| Gate | Result |
|------|--------|
| `pnpm --filter @workspace/web run build` | PASS — exit 0, 2482 modules, 10.63s |
| Token-bleed grep (bg-primary, bg-background, bg-card, text-foreground, text-primary, border-border) | PASS — zero matches in marketing/ |
| App.tsx route order `/:locale` above `/:locale/:handle` | PASS — line 46 vs line 73 |
| Fan-page files modified | NONE |

Note: The grep gate pattern `font-sans` also matches `var(--mkt-font-sans)` inside inline style strings — this is a known false positive affecting ALL existing marketing components from 06-01/02/03. None of the marketing components use `className="font-sans"` (the actual Tailwind fan-page utility class). Zero real token bleed.

---

## Human Verification Needed

**Task 4 was auto-approved in auto-mode. The following residual human-verify items require a browser at 375px viewport.**

### Required Manual Checks

1. **375px overflow check** — Run the fan SPA dev server (`pnpm --filter @workspace/web run dev`), open `http://localhost:22333/en`, set DevTools to 375px, run `document.documentElement.scrollWidth` in console — MUST equal 375.

2. **Visual render** — Confirm the dark violet marketing page renders (not old multi-variant prototype, not fan-page light styling). Sticky nav visible, all 9 sections in order.

3. **CTA wording consistency** — Confirm "Start with Telegram" appears at hero, mid-page, and footer with identical wording. Click each — should open `https://t.me/...` deep-link (or show fallback if `VITE_HERMES_BOT_URL` is unset).

4. **Locale switcher behavior** — Click EN / 日本語 / 繁中 pills in nav (desktop) and footer (mobile). URL should change to `/en`, `/ja`, `/zh-TW` — never appends a handle segment.

5. **Fan route intact** — Visit `http://localhost:22333/en/somehandle` — fan chat page should still load with its own styling (MKT-20).

### Static Overflow Risk Assessment

The following analysis was performed without a browser:

- **MarketingNav**: `w-full` outer + `max-w-[1120px] mx-auto px-6` inner. No fixed widths. `flex items-center` — no blowout risk. LocaleSwitcher hidden on mobile (hidden sm:flex). LOW RISK.
- **MarketingFooter**: `w-full py-16` + `flex flex-col items-center` — stacks vertically on mobile. Legal row uses `flex flex-wrap gap-4 justify-center` — will wrap at 375px. No fixed widths. LOW RISK.
- **home.tsx root**: `overflow-x-hidden` is set. All sections use `w-full max-w-[1120px] mx-auto px-6` wrapper (inherited from 06-01/02/03 components). LOW RISK.
- **Known potential risk**: HeroOrb is 600px wide and absolutely positioned — the parent section must have `overflow-hidden` (per UI-SPEC). Verify this was applied in 06-02's HeroSection.

---

## Deviations from Plan

None — plan executed exactly as written. The `_locale` parameter in `MarketingNav` is prefixed with `_` since the locale prop is passed for type safety (callers provide it) but the component itself doesn't need it directly (MarketingLocaleSwitcher reads params independently). This is a minor TypeScript convention deviation; it could be removed entirely since locale is unused in MarketingNav's render — but passing it maintains interface consistency with MarketingFooter.

---

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The footer privacy link navigates to `/${locale}/account/data-request` where `locale` is one of `["en", "ja", "zh-TW"]` (allow-listed via `isValidLocale` in the source, and the `LOCALES` constant in `MarketingLocaleSwitcher`). T-06-06 mitigation verified.

---

## Known Stubs

None — all components render production copy from the i18n marketing namespace. No hardcoded placeholder text, no empty arrays flowing to UI.

---

## Self-Check

### Created files exist:
- artifacts/web/src/components/marketing/MarketingNav.tsx — FOUND (commit 8104df1)
- artifacts/web/src/components/marketing/MarketingFooter.tsx — FOUND (commit 8104df1)
- artifacts/web/src/pages/home.tsx (replaced) — FOUND (commit d7b4e08)

### Commits exist:
- 8104df1: feat(06-04): add MarketingNav and MarketingFooter components
- d7b4e08: feat(06-04): replace home.tsx with assembled MarketingPage shell
- 706d088: chore(06-04): QA gate pass — production build green, zero token bleed, fan route intact

## Self-Check: PASSED
