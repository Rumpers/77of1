---
phase: 05-foundation-isolation
reviewed: 2026-05-31T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - artifacts/web/index.html
  - artifacts/web/src/App.tsx
  - artifacts/web/src/index.css
  - artifacts/web/src/lib/i18n.ts
  - artifacts/web/src/main.tsx
  - artifacts/web/vite.config.ts
  - artifacts/web/public/robots.txt
  - artifacts/web/public/sitemap.xml
  - artifacts/web/package.json
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-31
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 05 delivers frontend-only foundation work for the lala.la marketing site: marketing CSS token isolation via `@layer marketing-tokens` scoped to `[data-surface="marketing"]`, a typed i18n `marketing` namespace, `React.lazy` code-splitting of page routes, self-hosted Fontsource fonts, a static SEO head, `sitemap.xml`, and `robots.txt`.

The isolation discipline is well executed: `--mkt-*` tokens are scoped correctly, never leak into `@theme inline` or `:root`, and the i18n namespace is `satisfies`-enforced across all three locales. The font self-hosting and unhashed-woff2 vite emission are wired so the preload `href` is stable.

However, there is one shipped correctness defect that defeats the headline goal of this phase — the self-hosted fonts are **never applied to the global app surface** because the font-family token names do not match the Fontsource-registered family names. The non-negotiable preloaded Noto font is therefore unused on every page except a marketing surface that no rendered page currently mounts. Several SEO/head consistency issues and an accessibility regression in the viewport meta also surfaced.

## Critical Issues

### CR-01: Self-hosted fonts are never applied — global font-family token names do not match Fontsource families

**File:** `artifacts/web/src/index.css:143` (and `:144-145`), cross-ref `artifacts/web/src/main.tsx:2-3`
**Issue:**
`main.tsx` imports the self-hosted Fontsource packages, which register CSS families named exactly `'Inter Variable'` and `'Noto Sans JP Variable'` (verified in `node_modules/@fontsource-variable/inter/index.css` and `.../noto-sans-jp/index.css`). But the global app font tokens are:

```css
--app-font-sans: 'Inter', sans-serif;   /* line 143 — wrong family name */
--app-font-serif: Georgia, serif;
--app-font-mono: Menlo, monospace;
```

`'Inter'` (no `Variable` suffix) does not match the registered `@font-face` family `'Inter Variable'`, so the browser falls straight through to `sans-serif`. There is **no** family in the global cascade that resolves to `'Noto Sans JP Variable'` either. Consequences:

1. The whole app (`body { @apply font-sans }`, line 280) renders in the platform `sans-serif`, not the self-hosted Inter — the self-host migration produces no visible effect on any real page.
2. The "NON-NEGOTIABLE font preload" of `noto-sans-jp-latin-wght-normal.woff2` (`index.html:26`) is downloaded eagerly on every page but is never consumed by the global surface — it is referenced only by `--mkt-font-sans` (`index.css:417`), and the only marketing-surfaced page (`home.tsx`) is a stub that sets `fontFamily: "system-ui"` inline and never sets `data-surface="marketing"`. The preload is currently dead weight (a render-blocking-priority fetch for a font nothing paints with), and a browser will log an "preloaded but not used within a few seconds" console warning.

This is the central deliverable of the phase (self-hosted fonts replacing the CDN) silently not taking effect.

**Fix:**
Make the global tokens reference the Fontsource family names (keep the platform fallbacks), so both the Latin and CJK self-hosted faces are in the global cascade:

```css
--app-font-sans: 'Inter Variable', 'Noto Sans JP Variable', system-ui,
                 -apple-system, "Hiragino Sans", "Meiryo", sans-serif;
```

(Mirror the value already correctly used in `--mkt-font-sans`.) If the intent is genuinely that only the marketing surface uses these fonts, then the preload in `index.html:26` must be removed from the global document head and the "non-negotiable preload" decision revisited, because preloading a font no globally-rendered surface uses is a measurable performance regression with a console warning, not a win.

## Warnings

### WR-01: `maximum-scale=1` viewport disables pinch-zoom — accessibility (WCAG 1.4.4) regression

**File:** `artifacts/web/index.html:5`
**Issue:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
```
`maximum-scale=1` blocks user-initiated pinch-zoom on most mobile browsers. This fails WCAG 2.1 SC 1.4.4 (Resize Text) and is hostile to low-vision users — a notable risk for a consumer-facing marketing page that this phase is explicitly building out. There is no functional reason a static marketing/SPA page needs to suppress zoom.
**Fix:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

### WR-02: `og:url` and missing canonical do not match the hreflang/site URL scheme

**File:** `artifacts/web/index.html:13` (cross-ref `:21-24`, `public/sitemap.xml`)
**Issue:**
`og:url` is the bare apex `https://lala.la`, but every indexable URL in this phase is locale-prefixed (`https://lala.la/en`, `/ja`, `/zh-TW` per hreflang and sitemap), and `/` itself client-redirects to `/en` (`App.tsx:32-34`). There is also no `<link rel="canonical">`. Crawlers will see an `og:url` (and implied canonical) of `https://lala.la` that does not appear in the sitemap and immediately redirects, which muddies canonicalization and OG link-unfurl targets.
**Fix:**
Set a canonical and `og:url` consistent with the indexed default-locale URL:
```html
<link rel="canonical" href="https://lala.la/en" />
<meta property="og:url" content="https://lala.la/en" />
```
(Or, if per-locale canonicals are intended, that requires per-locale documents — out of scope for a single static `index.html`, in which case standardize on `/en`.)

### WR-03: `robots.txt` `Disallow: /en/` blocks the locale home page's own sub-resources and contradicts intent for indexable content

**File:** `artifacts/web/public/robots.txt:5-7`
**Issue:**
```
Allow: /en
Disallow: /en/
```
`Allow: /en` permits exactly `/en`, while `Disallow: /en/` blocks everything under `/en/`. Because this is an SPA served via history fallback, the intent is presumably "index the locale landing pages, hide fan/onboard/account sub-pages." That works for crawl-gating, but note: (a) `Allow: /en` does **not** match `/en/` (trailing slash), so if the deployed canonical home URL ever resolves with a trailing slash (`/en/`) it becomes disallowed and drops from the index; (b) most crawlers apply longest-match, so the rules are order-independent here, but the asymmetry between `Allow`/`Disallow` trailing slashes is fragile. The sitemap lists `https://lala.la/en` (no slash), so this currently aligns — but it is one trailing-slash redirect away from de-indexing the homepage.
**Fix:**
Make the allow/disallow boundaries explicit and slash-consistent, e.g. keep `Allow: /en` and `Disallow: /en/` only after confirming the production server never 301s `/en` → `/en/`. Add a regression note, or switch to path-segment patterns that tolerate the trailing slash (e.g. also `Allow: /en/$` if the home renders at the slash form).

### WR-04: `sitemap.xml` omits `<lastmod>` and uses arbitrary differing priorities with no basis

**File:** `artifacts/web/public/sitemap.xml:10-11, 19-20, 28-29`
**Issue:**
The three locale homepages are functionally equivalent landing pages, yet `/en` is given `priority 1.0` while `/ja` and `/zh-TW` get `0.9`. Priority is relative-within-site and these are peers; the split signals nothing useful and can subtly de-prioritize the JP/TW pages, which are the actual launch markets (JP/TW/HK per project brief). No `<lastmod>` is present, so crawlers cannot detect freshness. Minor, but this is net-new SEO infrastructure shipping with avoidable noise.
**Fix:**
Set all three locale homepages to the same priority (e.g. `0.8`) or drop `<priority>` entirely (Google ignores it), and add `<lastmod>` with a build/publish date so re-crawl scheduling has a signal.

### WR-05: `getPageLocale()` reads `window.location.pathname` directly, ignoring the router `base`

**File:** `artifacts/web/src/App.tsx:21-25` (used at `:82`), cross-ref `:79`
**Issue:**
`WouterRouter` is configured with `base={import.meta.env.BASE_URL.replace(/\/$/, "")}` (line 79), meaning the app may be served under a non-root base path. But `getPageLocale()` parses `window.location.pathname.split("/").find(Boolean)` — the raw, base-inclusive pathname. If `BASE_URL` is anything other than `/`, the first path segment is the base prefix (e.g. `app`), not the locale, so `isValidLocale(seg)` fails and the cookie-consent banner always falls back to `DEFAULT_LOCALE` ("en") even for JP/TW visitors. The banner locale silently desyncs from the page locale under any non-root deployment.
**Fix:**
Strip the router base before extracting the locale, or derive the locale from wouter's `useRoute`/`useLocation` (which are base-aware) instead of reading `window.location` directly:
```ts
import { useLocation } from "wouter";
// inside a component:
const [loc] = useLocation();              // base-stripped
const seg = loc.split("/").find(Boolean) ?? "";
```

### WR-06: `<Suspense fallback={null}>` produces a blank screen during every lazy chunk load with no error boundary

**File:** `artifacts/web/src/App.tsx:29` (cross-ref `:7-16`)
**Issue:**
All page routes are now `React.lazy` chunks, but the single top-level `Suspense` uses `fallback={null}` and there is no error boundary around the lazy tree. Two consequences: (1) on a slow network the user sees a fully blank page (no spinner/skeleton) during chunk fetch — a UX regression versus the previous eager bundle, especially on the marketing landing page this phase targets; (2) if a chunk fails to load (deploy mid-session, network blip, stale hashed URL), the `lazy()` import rejects and, with no error boundary, the whole app unmounts to a blank white screen with only a console error. For a consumer marketing entry point this is a meaningful reliability gap.
**Fix:**
Provide a lightweight visible fallback and wrap the lazy `Switch` in an error boundary that offers a reload on chunk-load failure:
```tsx
<ErrorBoundary fallback={<ReloadPrompt />}>
  <Suspense fallback={<PageSkeleton />}>
    <Switch>…</Switch>
  </Suspense>
</ErrorBoundary>
```

## Info

### IN-01: `marketing.meta.title` / `description` are untranslated for `ja` and `zh-TW`

**File:** `artifacts/web/src/lib/i18n.ts:795-501` (en), `:1089-1091` (ja), reused English strings
**Issue:**
The `ja` and `zh-TW` `marketing` namespaces copy the English `meta`, `hero`, `value_prop`, `pillars`, `channels`, `onboarding`, `cta`, `footer`, and `demo` strings verbatim — every marketing string in JP/TW is English. The `satisfies` check only enforces shape, not translation, so this compiles cleanly while shipping an all-English marketing page to the two primary launch markets. If these are intentional placeholders, mark them so they are not mistaken for finished copy.
**Fix:** Track as a content task; add a `// TODO(i18n): placeholder — English copy pending JP/TW translation` marker at the top of each non-en `marketing` block so the gap is visible in review and grep-able before launch.

### IN-02: Marketing token block declares a placeholder `--mkt-accent` while `:root` light-mode tokens are literal `red`

**File:** `artifacts/web/src/index.css:405-438` (mkt) and `:81-141` (`:root` light mode)
**Issue:**
The marketing-tokens block is explicitly flagged as placeholder ("replace wholesale via UI-SPEC before Phase 6"), which is fine. Separately note that the entire light-mode `:root` palette is still literal `red /*replace with H S L*/` (lines 81-141). This predates this phase, but because this phase introduces a `[data-surface="marketing"]` light surface (`--mkt-bg: #ffffff`), any component that mixes a global token (e.g. `bg-background` → `red`) with marketing tokens will render red. Worth confirming no marketing component consumes a global `--color-*` token before Phase 6.
**Fix:** No action required this phase; flag for Phase 6 so the marketing surface does not inherit unreplaced `red` global tokens.

### IN-03: `posthog-js` is a runtime dependency but is only referenced from `cookie-consent.ts`, not initialized in this phase's entry

**File:** `artifacts/web/package.json:81`, cross-ref `src/main.tsx`
**Issue:** `posthog-js` is in `dependencies` and imported by `src/lib/cookie-consent.ts`, but `main.tsx` (the entry this phase touches) does not initialize it. Not a defect in the reviewed diff; noted so the analytics wiring is not assumed complete.
**Fix:** None for this phase; verify PostHog init happens where intended before relying on marketing-page analytics.

### IN-04: Comment claims hreflang "MUST be static — NOT JS-injected" but no guard prevents JS injection

**File:** `artifacts/web/index.html:20`
**Issue:** The strongly-worded invariant comment is good documentation, but there is nothing (lint rule, test) enforcing that a future `useEffect` does not inject conflicting hreflang/`<link>` tags from the SPA. Given the SPA already manipulates document state, this invariant is one PR away from silent violation.
**Fix:** Optional — add a lightweight test asserting the static `<link rel="alternate" hreflang>` set matches `LOCALES` from `i18n.ts`, so locale drift between the head and the app is caught in CI.

### IN-05: `vite.config.ts` unhashes ALL `.woff2` assets globally, not just the preloaded Noto file

**File:** `artifacts/web/vite.config.ts:62-67`
**Issue:** `assetFileNames` returns the stable unhashed `assets/fonts/[name][extname]` for **every** `.woff2`, which is broader than the one preloaded file the comment references. Fontsource emits ~120 Noto subset files plus Inter; all become unhashed, losing content-hash cache-busting for fonts. Fontsource filenames are stable across versions so collisions are unlikely, but a font package bump that changes a file's bytes without renaming it would serve stale cached fonts. Acceptable trade-off for the stable-preload requirement, but the blast radius is wider than the comment implies.
**Fix:** Optional — narrow the unhashed path to only the preloaded file (match on the exact `noto-sans-jp-latin-wght-normal` name) and let all other woff2 keep content hashes, preserving cache-busting for the long tail of subset files.

---

_Reviewed: 2026-05-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
