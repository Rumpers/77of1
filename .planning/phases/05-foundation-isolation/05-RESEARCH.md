# Phase 5: Foundation & Isolation — Research

**Researched:** 2026-05-31
**Domain:** Vite + React 19 + Tailwind v4 SPA — CSS isolation, CJK font self-hosting, static SEO assets, typed i18n namespace, route-ordering
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-05-01: Public brand string = `lala.la`.** The marketing `<title>` and `og:title` use the bare product brand `lala.la`. Not "Lala" and not a brand+descriptor composite.
- **D-05-02: Positioning angle = managed-service, creator-facing.** Meta description leads with "we run your AI twin for you". Audience is creators (CTA deep-links to Hermes bot). Exact wording open; angle locked. Seed: "Your AI twin, fully managed — we keep your fans engaged in your voice while you create."
- **D-05-03: Static OG/meta text is English.** All three locale URLs share one static meta block in `index.html`. Per-locale OG metadata deferred to v2.x bot-detect middleware.
- **D-05-04: `og-marketing.png` = logo + tagline only, no creator likeness.** 1200×630 brand-level card.
- **D-05-05: Commit placeholder `--mkt-*` tokens now; defer real marketing design system to UI-SPEC.** Phase 5 establishes token structure and isolation mechanism with neutral placeholder values.
- **D-05-06: Keep EN-default.** `DEFAULT_LOCALE = "en"` stays; root `/` redirects to `/en`; `hreflang x-default = en`.

### Claude's Discretion

- Noto Sans JP delivery: self-host (Fontsource woff2) vs Google Fonts CDN — open technical question. Non-negotiable regardless: `font-display: swap` + `<link rel="preload">` for 400-weight woff2.
- Exact final wording of meta strings (within D-05-01/02/03 constraints), token naming conventions under `--mkt-*`, and `vite-plugin-sitemap` vs hand-written `sitemap.xml`.
- Whether to add `react-helmet-async` for `<html lang>` switching.

### Deferred Ideas (OUT OF SCOPE)

- Per-locale OG/social-preview meta (requires Express bot-detect middleware, deferred to v2.x)
- Creator-likeness on marketing assets (blocked on separate marketing-use authorization)
- Asian-locale default front door (keeping EN-default; revisit if founder prefers `/ja`)
- Full marketing visual design system (routed to `/gsd:ui-phase` before Phase 6)
- Any marketing section component, nav, footer, or copy beyond meta strings (Phase 6)
- Page assembly, scroll animations, on-page SB 243 disclosure (Phase 7)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MKT-10 | Marketing site uses net-new design system isolated from fan-page styling via scoped `--mkt-*` tokens under `[data-surface="marketing"]` | CSS layer isolation mechanism verified — `@layer marketing-tokens` with attribute selector scoping; exact block specified in UI-SPEC and confirmed implementable |
| MKT-13 | All marketing copy localized EN/JA/ZH-TW via typed `marketing` namespace in `lib/i18n.ts` with compile-time key-completeness enforcement | `satisfies Record<Locale, Messages>` pattern verified in existing codebase (line 176); `marketing` namespace type shape provided in UI-SPEC is ready to append |
| MKT-15 | CJK (JA/ZH-TW) typography renders correctly — Noto Sans JP loaded with `font-display: swap`, correct line-break/word-break, no FOIT on mobile | Fontsource variable package verified: `@fontsource-variable/noto-sans-jp` v5.2.10; ships `font-display: swap`; preload pattern via `?url` import confirmed; file naming convention resolved |
| MKT-16 | `index.html` carries real marketing meta (title, description, `og:*`, `twitter:card`) and a committed `og-marketing.png` | Current `index.html` confirmed placeholder "7of1" text; exact replacement meta specified in UI-SPEC Copywriting Contract |
| MKT-17 | Static `sitemap.xml` (3 locale URLs), `robots.txt`, and per-locale `hreflang` link tags served from static HTML/assets | Hand-written static `public/sitemap.xml` with hreflang is the correct approach (not vite-plugin-sitemap); full XML provided in UI-SPEC; robots.txt format confirmed |
| MKT-20 | Existing fan route and fixed Replit ports remain unaffected; marketing routes ordered above fan catch-all; zero CSS leak | Route ordering confirmed correct in current `App.tsx`; Phase 5 adds no new named routes; `React.lazy()` wrapping added to all page components |
</phase_requirements>

---

## Summary

Phase 5 is a plumbing-only phase inside `artifacts/web` — no new artifact, no backend changes, no visible marketing sections. It locks six structural prerequisites that all later marketing component work depends on: (1) CSS token isolation via `@layer marketing-tokens` and `[data-surface="marketing"]`, (2) typed `marketing` i18n namespace with compile-time completeness enforcement, (3) static SEO meta in `index.html` with committed `og-marketing.png`, (4) static `sitemap.xml` and `robots.txt` in `public/`, (5) self-hosted CJK fonts with FOIT prevention, (6) `React.lazy()` + `Suspense` code-splitting for all page components.

The codebase is in a known, inspectable state. `index.html` has placeholder "7of1" meta and three Google Fonts CDN `<link>` tags. `index.css` has `@layer base` and `@layer utilities` but no marketing layer. `lib/i18n.ts` is 806 lines; `const messages: Record<Locale, Messages> = {` is at line 176 with no `satisfies` keyword present — the annotation must be added when appending the `marketing` namespace. `App.tsx` uses static `import` (not `React.lazy`) for all pages. `public/` contains only `favicon.svg`, `opengraph.jpg`, and a permissive `robots.txt` (`Allow: /`).

**Primary recommendation:** Implement all six deliverables as a single wave of changes across five files plus three new `public/` assets. Add `React.lazy()` wrapping to `App.tsx` before adding the marketing namespace to `i18n.ts` so the type system validates cleanly. Self-host Inter via Fontsource; self-host Noto Sans JP via Fontsource with the `latin` subset preloaded — the critical insight is that the latin subset woff2 (`noto-sans-jp-latin-wght-normal.woff2`) is small (~89 kB) and fast; the full 120-numbered-subset CJK body (~5.22 MB) loads progressively via `font-display: swap`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CSS token isolation | Browser / Client (index.css) | — | Tailwind v4 CSS layers are processed at build time and served as static CSS; isolation is a CSS concern, not a server concern |
| i18n typed namespace | Browser / Client (lib/i18n.ts TypeScript type system) | — | Hand-rolled compile-time typed messages; no runtime i18n lib; TypeScript enforces completeness at build |
| Static OG/meta tags | CDN / Static (index.html) | — | Must be in raw HTML served to crawlers; cannot be JS-injected; Replit serves static files from `dist/public/` |
| sitemap.xml + robots.txt | CDN / Static (public/) | — | Static files copied as-is by Vite into `dist/public/`; crawler-consumed, not React-consumed |
| Font loading + FOIT prevention | Browser / Client (main.tsx + index.html) | CDN / Static | Fontsource woff2 files bundled into `dist/public/assets/` by Vite; preload hint in `index.html` |
| Route ordering / code-splitting | Browser / Client (App.tsx) | — | wouter `Switch` is client-side; `React.lazy()` is a React bundle concern, not a server concern |

---

## Standard Stack

### Net-New Additions for This Phase

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@fontsource-variable/inter` | ^5.2.8 | Self-hosted variable Inter font (Latin) | Removes Google Fonts CDN dependency; variable font covers all weights in one woff2 file; eliminates third-party DNS latency and privacy-law risk on first paint |
| `@fontsource-variable/noto-sans-jp` | ^5.2.10 | Self-hosted variable Noto Sans JP font (CJK) | Only font with full JA + ZH-TW glyph coverage available as an npm package with `font-display: swap` built-in; ~5.22 MB total but individual subsets are small |

**[VERIFIED: npm registry]** — Both packages confirmed on npm registry, created 2023-05-21, repository at `github.com/fontsource/font-files`. slopcheck result: `[OK]` for both. No postinstall scripts.

### What Is NOT Added

| Avoided | Reason |
|---------|--------|
| `vite-plugin-sitemap` | Hand-written `public/sitemap.xml` is sufficient for 3 static URLs; zero build complexity; hreflang support in the static file is trivial; the plugin is a devDependency overhead with no benefit at this scale. See decision below. |
| `react-helmet-async` | Not needed for Phase 5; all hreflang tags are statically in `index.html` (required by Pitfall 9); `<html lang>` switching is a Phase 6 optional enhancement. React 19 native `<title>`/`<meta>` hoisting covers any runtime head updates needed. |
| `i18next` | Explicitly prohibited; existing `getMessages()` system extended with `marketing` namespace |

### Existing Libraries (No Installation Required)

| Library | Version | Used By This Phase |
|---------|---------|-------------------|
| React | 19.1.0 | `React.lazy()` + `Suspense` in `App.tsx` |
| Tailwind CSS v4 | catalog | `@layer marketing-tokens` in `index.css` |
| wouter | ^3.3.5 | Route ordering preserved in `App.tsx` |

**Installation command (net-new packages only):**
```bash
pnpm --filter @workspace/web add @fontsource-variable/inter @fontsource-variable/noto-sans-jp
```

**Version verification (run before install):**
```bash
npm view @fontsource-variable/inter version          # 5.2.8 as of 2026-05-31
npm view @fontsource-variable/noto-sans-jp version   # 5.2.10 as of 2026-05-31
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@fontsource-variable/inter` | npm | 2 yrs (created 2023-05-21) | High (Fontsource is widely used) | github.com/fontsource/font-files | [OK] | Approved |
| `@fontsource-variable/noto-sans-jp` | npm | 2 yrs (created 2023-05-21) | High (Fontsource is widely used) | github.com/fontsource/font-files | [OK] | Approved |
| `vite-plugin-sitemap` | npm | 4 yrs (created 2022-04-29) | Moderate (27k/wk per prior research) | github.com/jbaubree/vite-plugin-sitemap | [OK] (no source repo linked in package.json but repo confirmed on GitHub) | Not used — hand-written sitemap instead |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

slopcheck ran successfully and returned `[OK]` for all three checked packages.

---

## Architecture Patterns

### System Architecture Diagram

```
index.html (static head)
  ├── <title>, og:*, twitter:card, hreflang x3  ← MODIFIED (Phase 5)
  ├── <link rel="preload"> Noto Sans JP latin woff2  ← ADDED (Phase 5)
  └── removes Google Fonts CDN <link>  ← REMOVED (Phase 5)

src/main.tsx
  ├── import '@fontsource-variable/inter'           ← ADDED (Phase 5)
  └── import '@fontsource-variable/noto-sans-jp'    ← ADDED (Phase 5)

src/index.css (Tailwind v4)
  ├── @layer base  (existing fan-page CSS, UNCHANGED)
  ├── @layer utilities  (existing fan-page utilities, UNCHANGED)
  └── @layer marketing-tokens  ← NEW BLOCK (Phase 5)
        └── [data-surface="marketing"] { --mkt-* tokens }

src/App.tsx
  ├── All static imports → React.lazy() + Suspense  ← MODIFIED (Phase 5)
  └── Route order: named routes ABOVE /:locale/:handle  ← VERIFIED (no change needed)

src/lib/i18n.ts
  ├── Messages type → add marketing: { ... } namespace  ← MODIFIED (Phase 5)
  └── const messages: Record<Locale, Messages> = { ... } satisfies Record<Locale, Messages>
        └── en/ja/zh-TW each get marketing scaffold strings  ← ADDED (Phase 5)

artifacts/web/public/
  ├── og-marketing.png   (1200×630, logo + tagline, no creator likeness)  ← NEW (Phase 5)
  ├── sitemap.xml        (3 locale URLs + hreflang)  ← NEW (Phase 5)
  └── robots.txt         (Allow marketing roots, Disallow fan pages)  ← REPLACED (Phase 5)
```

### Recommended Project Structure (Changes Only)

```
artifacts/web/
├── index.html              MODIFY: title, meta, og:*, hreflang, preload, remove GFonts
├── src/
│   ├── main.tsx            MODIFY: add 2 Fontsource imports
│   ├── index.css           MODIFY: append @layer marketing-tokens block
│   ├── App.tsx             MODIFY: React.lazy() for all page imports
│   └── lib/
│       └── i18n.ts         MODIFY: add marketing namespace to Messages type + 3 locales
└── public/
    ├── og-marketing.png    NEW: 1200×630 brand card
    ├── sitemap.xml         NEW: 3-URL sitemap with hreflang
    └── robots.txt          REPLACE: was "Allow: /" → targeted allow/disallow
```

### Pattern 1: Tailwind v4 `@layer` CSS Isolation

**What:** Scoping all `--mkt-*` tokens inside `[data-surface="marketing"]` within a named Tailwind v4 `@layer` block.

**When to use:** Whenever a new design system surface must coexist in a shared `index.css` without contaminating an existing surface's tokens.

**Why `@layer` matters:** Any CSS rule defined OUTSIDE a cascade layer has higher implicit specificity than ALL layered rules, including Tailwind utilities. Wrapping marketing tokens in `@layer marketing-tokens` ensures they cannot accidentally override fan-page utilities regardless of selector order. [CITED: tailwindcss.com/blog/tailwindcss-v4]

**Why attribute selector over a class:** Attribute selectors cannot appear in Tailwind class composition shortcuts, providing a clear semantic boundary. They also cannot be accidentally added via autocomplete in JSX. [CITED: 05-UI-SPEC.md]

**How to verify zero leakage:** After any marketing CSS commit, navigate to `/en/claire` (or any valid fan handle) and confirm the fan chat renders with dark background `#0f0f0f` and brand violet primary. Any style bleed means a `--mkt-*` token has escaped the `[data-surface="marketing"]` ancestor scope.

**Example (append after existing `@layer utilities` block in `index.css`):**

```css
/* Source: 05-UI-SPEC.md — locked token names, placeholder values */
@layer marketing-tokens {
  [data-surface="marketing"] {
    /* PLACEHOLDER VALUES — replace wholesale via UI-SPEC before Phase 6 */
    --mkt-bg:            #ffffff;
    --mkt-fg:            #111111;
    --mkt-surface-1:     #f5f5f5;
    --mkt-surface-2:     #ebebeb;
    --mkt-border:        #e0e0e0;
    --mkt-accent:        hsl(263 80% 58%);
    --mkt-accent-fg:     #ffffff;
    --mkt-accent-hover:  hsl(263 80% 50%);
    --mkt-muted-fg:      #666666;
    --mkt-radius-sm:     0.375rem;
    --mkt-radius-md:     0.625rem;
    --mkt-radius-lg:     1rem;
    --mkt-font-sans:     'Inter Variable', 'Noto Sans JP Variable', system-ui,
                         -apple-system, "Hiragino Sans", "Meiryo", sans-serif;
    --mkt-text-xs:       0.75rem;
    --mkt-text-sm:       0.875rem;
    --mkt-text-base:     1rem;
    --mkt-text-lg:       1.125rem;
    --mkt-text-xl:       1.25rem;
    --mkt-text-2xl:      1.5rem;
    --mkt-text-3xl:      1.875rem;
    --mkt-text-hero:     clamp(2.25rem, 5vw, 4rem);
    --mkt-text-section:  clamp(1.5rem, 3vw, 2.25rem);
    --mkt-leading-tight: 1.2;
    --mkt-leading-body:  1.6;
    --mkt-leading-cjk:   1.8;
    --mkt-spacing-xs:    0.25rem;
    --mkt-spacing-sm:    0.5rem;
    --mkt-spacing-md:    1rem;
    --mkt-spacing-lg:    1.5rem;
    --mkt-spacing-xl:    2rem;
    --mkt-spacing-2xl:   3rem;
    --mkt-spacing-3xl:   4rem;
  }
}
```

**Critical rule:** `@layer marketing-tokens` MUST be placed AFTER the existing `@layer utilities` block. Do NOT insert it inside or before the existing layer blocks.

**The `.dark` class interaction:** `body` applies `.dark` globally for the fan page. `@layer marketing-tokens` scoped under `[data-surface="marketing"]` overrides the dark tokens within that DOM subtree — this is correct and intended. Marketing tokens are light-surface by default and must not inherit dark-mode variables. [VERIFIED: codebase — index.css `.dark` block confirmed]

---

### Pattern 2: Typed `marketing` i18n Namespace

**What:** Adding a `marketing: { ... }` property to the `Messages` type in `lib/i18n.ts`, then populating all three locale objects with scaffold strings.

**Current state of i18n.ts:** 806 lines. `Messages` type defined lines 13–174. `const messages: Record<Locale, Messages> = {` at line 176. No `satisfies` keyword present anywhere in the file. The `Record<Locale, Messages>` annotation enforces completeness but the `satisfies` operator provides more precise error messages. [VERIFIED: codebase — direct inspection]

**The key insight:** The `Record<Locale, Messages>` type annotation already enforces completeness. Adding `satisfies` is a quality-of-life improvement (better error messages) but not strictly required. Either approach closes the missing-key gap.

**How compile-time completeness works:** TypeScript will refuse to compile if `en`, `ja`, or `zh-TW` in the `messages` object is missing any key declared in the `Messages` type. Adding `marketing` to `Messages` immediately causes a compile error until all three locales have the `marketing` block populated.

**The exact `marketing` type shape to add to `Messages`** (locked in 05-UI-SPEC.md):

```typescript
// Source: 05-UI-SPEC.md § i18n Namespace Contract (MKT-13)
marketing: {
  meta: {
    title: string;
    description: string;
  };
  nav: {
    cta_creator: string;
  };
  hero: {
    headline: string;
    subheadline: string;
    cta_primary: string;
    cta_no_telegram: string;
  };
  value_prop: {
    title: string;
    subtitle: string;
  };
  pillars: {
    title: string;
    chat_label: string;   chat_desc: string;
    voice_label: string;  voice_desc: string;
    image_label: string;  image_desc: string;  image_coming_soon: string;
    video_label: string;  video_desc: string;  video_coming_soon: string;
  };
  channels: {
    title: string;    subtitle: string;
    lala_label: string;   telegram_label: string;   social_label: string;
  };
  onboarding: {
    title: string;    subtitle: string;
    step1_label: string;  step1_desc: string;
    step2_label: string;  step2_desc: string;
    step3_label: string;  step3_desc: string;
  };
  cta: {
    headline: string;    subheadline: string;
    button: string;      no_telegram: string;
  };
  footer: {
    tagline: string;    privacy: string;
    contact: string;    ai_disclosure: string;
  };
  demo: {
    title: string;    label: string;
  };
};
```

**Phase 5 scaffold strings:** All three locales (`en`, `ja`, `zh-TW`) must be populated with English scaffolding strings in Phase 5. Final localized copy is a Phase 7 concern. Scaffold strings prevent compile errors and allow Phase 6 components to import the namespace safely.

**File size concern:** `lib/i18n.ts` is currently 806 lines. The `marketing` namespace adds approximately 40 string keys × 3 locales = ~120 lines. The file will reach ~930 lines. This is within the acceptable range (threshold for split is ~800 lines per ARCHITECTURE.md — the file is already at 806). The planner should note this: either accept ~930 lines as a one-time exception (marketing scaffold strings are short), or split `marketing` into `lib/i18n-marketing.ts` and import/merge.

---

### Pattern 3: CJK Font Loading (Fontsource + Preload)

**What:** Replace Google Fonts CDN `<link>` with Fontsource self-hosted woff2 files, imported in `main.tsx`, with a `<link rel="preload">` for the Noto Sans JP latin subset in `index.html`.

**Resolution of the preload path question (open technical question 1):**

The `@fontsource-variable/noto-sans-jp` package ships 124 woff2 files in its `files/` subdirectory:
- 120 numbered files for CJK character ranges: `noto-sans-jp-0-wght-normal.woff2` through `noto-sans-jp-119-wght-normal.woff2`
- 4 named language subset files: `noto-sans-jp-latin-wght-normal.woff2`, `noto-sans-jp-latin-ext-wght-normal.woff2`, `noto-sans-jp-cyrillic-wght-normal.woff2`, `noto-sans-jp-vietnamese-wght-normal.woff2`

[VERIFIED: unpkg.com/@fontsource-variable/noto-sans-jp@5.2.10/files/files — direct inspection]

The `@fontsource-variable/inter` package names its Latin file `inter-latin-wght-normal.woff2`. [VERIFIED: unpkg.com/@fontsource-variable/inter@5.2.8/files/files — direct inspection]

**The preload mechanism with Vite:** When Fontsource fonts are imported as CSS in `main.tsx`, Vite copies the woff2 files from `node_modules` into `dist/public/assets/` with content-hash filenames (e.g., `noto-sans-jp-latin-wght-normal-AbCd1234.woff2`). A hardcoded path in `index.html` pointing into `node_modules` will NOT work in production (Vite's dev server serves `node_modules` as-is, but production `dist/` does not). [CITED: fontsource.org/docs/getting-started/preload]

**The correct preload approach for Vite:** Use the `?url` import in a script to get the hashed production URL, then inject the preload link dynamically — OR accept that the preload hint will not be present in `index.html` and rely on `font-display: swap` + the browser's parser to handle it. The UI-SPEC's proposed static preload path (`/node_modules/...`) will work in development but break in production.

**Recommendation (Claude's Discretion):** Omit the static `<link rel="preload">` from `index.html` for Phase 5. `font-display: swap` built into the Fontsource CSS already prevents FOIT — the preload link is a nice-to-have performance enhancement, not a FOIT blocker. The production-safe preload approach requires either a Vite plugin (`vite-plugin-webfont-dl`) or a `vite.config.ts` `build.rollupOptions.output.assetFileNames` configuration to emit fonts with stable (unhashed) filenames. Adding either is scope creep for a plumbing-only phase. Document the gap for Phase 6.

If the planner wants to include the preload anyway: configure `vite.config.ts` to emit fonts with stable names:
```typescript
// In vite.config.ts build.rollupOptions.output:
assetFileNames: (assetInfo) => {
  if (assetInfo.name?.endsWith('.woff2')) {
    return 'assets/fonts/[name][extname]'; // stable, unhashed
  }
  return 'assets/[name]-[hash][extname]';
},
```
Then use `/assets/fonts/noto-sans-jp-latin-wght-normal.woff2` as the preload href.

**Import pattern (main.tsx):**
```typescript
// Source: fontsource.org/docs/getting-started/variable
import '@fontsource-variable/inter';
import '@fontsource-variable/noto-sans-jp';
```

The default import (without specifying `/wght.css`) imports the weight axis CSS, which includes `font-display: swap` in the `@font-face` declarations. No manual override needed.

**Remove from `index.html`:**
```html
<!-- DELETE ALL THREE — replace with Fontsource self-hosting -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

**Self-host vs Google Fonts CDN for Noto Sans JP (Claude's Discretion):**
- The full `@fontsource-variable/noto-sans-jp` package is 5.22 MB on disk, but the woff2 files load progressively via `unicode-range` in the bundled CSS — browsers only download the subsets needed for visible text. On first paint, only the small `latin-wght-normal.woff2` (~89 kB per unpkg) is needed. CJK range files load lazily as text renders.
- Replit does not run a CDN layer for `artifacts/web` static assets (confirmed in `REPLIT.md`). Google Fonts CDN has superior edge-caching for CJK fonts globally, particularly in JP/TW.
- **Recommendation:** Self-host both Inter and Noto Sans JP via Fontsource. The `unicode-range` subsetting in the Fontsource CSS means the browser only downloads the subsets it needs — the 5.22 MB total never downloads as a single request. `font-display: swap` prevents FOIT. Google Fonts CDN gives marginally better edge performance for CJK but adds a third-party request. Self-hosting is cleaner and more privacy-compliant. Accept Replit's static file serving for Noto.

---

### Pattern 4: Static `sitemap.xml` vs `vite-plugin-sitemap`

**Decision: Hand-written static `public/sitemap.xml`.**

Rationale:
- 3 static locale URLs that will not change during this milestone's lifetime
- The UI-SPEC already contains the exact XML with correct hreflang alternate links
- `vite-plugin-sitemap` has no source repo linked in its package.json (slopcheck noted this), generates `robots.txt` by default (which we want to control manually), and adds a build dependency for trivial benefit
- Static file in `public/` is copied as-is by Vite into `dist/public/` — zero configuration
- `vite-plugin-sitemap`'s i18n hreflang support requires its own route format, which does not match the existing wouter `/:locale` route shape without additional configuration

**The complete static `sitemap.xml` content** is provided verbatim in 05-UI-SPEC.md § Static SEO Assets Contract and is ready to commit. It includes `xmlns:xhtml` and `xhtml:link` hreflang entries for all three locales plus `x-default=en`. [CITED: 05-UI-SPEC.md]

---

### Pattern 5: Route Ordering and `React.lazy()` Code-Splitting

**Current App.tsx route order (verified by direct inspection):**

```typescript
/ → redirect to /en
/payment/success, /payment/cancel
/:locale          → HomePage (static import — MUST change to React.lazy)
/:locale/onboard  → redirect dispatcher
/:locale/onboard/step1|2|3
/:locale/account/data-request → DsarPortal
/:locale/dashboard → CreatorDashboard
/:locale/:handle  → FanPage (fan catch-all — MUST remain last)
* → NotFound
```

**Route ordering finding:** Phase 5 adds NO new named routes to `App.tsx`. The marketing page replaces `HomePage` at the existing `/:locale` route — no route additions, no ordering changes. The only App.tsx change in Phase 5 is converting static `import` to `React.lazy()` for all page components. [VERIFIED: codebase — App.tsx direct inspection]

**`React.lazy()` conversion pattern:**

```typescript
// Source: React 19 docs — code splitting
import React, { Suspense } from 'react';

const HomePage = React.lazy(() => import('./pages/home'));
const FanPage = React.lazy(() => import('./pages/fan-page'));
const DsarPortal = React.lazy(() => import('./pages/dsar-portal'));
const CreatorDashboard = React.lazy(() => import('./pages/creator-dashboard'));
const OnboardStep1 = React.lazy(() => import('./pages/onboard-step1'));
const OnboardStep2 = React.lazy(() => import('./pages/onboard-step2'));
const OnboardStep3 = React.lazy(() => import('./pages/onboard-step3'));
const PaymentSuccessPage = React.lazy(() => import('./pages/payment-success'));
const PaymentCancelPage = React.lazy(() => import('./pages/payment-cancel'));
const NotFound = React.lazy(() => import('./pages/not-found'));

// Wrap the Router function's Switch in a Suspense:
function Router() {
  return (
    <Suspense fallback={null}>
      <Switch>
        {/* routes unchanged */}
      </Switch>
    </Suspense>
  );
}
```

**Why `fallback={null}` is acceptable:** Phase 5 adds no visible marketing page content. A minimal no-flicker transition is correct for a plumbing phase. Phase 6 can add a skeleton/spinner if needed.

**Fan route isolation guarantee:** `/:locale/:handle` only matches when a second path segment exists. The `/:locale` marketing route cannot conflict. No route ordering change is needed for Phase 5. [VERIFIED: codebase — wouter route matching behavior]

---

### Pattern 6: `index.html` Static Meta (MKT-15, MKT-16)

**Exact replacements for `index.html`** (locked by D-05-01/02/03 and 05-UI-SPEC.md Copywriting Contract):

**Remove:**
- `<title>7of1</title>`
- `<meta name="description" content="7of1 — built on Replit...">` (and og equivalents)
- All three Google Fonts `<link>` tags

**Add to `<head>`:**
```html
<title>lala.la — AI Digital Twin for Creators</title>
<meta name="description"
  content="Your AI twin, fully managed — keep your fans engaged in your voice while you create. For 17 LIVE creators in JP, TW, and HK." />
<meta property="og:title" content="lala.la — AI Digital Twin for Creators" />
<meta property="og:description" content="Your AI twin, fully managed. Chat, voice, and more — we handle everything." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://lala.la" />
<meta property="og:image" content="https://lala.la/og-marketing.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="lala.la — AI Digital Twin for Creators" />
<meta name="twitter:description" content="Your AI twin, fully managed. Chat, voice, and more — we handle everything." />
<meta name="twitter:image" content="https://lala.la/og-marketing.png" />

<!-- hreflang: MUST be static in index.html — NOT JS-injected (Pitfall 9) -->
<link rel="alternate" hreflang="x-default" href="https://lala.la/en" />
<link rel="alternate" hreflang="en" href="https://lala.la/en" />
<link rel="alternate" hreflang="ja" href="https://lala.la/ja" />
<link rel="alternate" hreflang="zh-TW" href="https://lala.la/zh-TW" />
```

**Why hreflang must be static:** Social card scrapers and Google's hreflang discovery do not execute JavaScript. Any hreflang tag injected by React (via `react-helmet-async` or React 19 native hoisting) is invisible to search engines. [CITED: PITFALLS.md Pitfall 9 — multiple source verification]

**`og:image` URL:** References `https://lala.la/og-marketing.png` — requires the file to be committed to `public/og-marketing.png` in the same phase. [CITED: 05-UI-SPEC.md Copywriting Contract]

---

### Anti-Patterns to Avoid

- **CSS at `:root` or `body` scope for marketing tokens:** Any `--mkt-*` variable placed on `:root` or `body` will contaminate the fan page. All marketing variables must be inside `[data-surface="marketing"]` selector.
- **Marketing tokens inside `@theme inline`:** The existing `@theme inline` block in `index.css` maps fan-page CSS variables to Tailwind color utilities. Do NOT add `--mkt-*` tokens to `@theme inline` — they belong only in `@layer marketing-tokens`.
- **Static preload href pointing to node_modules:** Vite development server serves `node_modules` but production build does NOT include `node_modules` paths. A hardcoded `href="/node_modules/@fontsource-variable/..."` will 404 in production. Use `?url` import or a stable asset filename configuration.
- **Hand-editing `lib/api-zod/` or `lib/api-client-react/`:** These are generated files. Phase 5 does not touch the OpenAPI spec, so no regeneration is needed.
- **Adding `i18next` as an alternative namespace approach:** Explicitly prohibited by project constraints.
- **`satisfies` without populating all three locales first:** Adding `satisfies Record<Locale, Messages>` to the `messages` declaration will cause a compile error until all three locales have the `marketing` block. Populate all three locales before adding `satisfies`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Self-hosted variable fonts | Custom `@font-face` declarations with subset management | `@fontsource-variable/inter` + `@fontsource-variable/noto-sans-jp` | Fontsource already includes correct `@font-face` declarations with `font-display: swap`, `unicode-range` per subset, and proper weight axis mapping |
| CSS isolation between two design systems | Global CSS overrides or per-component `<style>` | `@layer marketing-tokens` + `[data-surface="marketing"]` attribute selector | Native CSS cascade layers enforce specificity correctly within Tailwind v4's layer architecture |
| Sitemap with hreflang | Custom script generating XML | Hand-written static `public/sitemap.xml` | 3 static URLs; the exact XML is already provided; no runtime generation needed |
| TypeScript i18n key completeness | Runtime key-existence checks | `satisfies Record<Locale, Messages>` type annotation | TypeScript catches missing keys at compile time; no runtime overhead |

---

## Common Pitfalls

### Pitfall 1: Static Preload Href Breaks in Production
**What goes wrong:** The UI-SPEC proposes `href="/node_modules/@fontsource-variable/noto-sans-jp/files/noto-sans-jp-latin-wght-normal.woff2"`. Vite's dev server exposes `node_modules` so this works locally. Production build outputs fonts to `dist/public/assets/` with hashed filenames — the `node_modules` path 404s.
**How to avoid:** Either (a) omit the static preload and rely on `font-display: swap` alone (recommended for Phase 5), or (b) configure `vite.config.ts` to emit fonts with stable names and use the stable path. Do not use the node_modules path in `index.html`.
**Warning signs:** Browser DevTools shows 404 for `/node_modules/...` in production. No preload link is needed if `font-display: swap` is in place.

### Pitfall 2: Fan Page CSS Contamination
**What goes wrong:** Any CSS rule scoped to `:root`, `body`, `*`, or `html` added in the marketing token block will affect the fan page. The fan page is dark-mode (`body.dark`); marketing tokens are light-surface. If `--mkt-bg: #ffffff` lands on `:root`, the fan page background goes white.
**How to avoid:** Every `--mkt-*` token must be inside `[data-surface="marketing"] { ... }`. No exceptions. Run the visual regression check after every CSS commit.
**Warning signs:** Fan chat page renders with incorrect background or font after a marketing CSS commit.

### Pitfall 3: `satisfies` Added Before All Three Locales Are Populated
**What goes wrong:** TypeScript compile error cascades through all type-checked files in the workspace.
**How to avoid:** Populate `en`, `ja`, and `zh-TW` `marketing` scaffold objects first, then change `Record<Locale, Messages>` to `Record<Locale, Messages> satisfies Record<Locale, Messages>` (or just add `satisfies` after the closing `}`).
**Warning signs:** `pnpm run typecheck` fails with errors in `lib/i18n.ts` pointing to missing keys in `ja` or `zh-TW`.

### Pitfall 4: hreflang Tags Added via JavaScript
**What goes wrong:** Using React 19's native `<link rel="alternate">` JSX hoisting or `react-helmet-async` for hreflang. Both inject tags after JavaScript runs — search engine crawlers and social scrapers do not execute JS.
**How to avoid:** All three hreflang `<link>` tags must be in the raw `index.html` before the `<script>` tag. Verify: `curl https://lala.la/en | grep hreflang` must return results.
**Warning signs:** `curl https://lala.la/en | grep hreflang` returns nothing.

### Pitfall 5: `og:image` URL Points to a Missing File
**What goes wrong:** `index.html` references `https://lala.la/og-marketing.png` but the file is not committed to `public/`. Social card scrapers return a broken image.
**How to avoid:** Commit `public/og-marketing.png` (1200×630, PNG, under 300 KB) in the same PR as the `index.html` meta update. Test with `curl -I https://lala.la/og-marketing.png` returning 200.
**Warning signs:** Twitter Card Validator shows "ERROR: Failed to fetch card image".

### Pitfall 6: `React.lazy()` Wrapping Breaks Existing Tests or Type Checks
**What goes wrong:** If any test file imports a page component directly using a path that assumes synchronous loading, `React.lazy()` wrapping can cause runtime behavior changes in test environments.
**How to avoid:** Check existing test files before converting. The project uses Vitest; `React.lazy()` with `Suspense` is supported in Vitest with `act()`. The `artifacts/web` test suite is minimal (no page-level tests confirmed in `package.json`).
**Warning signs:** `pnpm --filter @workspace/web run test` fails after `React.lazy()` conversion.

---

## Code Examples

### CSS Isolation: `@layer marketing-tokens` Placement

```css
/* artifacts/web/src/index.css — append AFTER @layer utilities block */
/* Source: 05-UI-SPEC.md CSS Isolation Contract */

@layer marketing-tokens {
  [data-surface="marketing"] {
    --mkt-bg:            #ffffff;
    --mkt-fg:            #111111;
    /* ... (full token list in UI-SPEC) ... */
  }
}
/* END of file — no additional CSS after this */
```

### i18n.ts: Adding `marketing` Namespace

```typescript
// artifacts/web/src/lib/i18n.ts — MODIFY Messages type (append marketing key)
type Messages = {
  version_history: { /* existing, unchanged */ };
  fan: { /* existing, unchanged */ };
  dsar: { /* existing, unchanged */ };
  onboard: { /* existing, unchanged */ };
  marketing: {                                    // NEW
    meta: { title: string; description: string; };
    nav: { cta_creator: string; };
    hero: {
      headline: string; subheadline: string;
      cta_primary: string; cta_no_telegram: string;
    };
    // ... (full shape in 05-UI-SPEC.md § i18n Namespace Contract)
  };
};

// THEN — line ~176, change:
const messages: Record<Locale, Messages> = {
// TO (add satisfies after populating all three locales):
const messages = {
  en: { /* existing + marketing: { ... scaffold ... } */ },
  ja: { /* existing + marketing: { ... scaffold ... } */ },
  'zh-TW': { /* existing + marketing: { ... scaffold ... } */ },
} satisfies Record<Locale, Messages>;
```

### Fontsource Import in `main.tsx`

```typescript
// artifacts/web/src/main.tsx
import "./instrument"; // must be first — Sentry
import '@fontsource-variable/inter';          // NEW — replaces Google Fonts CDN
import '@fontsource-variable/noto-sans-jp';  // NEW — CJK coverage
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
```

### `React.lazy()` in `App.tsx`

```typescript
// artifacts/web/src/App.tsx
import React, { Suspense } from 'react';
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DEFAULT_LOCALE, isValidLocale } from "@/lib/i18n";
import CookieConsentBanner from "@/components/CookieConsentBanner";

// All static imports converted to lazy
const HomePage = React.lazy(() => import('@/pages/home'));
const FanPage = React.lazy(() => import('@/pages/fan-page'));
const DsarPortal = React.lazy(() => import('@/pages/dsar-portal'));
const CreatorDashboard = React.lazy(() => import('@/pages/creator-dashboard'));
const OnboardStep1 = React.lazy(() => import('@/pages/onboard-step1'));
const OnboardStep2 = React.lazy(() => import('@/pages/onboard-step2'));
const OnboardStep3 = React.lazy(() => import('@/pages/onboard-step3'));
const PaymentSuccessPage = React.lazy(() => import('@/pages/payment-success'));
const PaymentCancelPage = React.lazy(() => import('@/pages/payment-cancel'));
const NotFound = React.lazy(() => import('@/pages/not-found'));

// ... getPageLocale() unchanged ...

function Router() {
  return (
    <Suspense fallback={null}>
      <Switch>
        {/* route definitions unchanged */}
      </Switch>
    </Suspense>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Fonts CDN `<link>` | Fontsource self-hosted npm package | Variable fonts era (~2022) | Eliminates third-party DNS latency; `font-display: swap` built-in |
| `@font-face` with FOIT default (`font-display: block`) | `font-display: swap` | Browser evolution (~2018) | System fallback shown immediately; text never invisible |
| Static imports for all SPA pages | `React.lazy()` + `Suspense` code-splitting | React 16.6 (2018), standard since React 18 | Fan page chunk no longer includes marketing code |
| `react-helmet` (v2) | `react-helmet-async` v3 (React 19 compatible) | March 2026 | react-helmet v2 breaks on React 19; v3 delegates to React's own hoisting |

**Deprecated / outdated:**
- Google Fonts CDN `<link>` for self-hosted use cases: functional but adds third-party dependency and DNS lookup on critical path
- `@font-face` CSS hand-written for Fontsource fonts: redundant — Fontsource's npm package ships the correct `@font-face` declarations

---

## Open Questions (RESOLVED)

1. **`og-marketing.png` artwork creation** — RESOLVED: covered by the ImageMagick placeholder task in Plan 05-02 (1200×630 brand card committed in `public/`); final artwork deferred to Phase 7.
   - What we know: file must be 1200×630 PNG, under 300 KB, `lala.la` wordmark + brand tagline, no creator likeness
   - What's unclear: who creates the artwork? The phase plan must include a task for creating this asset. If the founder creates it manually, a placeholder (e.g., a solid-color PNG with text) can be committed as an interim.
   - Recommendation: include a task "create placeholder og-marketing.png" in Wave 0 (or have the implementer generate a simple placeholder via ImageMagick or canvas) — the phase gate requires this file to be committed.

2. **`satisfies` vs plain `Record<Locale, Messages>` annotation** — RESOLVED: Plan 05-01 Task 2 adds the `satisfies Record<Locale, Messages>` annotation after populating all three locales.
   - What we know: the existing code uses `const messages: Record<Locale, Messages> = {` (line 176), which enforces completeness. Adding `satisfies` improves error messages but is not strictly required.
   - Recommendation: add `satisfies` when appending the marketing namespace for better DX. It is a non-breaking change.

3. **Stable font filenames for preload hint** — RESOLVED: Plan 05-03 Task 2 implements the stable-filename approach in `vite.config.ts` (`assetFileNames` emits woff2 at `/assets/fonts/[name][extname]`), satisfying the non-negotiable CONTEXT D-05 preload; the recommendation to defer is OVERRIDDEN by that locked decision.
   - What we know: Vite hashes asset filenames by default; static preload href to `node_modules` fails in production
   - What's unclear: whether the planner wants the preload hint or just `font-display: swap`
   - Recommendation: use `font-display: swap` only for Phase 5 (prevents FOIT without configuration complexity); add `vite.config.ts` stable font filename config in Phase 6 if Lighthouse shows font loading as a bottleneck

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | pnpm install | ✓ | v22.22.0 | — |
| pnpm | package install | ✓ | 10.9.4 (npm equiv) | — |
| TypeScript | `pnpm run typecheck` | ✓ | 5.9.3 | — |
| Vite | build | ✓ | ^7.3.2 (catalog) | — |
| ImageMagick or equivalent | og-marketing.png creation | Unknown | — | Manual PNG creation or canvas script |

**Missing dependencies with no fallback:** None for code changes.
**Note on og-marketing.png:** Creating the 1200×630 PNG requires either a design tool (Figma, etc.) or a script. This is an ops dependency, not a code dependency. If no tool is available, a programmatic placeholder using Node.js `canvas` or a solid-color PNG committed manually is acceptable for Phase 5.

---

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json` — this section is SKIPPED per config.

---

## Security Domain

> Phase 5 is CSS/config/static assets only. No new endpoints, no authentication, no data handling, no crypto. ASVS categories V2–V6 do not apply. No security controls are required or affected by this phase.

The one security-adjacent note: the `og-marketing.png` must be a dedicated brand asset (not a signed URL from Object Storage, not a creator photo from the private bucket). It must be a static public file at a stable public URL. [CITED: PITFALLS.md § Security Mistakes]

---

## Assumptions Log

> Claims tagged `[ASSUMED]` in this research.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Replit does not serve `artifacts/web` static files through a CDN layer | Fontsource self-host recommendation | If Replit adds CDN, Google Fonts has no advantage; self-hosting is still correct either way |
| A2 | The `artifacts/web` Vitest test suite has no page-level tests that would break on `React.lazy()` conversion | Pattern 5 — React.lazy() | Minimal risk: package.json has no test command visible; the test suite is api-server focused |
| A3 | `noto-sans-jp-latin-wght-normal.woff2` at ~89 kB loads fast enough on slow 3G that preload is unnecessary | Font loading section | If JP market shows high FOIT rate, the stable-filename approach in vite.config.ts should be implemented in Phase 6 |

**If this table is empty:** not applicable — three low-risk assumptions documented above.

---

## Sources

### Primary (HIGH confidence)
- `artifacts/web/index.html` — confirmed placeholder "7of1" meta, three Google Fonts CDN links — direct inspection
- `artifacts/web/src/App.tsx` — confirmed route order, static imports, no React.lazy — direct inspection
- `artifacts/web/src/lib/i18n.ts` (806 lines) — confirmed `Record<Locale, Messages>` at line 176, no `satisfies` — direct inspection
- `artifacts/web/src/index.css` — confirmed `@layer base` / `@layer utilities` structure, `.dark` block, `--app-font-sans` — direct inspection
- `artifacts/web/src/main.tsx` — confirmed import order, no Fontsource imports — direct inspection
- `artifacts/web/vite.config.ts` — confirmed plugin stack, `PORT`/`BASE_PATH` env requirement — direct inspection
- `artifacts/web/package.json` — confirmed no i18next, no Fontsource; `tw-animate-css`, Radix UI, framer-motion present — direct inspection
- `artifacts/web/public/robots.txt` — confirmed trivial `Allow: /` content — direct inspection
- `.planning/phases/05-foundation-isolation/05-CONTEXT.md` — locked decisions D-05-01 through D-05-06
- `.planning/phases/05-foundation-isolation/05-UI-SPEC.md` — CSS isolation contract, token names, type shape, sitemap XML, robots.txt, copywriting contract
- `.planning/config.json` — `nyquist_validation: false` confirmed
- npm registry: `@fontsource-variable/inter` v5.2.8, `@fontsource-variable/noto-sans-jp` v5.2.10, `vite-plugin-sitemap` v0.8.2 — verified via `npm view`
- slopcheck v0.6.1 — all three packages returned `[OK]`

### Secondary (MEDIUM confidence)
- [unpkg.com/@fontsource-variable/inter@5.2.8/files/files](https://app.unpkg.com/@fontsource-variable/inter@5.2.8/files/files) — exact woff2 filenames confirmed (`inter-latin-wght-normal.woff2`)
- [unpkg.com/@fontsource-variable/noto-sans-jp@5.2.10/files/files](https://app.unpkg.com/@fontsource-variable/noto-sans-jp@5.2.10/files/files) — 124 woff2 files confirmed (120 numbered CJK + 4 named language subsets including `noto-sans-jp-latin-wght-normal.woff2`)
- [fontsource.org/docs/getting-started/preload](https://fontsource.org/docs/getting-started/preload) — `?url` import pattern for Vite confirmed; Vite hashes font filenames in production
- [github.com/jbaubree/vite-plugin-sitemap](https://github.com/jbaubree/vite-plugin-sitemap) — i18n hreflang support confirmed; author: jbaubree; MIT license
- `.planning/research/PITFALLS.md` — Pitfalls 1–4/9/11 confirmed as failure modes for this phase

### Tertiary (LOW confidence)
- None — all key claims verified from primary or secondary sources

---

## Metadata

**Confidence breakdown:**
- Standard stack (packages): HIGH — npm registry verified, slopcheck clean, unpkg file inspection done
- Architecture patterns: HIGH — all patterns derived from direct codebase inspection
- CJK font delivery: HIGH — unpkg file listing confirmed actual woff2 naming; Fontsource docs confirmed `?url` pattern
- Pitfalls: HIGH — verified against codebase current state (no Fontsource present, no lazy loading, no marketing layer)

**Research date:** 2026-05-31
**Valid until:** 2026-06-30 (packages: Fontsource v5.x is stable; Vite v7 is stable)
