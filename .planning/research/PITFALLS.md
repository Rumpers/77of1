# Pitfalls Research: Marketing Site — Localized Vite SPA Addition

**Domain:** Adding a localized public marketing site to an existing React 19 + Vite + wouter + Tailwind v4 SPA
**Project:** lala.la v2.0 Marketing Site milestone
**Researched:** 2026-05-30
**Confidence:** HIGH (SEO/SPA, Tailwind layers, legal/compliance), MEDIUM (Telegram deep-link mobile behavior, CJK font performance), HIGH (route conflict, i18n architecture)

---

## Critical Pitfalls

### Pitfall 1: Social-Card and OG Meta Tags Are Invisible to Crawlers

**What goes wrong:**
The entire SPA is a single `index.html` with a `<div id="root"></div>` placeholder. Crawlers and social-card scrapers (Slack, Twitter/X, LINE, WeChat, iMessage) send HTTP GET requests and read the raw HTML — they do not execute JavaScript. The current `index.html` already ships generic placeholder OG tags ("7of1 — built on Replit"). When the marketing page launches, every social share from a creator or fan will preview as the placeholder "7of1" title and no image, because React never runs before the scraper times out.

This affects: Twitter card previews, LINE rich-link cards (critical for JP/TW audience), WhatsApp link previews, Slack unfurl, and most importantly Google's indexing of the value-proposition copy. Google CAN render JavaScript, but is unreliable for client-injected `<meta>` tags inside complex SPAs, and even when it does, it takes days-to-weeks to re-crawl after a JS-only change.

**Why it happens:**
Developers reach for `react-helmet-async` or `@tanstack/router`'s head management and assume that because the meta tags are "in the head" they are visible. They are not — they are injected by JavaScript after the HTML is served. The scraper sees the shell, not the injected tags.

**How to avoid:**
Two approaches, pick one before writing a single line of marketing-page component code:

Option A (recommended for this project): Static pre-render at build time using `vite-plugin-prerender` or `vite-plugin-static-copy` with a custom render script. Pre-render the locale root paths (`/en`, `/ja`, `/zh-TW`) to static HTML files with hardcoded OG meta tags baked in. The app hydrates normally for interactivity. This requires zero server-side infrastructure and fits Replit's static serving model.

Option B: A thin Replit `api-server` middleware that intercepts requests from known bot user-agents (Twitterbot, Slackbot, facebookexternalhit, Line-Preview, Google Search) and returns a pre-built HTML snippet with the correct meta tags. All other requests serve the normal SPA `index.html`.

The meta tags required for each locale root: `og:title`, `og:description`, `og:image` (1200×630 static asset, hosted on Replit Object Storage), `og:locale`, `og:url`, `twitter:card` (summary_large_image), `twitter:image`. The `og:image` file must exist at a public URL before the page is linked anywhere.

**Warning signs:**
- Run `curl -A "Twitterbot/1.0" https://lala.la/en` — if the response is `<div id="root"></div>` with placeholder text, the pitfall is live.
- Paste a lala.la URL into Twitter card validator or LINE's link preview tester before any announcement.

**Phase to address:**
Phase 1 (scaffold) — the pre-render decision must be made before any marketing component is built, because it affects the build pipeline. Retrofitting pre-render after the fact requires restructuring the Vite config.

---

### Pitfall 2: The Fan Route `/:locale/:handle` Will Match the Marketing Route `/:locale`

**What goes wrong:**
The current `App.tsx` router has this route order:
```
/:locale          → HomePage
/:locale/:handle  → FanPage
```

The marketing site replaces `HomePage`. It adds new sub-sections, possibly new sub-routes (e.g., `/:locale/features`, `/:locale/how-it-works`). If any of these sub-routes are added as `/:locale/:thing`, wouter's `Switch` will match the most-specific first — but if ordering is wrong, or if a new route is added as a child without a `Switch`, a visitor to `/en/features` could land on the `FanPage` with `handle = "features"`, which fires an API call to `/api/twin/features` and returns a 404 twin-not-found state visible to the user.

The specific collision: `/:locale/onboard` already exists. If `/:locale/how-it-works` is added without being placed above `/:locale/:handle` in the `Switch`, it will be swallowed by the fan route.

**Why it happens:**
wouter's `Switch` is greedy: the first matching `Route` wins. Adding new named routes BELOW the `/:locale/:handle` catch-all pattern will never be reached. Developers adding marketing sub-pages commonly forget that the fan handle route is a wildcard that consumes any two-segment path.

**How to avoid:**
All marketing sub-routes must be placed ABOVE the `/:locale/:handle` route in the `Switch`. Use a strict enumeration: `/:locale/features`, `/:locale/how-it-works`, `/:locale/managed-onboarding` — each explicitly listed before the fan catch-all. Do not add any general-purpose `/:locale/:section` pattern for marketing; it would conflict with the fan route.

Alternative: use wouter's nested `Router` with a `base` prop to namespace all marketing routes under a sub-tree (e.g., `base="/mkt"`), keeping the fan route untouched in a separate router. This is architecturally cleaner but requires refactoring `App.tsx`.

A CI route-conflict test is practical: enumerate all defined routes, assert that no two routes produce an identical match for a test-path set that includes known fan handles and marketing section names.

**Warning signs:**
- A visit to `/en/features` renders a "Creator not found" error (fan page 404 state) instead of the marketing Features section.
- API logs show requests to `/api/twin/how-it-works` or `/api/twin/features` — these are the fan API being called with marketing slugs as handles.

**Phase to address:**
Phase 1 (scaffold) — route structure must be established before any marketing component is written.

---

### Pitfall 3: New Marketing Design System Breaks Existing Fan-Page Styles via Tailwind v4 Cascade Layer Conflicts

**What goes wrong:**
The fan page uses Tailwind v4 utilities and a set of CSS custom properties defined in `index.css` (`--color-primary`, `--font-sans`, etc.). The marketing site needs a visually distinct design system — different typography scale, different color palette, different spacing rhythm. The temptation is to add new CSS variables and overrides in a `marketing.css` or directly in the marketing component files.

Tailwind v4 uses native CSS `@layer` for all of its output (base, components, utilities). The critical incompatibility: any CSS rule defined OUTSIDE a cascade layer has higher specificity than any CSS rule inside a layer, regardless of source order. If a third-party animation library or a marketing-specific stylesheet is added without declaring it inside a layer, those rules silently override Tailwind utilities on the fan page, because the fan page utilities live inside `@layer utilities`.

Specific failure mode: the marketing hero adds a CSS reset or a `font-family` rule at the global scope (not in a layer). This overrides `--app-font-sans` on the fan page, causing the fan chat to render in the wrong font in browsers that cached the marketing page CSS.

**Why it happens:**
Developers treat `index.css` as a shared global stylesheet and add new marketing rules to it. Tailwind v4's `@layer` system is not widely understood; the docs warn about this but developers encounter it when a Tailwind utility stops working after adding "some CSS."

**How to avoid:**
Scope all marketing-specific CSS under a namespacing class: `.marketing-root { ... }`. Wrap every marketing page in `<div className="marketing-root">`. Define all marketing-specific CSS custom properties inside `.marketing-root` scope so they do not leak to the fan page. Do NOT add any unlayered global CSS rules to `index.css` for the marketing site — if a rule must go in `index.css`, it must be inside a `@layer` directive.

For the new marketing typography: use Tailwind v4's `@theme` scoping within `.marketing-root` rather than overriding the root `@theme`. If using a different font (e.g., a display font for the hero heading), add the `@font-face` declaration inside a `@layer base` block.

**Warning signs:**
- Fan page components render with wrong font or wrong color after a marketing CSS file is added.
- Tailwind utilities on the fan page (e.g., `text-primary`) stop working — check for unlayered rules overriding CSS custom properties.
- `tw-animate-css` (already in the SPA) defines animations at the global scope; verify it does not conflict with any new animation library added for the marketing hero.

**Phase to address:**
Phase 1 (scaffold) — CSS isolation strategy must be established before any marketing styles are written. Fix later is a painful find-and-audit task.

---

### Pitfall 4: The Existing i18n System Cannot Scale to Marketing Copy Without Structural Debt

**What goes wrong:**
The current `lib/i18n.ts` is a hand-rolled TypeScript `Record<Locale, Messages>` object with deeply-nested keys. It already contains ~300 strings across three locales. Adding a full marketing site (hero section, features section, social proof, onboarding explanation, CTA copy, legal disclaimers) adds another ~200-400 strings. The existing system has three concrete problems at this scale:

1. **Key drift is undetected at build time.** If the `ja` or `zh-TW` translation object is missing a key that `en` has, TypeScript only detects it if `Messages` type is fully enforced. Looking at the current code, the `Messages` type IS enforced — but only for keys explicitly declared in the `Messages` type. If a developer adds a new marketing key to `en` but forgets to add it to the `Messages` type first, it compiles without error and the key silently falls back to the raw key string at runtime.

2. **Translation file becomes a merge conflict magnet.** At 500+ strings in a single file, two developers working on different sections will collision on the `messages` object in every PR.

3. **No namespace isolation.** Marketing copy and fan-chat copy share the same flat namespace. A refactor of marketing keys risks touching the fan-page copy that is already in production.

**Why it happens:**
The hand-rolled system was correct for 300 strings. It does not scale to a second major content domain (marketing) without architectural change. Developers copy-paste an existing key structure rather than introducing a namespace.

**How to avoid:**
Do NOT add marketing strings inline to `lib/i18n.ts`. Instead, introduce a `marketing` namespace as a separate export. Two valid approaches:

Option A (minimal change): Add a `marketing: { ... }` section to the `Messages` type and the three locale objects. Keep the single file but use TypeScript's `satisfies` operator to validate completeness: `const messages = { en: {...}, ja: {...}, 'zh-TW': {...} } satisfies Record<Locale, Messages>`. This catches missing keys at compile time.

Option B (recommended if i18next is being introduced anyway per CLAUDE.md stack): Move marketing copy to i18next JSON files in `src/locales/marketing/{en,ja,zh-TW}.json`. This enables lazy-loading (marketing copy is not downloaded by fans on the fan page), type-safe keys via `i18next-resources-to-ts`, and standard tooling for translation workflows.

**Warning signs:**
- A marketing section renders with raw key strings like `marketing.hero.tagline` in any locale.
- PR diff shows modifications to `lib/i18n.ts` touching both `fan.` and new marketing keys simultaneously — namespace collision risk.
- The `ja` or `zh-TW` locale objects are shorter than `en` by any key count.

**Phase to address:**
Phase 1 (scaffold) — the i18n architecture decision must precede writing any marketing copy string.

---

### Pitfall 5: Telegram Deep-Link CTA Fails on Mobile Without Telegram Installed, and on Desktop Requires an Extra Click

**What goes wrong:**
The primary CTA routes creators to the Hermes bot via a Telegram deep-link. The standard format is `https://t.me/HermesBotUsername?start=PAYLOAD`. On mobile with Telegram installed, this opens the bot correctly. Two failure modes:

**Failure A — No Telegram installed (mobile):** The `https://t.me/` URL loads a Telegram web page with an "Open in Telegram" button. On iOS Safari, if Telegram is not installed, this page redirects to the App Store. The creator sees a confusing interstitial rather than the onboarding flow. No fallback message is shown.

**Failure B — Desktop:** Clicking a `t.me` link in a desktop browser opens Telegram Web by default, not the desktop app. Telegram Web has functional limitations for bot interactions. If the creator has Telegram Desktop installed, she may want that. The `tg://resolve?domain=BotUsername&start=PAYLOAD` deep-link scheme opens the desktop app directly but does not work on mobile browsers.

A related failure: the start payload is URL-encoded incorrectly. Telegram's `start` parameter must be alphanumeric + underscores only (max 64 chars). If a locale string, referral token, or UTM parameter is passed as the `start` payload without stripping non-alphanumeric characters, the bot receives a malformed or truncated payload and the onboarding state machine cannot initialize correctly.

**Why it happens:**
Developers test on a device with Telegram installed and the happy path works. They do not test the no-Telegram path. The start payload encoding constraint is easy to miss.

**How to avoid:**
Use the `https://t.me/BotUsername?start=PAYLOAD` format (not the `tg://` scheme) as the CTA href — it works across all surfaces. Add a visible fallback below the CTA button: "Don't have Telegram? [Download it here]" linking to telegram.org. For the start payload: limit it to a short alphanumeric token (`lala_onboard` or a creator-specific slug), never a free-form string. Do not pass UTM parameters in the start payload — use the link URL itself for UTM tracking instead. Test the CTA link on: iOS Safari without Telegram, Android Chrome without Telegram, macOS Chrome with and without Telegram Desktop.

**Warning signs:**
- The CTA is an `<a href="tg://resolve?domain=...">` link — this scheme is not universally supported and breaks on many Android browsers.
- The start payload contains characters outside `[a-zA-Z0-9_-]`.
- No "Download Telegram" fallback visible anywhere near the CTA.

**Phase to address:**
Phase 2 (CTA implementation) — test matrix must be defined before the CTA goes live.

---

### Pitfall 6: Marketing Page Implicitly Makes Claims That Trigger SB 243 or FTC Liability

**What goes wrong:**
Marketing copy for an AI-companion service is uniquely regulated. Three categories of claim create legal exposure:

**Overclaiming human-likeness:** Phrases like "Fans will think they're talking to the real you," "Indistinguishable from a real conversation," or "Your fans won't know the difference" are not just puffery — under SB 243, an operator that presents a companion chatbot as human to a user who sincerely asks "Are you a real person?" is in violation. If the marketing page primes users to expect a human-like interaction, it strengthens the argument that the operator intended to deceive.

**Failing to disclose AI on the public marketing page:** SB 243 requires disclosure in "the application, the browser, or any other format" that the user accesses the chatbot. A public marketing page that recruits fans to chat with a creator twin should carry a disclosure that the twin is AI-generated, not just a disclaimer buried in Terms. The FTC's 2025 guidance on AI chatbot marketing specifically calls out companies that imply human interaction in promotional material.

**Using a creator's name or likeness in marketing materials without explicit scope in the consent agreement:** The current consent flow authorizes AI twin operation for fan engagement. Using Claire's name, handle, face, or voice in a public marketing page (e.g., "Powered by [Claire's name]" with a screenshot) may require a separate publicity-rights authorization for promotional use. The current consent agreement covers "operation of the AI twin" but may not cover "use of creator likeness in lala.la marketing materials."

**Why it happens:**
Marketing copy is written to be persuasive. Developers and founders without legal background write what makes the product sound compelling without checking whether the phrasing creates liability. The existing compliance work (SB 243 disclosure in the fan page) is correctly implemented but the marketing page is net-new and starts with zero compliance review.

**How to avoid:**
Approved phrasing pattern: "Your AI twin — built from your voice, your words, your style. Fans know it's AI; that's what makes it authentic." This conveys the value without implying deception. The marketing page must carry a visible "lala.la creates AI-powered digital twins. All twins are clearly disclosed as AI to fans." statement, not just in the footer ToS link. Do not use a specific creator's name, photo, or voice sample in marketing materials without written authorization for promotional use separate from the operational consent already in place. The existing consent grants lala.la a license for "operating the AI twin" — promoting the service is a different use.

**Warning signs:**
- Copy review draft contains phrases: "fans won't know," "just like talking to [name]," "indistinguishable," "real conversation."
- Marketing page hero uses a creator's actual face from her onboarded photos without a separate marketing-use authorization.
- No AI-disclosure statement visible above the fold on the marketing page.

**Phase to address:**
Phase 1 (copy/content planning) — all marketing copy must pass a compliance review before any component is built around it. The disclosure statement placement must be a design requirement from the start.

---

## Moderate Pitfalls

### Pitfall 7: CJK Font Loading Causes LCP Failure and Invisible Text on First Paint

**What goes wrong:**
The current `index.html` loads only `Inter` from Google Fonts — a Latin-only typeface. The marketing site needs to render Japanese and Traditional Chinese. If no CJK font is explicitly loaded, browsers fall back to system fonts, which vary wildly: Japanese iOS uses Hiragino, Windows uses Meiryo or Yu Gothic, Android uses Noto Sans CJK. The visual design breaks across platforms.

If a CJK web font IS loaded (e.g., Noto Sans JP), the default behavior is FOIT (Flash of Invisible Text): the text is hidden until the font downloads. A full Noto Sans JP file is 3-8MB. On a mobile connection, the hero headline in Japanese is invisible for 3-10 seconds. This directly tanks the LCP (Largest Contentful Paint) metric and increases bounce rate on exactly the mobile JP/TW audience this site targets.

**Why it happens:**
Developers add `<link href="Google Fonts Noto Sans JP">` to `index.html` and test on a fast connection. The font loads fast enough that FOIT is invisible. On a JP mobile carrier connection (3G or congested 4G), the FOIT window is 3-10 seconds — users see blank headings.

**How to avoid:**
Use `font-display: swap` for all CJK fonts — this shows a system font fallback immediately and swaps in the loaded font. Acceptable visual shift is better than invisible text. Use Google Fonts' `display=swap` URL parameter, or set `font-display: swap` in your `@font-face` declarations.

Do NOT load the full Noto Sans JP weight set. Use `text=` subsetting (Google Fonts API parameter) to load only the characters actually present in the marketing copy. Alternatively, use `unicode-range` in `@font-face` to let the browser download only the subsets needed for visible characters.

Load CJK fonts using `<link rel="preload">` for the first-screen locale. Since locale is URL-determined (`/ja/...`), the server (or a prerender build step) can inject the correct `<link rel="preload">` for each locale's HTML.

**Warning signs:**
- Google Fonts link in `index.html` for a full Noto Sans JP weight without `display=swap` or `text=` subsetting.
- Lighthouse audit shows "Eliminate render-blocking resources" flagging the CJK font link.
- Test on Chrome DevTools with "Slow 3G" — hero text should show system font fallback, not blank space.

**Phase to address:**
Phase 2 (marketing page build) — font strategy must be decided before the first hero component ships.

---

### Pitfall 8: CJK Text Breaks Mid-Word Creating Illegible Headings

**What goes wrong:**
Japanese and Traditional Chinese do not use spaces between words, so the default CSS line-break algorithm can split a compound word or phrase at any character boundary. A hero headline like "AIで生まれる、リアルなあなた" can break after "AIで" on narrow mobile viewports, splitting the phrase at a grammatically nonsensical boundary. For marketing copy where every word is deliberate, mid-compound breaks destroy the message.

A second issue: marketing sections often use `whitespace-nowrap` or fixed-width containers to control English layout. In Japanese/Chinese, these constraints cause text overflow — CJK characters have no spaces, so there are no break opportunities, and a long Japanese phrase in a `max-w-xs` container bleeds out of its box.

**Why it happens:**
The developer writes and tests copy in English. English line-breaking is word-boundary-aware. CJK line-breaking is character-boundary-aware. Without explicit CSS, the browser uses the character-boundary default, which is often wrong for Japanese.

**How to avoid:**
Apply `word-break: auto-phrase` (Chrome 119+, backed by BudouX ML model) for Japanese and Chinese headings. For maximum compatibility, use the `budoux` JS library to insert zero-width space hints in JP/ZH text at natural phrase boundaries before rendering. Add `line-break: strict` for Japanese to prevent breaks before punctuation.

Set `overflow-wrap: break-word` on all text containers (especially marketing cards and feature blurbs) so that neither CJK phrases nor long English URLs overflow their containers. Never use `whitespace-nowrap` on a container that may contain CJK text.

Line height for CJK: set to 1.7-1.8em (vs. ~1.4-1.5em for Latin). CJK characters are square and feel cramped at Latin line-height values.

**Warning signs:**
- Hero headline in Japanese breaks mid-compound-word on an iPhone SE viewport.
- Any text overflow (horizontal scroll) on the `375px` viewport width in ja or zh-TW locale.
- CJK text using the same `leading-relaxed` (1.625rem) Tailwind class as English — needs to be higher.

**Phase to address:**
Phase 2 (marketing page build) — define a locale-aware typography utility before the first CJK component.

---

### Pitfall 9: hreflang Tags Are JavaScript-Injected and Therefore Invisible to Search Engines

**What goes wrong:**
The SPA currently serves a single `index.html` for all paths. If `react-helmet-async` or equivalent is used to inject `<link rel="alternate" hreflang="...">` tags for locale variants, those tags are injected by JavaScript — they are not present in the raw HTML. Google's crawler does not reliably execute JavaScript for hreflang discovery. The result: Google serves the wrong locale to users, or treats `/en`, `/ja`, and `/zh-TW` as duplicate content and consolidates them into a single URL.

For a multilingual marketing site targeting JP/TW creators, wrong-locale serving (JP creator sees English page) is a direct conversion-rate failure.

**Why it happens:**
SPAs rely on React to "set" head tags. The HTML template is one file. Hreflang tags belong in static `<head>` HTML, not in a JavaScript component lifecycle.

**How to avoid:**
If using the build-time pre-render approach (Pitfall 1's Option A): the pre-render step for each locale (`/en`, `/ja`, `/zh-TW`) injects the full hreflang set into the HTML output for that route. Each locale's HTML gets the correct set of three `<link rel="alternate">` tags pointing to the other two.

If not pre-rendering: the `index.html` template must include all three hreflang tags statically, since the same shell is served for all paths. This is imperfect but better than JS-injected tags.

XML sitemap approach: as a supplement, add an XML sitemap at `/sitemap.xml` that declares all three locale URLs with their hreflang relationships. Google reads the sitemap even when it cannot fully render JS. For a small marketing site (3 locales × ~5 pages = 15 URLs), the sitemap can be a static file.

**Warning signs:**
- Google Search Console shows "Alternate page with proper canonical tag" warnings for the locale pages.
- Running `curl https://lala.la/ja | grep hreflang` returns nothing.
- Google serves the English page to a Japanese user who typed the `/ja` URL directly.

**Phase to address:**
Phase 1 (scaffold) — part of the same pre-render/hreflang decision as Pitfall 1.

---

### Pitfall 10: Hero Video/Animation Prevents LCP and Causes Layout Shift on iOS

**What goes wrong:**
The marketing brief calls for an "engaging, mobile-first" design. This often leads to a hero section with an autoplaying video background, a Framer Motion entrance animation that delays the hero headline, or a large WebGL canvas. Any of these causes:

- **LCP failure:** The LCP element (largest contentful paint — usually the hero headline or hero image) is hidden behind an animation or waiting for a video to load. Google's Core Web Vitals use LCP as a ranking signal. A hero animation that delays the `h1` from rendering for 800ms is enough to push LCP from "Good" (< 2.5s) to "Needs Improvement."

- **iOS autoplay block:** Safari on iOS requires `muted` AND `playsinline` attributes for video to autoplay. Missing either attribute causes the video to not play at all, leaving a blank hero area. On slower connections, even with the correct attributes, the video may not load before the user scrolls past it.

- **Layout Shift (CLS):** If the hero image or video dimensions are not explicitly set in CSS (via `aspect-ratio` or explicit `width`/`height`), the browser does not know the element's dimensions before it loads, causing a layout shift when it loads. This is especially common with dynamically loaded images (Replit Object Storage signed URLs).

**Why it happens:**
Framer Motion entrance animations are easy to add and look impressive in local dev. The performance cost only appears on real mobile devices on real connections. Video autoplay attributes are easy to forget.

**How to avoid:**
No Framer Motion `initial` state that hides the LCP element (`opacity: 0`, `y: -20`, etc.) — animations must start from the visible state, not animate into visibility. If animations are desired, use CSS transitions with `prefers-reduced-motion` support.

If a background video is used: set `muted`, `playsinline`, `autoplay`, `loop` attributes; set explicit `width="100%"` and `aspect-ratio: 16/9` on the container so the layout does not shift on load; provide a static poster image as the `poster` attribute so iOS users on slow connections see something.

All hero images: set explicit dimensions or `aspect-ratio` in CSS. Load via `<img loading="eager" fetchpriority="high">` for the above-the-fold hero image.

Target: LCP < 2.5s on Moto G4 (simulated in Chrome DevTools), CLS < 0.1.

**Warning signs:**
- Framer Motion `initial={{ opacity: 0 }}` on the hero `<h1>` or hero image.
- `<video>` tag missing `playsinline` attribute.
- Hero image served without explicit dimensions, causing layout shift on load.
- Lighthouse mobile score below 75.

**Phase to address:**
Phase 2 (marketing page build) — performance budget must be defined before hero design is finalized.

---

### Pitfall 11: Shared Bundle Bloat — Marketing Assets Downloaded by Every Fan

**What goes wrong:**
`artifacts/web` is a single Vite build. All code — the fan chat page, the marketing site, all component libraries — is bundled together. If the marketing site adds:
- A heavy animation library (e.g., GSAP, lottie-react)
- A large hero image or video as a bundled import
- Additional Radix UI primitives not used by the fan page
- New i18n JSON files for marketing copy not needed by fans

...then every fan who visits `lala.la/en/claire` downloads the marketing bundle too. A fan who never sees the marketing page pays the network cost of it. At N=1 this is invisible, but it is a design debt that compounds with each marketing section added.

The current bundle has no code-splitting for routes — a fan visiting `/ja/claire` downloads the code for `OnboardStep1`, `OnboardStep2`, `OnboardStep3`, `DsarPortal`, `CreatorDashboard`, and now the entire marketing site. This is an architectural issue, not just a marketing-site issue, but adding a large marketing design system is the moment it becomes visible.

**Why it happens:**
Single-SPA architecture is simple and Vite's default bundling keeps everything together. Route-level code splitting requires explicit `React.lazy()` and `Suspense` wrapping. Developers skip this because it adds complexity.

**How to avoid:**
Use `React.lazy()` + `Suspense` for every page component in `App.tsx`. This is the minimum viable code split: each page becomes a separate chunk, downloaded only when its route is visited. The fan page chunk must NOT include any marketing component imports.

For the marketing design system: if it uses different component primitives than the fan page, keep them in a separate directory (`src/components/marketing/`). Do not re-export marketing components from the fan component index.

For marketing i18n: if using separate JSON files (the Option B from Pitfall 4), ensure they are loaded lazily via i18next's `HttpBackend` or dynamic `import()` — not bundled into the main chunk.

**Warning signs:**
- `App.tsx` imports `HomePage` (marketing) with a static `import` rather than `React.lazy(() => import('./pages/home'))`.
- Vite build output shows a single chunk > 500KB.
- A Lottie animation JSON or GSAP import appears in the top-level bundle.

**Phase to address:**
Phase 1 (scaffold) — set up `React.lazy` for all pages as a baseline before any new page is added.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Add marketing strings to `lib/i18n.ts` inline | No new files, fast to write | Single file becomes unmaintainable; merge conflicts on every PR; no lazy-loading | Never — introduce a `marketing` namespace from the start |
| Skip pre-render, rely on JS-injected meta tags | No build pipeline change | Zero social-card previews; zero Google indexing of marketing copy | Never — pre-render is mandatory for a public marketing page |
| Use static imports for all page components | Simpler `App.tsx` | Fans download marketing code on every visit | Acceptable only for pages under ~10KB; unacceptable for a full marketing site |
| Ignore `font-display: swap` for CJK fonts | Correct brand font always shown | FOIT / invisible text for 3-10s on mobile; high bounce rate in target markets | Never — `swap` is the correct default |
| Global CSS for marketing styles | Fast to write | Bleeds into fan page via Tailwind layer conflicts | Never — use `.marketing-root` scoping |
| Use creator's name/photo in hero without separate marketing-use clause | Compelling landing page | Personality-rights claim; consent mismatch | Never — get separate written authorization |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Telegram deep-link CTA | Using `tg://resolve?domain=...` scheme in `<a href>` | Use `https://t.me/BotName?start=PAYLOAD`; add visible "Download Telegram" fallback |
| Telegram start payload | Passing locale or UTM data in `?start=` parameter | Keep start payload to `[a-zA-Z0-9_-]` alphanumeric token only; use URL-level UTM params |
| Google Fonts CJK | Loading full font weight set without `text=` or `unicode-range` | Subset to visible characters; use `display=swap`; `<link rel="preload">` for first-screen locale |
| Framer Motion hero | `initial={{ opacity: 0 }}` on the hero headline | Animate non-LCP elements only; or use CSS transitions from visible state with `prefers-reduced-motion` check |
| wouter route order | Adding `/:locale/new-section` below `/:locale/:handle` | All named marketing sub-routes must appear above the fan handle catch-all in the `Switch` |
| Tailwind v4 + third-party CSS | Adding unlayered CSS (from animation libs) after `@import "tailwindcss"` | Wrap all non-Tailwind CSS in `@layer` blocks; scope marketing styles under `.marketing-root` class |
| OG image URL | Generating OG image path dynamically in JS | OG image must be a static asset at a known public URL before any link is shared; pre-render or middleware required |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full CJK font without subsetting | 3-8MB font download; FOIT for 3-10s on mobile | `text=` subsetting on Google Fonts; `unicode-range` in `@font-face`; `font-display: swap` | Every page load on mobile JP/TW |
| Hero video without `poster` + explicit dimensions | Blank hero area on iOS; CLS score > 0.25 | `poster` static image; explicit `aspect-ratio` on container; `muted playsinline autoplay loop` | Every iOS visit |
| Framer Motion on LCP element | LCP > 4s; poor Google ranking | Animate only below-fold or non-LCP elements; set `prefers-reduced-motion: reduce` media query | Every mobile visit with slow CPU |
| No `React.lazy` code splitting | Fan page bundle includes all marketing code | Lazy-load every page component in `App.tsx` | Becomes visible when marketing bundle > 200KB |
| Static import of marketing i18n into main chunk | Fans download all three locales of marketing copy | Lazy-load locale files per route via i18next `HttpBackend` | Every fan page visit |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Using creator's actual photos from Replit Object Storage as OG images without access control review | Public URL exposes consented-but-private assets | Use dedicate public-CDN assets for marketing; keep uploaded creator photos in private bucket |
| Putting UTM/tracking parameters in Telegram `?start=` payload | Bot receives tracking data; payload might be logged as user input | UTM lives in the landing page URL only; `?start=` carries only a short opaque token |
| Marketing page bypasses the `creator_kyc` gate for the fan route | Not a security issue for the marketing page itself, but a route-ordering bug could serve the fan page without the gate | Route ordering test (Pitfall 2) catches this |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| CTA says "Start on Telegram" with no explanation | JP/TW creators unfamiliar with bot onboarding abandon CTA | Show a 3-step visual: "Click → Bot opens → Answer 5 questions" before the CTA button |
| Locale switcher missing on marketing page | Japanese creator lands on `/en` and cannot find Japanese version | Persist the `LocaleSwitcher` component (already exists) in the marketing page nav |
| Marketing page has no link to `lala.la/[handle]` demo | Creator cannot see what their fans will experience | Add a "See a live demo" link to a publicly visible twin (requires one public creator twin) |
| `prefers-reduced-motion` not respected | Vestibular disorder users experience motion sickness from hero animation | All Framer Motion animations must check `useReducedMotion()` from Framer Motion's API |

---

## "Looks Done But Isn't" Checklist

- [ ] **OG tags visible:** Run `curl -A "Twitterbot" https://lala.la/ja` — response HTML must contain `og:title` with Japanese copy, not the placeholder "7of1" string.
- [ ] **Fan route unaffected:** Visit `/en/features` — must render the marketing Features section, NOT the fan 404 state.
- [ ] **Telegram CTA without Telegram installed:** Test on iOS Safari without Telegram installed — must show "Download Telegram" fallback, not a broken link.
- [ ] **CJK font fallback visible:** Test on Chrome DevTools "Slow 3G" — Japanese/Chinese hero text must show system font fallback immediately, not blank space.
- [ ] **Hreflang in HTML source:** `curl https://lala.la/en | grep hreflang` must return all three locale `<link>` tags in the raw HTML (not injected by JS).
- [ ] **AI disclosure on page:** Marketing page must contain a visible AI-companion disclosure statement above the fold or at minimum in a clearly visible secondary position — not buried in footer links.
- [ ] **Route conflict test:** Verify that navigating to every marketing sub-route does not trigger a fan-page API call to `/api/twin/[section-name]`.
- [ ] **No creator name/photo without marketing authorization:** Confirm that any creator asset used in marketing copy has explicit written authorization for promotional use separate from the operational consent.
- [ ] **Tailwind fan-page regression:** After adding marketing CSS, verify the fan chat page at `/en/claire` (or equivalent) renders with correct fonts and colors — no style bleed.
- [ ] **Bundle size check:** After marketing site is built, run `pnpm --filter @workspace/web run build` and confirm the fan-page route chunk has not grown by more than 10KB.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Social card meta tags missing at launch | MEDIUM | Add middleware or pre-render step; wait 2-7 days for social crawlers to re-cache; manually trigger re-scrape via Twitter Card Validator and Facebook Sharing Debugger |
| Fan route breaks after marketing route added | LOW | Fix route ordering in `App.tsx` Switch; no backend change needed; deploy takes minutes |
| Tailwind CSS bleed from marketing into fan page | MEDIUM | Scope all marketing CSS under `.marketing-root`; audit and move any global overrides; may require testing every fan page state |
| Creator's likeness used in marketing without proper authorization | HIGH | Remove immediately; request written authorization or replace with generic AI-illustration; legal review required before re-adding |
| CJK font FOIT at launch | LOW | Add `display=swap` parameter to Google Fonts URL; deploy; takes effect immediately |
| Telegram deep-link broken | LOW | Update `href` to correct format; add fallback text; deploy in minutes |
| Marketing copy flagged as non-compliant | HIGH | Take page offline or replace with placeholder; legal review cycle (days to weeks); rewrite copy to approved pattern |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Social card / OG meta tag invisibility | Phase 1 scaffold | `curl -A "Twitterbot" https://lala.la/ja` returns correct OG title in raw HTML |
| Fan route conflict from new marketing routes | Phase 1 scaffold | Automated route test: `/en/features` does not trigger `/api/twin/features` call |
| Tailwind v4 cascade layer bleed | Phase 1 scaffold | Fan page visual regression test after any marketing CSS is added |
| i18n architecture decision | Phase 1 scaffold | All three locales pass `satisfies Record<Locale, Messages>` TypeScript check with zero missing keys |
| Telegram CTA failure modes | Phase 2 CTA build | Manual test on iOS without Telegram; `?start=` payload is alphanumeric-only |
| AI-disclosure missing on marketing page | Phase 1 copy/design | Compliance review sign-off before any content ships; disclosure visible in rendered page |
| Creator likeness without marketing authorization | Phase 1 content planning | Written marketing-use authorization on file before any creator asset appears on the page |
| CJK font FOIT | Phase 2 build | Lighthouse mobile test on Slow 3G; LCP < 3s for ja and zh-TW locales |
| CJK text line-break errors | Phase 2 build | Visual QA at 375px viewport for all CJK marketing copy; no mid-compound breaks |
| hreflang JavaScript injection | Phase 1 scaffold | `curl https://lala.la/en | grep hreflang` returns tags in raw HTML |
| Hero media LCP failure | Phase 2 build | Lighthouse CWV: LCP < 2.5s mobile, CLS < 0.1 |
| Bundle bloat from marketing assets | Phase 1 scaffold | Vite build output: fan-page chunk does not contain marketing component code |

---

## Sources

- SPA prerendering for SEO: [vite-prerender-plugin on npm](https://www.npmjs.com/vite-prerender-plugin), [Stacknaut — Vue Prerendering without SSR](https://stacknaut.com/articles/vue-prerendering-without-ssr), [DEV.to — SEO in React+Vite](https://dev.to/ali_dz/optimizing-seo-in-a-react-vite-project-the-ultimate-guide-3mbh)
- OG social card pitfalls: [CyberCraft — Open Graph React SEO](https://ccbd.dev/blog/open-graph-react-seo-fix-social-previews-and-add-og-meta-tags-2026-guide), [VibieIt Blog — Dynamic OG Tags with Vite](https://blog.vibeit.hr/blog/dynamic-og-tags)
- Hreflang in SPAs: [Search Engine Journal — Common Hreflang Mistakes](https://www.searchenginejournal.com/ask-an-seo-what-are-the-most-common-hreflang-mistakes/556455/), [Weglot — Hreflang Guide](https://www.weglot.com/guides/hreflang-tag), [gracker.ai — Hreflang Challenges](https://gracker.ai/seo-101/hreflang-implementation-challenges-solutions)
- CJK typography and line breaking: [Typotheque — Typesetting CJK](https://www.typotheque.com/articles/typesetting-cjk-text), [ryelle.codes — Typography troubles in Japanese](https://ryelle.codes/2025/04/typography-troubles-balancing-in-japanese-korean/), [Chrome Developers — CSS i18n features](https://developer.chrome.com/blog/css-i18n-features), [codestudy.net — Japanese line break in HTML/CSS](https://www.codestudy.net/blog/in-html-and-css-how-do-i-make-japanese-text-break-lines-correctly/)
- Font loading performance: [Jono Alderson — Loading fonts wrong](https://www.jonoalderson.com/performance/youre-loading-fonts-wrong/), [Asian Absolute — CJK Typesetting 2025](https://asianabsolute.co.uk/blog/cjk-typesetting-challenges-workflows-and-best-practices/)
- Tailwind v4 cascade layers: [Tailwind v4 blog post](https://tailwindcss.com/blog/tailwindcss-v4), [GitHub discussion — opt out of native cascade layers](https://github.com/tailwindlabs/tailwindcss/discussions/13188), [Livewire Flux issue — v4 incompatibility](https://github.com/livewire/flux/issues/783), [CSS-Tricks — Cascade Layers with Tailwind](https://css-tricks.com/using-css-cascade-layers-with-tailwind-utilities/)
- Telegram deep links: [Telegram official deep links API](https://core.telegram.org/api/links), [Telegram desktop start parameter issue #27064](https://github.com/telegramdesktop/tdesktop/issues/27064)
- Hero video performance: [Aaron Grogg — LCP for Video Heroes](https://aarontgrogg.com/blog/2026/01/06/improving-lcp-for-video-hero-components/), [Mux — Video playback best practices 2025](https://www.mux.com/articles/best-practices-for-video-playback-a-complete-guide-2025), [Simon Hearne — Fast responsive videos](https://simonhearne.com/2021/fast-responsive-videos/)
- AI companion marketing / SB 243 compliance: [National Law Review — SB 243 private lawsuits](https://natlawreview.com/article/when-ai-feels-human-californias-sb-243-opens-door-private-lawsuits), [DLA Piper — FTC AI chatbots](https://www.dlapiper.com/en-us/insights/publications/2025/09/ftc-ai-chatbots), [Cooley — AI chatbots crossroads](https://www.cooley.com/news/insight/2025/2025-10-21-ai-chatbots-at-the-crossroads-navigating-new-laws-and-compliance-risks), [Troutman Privacy — New AI companion chatbot laws](https://www.troutmanprivacy.com/2026/01/analyzing-the-new-ai-companion-chatbot-laws/)
- Creator likeness / marketing authorization: [ArentFox Schiff — AI avatars legal risks](https://www.afslaw.com/perspectives/alerts/the-business-ai-avatars-key-legal-risks-and-best-practices), [Traverse Legal — AI twins legal risks](https://www.traverselegal.com/blog/ai-avatar-legal-risks/), [Influencers-time — AI likeness disclosure rules 2026](https://www.influencers-time.com/ai-likeness-rules-2026-disclosure-guide-for-marketers/)
- i18next type safety: [i18next TypeScript docs](https://www.i18next.com/overview/typescript), [Locize blog — i18next TypeScript](https://www.locize.com/blog/i18next-typescript/), [Zwyx — Type-safe translations](https://zwyx.dev/blog/typesafe-translations)
- wouter routing: [wouter GitHub](https://github.com/molefrog/wouter), [wouter issue #464 — Switch back button](https://github.com/molefrog/wouter/issues/464)

---

*Pitfalls research for: Adding localized Vite SPA marketing site to lala.la*
*Researched: 2026-05-30*
