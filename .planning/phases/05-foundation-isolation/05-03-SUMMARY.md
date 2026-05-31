---
phase: "05"
plan: "03"
subsystem: artifacts/web
tags: [fonts, seo, meta, og, hreflang, fontsource, vite, preload, mkt-15, mkt-16, mkt-17]
dependency_graph:
  requires:
    - "05-02: og-marketing.png committed to public/ (og:image references it)"
  provides:
    - "Self-hosted Inter Variable + Noto Sans JP Variable via Fontsource (replaces Google Fonts CDN)"
    - "vite.config.ts stable woff2 output path (assets/fonts/[name][extname])"
    - "index.html: full marketing meta/og/twitter/hreflang head + working production font preload"
  affects:
    - "artifacts/web/package.json"
    - "artifacts/web/src/main.tsx"
    - "artifacts/web/vite.config.ts"
    - "artifacts/web/index.html"
tech_stack:
  added:
    - "@fontsource-variable/inter ^5.2.8"
    - "@fontsource-variable/noto-sans-jp ^5.2.10"
  patterns:
    - "Fontsource variable font self-hosting: import in main.tsx pulls CSS with @font-face + font-display: swap"
    - "Vite rollupOptions.output.assetFileNames: woff2 → stable unhashed path; other assets → content-hashed"
    - "Static index.html hreflang (not JS-injected) satisfying crawler-visibility requirement"
    - "Font preload integration: stable vite-emitted path enables preload without node_modules href"
key_files:
  created: []
  modified:
    - "artifacts/web/package.json"
    - "artifacts/web/src/main.tsx"
    - "artifacts/web/vite.config.ts"
    - "artifacts/web/index.html"
    - "pnpm-lock.yaml"
decisions:
  - "Fontsource packages placed in dependencies (not devDependencies) — they are runtime CSS/font imports bundled by Vite"
  - "Preload crossorigin attribute set to 'anonymous' — matches PATTERNS.md spec, required for CORS font fetch"
  - "pnpm install (not --frozen-lockfile) used in worktree to sync lockfile with new package.json entries"
metrics:
  duration: 322s
  completed: "2026-05-31"
  tasks: 3
  files: 5
---

# Phase 5 Plan 03: Self-Hosted Fonts + Static SEO Head Summary

Self-hosted Inter Variable and Noto Sans JP Variable via Fontsource replace the Google Fonts CDN; vite.config.ts emits woff2 at stable unhashed paths; index.html carries the full marketing meta/og/twitter/hreflang head plus the NON-NEGOTIABLE 400-weight Noto Sans JP preload that resolves correctly in the production dist.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install Fontsource packages + import in main.tsx (MKT-15) | e2be695 | artifacts/web/package.json, artifacts/web/src/main.tsx, pnpm-lock.yaml |
| 2 | Configure vite.config.ts for stable woff2 path (MKT-15/17) | 13ae700 | artifacts/web/vite.config.ts |
| 3 | Replace index.html head — marketing meta/og/twitter/hreflang + font preload (MKT-15/16/17) | b7f8ae5 | artifacts/web/index.html |

## What Was Built

**Task 1 — Fontsource Install + main.tsx (MKT-15):** Installed `@fontsource-variable/inter ^5.2.8` and `@fontsource-variable/noto-sans-jp ^5.2.10` (pre-audited OK in RESEARCH Package Legitimacy Audit — created 2023-05-21, no postinstall scripts, workspace `minimumReleaseAge: 1440` guard active). Added two import lines to `main.tsx` after `./instrument` (Sentry must init first) and before `./index.css` (font-face declarations before Tailwind base). The default Fontsource variable import pulls a CSS file that declares `@font-face { font-display: swap; }` — no manual @font-face override needed. No postinstall scripts ran during install (confirmed from pnpm output).

**Task 2 — vite.config.ts stable woff2 path (MKT-15 preload prerequisite):** Added `rollupOptions.output.assetFileNames` to the existing `build` block. Function: if `assetInfo.name?.endsWith('.woff2')` → `'assets/fonts/[name][extname]'` (stable, unhashed); otherwise → `'assets/[name]-[hash][extname]'` (default content-hashing). After build, `dist/public/assets/fonts/noto-sans-jp-latin-wght-normal.woff2` exists at the exact path the preload href references. Non-font assets remain content-hashed (e.g., `fan-page-BimVBzYx.js`). Port configuration unchanged (PORT/server/preview config untouched).

**Task 3 — index.html marketing head (MKT-15/16/17):** Full head replacement:
- Title: `lala.la — AI Digital Twin for Creators`
- Meta description: full copy from UI-SPEC Copywriting Contract
- `og:title`, `og:description`, `og:type`, `og:url` (`https://lala.la`), `og:image` (`https://lala.la/og-marketing.png`)
- `twitter:card` = `summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image` (same og-marketing.png)
- 4 static hreflang tags in raw HTML (x-default/en/ja/zh-TW) before the `<script>` tag — not JS-injected
- NON-NEGOTIABLE font preload: `<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/noto-sans-jp-latin-wght-normal.woff2" crossorigin="anonymous" />`
- All 3 Google Fonts CDN `<link>` tags removed (googleapis.com, gstatic.com)
- Integration gate verified: built dist contains the preloaded woff2 at the exact referenced path (no 404 in production)

## Deviations from Plan

None — plan executed exactly as written. The cross-doc tension (RESEARCH suggesting omitting the preload vs CONTEXT D-05 making it NON-NEGOTIABLE) was resolved precisely as the plan specifies: stable assetFileNames in vite.config.ts + matching /assets/fonts/ href in the preload tag.

**Pre-existing out-of-scope error (not introduced by this plan):** `dashboard-security.tsx(220,5): error TS2304: Cannot find name 'setQrDataUrl'` — identical error noted in 05-01-SUMMARY, exists on main branch, not caused by Phase 5 changes. Logged to deferred items per 05-01 precedent.

## Known Stubs

None. All meta strings are the final English marketing copy from the UI-SPEC Copywriting Contract. The og-marketing.png referenced is the 1200x630 brand card committed in Plan 02 (intentional Phase 5 placeholder; final artwork is Phase 7 scope per D-05-04). The preload path resolves correctly in production builds.

## Threat Flags

No new security-relevant surface introduced.

- T-05-SC mitigated: both Fontsource packages returned slopcheck [OK] in RESEARCH audit; no postinstall scripts executed during install (confirmed); workspace `minimumReleaseAge: 1440` pnpm supply-chain guard active; pnpm lockfile pins exact versions.
- T-05-07 (meta/og/hreflang integrity): all values are hardcoded English strings from source; no user input flows into them — no injection surface.
- T-05-08 (og:image path): references brand-only card (no creator likeness per D-05-04); preload path is a static public font asset.
- T-05-09: Phase 5 adds no routes, no API calls, no auth changes.

## Self-Check: PASSED

- [x] `artifacts/web/package.json` contains `@fontsource-variable/inter` and `@fontsource-variable/noto-sans-jp`
- [x] `artifacts/web/src/main.tsx` imports both packages after `./instrument`, before `./index.css`
- [x] `artifacts/web/vite.config.ts` contains `assetFileNames`
- [x] `artifacts/web/index.html` contains `lala.la — AI Digital Twin for Creators` (title), 4 hreflang tags, `og:url`, `og:image` pointing to og-marketing.png, preload at `/assets/fonts/noto-sans-jp-latin-wght-normal.woff2`, no googleapis.com
- [x] `artifacts/web/dist/public/assets/fonts/noto-sans-jp-latin-wght-normal.woff2` exists (integration gate)
- [x] `artifacts/web/dist/public/index.html` has 4 hreflang tags and og:title (crawler simulation)
- [x] Commit e2be695 exists (Task 1)
- [x] Commit 13ae700 exists (Task 2)
- [x] Commit b7f8ae5 exists (Task 3)
