# Stack Research

**Domain:** Marketing site added to an existing Vite + React 19 + Tailwind v4 SPA
**Milestone:** v2.0 Marketing Site
**Researched:** 2026-05-30
**Confidence:** HIGH — all additions verified against current npm, official docs, and codebase state

---

## Context: What Already Exists (Do Not Re-Research)

The existing `artifacts/web` package already provides:

- React 19.1.0 + Vite ^7.3.2 + TypeScript strict mode
- Tailwind CSS v4 (`@tailwindcss/vite` Vite plugin, CSS-native config via `@theme`)
- Framer Motion ^12.23.24 (already in catalog)
- Radix UI full primitive set (20+ packages already installed)
- `class-variance-authority` + `tailwind-merge` + `clsx`
- lucide-react (in catalog)
- wouter ^3.3.5 routing (`/:locale` prefix already established in `App.tsx`)
- i18n via a hand-rolled `messages` Record in `lib/i18n.ts` (not i18next — the web layer uses its own typed message map)
- Inter font loaded from Google Fonts CDN in `index.html`
- Framer Motion, embla-carousel-react, react-icons already in devDeps

The marketing site lives at `/:locale` — the route `/:locale` already maps to `src/pages/home.tsx`, which is currently a placeholder stub. The marketing work **replaces that stub** within the existing artifact. No new artifact is needed.

---

## Net-New Stack Additions

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@fontsource-variable/inter` | ^5.x | Variable Inter font, self-hosted | Removes Google Fonts CDN request from `index.html`; eliminates third-party DNS latency and privacy-law risk on first paint; variable font gives weight/width range with a single file; Inter is already the EN display face — this replaces the Google Fonts `<link>` with an npm import |
| `@fontsource-variable/noto-sans-jp` | ^5.x | CJK font coverage (JA + zh-TW glyphs) | Noto Sans JP covers Hiragana, Katakana, Kanji AND Traditional Chinese (zh-TW shares the same Unicode blocks); self-hosted via Fontsource to avoid CDN latency; import only required weights (400, 500, 700) to limit bundle size; variable font version ships a single woff2 file for all weights |
| `react-helmet-async` | ^3.0.0 | Per-route `<head>` management (title, meta, OG tags) | React 19 has native metadata hoisting for `<title>` and `<meta>` tags via JSX — no library needed for simple per-component cases. BUT `react-helmet-async` v3.0.0 (released March 2026) is needed for: (1) `og:image` + `og:url` injection from route-aware components, (2) `lang` attribute updates on `<html>` per locale switch, (3) `hreflang` alternate link tags across the three locale routes. v3 detects React 19 and delegates to React's own hoisting — zero overhead, fully compatible |
| `vite-plugin-sitemap` | ^0.7.x | Generates `sitemap.xml` + `robots.txt` at build time | Marketing site needs to be indexable; sitemap covers the 3 known static locale roots (`/en`, `/ja`, `/zh-TW`); zero runtime cost; integrates directly into `vite.config.ts`; last updated May 2025 |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tw-animate-css` | ^1.4.0 | CSS-native Tailwind animation utilities | Already installed in web devDeps (`tw-animate-css` is visible in `package.json`). Use `animate-fade-in`, `animate-slide-up`, etc. for section reveal without adding Framer Motion overhead to every element |
| `@radix-ui/react-navigation-menu` | already installed | Desktop nav with locale switcher | Already in devDeps; use for the sticky marketing nav bar — handles keyboard, focus management, and ARIA out of the box |
| `embla-carousel-react` | already installed (^8.6.0) | Feature/pillar carousel on mobile | Already in web devDeps; use for the "4 generative pillars" horizontal scroll section on mobile viewports |
| `framer-motion` | already in catalog (^12.23.24) | Hero section entrance + scroll-triggered section reveals | Already installed; use `whileInView` + `viewport={{ once: true }}` on section wrappers; this is the correct Framer Motion v12 pattern for marketing scroll reveals (no IntersectionObserver wiring needed) |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `vite-plugin-sitemap` in `vite.config.ts` | Sitemap at build time | Add to the plugins array in `artifacts/web/vite.config.ts`; configure `hostname: 'https://lala.la'`, `routes: ['/en', '/ja', '/zh-TW']` |
| Express route-level OG meta injection | Dynamic OG tags for crawlers | The existing `api-server` already serves the Vite `dist/` static files. Add a thin Express middleware that detects known bot user-agents and injects pre-baked `og:*` strings into `index.html` before streaming. This gives social card previews without SSR. See SEO section below for the exact pattern |

---

## Installation

```bash
# Self-hosted fonts (replace Google Fonts CDN link in index.html)
pnpm --filter @workspace/web add @fontsource-variable/inter @fontsource-variable/noto-sans-jp

# Helmet for per-route OG + hreflang + lang attribute
pnpm --filter @workspace/web add react-helmet-async

# Sitemap generation (devDependency — build-time only)
pnpm --filter @workspace/web add -D vite-plugin-sitemap
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@fontsource-variable/noto-sans-jp` (self-hosted) | Google Fonts CDN `<link>` | Only if Replit Object Storage (which would cache fonts) is configured as a CDN — it isn't; self-hosting is better for this deployment |
| `react-helmet-async` v3 | React 19 native `<title>` + `<meta>` JSX hoisting | Native hoisting is sufficient for per-page `<title>` and description. Use the native approach for those, and only bring in react-helmet-async for the `<html lang>` attribute, `hreflang` links, and `og:image` tags which the native hoisting API does not yet cover cleanly |
| `vite-plugin-sitemap` | Hardcoded `sitemap.xml` in `public/` | Acceptable if the route set never changes; the plugin is simpler and auto-regenerates on build |
| Framer Motion `whileInView` | `react-intersection-observer` + CSS transitions | `react-intersection-observer` is fine but adds a dependency; Framer Motion is already installed and `whileInView` covers all marketing reveal patterns without extra setup |
| Express bot-detect middleware for OG | Full SSR (Vite SSR / vike / Remix) | SSR would give perfect OG + SEO but is a substantial architecture change. The marketing site is 3 static locale routes with fixed copy; bot-detect middleware + hardcoded meta strings is sufficient and keeps the deployment on Vite SPA |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Next.js | Explicitly excluded by project constraint; Vite + wouter is the mandate; migrating to Next.js for SEO is disproportionate for 3 static locale routes | Stay on Vite; use the Express OG-injection middleware described below |
| Remix / vike / vite-plugin-ssr | SSR framework just for marketing meta tags is massive scope creep on a frontend-only milestone | Express bot-detect middleware (see SEO section) |
| i18next / react-i18next | The web layer already has a typed `getMessages()` function in `lib/i18n.ts`. Adding i18next would create two competing i18n systems in the same artifact | Extend the existing `Messages` type in `lib/i18n.ts` with a `marketing` namespace key |
| `@heroicons/react` or `phosphor-icons` | lucide-react is already in the catalog; mixing two icon libraries adds cognitive overhead with negligible benefit | lucide-react for UI icons; inline SVG for any brand-specific marketing icons not covered by lucide |
| GSAP or ScrollTrigger | Heavy dependency (60+ kB); Framer Motion is already installed and `whileInView` covers all needed scroll reveal patterns for a marketing site | Framer Motion `whileInView` + `tw-animate-css` for simple fades |
| `react-spring` or `motion` (the renamed package) | The catalog pins `framer-motion` ^12.23.24; `motion` is the renamed package but the import path is `framer-motion` for v12; do not mix imports | Use `framer-motion` imports throughout; the rename to `motion/react` applies to v12.x but both import paths work — stick with `framer-motion` for consistency with existing fan-page code |
| `styled-components` / `emotion` | CSS-in-JS conflicts with Tailwind v4's CSS-native approach and adds runtime overhead | Tailwind utility classes + `cn()` + `@theme` design tokens |
| `react-i18n` / `lingui` | Out of scope; the existing hand-rolled message map is sufficient for 3 locales and typed; a full i18n runtime is not needed | Extend `lib/i18n.ts` |
| Stripe, payment components | No fan/creator payment loop in this milestone; strictly frontend-only | N/A |
| Any backend / API changes | This milestone is explicitly frontend-only; `artifacts/api-server` is untouched | N/A |

---

## SEO / Meta / Social Cards Without SSR

This is the most important architectural decision for the marketing site. The full analysis:

### Problem

`artifacts/web` is a Vite SPA. `index.html` is a near-empty shell with a `<div id="root">`. Social media crawlers (Twitter/X, Telegram link preview, Facebook, LINE, LinkedIn) do not execute JavaScript — they read the raw HTML. So `<meta property="og:image">` injected by React never reaches them.

### Solution: Express Bot-Detect Middleware (Recommended)

The existing `api-server` (Express 5) already serves the Vite static build from `artifacts/web/dist/public/`. Add a small middleware before the static file handler:

```typescript
// artifacts/api-server/src/middleware/og-inject.ts
const CRAWLER_UA = /Twitterbot|facebookexternalhit|TelegramBot|LinkedInBot|Slackbot|Googlebot/i;

const LOCALE_META: Record<string, { title: string; description: string; image: string }> = {
  en: {
    title: "lala.la — Your AI digital twin, always on",
    description: "Managed AI digital-twin service for creators. Chat, voice, image, video. Deploy on lala.la + Telegram in days.",
    image: "https://lala.la/og/en.jpg",
  },
  ja: {
    title: "lala.la — AIデジタルツインで、ファンとつながろう",
    description: "クリエイター向けのマネージドAIデジタルツインサービス。lala.laとTelegramに数日でデプロイ。",
    image: "https://lala.la/og/ja.jpg",
  },
  "zh-TW": {
    title: "lala.la — 您的 AI 數位分身，全天候上線",
    description: "創作者的 AI 數位分身托管服務，聊天、語音、圖像、影片，數天內部署上線。",
    image: "https://lala.la/og/zh-TW.jpg",
  },
};

export function ogInjectMiddleware(req, res, next) {
  if (!CRAWLER_UA.test(req.headers["user-agent"] ?? "")) return next();
  const locale = ["en", "ja", "zh-TW"].find(l => req.path.startsWith(`/${l}`)) ?? "en";
  const m = LOCALE_META[locale];
  const html = buildIndexHtml(m); // read dist/public/index.html, string-replace placeholders
  res.setHeader("Content-Type", "text/html");
  res.send(html);
}
```

**Why this approach:**
- Zero new packages on the frontend
- Express is already in the stack
- Google explicitly supports dynamic rendering (not classified as cloaking when content is equivalent)
- The marketing site has fixed copy per locale — no dynamic data needed for OG tags
- The 3 OG images (`og/en.jpg`, `og/ja.jpg`, `og/zh-TW.jpg`) are static assets committed to `artifacts/web/public/og/`

### React 19 Native Metadata (In-Component)

For `<title>`, `<meta name="description">`, and `<link rel="canonical">` that update as the user navigates (important for browser tab title), use React 19's native hoisting directly in the marketing page component:

```tsx
// src/pages/home.tsx
export default function MarketingPage() {
  const locale = useLocale(); // from wouter params
  const t = getMessages(locale).marketing;
  return (
    <>
      <title>{t.meta_title}</title>
      <meta name="description" content={t.meta_description} />
      <link rel="canonical" href={`https://lala.la/${locale}`} />
      {/* hreflang alternate links */}
      <link rel="alternate" hrefLang="en" href="https://lala.la/en" />
      <link rel="alternate" hrefLang="ja" href="https://lala.la/ja" />
      <link rel="alternate" hrefLang="zh-TW" href="https://lala.la/zh-TW" />
      {/* page content */}
    </>
  );
}
```

React 19.1.0 hoists `<title>`, `<meta>`, and `<link>` placed anywhere in the component tree to `<head>`. This is sufficient for browser-side title/description updates without any library.

**Use `react-helmet-async` v3 only for:** the `<html lang="...">` attribute update (React 19 does not hoist attributes to the `<html>` element) and for `og:image` / `og:url` where you want a programmatic override that also works for SSR-future-proofing. If you only target the Express bot-detect approach, react-helmet-async is optional.

### Sitemap

Add `vite-plugin-sitemap` to `vite.config.ts`:

```typescript
import sitemap from "vite-plugin-sitemap";

plugins: [
  react(),
  tailwindcss(),
  sitemap({
    hostname: "https://lala.la",
    routes: ["/en", "/ja", "/zh-TW"],
    // fan handle routes are dynamic; exclude them
    exclude: ["/:locale/:handle"],
  }),
  ...
]
```

This writes `dist/public/sitemap.xml` and `dist/public/robots.txt` on every production build. No runtime cost.

---

## Typography / Design System

### Font Strategy

The marketing site needs CJK support across three locales. The current `index.html` loads Inter from Google Fonts CDN — this must change for two reasons: (1) Google Fonts is a third-party DNS lookup that slows first-paint; (2) Inter does not cover Japanese or Traditional Chinese glyphs at all, causing system fallback rendering in those locales which looks inconsistent.

**Replace the Google Fonts `<link>` in `index.html` with:**

```typescript
// src/main.tsx (or a new src/fonts.ts imported by main.tsx)
import "@fontsource-variable/inter/wght.css";           // weight axis, latin subset
import "@fontsource-variable/noto-sans-jp/wght.css";    // weight axis, jp + zh-TW glyphs
```

**Tailwind v4 CSS `@theme` declaration in `src/index.css`:**

```css
@import "@fontsource-variable/inter/wght.css";
@import "@fontsource-variable/noto-sans-jp/wght.css";

@theme {
  --font-sans: "InterVariable", "Noto Sans JP Variable", system-ui, sans-serif;
  --font-display: "InterVariable", "Noto Sans JP Variable", system-ui, sans-serif;
  /* Marketing-specific design tokens */
  --color-brand: oklch(55% 0.24 290);       /* lala.la purple */
  --color-brand-light: oklch(70% 0.20 290);
  --color-surface: oklch(10% 0.01 290);     /* near-black with hue */
  --color-muted: oklch(55% 0.03 290);
  --radius-card: 1rem;
  --shadow-glow: 0 0 40px oklch(55% 0.24 290 / 0.3);
}
```

Noto Sans JP covers all Hiragana, Katakana, and the 2,136 Joyo Kanji + a large portion of Traditional Chinese (zh-TW). Font stacking means Inter handles Latin text and Noto Sans JP handles CJK fallthrough in a single `font-family` declaration. No per-locale font-family switching needed.

**Bundle size:** `@fontsource-variable/inter` wght axis = ~120 kB woff2; `@fontsource-variable/noto-sans-jp` wght axis = ~4.5 MB woff2. The CJK font is large. Mitigate with `font-display: swap` (Fontsource includes this) and preload only the weight-400 woff2 in `index.html`:

```html
<link rel="preload" href="/fonts/noto-sans-jp-wght.woff2" as="font" type="font/woff2" crossorigin>
```

Alternatively, keep Google Fonts for Noto Sans JP only (it has superior subsetting/CDN caching infrastructure for CJK) and self-host Inter. The tradeoff: one CDN DNS lookup for CJK fonts vs. full self-hosted. For a Replit-hosted app without a CDN layer, Google Fonts' CDN likely outperforms Replit's static file serving for the 4.5 MB CJK font. Decision: self-host Inter (small), use Google Fonts for Noto Sans JP (large) — a pragmatic middle ground.

### Scroll Animation Pattern

Use Framer Motion's `whileInView` for all section reveal animations. Do not use `useAnimation` + manual IntersectionObserver (that pattern is from pre-v8 Framer Motion). The v12 pattern:

```tsx
import { motion } from "framer-motion";

const fadeUpVariant = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

<motion.section
  variants={fadeUpVariant}
  initial="hidden"
  whileInView="visible"
  viewport={{ once: true, margin: "-80px" }}
>
  {/* section content */}
</motion.section>
```

`viewport={{ once: true }}` means the animation fires once as the section enters view and does not replay on scroll-up — correct behavior for marketing sections. `margin: "-80px"` triggers slightly before the element fully enters the viewport so content appears to glide in naturally.

### Icon Strategy

lucide-react is already installed in the catalog. Use it for all UI icons (nav, CTA arrows, feature badges). For the "4 generative pillars" section consider using custom SVG illustrations (committed to `artifacts/web/public/`) rather than icon library icons — marketing assets need brand differentiation that generic icon sets cannot provide.

---

## Marketing Copy / i18n Integration

The existing `lib/i18n.ts` in `artifacts/web` uses a hand-rolled typed `Messages` record with three locales. This is the correct approach for this project — adding i18next would introduce a second i18n system into the same artifact.

**Extend `lib/i18n.ts` with a `marketing` namespace:**

```typescript
type Messages = {
  // ... existing fan, dsar, onboard keys ...
  marketing: {
    meta_title: string;
    meta_description: string;
    hero_headline: string;
    hero_subheadline: string;
    hero_cta: string;
    hero_cta_href: string;       // deep-link to Hermes Telegram bot
    pillars_title: string;
    pillars: {
      chat: { title: string; body: string };
      voice: { title: string; body: string };
      image: { title: string; body: string };
      video: { title: string; body: string };
    };
    channels_title: string;
    channels_body: string;
    onboarding_title: string;
    onboarding_body: string;
    nav_cta: string;
  };
};
```

All marketing copy lives in this typed structure. TypeScript enforces completeness across all three locales at compile time — no runtime missing-key bugs.

**Telegram CTA deep-link:** The primary CTA button deep-links into the existing Hermes onboarding bot. The URL is `https://t.me/{HERMES_BOT_USERNAME}?start=creator_onboard`. This is a frontend-only hardcoded link — no backend changes needed. Expose it as an env var `VITE_HERMES_BOT_URL` injected at build time so it can differ between staging and production.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@fontsource-variable/inter` ^5.x | Vite ^7, Tailwind v4 | Import the CSS directly in `main.tsx`; Vite bundles it and copies woff2 files to `dist/public/assets/` |
| `@fontsource-variable/noto-sans-jp` ^5.x | Vite ^7, Tailwind v4 | Same as Inter; large woff2 — consider `font-display: optional` for non-critical CJK subsets |
| `react-helmet-async` ^3.0.0 | React 19.1.0 | v3 released March 2026; v2 breaks on React 19; upgrade is required if you use helmet at all |
| `vite-plugin-sitemap` ^0.7.x | Vite ^7.3.2 | Add to `plugins` array in `vite.config.ts`; compatible with the existing `@tailwindcss/vite` + `@vitejs/plugin-react` plugin stack |
| Framer Motion ^12.23.24 | React 19.1.0 | Already in catalog; `whileInView` works correctly in v12 with React 19 |

---

## Sources

- `artifacts/web/package.json` — confirmed existing deps — HIGH confidence
- `artifacts/web/src/App.tsx` — wouter route structure, confirmed `/:locale` home route — HIGH confidence
- `artifacts/web/src/lib/i18n.ts` — confirmed hand-rolled typed message map, not i18next — HIGH confidence
- `artifacts/web/index.html` — confirmed Google Fonts CDN link for Inter — HIGH confidence
- `pnpm-workspace.yaml` — confirmed catalog versions and supply-chain guard — HIGH confidence
- [react-helmet-async npm](https://www.npmjs.com/package/react-helmet-async) — v3.0.0 released March 2026, React 19 compatible — HIGH confidence
- [React 19 document metadata hoisting](https://react.dev/blog/2024/12/05/react-19) — native `<title>`/`<meta>` hoisting in React 19 — HIGH confidence
- [Framer Motion scroll animations](https://motion.dev/docs/react-scroll-animations) — `whileInView` + `viewport` API for v12 — HIGH confidence
- [vite-plugin-sitemap npm](https://www.npmjs.com/package/vite-plugin-sitemap) — last updated May 2025, ~27k weekly downloads — MEDIUM confidence
- [@fontsource-variable/noto-sans-jp npm](https://www.npmjs.com/package/@fontsource-variable/noto-sans-jp) — variable font, self-hosted — HIGH confidence
- [Noto Sans JP Google Fonts](https://fonts.google.com/noto/specimen/Noto+Sans+JP) — CJK coverage confirmed — HIGH confidence
- [Web Almanac 2025 fonts](https://almanac.httparchive.org/en/2025/fonts) — Noto Sans JP #1 mobile Google Font at 6.4% — MEDIUM confidence
- [SPA OG meta tag injection without SSR — DEV Community](https://dev.to/msveshnikov/simple-seo-fix-for-vitereact-spas-without-switching-to-nextremix-pe0) — Express bot-detect pattern — MEDIUM confidence
- [Dynamic rendering approved by Google](https://www.stackmatix.com/blog/spa-meta-tags-dynamic-rendering) — not classified as cloaking — MEDIUM confidence

---

*Stack research for: v2.0 Marketing Site (net-new additions only)*
*Researched: 2026-05-30*
