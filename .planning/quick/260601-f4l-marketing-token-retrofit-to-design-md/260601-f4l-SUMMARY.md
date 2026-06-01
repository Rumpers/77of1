---
phase: quick-260601-f4l
plan: 01
subsystem: web-marketing-tokens
tags: [design-tokens, fonts, marketing, css, fontsource]
completed: 2026-06-01
duration_minutes: 12
tasks_completed: 2
tasks_total: 2
files_created: []
files_modified:
  - artifacts/web/src/index.css
  - artifacts/web/src/main.tsx
  - artifacts/web/package.json
  - pnpm-lock.yaml
commits:
  - hash: c01695d
    message: "feat(web): retrofit marketing --mkt-* tokens to Luminous Infrastructure"
  - hash: 1c1c878
    message: "feat(web): self-host Bricolage Grotesque + Geist + Noto Sans TC via Fontsource"
requires: []
provides: [marketing-token-foundation, marketing-font-loading]
affects: [artifacts/web]
key_decisions:
  - "Pre-existing TS error in dashboard-security.tsx (setQrDataUrl) confirmed out-of-scope; baseline was already failing before this task"
  - "index.html Noto JP preload left untouched as required; no Bricolage preload added (hashed path not confirmed from build)"
---

# Quick 260601-f4l: Marketing --mkt-* Token Retrofit to Luminous Infrastructure

**One-liner:** Replaces all placeholder light-mode `--mkt-*` values with the DESIGN.md "Luminous Infrastructure" dark violet-ink palette and loads three new Fontsource variable font families (Bricolage Grotesque, Geist, Noto Sans TC) for the marketing surface.

## Tasks Executed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Retrofit --mkt-* token values to DESIGN.md | c01695d | Done |
| 2 | Install and import three self-hosted font families | 1c1c878 | Done |

## What Was Built

### Task 1 — Token Retrofit (index.css)

Inside `@layer marketing-tokens { [data-surface="marketing"] { ... } }` only:

**Retrofitted values (9 tokens):**
- `--mkt-bg`: `#ffffff` → `#0D0A14` (violet-tinted near-black canvas)
- `--mkt-fg`: `#111111` → `#F4F1FA` (warm violet-white)
- `--mkt-surface-1`: `#f5f5f5` → `#16111F`
- `--mkt-surface-2`: `#ebebeb` → `#1F1830`
- `--mkt-border`: `#e0e0e0` → `#2A2238`
- `--mkt-accent`: `hsl(263 80% 58%)` → `#7C3AED` (exact hex)
- `--mkt-accent-hover`: `hsl(263 80% 50%)` → `#6D28D9`
- `--mkt-accent-fg`: `#ffffff` → `#FFFFFF` (casing normalized)
- `--mkt-muted-fg`: `#666666` → `#9D94B5`
- `--mkt-radius-sm/md/lg`: `.375/.625/1rem` → `0.5/0.875/1.25rem`
- `--mkt-font-sans`: Inter Variable stack → `'Geist', 'Noto Sans JP', 'Noto Sans TC', system-ui, -apple-system, "Hiragino Sans", "Meiryo", sans-serif`

**New tokens added (4):**
- `--mkt-glow-from: #7C3AED` — violet bloom start
- `--mkt-glow-to: #D946EF` — fuchsia bloom end
- `--mkt-radius-pill: 999px`
- `--mkt-font-display: 'Bricolage Grotesque', system-ui, sans-serif`

**Preserved unchanged:** all `--mkt-text-*`, `--mkt-leading-*`, `--mkt-spacing-*` tokens.

**Isolation confirmed:** Zero `--mkt-*` declarations outside `[data-surface="marketing"]`. `:root`, `.dark`, `@theme inline` are byte-identical to before.

### Task 2 — Font Loading (main.tsx + package.json)

Packages confirmed against npm registry before install:
- `@fontsource-variable/bricolage-grotesque@5.2.10` ✓
- `@fontsource-variable/geist@5.2.9` ✓ (NOT geist-sans — that variable form does not exist)
- `@fontsource-variable/noto-sans-tc@5.2.10` ✓

Installed via: `pnpm --filter @workspace/web add ...`

Imports in `main.tsx` (5 total, order: instrument → inter → noto-sans-jp → bricolage-grotesque → geist → noto-sans-tc):
```
import './instrument'; // must be first
import '@fontsource-variable/inter';
import '@fontsource-variable/noto-sans-jp';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/geist';
import '@fontsource-variable/noto-sans-tc';
```

`index.html` untouched. Noto JP preload at line 26 preserved exactly.

## Verification Results

| Check | Result |
|-------|--------|
| `grep -c --mkt-(glow-from\|glow-to\|radius-pill\|font-display)` returns 4 | PASS |
| `grep -n "@fontsource"` shows exactly 5 imports | PASS |
| All `--mkt-*` inside marketing-tokens scope only | PASS |
| `:root`/`.dark`/`@theme inline` untouched | PASS |
| `pnpm install` succeeded | PASS |
| `tsc --noEmit` pre-existing error (dashboard-security.tsx) | Pre-existing — out of scope |
| Font modules present in node_modules | PASS |

## Deviations from Plan

### Pre-existing TS Error (Out of Scope)

`artifacts/web/src/pages/dashboard-security.tsx:220` has a pre-existing `TS2304: Cannot find name 'setQrDataUrl'` error. Confirmed by running `tsc --noEmit` on the baseline (before any changes in this task) — the error was already present. This task introduces zero new TypeScript errors. The pre-existing error is out of scope per the deviation boundary rule (only fix issues directly caused by current task changes).

## Known Stubs

None — this task is foundation-only (token values + font loading). No marketing components consume these tokens yet; Phase 6 builds those components.

## Threat Flags

None — CSS custom property scoping change has no security surface.

## Self-Check: PASSED

- `c01695d` exists: confirmed
- `1c1c878` exists: confirmed
- `artifacts/web/src/index.css` contains `--mkt-glow-from`: confirmed
- `artifacts/web/src/main.tsx` contains `@fontsource-variable/geist`: confirmed
- `artifacts/web/package.json` contains `@fontsource-variable/bricolage-grotesque`: confirmed
