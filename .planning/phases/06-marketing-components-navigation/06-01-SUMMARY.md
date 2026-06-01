---
phase: 06-marketing-components-navigation
plan: "01"
subsystem: web-marketing
tags: [marketing, components, cta, locale, decorative, css]
dependency_graph:
  requires: []
  provides:
    - artifacts/web/src/components/marketing/CtaButton.tsx
    - artifacts/web/src/components/marketing/MarketingLocaleSwitcher.tsx
    - artifacts/web/src/components/marketing/HeroOrb.tsx
    - artifacts/web/src/components/marketing/index.ts
    - artifacts/web/src/index.css (reduced-motion guard)
    - .env.example (VITE marketing vars)
  affects:
    - artifacts/web/src/pages/home.tsx (consumes barrel — built in plan 06-03/04)
    - Wave-2 plans 06-02, 06-03, 06-04 (import from barrel without editing it)
tech_stack:
  added: []
  patterns:
    - "Module-scope env var read: const X = import.meta.env.VITE_X ?? fallback"
    - "Marketing font via inline style: style={{ fontFamily: 'var(--mkt-font-sans)' }}"
    - "External anchor: target=_blank rel=noopener noreferrer"
    - "Locale navigation: setLocation(`/${locale}`) via wouter useLocation"
    - "Decorative element: aria-hidden absolute inset-0 overflow-hidden"
key_files:
  created:
    - artifacts/web/src/components/marketing/CtaButton.tsx
    - artifacts/web/src/components/marketing/MarketingLocaleSwitcher.tsx
    - artifacts/web/src/components/marketing/HeroOrb.tsx
    - artifacts/web/src/components/marketing/index.ts
  modified:
    - artifacts/web/src/index.css
    - .env.example
decisions:
  - "Barrel pre-populated with all 12 component names upfront so Wave-2 plans never edit index.ts"
  - "CtaButton reads VITE_HERMES_BOT_URL at module scope (not inside onClick) per MKT-09"
  - "HeroOrb renders at full opacity on first paint; framer-motion breathing loop deferred to Phase 7 per LCP safety rule"
  - "MarketingLocaleSwitcher navigates to /:locale only — never /:locale/:handle — isolated from fan LocaleSwitcher"
  - "Reduced-motion guard placed after @layer marketing-tokens as a standalone @media rule (not inside the layer)"
  - "?start=creator_onboard payload documented as inert — Hermes /start handler does not parse it yet (no-op until Phase 8)"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-06-01"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 2
---

# Phase 06 Plan 01: Marketing Leaf Primitives Summary

CtaButton + MarketingLocaleSwitcher + HeroOrb primitives built with only `--mkt-*` tokens; 12-name barrel pre-populated; VITE env vars documented; reduced-motion guard added under the marketing scope.

## What Was Built

### Task 1 — CtaButton primitive (MKT-08, MKT-09)
Commit: `0bbcf85`

`CtaButton.tsx` — a reusable Telegram CTA anchor with always-visible mailto fallback. Reads `VITE_HERMES_BOT_URL` once at module scope via `import.meta.env` (build-time injection). When the env var is absent or empty, the primary `<a>` renders with `href={undefined}` so it does not navigate — the fallback mailto link below is always present. Every external anchor carries `target="_blank" rel="noopener noreferrer"` (T-06-01 tab-napping mitigation). Size prop (`sm` | `md`) controls padding. Violet glow box-shadow via `color-mix(in oklch, ...)`. Font applied via `style={{ fontFamily }}`, not the `font-sans` Tailwind utility (which maps to the fan-page Inter stack).

### Task 2 — MarketingLocaleSwitcher + HeroOrb (MKT-14, MKT-11)
Commit: `92b51dd`

`MarketingLocaleSwitcher.tsx` — three inline pill `<button>`s (EN | 日本語 | 繁中) that call `setLocation(`/${locale}`)` via wouter `useLocation`. No Radix `DropdownMenu`, no import from `components/fan/LocaleSwitcher.tsx`. Active pill uses `bg-[--mkt-accent]` with `aria-current="page"`.

`HeroOrb.tsx` — pure static decorative element. `aria-hidden` outer `pointer-events-none absolute inset-0 overflow-hidden` div containing a 600px `rounded-full` with a `radial-gradient` + `blur(60px)`. No framer-motion, no `initial opacity:0`. Renders at full opacity on first paint. Parent section must have `overflow-hidden` to contain the 600px orb at 375px viewport.

### Task 3 — Barrel, env vars, reduced-motion guard (MKT-11)
Commit: `bd784c0`

`index.ts` — 12-name named re-export barrel for all marketing components. All names (including Wave-2 components not yet created) are listed so downstream plans never touch this file.

`.env.example` — new "Marketing web (Vite)" section with `VITE_HERMES_BOT_URL=` and `VITE_CONTACT_EMAIL=contact@lala.la`.

`index.css` — `@media (prefers-reduced-motion: reduce)` block added after the `@layer marketing-tokens` close brace. Scopes `animation-duration: 0.01ms !important; transition-duration: 0.01ms !important;` to `[data-surface="marketing"] *`.

## Known No-Op: Hermes `?start=creator_onboard` Payload

The `VITE_HERMES_BOT_URL` deep-link includes `?start=creator_onboard`. However, the Hermes `/start` handler (`artifacts/hermes/src/index.ts` line 65) does NOT parse the `start` payload — it routes any unlinked creator to `${WEB_BASE_URL}/creator/connect` regardless of the payload value. The deep-link still correctly opens the Hermes bot; the `creator_onboard` parameter is simply ignored by Hermes today. This is documented in `.env.example` and is a no-op until a future phase adds Hermes payload parsing.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The only new surfaces are:

| Flag | File | Description |
|------|------|-------------|
| T-06-01 (mitigated) | CtaButton.tsx | External `<a>` to `t.me` domain — mitigated with `rel="noopener noreferrer"` per threat register |
| T-06-02 (accepted) | CtaButton.tsx | mailto: link exposes `contact@lala.la` — already public, not PII |
| T-06-03 (accepted) | CtaButton.tsx | `VITE_HERMES_BOT_URL` is build-time env, not user input |

All threats per the plan's `<threat_model>` are addressed. No new surfaces beyond those already in the register.

## Self-Check: PASSED

- [x] CtaButton.tsx exists at `artifacts/web/src/components/marketing/CtaButton.tsx`
- [x] MarketingLocaleSwitcher.tsx exists
- [x] HeroOrb.tsx exists
- [x] index.ts exists with 12 exports
- [x] .env.example contains VITE_HERMES_BOT_URL and VITE_CONTACT_EMAIL
- [x] index.css contains prefers-reduced-motion guard scoped to [data-surface="marketing"]
- [x] Zero fan-page token matches in marketing/ directory
- [x] Commits 0bbcf85, 92b51dd, bd784c0 exist
