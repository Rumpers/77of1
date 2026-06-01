---
status: passed
phase: 06-marketing-components-navigation
source: [06-VERIFICATION.md]
started: 2026-06-01T08:00:00Z
updated: 2026-06-01T09:20:00Z
verified_by: browser automation (Playwright) against dev server on :22344 (rio-de-janeiro build)
---

## Current Test

[complete — all items browser-verified]

## Tests

### 1. 375px responsive overflow (SC-5 / MKT-11)
expected: At 375px viewport, no horizontal overflow on `/en`.
result: PASS — `document.documentElement.scrollWidth === clientWidth === 375`, `horizontalOverflow: false`. The single absolute-positioned HeroOrb div extends past the viewport but is clipped by `overflow-x-hidden` on the marketing surface (no scrollbar produced).

### 2. Visual marketing page render
expected: `/en` renders the new marketing page, not the old prototype.
result: PASS — `data-surface="marketing"` present, h1 "Your AI twin, fully managed.", 7 `<section>` elements, 0 console errors. Confirmed NOT the old throwaway prototype (which had a different headline + variant directions).

### 3. CTA click behavior (MKT-08/MKT-09)
expected: Primary CTA at hero/mid/footer routes to same `t.me` deep-link; mailto fallback visible.
result: PASS (wiring) / CAVEAT (env). All 3 "Start with Telegram" CTAs read one shared module constant `HERMES_BOT_URL` (import.meta.env.VITE_HERMES_BOT_URL) → identical href guaranteed when set. Mailto fallback ("No Telegram? Contact us" → mailto:contact@lala.la) always rendered (4 instances + footer Contact).
CARRY-FORWARD: with VITE_HERMES_BOT_URL unset, the primary CTA renders as a styled href-less dead anchor (REVIEW.md CR-01). Deployment MUST set VITE_HERMES_BOT_URL; CtaButton should fall back more gracefully than a dead anchor. → Phase 7.

### 4. Locale switcher routing (MKT-14)
expected: Nav switcher changes URL to /ja, /zh-TW, /en (no handle) and re-renders localized copy.
result: PASS (structure) / CAVEAT (copy). `/ja` renders marketing surface with Japanese section content; nav switcher (EN / 日本語 / 繁中) present, single-segment routing, no fan LocaleSwitcher import.
CARRY-FORWARD: hero h1 and SB-243 disclosure still render English on /ja (missing JA/TW hero copy — REVIEW.md WR-04). Roadmap defers EN/JA/ZH-TW locale verification + native-speaker copy to Phase 7.

### 5. Fan route isolation
expected: `/en/<handle>` still loads the fan chat page unchanged.
result: PASS — `/en/claire` renders the fan chat page (`isMarketingSurface: false`, h1 "@claire", "Chat with @claire's AI twin"). Marketing nav/route does not interfere. (2 console errors there are pre-existing fan-page API calls with no backend running — unrelated to Phase 6.)

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

Phase-6 goal (isolated, individually-verifiable marketing components consuming only --mkt-* tokens) is achieved. The following are quality/compliance carry-forwards to Phase 7 (Assembly, Polish & Compliance), tracked but NOT Phase-6 must-have failures:

- **CR-01 (critical, REVIEW.md):** CtaButton renders a styled href-less dead `<a>` when VITE_HERMES_BOT_URL is unset. Fix graceful fallback + ensure deploy sets the env var.
- **WR-04 (warning, REVIEW.md):** SB-243 disclosure copy hardcoded English in hero/demo (renders English on JA/TW). `@claire_ai` handle hardcoded. Localize for compliance.
- **WR-02 (warning, REVIEW.md):** `/:locale` matches any segment → `/foobar` serves English page at 200 instead of 404. Add locale allow-list.
- **WR-05 (warning, REVIEW.md):** Footer privacy link is a raw `<a href>` causing full page reload, bypassing wouter SPA router.
- **Orphaned test:** `artifacts/web/src/pages/home.test.ts` references the removed throwaway home exports (MarketingLanding/variant directions); not wired to any runner, does not break build/typecheck — delete during Phase 7 cleanup.
