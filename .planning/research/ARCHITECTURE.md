# Architecture Research

**Domain:** Marketing site integration into existing artifacts/web SPA (lala.la)
**Researched:** 2026-05-30
**Confidence:** HIGH — derived from direct codebase inspection of artifacts/web/src/, App.tsx, lib/i18n.ts, vite.config.ts, index.html, and package.json

---

## Integration Overview

The marketing site is NOT a new artifact. It lives entirely inside `artifacts/web` — the existing React 19 + Vite SPA on port 22333. The "placeholder" at the locale root is `src/pages/home.tsx` (8 lines of unstyled HTML). The entire milestone is replacing that file and adding supporting modules around it.

### What MUST NOT change

- The fan route `/:locale/:handle` (the `FanPage` component and its registration in `App.tsx`)
- Port 22333
- `artifacts/api-server` (Express, port 8080) — no backend changes
- `artifacts/hermes` — the marketing CTA deep-links to it; no changes to the bot
- `lib/api-zod/` and `lib/api-client-react/` — generated; not touched by this milestone
- The `/:locale/onboard/*`, `/:locale/account/data-request`, `/:locale/dashboard`, `/payment/*` routes — all remain registered as-is

---

## System Overview

```
artifacts/web/src/
├── App.tsx                  MODIFY: import MarketingPage; replace HomePage in /:locale route
├── index.css                MODIFY: add marketing CSS layer and design tokens block
├── index.html               MODIFY: update default <title>, meta description, og:* tags
├── lib/
│   └── i18n.ts              MODIFY: add `marketing` namespace to Messages type + 3-locale copy
│
├── pages/
│   ├── home.tsx             REPLACE: becomes the new MarketingPage shell
│   └── [all others]         NO CHANGE
│
├── components/
│   ├── fan/                 NO CHANGE
│   ├── ui/                  NO CHANGE (fan + shared Radix primitives)
│   └── marketing/           NEW: isolated marketing design system
│       ├── index.ts         re-export barrel
│       ├── MarketingNav.tsx
│       ├── HeroSection.tsx
│       ├── PillarsSection.tsx
│       ├── ChannelsSection.tsx
│       ├── OnboardingSection.tsx
│       ├── CtaSection.tsx
│       └── MarketingFooter.tsx
│
└── content/                 NEW: structured marketing copy (typed, locale-keyed)
    └── marketing.ts         marketing copy object — same shape as existing i18n.ts namespaces
```

---

## Routing Strategy

### Current Route Table (App.tsx)

```
/              → redirect to /en
/:locale       → HomePage  (the 8-line placeholder — THIS is what we replace)
/:locale/:handle → FanPage (MUST NOT CHANGE)
/:locale/onboard → redirect dispatcher
/:locale/onboard/step1|2|3 → wizard steps
/:locale/account/data-request → DsarPortal
/:locale/dashboard → CreatorDashboard
/payment/success|cancel → payment pages
```

### Marketing Site Route

The marketing site replaces `HomePage` at `/:locale`. The route registration in `App.tsx` does not change:

```tsx
// App.tsx — route registration UNCHANGED
<Route path="/:locale">
  {() => <MarketingPage />}
</Route>
```

Only the import changes: `import MarketingPage from "@/pages/home"` (the file `home.tsx` is replaced).

### Why Path-Prefix (`/:locale`) is Already the Right Model

The existing routing already uses path-prefix locale detection. `getPageLocale()` in App.tsx parses `window.location.pathname.split("/").find(Boolean)` to extract the locale segment and validates it against `isValidLocale()`. The root `/` redirects to `/en`.

This means:
- `/en` → marketing site in English
- `/ja` → marketing site in Japanese
- `/zh-TW` → marketing site in Traditional Chinese
- `/en/claire` → FanPage for Claire (unaffected)

No new routing logic is required. The fan route safety is guaranteed by wouter's route specificity: `/:locale/:handle` only matches when a second path segment exists, so the marketing route `/:locale` cannot conflict.

### Locale Switcher for Marketing Page

The fan page's `LocaleSwitcher` component switches to `/:locale/:handle`. For the marketing page, a separate `MarketingLocaleSwitcher` (inside `components/marketing/`) switches to `/:locale` (no handle). It reuses `LOCALES` and `isValidLocale` from `lib/i18n.ts` but is a different component — do NOT modify the fan page's `LocaleSwitcher`.

---

## Design System Isolation

### The Problem

The fan page CSS uses a dark-mode-first palette (near-black backgrounds, brand violet `263 80% 58%`). All CSS custom properties are defined on `:root` (light, mostly unset — still showing `red` placeholders) and `.dark`. The `body` applies `bg-background text-foreground`, which picks up the dark mode values.

The marketing site needs a distinct brand aesthetic (likely light or mixed). If marketing components inherit the same CSS variables, they get the fan page's dark-mode skin.

### Isolation Approach: CSS Layer + Scoped Token Block

Add a `[data-surface="marketing"]` attribute to the marketing page root element. Define a separate token block scoped to that attribute in a new CSS layer inside `index.css`:

```css
/* index.css — NEW section appended below existing @layer base */

@layer marketing-tokens {
  [data-surface="marketing"] {
    --mkt-bg:          #ffffff;
    --mkt-fg:          #0a0a0a;
    --mkt-accent:      hsl(263 80% 58%);   /* brand violet — shared with fan page */
    --mkt-accent-fg:   #ffffff;
    --mkt-surface-1:   #f8f8f8;
    --mkt-surface-2:   #f0f0f0;
    --mkt-border:      #e5e5e5;
    --mkt-radius:      0.75rem;

    /* Typography scale — distinct from fan page system-ui */
    --mkt-font-display: 'Inter', system-ui, sans-serif;
    --mkt-font-body:    'Inter', system-ui, sans-serif;
    --mkt-text-hero:    clamp(2.5rem, 6vw, 4.5rem);
    --mkt-text-section: clamp(1.75rem, 3.5vw, 2.5rem);
    --mkt-text-body:    1rem;
    --mkt-leading:      1.6;
  }
}
```

`home.tsx` renders:
```tsx
<div data-surface="marketing" className="min-h-screen bg-[--mkt-bg] text-[--mkt-fg]">
  {/* sections */}
</div>
```

All marketing components consume `--mkt-*` tokens directly via Tailwind's arbitrary value syntax (`bg-[--mkt-bg]`, `text-[--mkt-accent]`) or via CSS classes defined in the `marketing-tokens` layer. They do NOT use `bg-background`, `text-foreground`, or any of the existing fan-page CSS variable names.

### Why This Over a Separate CSS File / Stylesheet Import

- No new stylesheet: the Vite build already bundles `index.css`; adding an import would split the critical path
- Scoped by `data-surface` attribute: marketing tokens cannot leak onto fan page elements (different DOM subtree)
- `@layer marketing-tokens` has lower specificity than `@layer base` if needed, preventing accidental overrides

### Shared Radix Primitives

The existing `components/ui/` Radix primitives (Button, DropdownMenu, Dialog, etc.) CAN be used in marketing components as long as they are styled with `--mkt-*` tokens rather than the fan-page token names. This is acceptable — the Radix primitives are unstyled in their base form; only the class overrides change.

If a marketing component needs a `Button`, pass explicit className overrides instead of relying on the global `primary` variant, which uses `--primary` (fan-page violet). Example: `<Button className="bg-[--mkt-accent] text-[--mkt-accent-fg] ...">`

---

## Locale Detection and Routing — Marketing Pages

### Existing Pattern (Do Not Break)

The current flow for locale detection is:

1. User visits `/` → `<Redirect to="/en" />` (in `App.tsx`)
2. `getPageLocale()` reads `window.location.pathname` first segment
3. Individual pages call `getMessages(locale).fan` / `.dsar` / `.onboard` to get typed copy

The marketing page follows the exact same pattern. No new locale detection mechanism is needed.

### Locale Redirect Logic

The root `/` already redirects to `/en`. If a user visits `/zh-TW`, wouter matches `/:locale` with `locale="zh-TW"`, `isValidLocale("zh-TW")` returns true, and `MarketingPage` renders with the zh-TW locale.

The `DEFAULT_LOCALE = "en"` fallback in `getPageLocale()` handles unknown locale segments without crashing.

### No Accept-Language Header Negotiation on the Client

There is no `Accept-Language` detection at the SPA layer and none should be added for this milestone. Path-prefix locale routing is already established and consistent across all existing pages. Adding browser-language auto-redirect would change behavior for existing fan routes and requires careful handling of direct links. Defer until a later milestone if needed.

### Locale Switcher Placement

The marketing `MarketingNav` component includes a `MarketingLocaleSwitcher`. It uses `useLocation()` from wouter (the same hook `LocaleSwitcher` uses) and navigates to `/${targetLocale}` (without a handle segment).

---

## Copy/Content Organization

### Current i18n Pattern

`lib/i18n.ts` is a single TypeScript file with:
- A `Messages` type (typed shape for all copy)
- A `messages: Record<Locale, Messages>` object with inline strings for all 3 locales
- `getMessages(locale)` returning the typed object for that locale

All existing pages call `const t = getMessages(locale).fan` / `.dsar` / `.onboard`.

### Marketing Copy Approach: Extend the Same Pattern

Add a `marketing` namespace to the existing `Messages` type and `messages` object. This is the zero-dependency, zero-new-tool approach consistent with the existing codebase.

```typescript
// lib/i18n.ts — MODIFY

type Messages = {
  version_history: { ... };    // existing
  fan: { ... };                // existing
  dsar: { ... };               // existing
  onboard: { ... };            // existing
  marketing: {                 // NEW
    nav: {
      cta_creator: string;     // "Start your twin"
    };
    hero: {
      headline: string;
      subheadline: string;
      cta_primary: string;
      cta_secondary: string;
    };
    pillars: {
      title: string;
      chat_label: string;
      chat_desc: string;
      voice_label: string;
      voice_desc: string;
      image_label: string;
      image_desc: string;
      video_label: string;
      video_desc: string;
    };
    channels: {
      title: string;
      subtitle: string;
      lala_label: string;
      telegram_label: string;
      social_label: string;
    };
    onboarding: {
      title: string;
      subtitle: string;
      step1_label: string;
      step1_desc: string;
      step2_label: string;
      step2_desc: string;
      step3_label: string;
      step3_desc: string;
    };
    cta: {
      headline: string;
      subheadline: string;
      button: string;
    };
    footer: {
      tagline: string;
      privacy: string;
      terms: string;
      contact: string;
    };
  };
};
```

`home.tsx` calls `const t = getMessages(locale).marketing`.

### Why Not i18next for This Milestone

`i18next` and `react-i18next` are NOT installed in the workspace. The CLAUDE.md tech stack section lists them as a recommendation, but the actual codebase uses `lib/i18n.ts`. Installing i18next for this milestone would:
- Add ~50kB to the bundle
- Require migrating existing `getMessages()` call sites or running two systems in parallel
- Add configuration complexity (detection plugins, backends, suspense) with no benefit for 3 static locales and ~100 copy strings

Extend `lib/i18n.ts` for this milestone. If i18next is needed later (dynamic content loading, many more locales, plural rules, ICU formatting), migrate the whole `lib/i18n.ts` system at that point — do not introduce a parallel system.

### Content Volume

Marketing copy for 3 locales is approximately 60-80 strings. This is small enough to keep inline in `lib/i18n.ts`. If the file grows beyond ~800 lines, split marketing copy into `lib/i18n-marketing.ts` and import+merge with the main messages — but do not do this preemptively.

---

## SEO — Without SSR

### The Constraint

Vite produces a client-rendered SPA. There is no SSR, no pre-rendering server, and no SSG step in the current build pipeline. The Replit deployment serves the single `dist/public/index.html` for all routes.

### What This Means for SEO

- Crawlers that execute JavaScript (Googlebot) will see the fully rendered marketing page — adequate for Google indexing
- Social card scrapers (Twitter/X, Slack, Facebook, LINE) do NOT execute JavaScript — they read the static HTML `<head>` only. The current `index.html` has placeholder `og:*` tags; social previews will show those placeholders for all routes

### Approach: Static Meta in index.html for Marketing Routes, React Helmet for Dynamic Routes

**Step 1: Update `index.html` with real lala.la marketing meta.**

The marketing site at `/:locale` is the canonical "home" of the domain. The static `index.html` meta tags should reflect the marketing site content (not the fan page, which has creator-specific meta that cannot be static anyway). Update `index.html`:

```html
<title>lala.la — AI Digital Twin for Creators</title>
<meta name="description" content="Run your AI twin on lala.la and Telegram. Chat, voice, image, and video — managed for you. For 17 LIVE creators in JP/TW/HK." />
<meta property="og:title" content="lala.la — AI Digital Twin for Creators" />
<meta property="og:description" content="Run your AI twin on lala.la and Telegram. Chat, voice, image, and video — managed." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://lala.la" />
<meta property="og:image" content="https://lala.la/og-marketing.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://lala.la/og-marketing.png" />
```

A static `public/og-marketing.png` (1200x630) is added as a build asset for the social card image.

**Step 2: Do NOT install react-helmet or react-helmet-async for this milestone.**

The fan page is creator-specific and needs dynamic `<title>` and `og:*` per creator, but that problem is orthogonal to this milestone and not blocking fan page functionality (the fan page already works). Defer react-helmet to the phase that adds per-creator SEO. For now:

- Marketing pages: served by the static `index.html` meta (correct for social cards)
- Fan pages: served by the same static `index.html` meta (acceptable — fan pages are not the social-card target; they're destination URLs, not shared links)

**Step 3: Sitemap.xml — static file in `public/`.**

Add `artifacts/web/public/sitemap.xml` listing the 3 locale marketing pages:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://lala.la/en</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://lala.la/ja</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://lala.la/zh-TW</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>
</urlset>
```

Static files in `public/` are copied as-is into `dist/public/` by Vite.

**Step 4: robots.txt in `public/`.**

```
User-agent: *
Allow: /en
Allow: /ja
Allow: /zh-TW
Disallow: /en/*/  
Disallow: /ja/*/
Disallow: /zh-TW/*/
Sitemap: https://lala.la/sitemap.xml
```

This tells crawlers to index the marketing locale roots but not the fan chat pages (which are not content for indexing).

### Vite Prerender Plugin — Considered and Deferred

`vite-plugin-prerender` or `vite-ssg` could generate static HTML shells for the 3 locale roots at build time, giving social scrapers real meta. However:
- These plugins require configuration changes to `vite.config.ts`
- They add a headless browser build step (Puppeteer/Playwright)
- For 3 pages with static content, the complexity outweighs the benefit
- Googlebot JavaScript rendering is sufficient for SEO ranking

Defer prerendering unless social card previews become a validated business requirement. The `og:image` static approach covers the most common social sharing scenario.

---

## Data Flow

```
Browser visits lala.la/ja
    ↓
Vite static server returns index.html (with updated marketing og:* tags)
    ↓
React + wouter boots in browser
    ↓
App.tsx: getPageLocale() reads pathname → "ja"
    ↓
Router: matches /:locale with locale="ja" → renders MarketingPage
    ↓
MarketingPage:
  - reads locale from useParams() or getPageLocale()
  - calls getMessages("ja").marketing → typed copy object
  - renders sections: MarketingNav, HeroSection, PillarsSection,
    ChannelsSection, OnboardingSection, CtaSection, MarketingFooter
    ↓
Primary CTA click:
  - opens t.me/<HERMES_BOT>?start=creator (env var VITE_HERMES_DEEP_LINK)
  - window.open() in new tab, no SPA navigation
    ↓
Locale switcher click:
  - MarketingLocaleSwitcher calls setLocation("/" + targetLocale)
  - wouter matches /:locale → MarketingPage re-renders in new locale
```

Fan route isolation:
```
Browser visits lala.la/ja/claire
    ↓
Router: matches /:locale/:handle with locale="ja", handle="claire"
    ↓
FanPage renders — marketing components never instantiated
```

---

## Component Structure

### New Files (`artifacts/web/src/components/marketing/`)

| Component | Responsibility |
|-----------|---------------|
| `index.ts` | Re-export barrel for all marketing components |
| `MarketingNav.tsx` | Fixed-top nav: lala.la logo, locale switcher, "Start your twin" CTA button |
| `HeroSection.tsx` | Full-viewport hero: headline, subheadline, dual CTA buttons, hero visual |
| `PillarsSection.tsx` | Four generative pillars (chat/voice/image/video) — icon grid or card grid |
| `ChannelsSection.tsx` | Multi-channel deployment story (lala.la + Telegram + own social) |
| `OnboardingSection.tsx` | Managed white-glove onboarding — numbered steps |
| `CtaSection.tsx` | Final CTA block — Hermes deep-link button |
| `MarketingFooter.tsx` | Privacy / Terms links + tagline |

Each section component receives `t: Messages["marketing"]` as a prop — it does not call `getMessages()` itself. `home.tsx` calls `getMessages(locale).marketing` once and passes `t` down.

### Modified Files

| File | Change Type | What Changes |
|------|-------------|-------------|
| `src/pages/home.tsx` | REPLACE | The 8-line placeholder is fully replaced with `MarketingPage` component |
| `src/lib/i18n.ts` | MODIFY | Add `marketing` namespace to `Messages` type and populate 3-locale copy |
| `src/index.css` | MODIFY | Append `@layer marketing-tokens` with `[data-surface="marketing"]` token block |
| `src/App.tsx` | MODIFY (minor) | Import name change only if renaming the default export in home.tsx |
| `index.html` | MODIFY | Update title, description, og:* tags for marketing content |

### New Non-Component Files

| File | Purpose |
|------|---------|
| `public/og-marketing.png` | 1200x630 social card image — static asset |
| `public/sitemap.xml` | Sitemap for crawlers |
| `public/robots.txt` | Crawler directives |

### Files That Must NOT Be Modified

| File | Reason |
|------|--------|
| `src/pages/fan-page.tsx` | Fan route — core product; no marketing concerns here |
| `src/components/fan/*` | Fan page component tree |
| `src/components/ui/*` | Shared Radix primitives — can be consumed but not modified |
| `src/App.tsx` (route table) | Route registrations stay identical; only the import of `home.tsx` may change if the export is renamed |
| `vite.config.ts` | Port 22333, base path — no changes |

---

## Build Order (Suggested)

Dependencies flow from bottom to top. Each step unblocks the next.

```
Step 1 — Foundation (no visible output yet)
  - Update lib/i18n.ts: add marketing namespace type + 3-locale copy strings
  - Append marketing-tokens CSS layer to index.css
  - Update index.html: title, description, og:* tags
  - Add public/og-marketing.png, public/sitemap.xml, public/robots.txt
  RATIONALE: Copy and tokens must exist before components consume them.
  VERIFIABLE: pnpm run typecheck should pass

Step 2 — Static sections (no interaction)
  - Create components/marketing/MarketingFooter.tsx
  - Create components/marketing/HeroSection.tsx
  - Create components/marketing/PillarsSection.tsx
  - Create components/marketing/ChannelsSection.tsx
  - Create components/marketing/OnboardingSection.tsx
  - Create components/marketing/CtaSection.tsx
  RATIONALE: Content sections have no inter-dependencies; build them in any order.
  VERIFIABLE: Each component renders with placeholder data in isolation.

Step 3 — Navigation
  - Create components/marketing/MarketingNav.tsx (includes MarketingLocaleSwitcher)
  RATIONALE: Nav depends on locale-switching logic; build after confirming
  wouter's useLocation() pattern works as expected in the marketing context.

Step 4 — Page assembly
  - Replace src/pages/home.tsx with MarketingPage shell
  - Wire all sections together; pass `t = getMessages(locale).marketing` to each
  - Create components/marketing/index.ts barrel
  RATIONALE: Assembly is last; all sections must be complete first.
  VERIFIABLE: Visit /en, /ja, /zh-TW — marketing site renders in each locale.
  Verify /en/claire still loads FanPage unaffected.

Step 5 — Polish
  - Add Framer Motion entrance animations to HeroSection (already in package.json)
  - Mobile breakpoint audit across all sections
  - Locale switcher test: switching from /ja to /en preserves marketing page
  RATIONALE: Animation and responsive polish after layout is confirmed correct.
```

---

## Environment Variable

The Hermes Telegram deep-link CTA requires one new environment variable:

```
VITE_HERMES_DEEP_LINK=https://t.me/<bot_username>?start=creator
```

Prefix `VITE_` is required for Vite to expose it to the browser bundle. Add to `.env.example`. The `CtaSection` and `MarketingNav` components reference `import.meta.env.VITE_HERMES_DEEP_LINK`. If absent (local dev without `.env.local`), fall back to a `#contact` anchor.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Adding a new `artifacts/` entry for the marketing site

The marketing site is a page within the existing `artifacts/web` SPA. Creating a separate artifact would duplicate the build pipeline, split the port mapping, and require a reverse proxy to serve both from `lala.la`. It adds no benefit.

### Anti-Pattern 2: Using the fan page's `--primary` / `--background` CSS variables in marketing components

The dark-mode fan page palette will make marketing components look like the chat interface. Use only `--mkt-*` tokens scoped under `[data-surface="marketing"]`.

### Anti-Pattern 3: Installing i18next alongside the existing getMessages() system

Running two i18n systems creates maintenance burden and confusion about which pages use which system. Extend `lib/i18n.ts` for this milestone. Migrate to i18next later as a whole-system decision if justified.

### Anti-Pattern 4: Locale detection via Accept-Language header at the SPA level

The existing routing already sends users to `/:locale` via the `/ → /en` redirect. Adding Accept-Language auto-detection would change existing behavior for bookmarked links and break locale persistence. Do not add it.

### Anti-Pattern 5: Per-creator og:meta via react-helmet for the marketing milestone

React-helmet is needed for fan page SEO but that is out of scope here. Introducing it now just to update the marketing page title (which is already served statically from `index.html`) adds unnecessary complexity.

### Anti-Pattern 6: Modifying the wouter Route table for the fan route

The fan route `/:locale/:handle` is a two-segment path and cannot conflict with the marketing route `/:locale`. Do not add guards, change route ordering, or modify the fan route registration.

---

## Sources

- `artifacts/web/src/App.tsx` — route table, wouter setup — HIGH confidence (direct inspection)
- `artifacts/web/src/lib/i18n.ts` — Messages type, getMessages() pattern, 3 locales inline — HIGH confidence (direct inspection)
- `artifacts/web/src/index.css` — Tailwind v4 CSS layer, CSS custom property system, dark-mode token definitions — HIGH confidence (direct inspection)
- `artifacts/web/vite.config.ts` — Vite build config, port 22333, BASE_PATH env var — HIGH confidence (direct inspection)
- `artifacts/web/index.html` — static meta, SPA shell — HIGH confidence (direct inspection)
- `artifacts/web/package.json` — framer-motion confirmed present, i18next NOT present — HIGH confidence (direct inspection)
- `artifacts/web/src/components/fan/LocaleSwitcher.tsx` — wouter useLocation() locale-switch pattern — HIGH confidence (direct inspection)
- `artifacts/web/src/pages/home.tsx` — confirmed 8-line placeholder — HIGH confidence (direct inspection)
- `.planning/PROJECT.md` — milestone v2.0 scope, must-not-change constraints — HIGH confidence (direct read)
- `docs/roadmap.md` — initiative #1 done-looks-like criteria — HIGH confidence (direct read)
- CLAUDE.md — tech stack, port mapping constraints — HIGH confidence (project instructions)

---

*Architecture research for: Marketing site integration into artifacts/web SPA*
*Researched: 2026-05-30*
