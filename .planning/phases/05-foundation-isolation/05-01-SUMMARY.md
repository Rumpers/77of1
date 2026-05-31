---
phase: "05"
plan: "01"
subsystem: artifacts/web
tags: [css-isolation, i18n, code-splitting, marketing, react-lazy]
dependency_graph:
  requires: []
  provides:
    - "@layer marketing-tokens with [data-surface=\"marketing\"]-scoped --mkt-* tokens"
    - "Typed marketing i18n namespace enforced by satisfies across en/ja/zh-TW"
    - "React.lazy() code-split page imports with Suspense boundary"
  affects:
    - "artifacts/web/src/index.css"
    - "artifacts/web/src/lib/i18n.ts"
    - "artifacts/web/src/App.tsx"
tech_stack:
  added: []
  patterns:
    - "CSS @layer isolation: marketing tokens scoped to [data-surface=\"marketing\"] attribute selector"
    - "TypeScript satisfies keyword for compile-time exhaustiveness checking"
    - "React.lazy() + Suspense for page-level code splitting"
key_files:
  created: []
  modified:
    - "artifacts/web/src/index.css"
    - "artifacts/web/src/lib/i18n.ts"
    - "artifacts/web/src/App.tsx"
decisions:
  - "Used satisfies Record<Locale, Messages> instead of type annotation for better TypeScript error messages and structural enforcement"
  - "Set Suspense fallback={null} — no marketing content exists yet in Phase 5 (plumbing-only)"
  - "English scaffolding used for all three locales (en/ja/zh-TW) — final JA/ZH-TW copy deferred to Phase 7"
metrics:
  duration: 700s
  completed: "2026-05-31"
  tasks: 3
  files: 3
---

# Phase 5 Plan 01: CSS/i18n/Bundle Isolation Foundation Summary

CSS isolation, typed i18n marketing namespace with compile-time key-completeness enforcement, and React.lazy page code-splitting added in three files with zero fan-page behavior change.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | @layer marketing-tokens CSS isolation | 2c8dc44 | artifacts/web/src/index.css |
| 2 | Typed marketing i18n namespace + satisfies | f061611 | artifacts/web/src/lib/i18n.ts |
| 3 | React.lazy() + Suspense code splitting | 0a80fca | artifacts/web/src/App.tsx |

## What Was Built

**Task 1 — CSS Isolation (MKT-10):** Appended `@layer marketing-tokens { [data-surface="marketing"] { ... } }` block at the end of `index.css`, after `@layer utilities`. Contains 34 `--mkt-*` CSS custom properties covering: surface colors (bg/surface-1/surface-2), text hierarchy (fg/muted-fg/accent-fg), accent (accent/accent-hover), border, radius (sm/md/lg), font stack (Inter Variable + Noto Sans JP Variable), type scale (xs through hero + section clamp), line heights (tight/body/cjk), and spacing scale (xs through 3xl). No `--mkt-*` token appears on `:root`, `body`, `html`, or `*` selectors — zero fan-page token leakage. The `.dark` block and `@theme inline` block are byte-for-byte unchanged.

**Task 2 — i18n Namespace (MKT-13):** Added `marketing:` block to the `Messages` TypeScript type with the complete nested shape (meta/nav/hero/value_prop/pillars/channels/onboarding/cta/footer/demo). Populated English scaffold for all three locales. Changed declaration from `const messages: Record<Locale, Messages> = {` to `const messages = { ... } satisfies Record<Locale, Messages>` — adding a marketing key to EN but not JA or ZH-TW now produces a TypeScript compile error. Drift guard verified: removing `demo` from `en.marketing` produces TS2741 on the satisfies annotation. No i18next library installed.

**Task 3 — Bundle Isolation (MKT-20):** Replaced 10 static `import X from "@/pages/..."` declarations with `const X = React.lazy(() => import("@/pages/..."))`. Added `import React, { Suspense } from "react"` at top. Wrapped `<Switch>` in `<Suspense fallback={null}>`. Route order preserved: `<Route path="/:locale/:handle" component={FanPage}/>` remains the last named route before the `<Route component={NotFound}/>` wildcard.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing fan-dsar.tsx missing dsar i18n keys (surfaced by satisfies enforcement)**

- **Found during:** Task 2
- **Issue:** `fan-dsar.tsx` references 24 `dsar.*` keys (`fan_tab`, `creator_tab`, `fan_title`, `fan_subtitle`, `email_label`, `email_placeholder`, `request_type_label`, `request_type_all`, `request_type_messages`, `request_type_account`, `fan_notice`, `creator_title`, `creator_subtitle`, `creator_email_label`, `creator_notice`, `email_invalid`, `submitting`, `fan_submit`, `creator_submit`, `done_title`, `done_body_fan`, `done_body_creator`, `done_support_hint`, `powered_by`) that did not exist in the `dsar` type in `i18n.ts`. The `Record<Locale, Messages>` type annotation did not enforce these — but `satisfies` does. These errors existed in the main branch already (confirmed by running tsc on main repo).
- **Fix:** Added all 24 missing keys to the `dsar` block in the `Messages` type, and added English/Japanese/Chinese scaffold values to all three locale entries.
- **Files modified:** `artifacts/web/src/lib/i18n.ts`
- **Commit:** f061611 (included in Task 2 commit)

### Pre-existing Errors Not Fixed (Out of Scope)

**dashboard-security.tsx:** `setQrDataUrl` used but not declared via `useState`. This error exists in the main branch and is not caused by any of my changes. Logged to deferred items.

## Known Stubs

The marketing namespace scaffold strings are intentional English placeholders for all three locales. Final JA/ZH-TW copy is Phase 7 scope (per D-05-05 decision). These stubs do NOT prevent the plan's goal from being achieved — Phase 5 is plumbing-only with no visible marketing content.

## Threat Flags

No new security-relevant surface introduced. This plan modifies only:
- A CSS file (static build output, no runtime user input)
- A TypeScript i18n file (build-time constants, no PII, no secrets)
- A React router file (no new routes, no auth paths, no data handling)

T-05-01 (CSS leakage to :root/body) mitigated: `grep -nE '^(:root|body|html|\*)' artifacts/web/src/index.css | grep -i mkt` returns nothing.

## Self-Check: PASSED

- [x] `artifacts/web/src/index.css` exists and contains `@layer marketing-tokens`
- [x] `artifacts/web/src/lib/i18n.ts` exists and contains `satisfies Record<Locale, Messages>`
- [x] `artifacts/web/src/App.tsx` exists and contains `React.lazy`
- [x] Commit 2c8dc44 exists: `git log --oneline --all | grep 2c8dc44` — FOUND
- [x] Commit f061611 exists: FOUND
- [x] Commit 0a80fca exists: FOUND
