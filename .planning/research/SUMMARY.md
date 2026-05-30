# Project Research Summary

**Project:** lala.la — Milestone v2.0 Marketing Site
**Domain:** Localized public marketing site added to an existing Vite + React 19 SPA
**Researched:** 2026-05-30
**Confidence:** HIGH

---

## Executive Summary

The v2.0 marketing site replaces an 8-line placeholder at the locale root (`/:locale`) of the existing `artifacts/web` SPA with a polished, multi-section, three-locale (EN/JA/ZH-TW) marketing page. This is entirely a frontend change — no backend modifications, no new artifact, no new port. The work lives inside one existing file (`src/pages/home.tsx`) and a new `src/components/marketing/` subtree. Net-new packages are minimal: self-hosted Inter and Noto Sans JP fonts, `vite-plugin-sitemap` for build-time sitemap generation, and optionally `react-helmet-async` v3. The milestone is tightly scoped — no pricing page, no signup form, no analytics, no creator dashboard link — and the single conversion goal is a Hermes Telegram deep-link CTA.

The most critical decision for this milestone is the SEO/OG meta approach, and it must be made before writing a single component. Social card scrapers do not execute JavaScript; a React-injected `<meta property="og:image">` is invisible to LINE, Slack, Twitter/X, and WeChat — the exact channels JP/TW creators use to share links. The correct approach for this project is static-asset SEO: update `index.html` with real marketing meta tags, commit a static `og-marketing.png` (1200×630) to `public/`, add a static `sitemap.xml` and `robots.txt` to `public/`, and add all three hreflang `<link>` tags directly in `index.html`. This covers the primary use case with zero server-side complexity. The Express bot-detect middleware option floated in STACK.md is a valid future enhancement but introduces a backend touch in what is explicitly a frontend-only milestone — defer it.

The two highest-leverage risks are CSS isolation and route-ordering. The fan page (`/:locale/:handle`) and the marketing page (`/:locale`) share one Vite build and one `index.css`. Without a hard `[data-surface="marketing"]` scope on all marketing CSS tokens, dark-mode fan-page variables contaminate marketing components. Without all marketing named sub-routes placed above the `/:locale/:handle` catch-all in the wouter `Switch`, marketing section paths silently render as fan-page 404 states. Both must be locked in Phase 1 before any section component is written.

---

## Key Findings

### Recommended Stack

The stack is almost entirely the existing `artifacts/web` package. Four additions are needed: `@fontsource-variable/inter` and `@fontsource-variable/noto-sans-jp` to replace the Google Fonts CDN link (privacy, latency, and CJK coverage); `vite-plugin-sitemap` as a devDependency; and optionally `react-helmet-async` v3 for `<html lang>` attribute switching. All animation, component, and utility libraries needed (Framer Motion, Radix UI, embla-carousel, tw-animate-css, lucide-react) are already installed.

The i18n approach is unambiguous: do NOT install i18next. The existing `lib/i18n.ts` hand-rolled typed `Messages` record is extended with a `marketing` namespace, protected by TypeScript's `satisfies Record<Locale, Messages>` operator for compile-time key completeness. Adding i18next would create two competing i18n systems with no benefit for 60-80 static strings across 3 locales.

**Core technologies:**
- `@fontsource-variable/inter` ^5.x — self-hosted Inter; removes Google Fonts CDN latency; variable font covers EN weight range in one file
- `@fontsource-variable/noto-sans-jp` ^5.x — CJK coverage for JA + ZH-TW; Inter has zero CJK glyphs; must use `font-display: swap` and preload the 400-weight woff2 to prevent 3-10s FOIT on mobile
- `vite-plugin-sitemap` ^0.7.x — build-time `sitemap.xml` + `robots.txt`; zero runtime cost
- Static files in `public/`: `og-marketing.png`, `sitemap.xml`, `robots.txt` — the correct SEO approach for a frontend-only milestone
- Existing: Framer Motion `whileInView` + `viewport={{ once: true }}`; Radix UI navigation menu; embla-carousel for mobile pillars; `tw-animate-css` for simple fades

**Do NOT add:** i18next/react-i18next; Express bot-detect OG middleware (deferred); react-helmet-async (optional); GSAP/lottie/react-spring; any SSR framework.

### Expected Features

The audience is non-technical JP/TW/HK creators (17 LIVE streamers, Fanvue/Patreon), mobile-first (80%+ mobile), high uncertainty-avoidance, and already on Telegram daily.

**Must have (table stakes):**
- Hero: localized headline + sub-head + single Hermes Telegram CTA + hero visual (static chat animation)
- Value proposition block: three-benefit layout (chat/voice/multi-channel), outcome-focused copy
- Four generative pillars: chat/voice/image-coming-soon/video-coming-soon
- "How it works" — 3-step managed onboarding; no technical jargon; managed service framing throughout
- Multi-channel deployment story: lala.la + Telegram + own socials
- Static demo transcript card per locale
- Repeated CTA at hero, mid-page, and footer
- Responsive mobile-first layout
- EN/JA/ZH-TW full localization
- Footer: company name, contact email, privacy policy link, AI disclosure notice
- Visible AI companion disclosure statement (SB 243; not just in footer ToS link)

**Should have (differentiators):**
- "Managed service" framing throughout — competitors are self-serve; this is the gap
- Social proof block with creator quote (placeholder acceptable at launch)
- Creator ownership/portability callout ("your data is yours, non-exclusive license")
- Safety one-liner: "all twins pass a 30-case safety review before going live"
- Locale-adaptive CTA copy — culturally tuned, not just translated (JA: 敬語 register)

**Defer to v2.x / v3+:** pricing page; self-serve signup form; blog/FAQ; live demo widget; animated video hero; analytics; social media links; OG tags per locale beyond static `index.html`.

### Architecture Approach

The marketing site is not a new artifact. It is `src/pages/home.tsx` replaced plus a new `src/components/marketing/` subtree within `artifacts/web`. Route registration in `App.tsx` is unchanged — only the component imported at `/:locale` is swapped. Fan route safety is structural: `/:locale/:handle` only matches with two path segments, so the marketing route cannot conflict — as long as no new marketing routes are added as `/:locale/:thing` (those would collide and must be enumerated above the fan catch-all).

**Major components:**
1. `lib/i18n.ts` (modified) — `marketing` namespace added to `Messages` type; `satisfies Record<Locale, Messages>` enforced; ~60-80 new strings; keep inline unless file exceeds ~800 lines
2. `src/components/marketing/` (new) — isolated design system; components receive `t: Messages["marketing"]` as prop; none touch fan-page CSS variables
3. `src/index.css` (modified) — `@layer marketing-tokens` with `[data-surface="marketing"]` scoped `--mkt-*` tokens; zero leakage to fan page
4. `index.html` (modified) — real marketing title, description, `og:*` tags, all three hreflang links statically in `<head>`; `public/og-marketing.png` committed
5. `src/pages/home.tsx` (replaced) — `MarketingPage` shell; calls `getMessages(locale).marketing` once; wraps content in `<div data-surface="marketing">`

### Critical Pitfalls

1. **Social card OG tags invisible to crawlers** — Prevent by updating `index.html` with static marketing meta and committing `public/og-marketing.png`. Verify: `curl -A "Twitterbot/1.0" https://lala.la/en` must return real `og:title`. Express bot-detect middleware is deferred.

2. **Fan-page CSS contamination from marketing token leakage** — Prevent by scoping ALL marketing CSS under `[data-surface="marketing"]` in `@layer marketing-tokens`. Never use `--primary`, `--background`, or any fan-page variable inside marketing components. Verify with visual regression on fan chat page after every marketing CSS commit.

3. **i18n missing-key bugs in JA/ZH-TW** — Prevent by adding the `marketing` namespace as a typed `Messages` extension with `satisfies Record<Locale, Messages>`. TypeScript won't compile if any locale is missing any key.

4. **CJK font FOIT (3-10s invisible text on mobile)** — Prevent with `font-display: swap` (Fontsource includes this), `<link rel="preload">` for 400-weight woff2, subset import. Test on Chrome DevTools "Slow 3G" — text must show system fallback immediately.

5. **SB 243 compliance and creator likeness on marketing page** — Prevent: (a) include visible AI-disclosure statement on page (not just footer ToS), (b) use approved phrasing ("fans know it's AI; that's what makes it authentic"), (c) get separate written marketing-use authorization before any creator asset appears. Operational consent already signed covers twin operation, not promotional use.

---

## Implications for Roadmap

### Phase 1: Foundation and Isolation (no visible output)

**Rationale:** CSS leakage, route conflicts, i18n missing keys, and OG tag invisibility can only be prevented by locking the foundation first. Building section components before this is done creates rework.

**Delivers:**
- `lib/i18n.ts` extended with typed `marketing` namespace + `satisfies` enforcement; all 3 locales populated
- `@layer marketing-tokens` appended to `index.css` with `[data-surface="marketing"]` scoped `--mkt-*` tokens
- `index.html` updated: real marketing meta, all three hreflang `<link>` tags
- `public/og-marketing.png`, `public/sitemap.xml`, `public/robots.txt` committed
- `VITE_HERMES_DEEP_LINK` added to `.env.example`
- Font packages installed; Google Fonts CDN `<link>` removed; `font-display: swap` + preload confirmed
- `vite-plugin-sitemap` added to devDependencies and `vite.config.ts`
- `React.lazy()` + `Suspense` wrapping added to all page components in `App.tsx`

**Avoids:** Pitfalls 1 (OG), 2 (route conflict), 3 (CSS leakage), 4 (i18n drift), 9 (hreflang JS-injected), 11 (bundle bloat)

### Phase 2: Static Section Components

**Rationale:** Content sections are independent of each other. Build them all as isolated components before assembling into the page.

**Delivers:** `MarketingFooter`, `HeroSection`, `PillarsSection`, `ChannelsSection`, `OnboardingSection`, `CtaSection`, `index.ts` barrel — all in `src/components/marketing/`

**Uses:** `--mkt-*` tokens only; Radix UI navigation menu; embla-carousel for mobile pillars; lucide-react icons

**Avoids:** Pitfall 3 (CSS leakage), Pitfall 5 (Telegram CTA — `https://t.me/` not `tg://`; fallback text; alphanumeric start payload only)

### Phase 3: Navigation Component

**Rationale:** `MarketingNav` requires a `MarketingLocaleSwitcher` that is intentionally different from the fan page's version (navigates to `/${targetLocale}` without a handle). Build after static sections are confirmed.

**Delivers:** `MarketingNav.tsx` — sticky nav with logo, `MarketingLocaleSwitcher`, CTA button

**Avoids:** Pitfall 2 (route conflict — locale switcher navigates to `/:locale` only)

### Phase 4: Page Assembly and Locale Verification

**Rationale:** Assembly is last — all sections must be individually verified before wiring together.

**Delivers:** `src/pages/home.tsx` fully replaced; all sections wired; locale switching verified across EN/JA/ZH-TW; fan route unaffected; CJK typography verified (`word-break: auto-phrase`, `line-break: strict`, line-height 1.7-1.8em, no overflow at 375px)

**Avoids:** Pitfall 8 (CJK line-break), Pitfall 6 (SB 243 disclosure visible on assembled page)

**Research flag:** Confirm `word-break: auto-phrase` Safari iOS 17+ coverage. If inadequate, add `budoux` (~4 kB). Decision at Phase 4 assembly, not a pre-research blocker.

### Phase 5: Performance, Animations, and Compliance Verification

**Rationale:** Performance polish and compliance verification depend on final content and real layout.

**Delivers:** Framer Motion `whileInView` animations (non-LCP elements only; hero headline/image NOT in `initial={{ opacity: 0 }}`); `useReducedMotion()` checks; Lighthouse mobile: LCP < 2.5s, CLS < 0.1, score ≥ 75; full "Looks done but isn't" checklist from PITFALLS.md executed

### Phase Ordering Rationale

- Foundation precedes components: CSS tokens, i18n types, and static SEO assets are consumed by components.
- Navigation after sections: locale-switching dependency is best tested against real components.
- Assembly last: requires all sections individually verified.
- Performance last: requires final content.
- Express bot-detect OG middleware is absent from all phases — backend touch in a frontend-only milestone; deferred.

### Research Flags

No phases need deeper research. All research is HIGH confidence from direct codebase inspection and verified external sources.

One validation point during Phase 4: `word-break: auto-phrase` Safari support for JP/TW iOS users. If Safari coverage is inadequate, `budoux` is the fallback. Not a pre-build research gap.

---

## Cross-Document Tension Resolutions

**1. SEO/OG approach — RESOLVED: static `index.html` only for this milestone.**
STACK.md's Express bot-detect middleware is deferred. ARCHITECTURE.md's static `index.html` + static asset approach is correct given the frontend-only constraint.

**2. i18n — RESOLVED: extend `lib/i18n.ts`; do NOT install i18next.**
All four documents agree. `satisfies Record<Locale, Messages>` closes the missing-key gap. Unambiguous.

**3. Fonts/CJK — RESOLVED: self-host Inter; Noto Sans JP CDN vs self-host decided in Phase 1.**
`font-display: swap` and preload are mandatory regardless. Open question: confirm in Phase 1 whether Replit serves static assets through a CDN. If not, Google Fonts CDN for Noto Sans JP only may outperform Replit's static file serving for the 4.5 MB woff2.

**4. Fan-route safety — RESOLVED: structural guarantee + CSS isolation.**
Structural: `/:locale/:handle` only matches two-segment paths; current milestone adds no marketing sub-routes, so no conflict exists today. CSS: `[data-surface="marketing"]` / `--mkt-*` isolation is mandatory from Phase 1.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified against pnpm-workspace.yaml and package.json; i18next absence confirmed by direct codebase inspection |
| Features | HIGH | SaaS landing page patterns well-documented; East Asian UX norms from multiple practitioner sources; competitor analysis MEDIUM but not decision-critical |
| Architecture | HIGH | Derived from direct inspection of App.tsx, lib/i18n.ts, index.css, vite.config.ts, index.html, and src/pages/home.tsx; all patterns code-confirmed |
| Pitfalls | HIGH/MEDIUM | HIGH for SEO/SPA, CSS layers, legal, route conflict, i18n; MEDIUM for Telegram deep-link mobile behavior and CJK font performance specifics (verify-during-build, not pre-research) |

**Overall confidence:** HIGH

### Gaps to Address

- **Noto Sans JP CDN vs self-host**: Confirm in Phase 1 whether Replit serves static assets through a CDN. Either approach is acceptable as long as `font-display: swap` and preload are in place.
- **`word-break: auto-phrase` Safari coverage**: Check during Phase 4 assembly. Fallback: `budoux` library.
- **Native-speaker copywriting for JA/ZH-TW**: Ops dependency. Plan a review round before Phase 4 copy is locked. Not a technical gap.
- **Claire marketing authorization**: Before any creator asset appears on the marketing page, a separate written marketing-use authorization must be on file. Current consent covers twin operation only. Resolve in parallel with Phase 2.

---

## Sources

### Primary (HIGH confidence)
- `artifacts/web/src/App.tsx`, `lib/i18n.ts`, `src/index.css`, `vite.config.ts`, `index.html`, `src/pages/home.tsx` — direct codebase inspection
- `pnpm-workspace.yaml` — catalog versions confirmed
- `docs/roadmap.md` — initiative #1 scope and done-looks-like criteria
- CLAUDE.md — port constraints, tech stack, migration decisions
- react-helmet-async npm — v3.0.0 React 19 compatibility
- React 19 document metadata hoisting docs
- Framer Motion v12 `whileInView` API docs
- California SB 243 Skadden analysis — marketing disclosure requirements

### Secondary (MEDIUM confidence)
- vite-plugin-sitemap npm — Vite 7 compatibility
- AnyMind Group 2026 East Asia Influencer Playbook
- Humble Bunny — Japanese web design norms
- Chrome Developers — `word-break: auto-phrase`
- ryelle.codes — CJK line-break behavior
- Weglot — hreflang in SPAs

---
*Research completed: 2026-05-30*
*Ready for roadmap: yes*
