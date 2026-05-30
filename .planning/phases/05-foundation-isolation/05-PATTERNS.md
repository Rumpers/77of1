---
phase: 5
slug: foundation-isolation
mapped: 2026-05-31
---

# Phase 5: Foundation & Isolation — Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 8 (5 modified, 3 new static assets)
**Analogs found:** 6 / 8 (2 static assets have no meaningful code analog — see No Analog Found)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `artifacts/web/index.html` | config / static head | request-response (crawler-consumed) | existing `index.html` itself | self-analog (replace in-place) |
| `artifacts/web/src/main.tsx` | entry-point / bootstrap | transform (import pipeline) | existing `main.tsx` itself | self-analog (prepend imports) |
| `artifacts/web/src/index.css` | config / token layer | transform (CSS cascade) | existing `@layer utilities` block in `index.css` | exact layer-block analog |
| `artifacts/web/src/App.tsx` | router / provider | request-response (client routing) | existing `App.tsx` static imports | self-analog (swap import style) |
| `artifacts/web/src/lib/i18n.ts` | utility / config | transform (compile-time types) | existing `Messages` type + `messages` object in `i18n.ts` | exact namespace-append analog |
| `artifacts/web/vite.config.ts` | config / build | transform (build pipeline) | existing `vite.config.ts` `build.rollupOptions` | self-analog (optional addition) |
| `artifacts/web/public/sitemap.xml` | static asset | N/A | existing `public/robots.txt` (static text file in `public/`) | partial (same delivery mechanism) |
| `artifacts/web/public/robots.txt` | static asset | N/A | existing `public/robots.txt` itself | self-analog (replace in-place) |
| `artifacts/web/public/og-marketing.png` | static asset / image | N/A | existing `public/opengraph.jpg` | partial (same delivery mechanism, different dimensions) |

---

## Pattern Assignments

### `artifacts/web/index.html` (config, static head)

**Analog:** `artifacts/web/index.html` (self — replace placeholder blocks in-place)

**Current state** (lines 1–24, entire file):
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <title>7of1</title>
    <meta name="description" content="7of1 — built on Replit. Update this description to reflect the app." />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="7of1" />
    <meta property="og:description" content="7of1 — built on Replit. Update this description to reflect the app." />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="7of1" />
    <meta name="twitter:description" content="7of1 — built on Replit. Update this description to reflect the app." />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**What to replace / remove:**
- `<title>7of1</title>` — replace
- All three `<meta name="description">` / `og:*` / `twitter:*` with "7of1" content — replace
- `<link rel="preconnect" href="https://fonts.googleapis.com">` — delete
- `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` — delete
- `<link href="https://fonts.googleapis.com/css2?...">` — delete
- Missing: `og:url`, `og:image`, `twitter:image`, hreflang `<link>` tags — add

**Target head block (full replacement):**
```html
<title>lala.la — AI Digital Twin for Creators</title>
<meta name="description"
  content="Your AI twin, fully managed — keep your fans engaged in your voice while you create. For 17 LIVE creators in JP, TW, and HK." />
<meta name="robots" content="index, follow" />
<meta property="og:title" content="lala.la — AI Digital Twin for Creators" />
<meta property="og:description" content="Your AI twin, fully managed. Chat, voice, and more — we handle everything." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://lala.la" />
<meta property="og:image" content="https://lala.la/og-marketing.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="lala.la — AI Digital Twin for Creators" />
<meta name="twitter:description" content="Your AI twin, fully managed. Chat, voice, and more — we handle everything." />
<meta name="twitter:image" content="https://lala.la/og-marketing.png" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<!-- hreflang: MUST be static in index.html — NOT JS-injected -->
<link rel="alternate" hreflang="x-default" href="https://lala.la/en" />
<link rel="alternate" hreflang="en" href="https://lala.la/en" />
<link rel="alternate" hreflang="ja" href="https://lala.la/ja" />
<link rel="alternate" hreflang="zh-TW" href="https://lala.la/zh-TW" />
<!-- NON-NEGOTIABLE font preload (CONTEXT.md D-05): 400-weight Noto Sans JP latin woff2 at the STABLE vite-emitted path -->
<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/fonts/noto-sans-jp-latin-wght-normal.woff2">
<!-- Fontsource fonts loaded via main.tsx — no CDN link needed here -->
```

**Critical constraint:** The `<link rel="preload">` for the 400-weight Noto Sans JP woff2 is NON-NEGOTIABLE per CONTEXT.md D-05 — it MUST be present. The preload MUST point to the STABLE vite-emitted path `/assets/fonts/noto-sans-jp-latin-wght-normal.woff2` (configured in `vite.config.ts` `build.rollupOptions.output.assetFileNames`), NOT a `/node_modules/...` hashed path. Vite dev serves node_modules but the production dist does not, so the stable assetFileNames mapping (see the `vite.config.ts` section below) is the prerequisite that makes this preload resolve in production. `font-display: swap` (built into Fontsource) handles FOIT prevention alongside the preload.

---

### `artifacts/web/src/main.tsx` (entry-point, bootstrap)

**Analog:** `artifacts/web/src/main.tsx` (self — prepend two imports after `./instrument`)

**Current state** (lines 1–6, entire file):
```typescript
import "./instrument"; // must be first — Sentry captures load-time errors
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
```

**Target state** (add two Fontsource imports after line 1, before React imports):
```typescript
import "./instrument"; // must be first — Sentry captures load-time errors
import '@fontsource-variable/inter';         // self-hosted — replaces Google Fonts CDN
import '@fontsource-variable/noto-sans-jp';  // CJK coverage — unicode-range subsetting loads lazily
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
```

**Import ordering rule:** Fontsource imports must be AFTER `./instrument` (Sentry must initialize before anything else) and BEFORE `./index.css` (font face declarations should resolve before Tailwind base styles are applied). Do not move `./instrument` below any other import.

---

### `artifacts/web/src/index.css` (config, CSS token layer)

**Analog:** existing `@layer utilities` block in `artifacts/web/src/index.css` (lines 304–394)

**Existing layer structure to preserve** (the three blocks in the file):
```css
/* Block 1 — lines 7–67 */
@theme inline { ... }   /* Tailwind v4 token mappings — DO NOT TOUCH */

/* Block 2 — lines 189–272 */
.dark { ... }           /* Fan-page dark-mode token values — DO NOT TOUCH */

/* Block 3 — lines 274–282 */
@layer base { ... }     /* Fan-page base styles — DO NOT TOUCH */

/* Block 4 — lines 304–394 */
@layer utilities { ... }  /* Fan-page utilities — DO NOT TOUCH; append AFTER this */
```

**What to append** (after the closing `}` of `@layer utilities`, at end of file):
```css
/* ============================================================
 * MARKETING SURFACE TOKENS
 * Scope: [data-surface="marketing"] attribute selector only.
 * NEVER reference --mkt-* outside this ancestor scope.
 * NEVER add --mkt-* to @theme inline or :root.
 * PLACEHOLDER VALUES — replace wholesale via UI-SPEC before Phase 6.
 * ============================================================ */
@layer marketing-tokens {
  [data-surface="marketing"] {
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

**Why this works with `.dark`:** The existing `@layer base` applies `bg-background text-foreground` to `body` and the `.dark` class overrides the fan-page tokens. The `@layer marketing-tokens` block scoped to `[data-surface="marketing"]` will override the dark tokens *within that subtree*, which is the correct behavior — marketing surface is light-mode only.

**Critical: do NOT add any `--mkt-*` variable to the existing `@theme inline` block** (lines 7–67). The `@theme inline` block is Tailwind's utility-class bridge for fan-page tokens exclusively.

---

### `artifacts/web/src/App.tsx` (router, client routing)

**Analog:** `artifacts/web/src/App.tsx` itself (self — convert static imports to `React.lazy`)

**Current static import block** (lines 1–14):
```typescript
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import FanPage from "@/pages/fan-page";
import PaymentSuccessPage from "@/pages/payment-success";
import PaymentCancelPage from "@/pages/payment-cancel";
import OnboardStep1 from "@/pages/onboard-step1";
import OnboardStep2 from "@/pages/onboard-step2";
import OnboardStep3 from "@/pages/onboard-step3";
import DsarPortal from "@/pages/dsar-portal";
import CreatorDashboard from "@/pages/creator-dashboard";
import { DEFAULT_LOCALE, isValidLocale } from "@/lib/i18n";
import CookieConsentBanner from "@/components/CookieConsentBanner";
```

**Target import block** (replace page imports with `React.lazy`; add `React` and `Suspense`):
```typescript
import React, { Suspense } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DEFAULT_LOCALE, isValidLocale } from "@/lib/i18n";
import CookieConsentBanner from "@/components/CookieConsentBanner";

const NotFound         = React.lazy(() => import("@/pages/not-found"));
const HomePage         = React.lazy(() => import("@/pages/home"));
const FanPage          = React.lazy(() => import("@/pages/fan-page"));
const PaymentSuccessPage = React.lazy(() => import("@/pages/payment-success"));
const PaymentCancelPage  = React.lazy(() => import("@/pages/payment-cancel"));
const OnboardStep1     = React.lazy(() => import("@/pages/onboard-step1"));
const OnboardStep2     = React.lazy(() => import("@/pages/onboard-step2"));
const OnboardStep3     = React.lazy(() => import("@/pages/onboard-step3"));
const DsarPortal       = React.lazy(() => import("@/pages/dsar-portal"));
const CreatorDashboard = React.lazy(() => import("@/pages/creator-dashboard"));
```

**Current route order** (lines 26–69) — verified safe, no changes required:
```typescript
function Router() {
  return (
    <Switch>
      <Route path="/">...</Route>                          // root → redirect /en
      <Route path="/payment/success" .../>                 // named — safe above catch-all
      <Route path="/payment/cancel" .../>                  // named — safe above catch-all
      <Route path="/:locale">...</Route>                   // home page — SINGLE segment
      <Route path="/:locale/onboard">...</Route>           // named — ABOVE catch-all
      <Route path="/:locale/onboard/step1" .../>           // named — ABOVE catch-all
      <Route path="/:locale/onboard/step2" .../>
      <Route path="/:locale/onboard/step3" .../>
      <Route path="/:locale/account/data-request" .../>   // named — ABOVE catch-all
      <Route path="/:locale/dashboard" .../>               // named — ABOVE catch-all
      <Route path="/:locale/:handle" component={FanPage}/> // fan catch-all — LAST named route
      <Route component={NotFound} />                       // wildcard — absolute last
    </Switch>
  );
}
```

**Wrap Router's Switch with Suspense** — `fallback={null}` is correct for Phase 5 (no marketing page content yet):
```typescript
function Router() {
  return (
    <Suspense fallback={null}>
      <Switch>
        {/* route definitions unchanged — preserve exact order above */}
      </Switch>
    </Suspense>
  );
}
```

**Route ordering invariant to preserve:** `/:locale/:handle` (two-segment) must remain the last named `<Route>` before the wildcard. Phase 6 marketing sub-routes (e.g., `/:locale/pricing`) must be inserted ABOVE `/:locale/:handle` when added.

---

### `artifacts/web/src/lib/i18n.ts` (utility, compile-time types)

**Analog:** existing `Messages` type + `messages` const object in `artifacts/web/src/lib/i18n.ts`

**Existing type structure** (lines 13–174):
```typescript
type Messages = {
  version_history: { /* 24 string keys */ };
  fan: { /* 40+ string keys including nested report_categories */ };
  dsar: { /* 16 string keys */ };
  onboard: { /* nested step1/step2/step3 with items */ };
};
```

**Existing messages declaration** (line 176):
```typescript
const messages: Record<Locale, Messages> = {
  en: { ... },
  ja: { ... },
  'zh-TW': { ... },
};
```

**Export pattern** (lines 799–806, end of file):
```typescript
export function getMessages(locale: string): Messages {
  const loc = LOCALES.includes(locale as Locale) ? (locale as Locale) : DEFAULT_LOCALE;
  return messages[loc];
}

export function isValidLocale(locale: string): locale is Locale {
  return LOCALES.includes(locale as Locale);
}
```

**What to modify — step 1:** Append `marketing` to `Messages` type after the `onboard` block (before line 174's closing `}`):
```typescript
// Append inside the Messages type, after onboard: { ... };
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

**What to modify — step 2:** Add a `marketing` scaffold object to EACH of the three locale entries (`en`, `ja`, `zh-TW`) in the `messages` const. Use English scaffolding for all three locales in Phase 5 — final localized copy is a Phase 7 concern.

Scaffold example (copy verbatim into all three locales; Phase 7 replaces ja/zh-TW values):
```typescript
marketing: {
  meta: {
    title: "lala.la — AI Digital Twin for Creators",
    description: "Your AI twin, fully managed — keep your fans engaged in your voice while you create.",
  },
  nav: {
    cta_creator: "Get started",
  },
  hero: {
    headline: "Your AI twin, fully managed.",
    subheadline: "We keep your fans engaged in your voice while you create.",
    cta_primary: "Start with Telegram",
    cta_no_telegram: "No Telegram? Contact us",
  },
  value_prop: {
    title: "We handle everything",
    subtitle: "From setup to daily fan engagement — you focus on creating.",
  },
  pillars: {
    title: "What your twin can do",
    chat_label: "Chat",        chat_desc: "Text chat with your fans in your voice.",
    voice_label: "Voice",      voice_desc: "Voice messages that sound like you.",
    image_label: "Image",      image_desc: "AI-generated photos.", image_coming_soon: "Coming soon",
    video_label: "Video",      video_desc: "AI-generated videos.", video_coming_soon: "Coming soon",
  },
  channels: {
    title: "Where your twin lives",
    subtitle: "Meet your fans where they are.",
    lala_label: "lala.la",
    telegram_label: "Telegram",
    social_label: "Social",
  },
  onboarding: {
    title: "Get started in 3 steps",
    subtitle: "From zero to live twin in one session.",
    step1_label: "Tell us about yourself",  step1_desc: "Share your persona via Telegram.",
    step2_label: "We train your twin",      step2_desc: "We handle the technical setup.",
    step3_label: "Go live",                 step3_desc: "Your twin starts responding to fans.",
  },
  cta: {
    headline: "Ready to meet your fans?",
    subheadline: "Your first twin session is free.",
    button: "Start with Telegram",
    no_telegram: "No Telegram? Contact us",
  },
  footer: {
    tagline: "lala.la — AI Digital Twin for Creators",
    privacy: "Privacy Policy",
    contact: "Contact",
    ai_disclosure: "AI-generated content · Not a real person",
  },
  demo: {
    title: "See a demo",
    label: "Try a live demo",
  },
},
```

**What to modify — step 3:** After populating all three locales, change the declaration at line 176 to use `satisfies` for better TypeScript error messages:
```typescript
// Before:
const messages: Record<Locale, Messages> = {

// After:
const messages = {
  // ... all three locale objects with marketing scaffold ...
} satisfies Record<Locale, Messages>;
```

**Order of operations:** Populate all three locale `marketing` blocks FIRST, then add `satisfies`. Reversing this order causes a cascading TypeScript compile error across the workspace.

**File size note:** File is currently 806 lines. Adding ~120 lines for the `marketing` scaffold brings it to ~930 lines. This is a one-time acceptable exception given the scaffold strings are short and the split to `lib/i18n-marketing.ts` adds import complexity for marginal benefit.

---

### `artifacts/web/vite.config.ts` (config, build pipeline)

**Analog:** existing `artifacts/web/vite.config.ts` (self — optional `build.rollupOptions` addition)

**Current `build` block** (lines 57–60):
```typescript
build: {
  outDir: path.resolve(import.meta.dirname, "dist/public"),
  emptyOutDir: true,
},
```

**Required addition** (REQUIRED for Phase 5 — the locked-decision preload in index.html depends on this stable woff2 filename mapping; see CONTEXT.md D-05):
```typescript
build: {
  outDir: path.resolve(import.meta.dirname, "dist/public"),
  emptyOutDir: true,
  rollupOptions: {
    output: {
      assetFileNames: (assetInfo) => {
        if (assetInfo.name?.endsWith('.woff2')) {
          return 'assets/fonts/[name][extname]'; // stable, unhashed — enables preload href
        }
        return 'assets/[name]-[hash][extname]';  // default for all other assets
      },
    },
  },
},
```

With this in place, the NON-NEGOTIABLE preload link in `index.html` references the stable path:
```html
<link rel="preload" as="font" type="font/woff2"
  href="/assets/fonts/noto-sans-jp-latin-wght-normal.woff2"
  crossorigin="anonymous" />
```

**Resolution note:** RESEARCH § Pattern 3 originally floated omitting the preload and relying on `font-display: swap` alone. That option is OVERRIDDEN by CONTEXT.md D-05, which makes the preload non-negotiable. The stable-filename approach above is therefore in scope for Phase 5 (not deferred to Phase 6) precisely because it is the only production-safe way to satisfy the locked preload decision.

---

### `artifacts/web/public/robots.txt` (static asset)

**Analog:** existing `artifacts/web/public/robots.txt` (self — replace in-place)

**Current content** (lines 1–2):
```
User-agent: *
Allow: /
```

**Target content** (replace entire file):
```
User-agent: *
Allow: /en
Allow: /ja
Allow: /zh-TW
Disallow: /en/
Disallow: /ja/
Disallow: /zh-TW/
Disallow: /payment/
Sitemap: https://lala.la/sitemap.xml
```

**Explanation of trailing-slash rule:** `Allow: /en` permits the marketing root; `Disallow: /en/` (trailing slash) blocks all two-segment paths like `/en/claire` (fan chat pages). Crawlers must not index individual fan pages.

---

### `artifacts/web/public/sitemap.xml` (static asset, new file)

**Analog:** `artifacts/web/public/robots.txt` (same delivery mechanism — static file in `public/` copied as-is by Vite into `dist/public/`)

**Full content** (new file, write verbatim):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://lala.la/en</loc>
    <xhtml:link rel="alternate" hreflang="en"      href="https://lala.la/en"/>
    <xhtml:link rel="alternate" hreflang="ja"      href="https://lala.la/ja"/>
    <xhtml:link rel="alternate" hreflang="zh-TW"   href="https://lala.la/zh-TW"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://lala.la/en"/>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://lala.la/ja</loc>
    <xhtml:link rel="alternate" hreflang="en"      href="https://lala.la/en"/>
    <xhtml:link rel="alternate" hreflang="ja"      href="https://lala.la/ja"/>
    <xhtml:link rel="alternate" hreflang="zh-TW"   href="https://lala.la/zh-TW"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://lala.la/en"/>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://lala.la/zh-TW</loc>
    <xhtml:link rel="alternate" hreflang="en"      href="https://lala.la/en"/>
    <xhtml:link rel="alternate" hreflang="ja"      href="https://lala.la/ja"/>
    <xhtml:link rel="alternate" hreflang="zh-TW"   href="https://lala.la/zh-TW"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://lala.la/en"/>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
```

---

## Shared Patterns

### Font Import Order (main.tsx convention)
**Source:** `artifacts/web/src/main.tsx` line 1
**Apply to:** Font imports must follow the Sentry-first rule.
```typescript
import "./instrument"; // ALWAYS first — Sentry must capture load-time errors
// Fontsource imports go here — AFTER instrument, BEFORE React and CSS
import '@fontsource-variable/inter';
import '@fontsource-variable/noto-sans-jp';
import { createRoot } from "react-dom/client";
// ...
import "./index.css"; // CSS after JS imports
```

### `@layer` Block Placement (index.css convention)
**Source:** `artifacts/web/src/index.css` lines 274 and 304
**Apply to:** Any new CSS surface added to index.css.
- `@theme inline` block is always first (Tailwind utility bridge — do not touch)
- `:root` and `.dark` blocks follow (fan-page token values)
- `@layer base` after that
- `@layer utilities` after that
- New named layers (`@layer marketing-tokens`) always AFTER `@layer utilities`

### i18n Namespace Append Pattern
**Source:** `artifacts/web/src/lib/i18n.ts` lines 13–174 (`Messages` type) + 176 (`messages` declaration)
**Apply to:** Any new i18n namespace added to the file.
Rule: type shape added to `Messages` → all three locale entries in `messages` populated → `satisfies` annotation kept/added. Never add a key to `Messages` without simultaneously populating all three locales, or `pnpm run typecheck` fails across the workspace.

### Route Ordering Safety Invariant
**Source:** `artifacts/web/src/App.tsx` lines 26–69
**Apply to:** Every new route added in Phase 6+.
Rule: any named sub-route (`/:locale/[name]`) must be placed ABOVE `<Route path="/:locale/:handle">` in the `Switch`. The fan catch-all `/:locale/:handle` must always be the last named route before the wildcard `<Route component={NotFound} />`.

### Static Asset Delivery (public/ convention)
**Source:** `artifacts/web/public/robots.txt`, `artifacts/web/public/favicon.svg`, `artifacts/web/public/opengraph.jpg`
**Apply to:** `sitemap.xml`, `og-marketing.png`, `robots.txt`
Files placed in `artifacts/web/public/` are copied as-is by Vite into `dist/public/` at the root path. No import or configuration needed. Filename in `public/` becomes the URL path (e.g., `public/sitemap.xml` → `https://lala.la/sitemap.xml`).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `artifacts/web/public/og-marketing.png` | static asset / image | N/A | Existing `public/opengraph.jpg` covers the delivery mechanism; the image *content* (1200×630 brand card) has no codebase analog — it requires image creation tooling (Figma, ImageMagick, canvas script) or a manual placeholder PNG |

The `og-marketing.png` must be committed in the same PR as the `index.html` meta update. Placeholder approach: a 1200×630 solid-color PNG with "lala.la" text overlay is acceptable for Phase 5 — final artwork is Phase 7. If ImageMagick is available: `convert -size 1200x630 xc:#7c3aed -pointsize 80 -fill white -gravity center -annotate 0 "lala.la" og-marketing.png`

---

## Metadata

**Analog search scope:** `artifacts/web/` (frontend-only phase)
**Files scanned:** 8 source files + 3 public assets
**Pattern extraction date:** 2026-05-31

**Key confirmed facts from direct codebase inspection:**
- `index.html` is 24 lines; placeholder "7of1" meta confirmed on lines 6, 9, 10, 13, 14; three Google Fonts CDN links on lines 16–18
- `main.tsx` is 6 lines; no Fontsource imports present; `./instrument` is already line 1
- `index.css` has `@layer base` (line 274), `@layer utilities` (line 304); file ends at line 394; no `@layer marketing-tokens` present
- `App.tsx` is 84 lines; all 10 page imports are static (lines 3–12); `Router()` wraps `<Switch>` without `<Suspense>`; `/:locale/:handle` is on line 65 (correctly last named route)
- `i18n.ts` is 806 lines; `Messages` type lines 13–174; `const messages: Record<Locale, Messages> = {` on line 176; no `satisfies` keyword present; `getMessages` exported at line 799
- `vite.config.ts` has `build.outDir` set but no `rollupOptions.output.assetFileNames`
- `public/robots.txt` is 2 lines: `User-agent: *` + `Allow: /`
- `public/` contains `favicon.svg`, `opengraph.jpg`, `robots.txt` (no `sitemap.xml`)
- Pages directory contains all 10 page components referenced in App.tsx; `home.tsx` is 8-line placeholder
