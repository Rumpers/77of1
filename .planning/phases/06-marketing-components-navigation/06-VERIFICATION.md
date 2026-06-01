---
phase: 06-marketing-components-navigation
verified: 2026-06-01T09:20:00Z
status: passed
score: 5/5 must-haves verified (4 automated + 1 human-verify item confirmed via Playwright browser automation on :22344; see 06-HUMAN-UAT.md)
overrides_applied: 0
human_verify_resolution: "All 5 HUMAN-UAT items browser-verified PASS on the rio-de-janeiro build. Carry-forward quality/compliance items (CR-01 dead CTA when env unset, WR-04 hardcoded-English disclosure, WR-02 locale allow-list, WR-05 footer-link reload, orphaned home.test.ts) deferred to Phase 7 (Assembly, Polish & Compliance) — none are Phase-6 must-have failures."
human_verification:
  - test: "375px no-overflow check"
    expected: "document.documentElement.scrollWidth === 375 at 375px DevTools viewport; no horizontal scroll on any section"
    why_human: "Requires a running browser with DevTools; scrollWidth measurement cannot be derived from static analysis"
  - test: "Visual render + dark violet marketing page"
    expected: "http://localhost:22333/en renders the Luminous Infrastructure dark violet marketing page, not the old prototype or fan-page light styling; all 9 sections in order"
    why_human: "Cannot verify visual appearance or Tailwind CSS token resolution from static analysis"
  - test: "CTA deep-link wording consistency + click behavior"
    expected: "\"Start with Telegram\" appears at hero, mid-page CtaSection, and footer with identical wording; clicking each opens https://t.me/... in a new tab; or, when VITE_HERMES_BOT_URL is unset, the mailto fallback \"No Telegram? Contact us\" is the actionable control"
    why_human: "Link navigation requires a browser; also needed to assess CR-01 real-world UX impact (dead href when bot URL unset)"
  - test: "Locale switcher routing"
    expected: "Clicking EN / 日本語 / 繁中 pills in nav (desktop) and footer changes URL to /en, /ja, /zh-TW — never appends a handle; page stays on marketing page"
    why_human: "SPA router behavior requires a running browser"
  - test: "Fan route isolation"
    expected: "http://localhost:22333/en/somehandle loads the fan chat page with fan-page styling; no --mkt-* visual leak"
    why_human: "CSS isolation between marketing and fan surfaces requires visual inspection in a running browser"
---

# Phase 6: Marketing Components & Navigation — Verification Report

**Phase Goal:** Every content section, the marketing footer, the sticky nav with locale switcher, and the Telegram CTA deep-link are built as isolated, individually verifiable React components that consume only `--mkt-*` tokens and the typed `marketing` i18n namespace.
**Verified:** 2026-06-01T09:10:11Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Hero section shows localized headline, sub-headline, hero visual, and a single primary Telegram CTA opening the correct Hermes deep-link; visitors without Telegram see a graceful fallback text prompt | ✓ VERIFIED | `HeroSection.tsx`: renders `<HeroOrb />` + `<h1>{t.hero.headline}</h1>` + `<p>{t.hero.subheadline}</p>` + `<CtaButton label={t.hero.cta_primary} fallbackLabel={t.hero.cta_no_telegram} />`. `CtaButton.tsx` unconditionally renders a mailto fallback `<a>` below the primary anchor; fallback is NOT conditional on bot URL being absent. CR-01 (dead primary anchor when bot URL unset) is a UX quality defect but the fallback text IS always present. |
| 2 | Four content sections (value prop, four pillars, multi-channel, how it works) render correctly in EN with accurate copy; image and video pillars visually marked "coming soon" | ✓ VERIFIED | `ValuePropSection.tsx` renders `t.value_prop.title` + `t.value_prop.subtitle`. `FourPillarsSection.tsx` renders 4 PillarCards; Chat+Voice have `live={true}` (no badge); Image+Video have `live={false}` with `comingSoonLabel={t.pillars.image_coming_soon}` / `t.pillars.video_coming_soon`. EN values = "Coming soon". `HowItWorksSection.tsx` renders 3 StepCards from `t.onboarding.step1/2/3_label/desc`. `MultiChannelSection.tsx` renders 3 ChannelCards from `t.channels.lala_label/telegram_label/social_label`. |
| 3 | Primary CTA appears at hero, mid-page, and footer with identical wording; tapping any instance routes to same deep-link URL | ✓ VERIFIED | Hero: `CtaButton label={t.hero.cta_primary}` = "Start with Telegram". CtaSection: `CtaButton label={t.cta.button}` = "Start with Telegram". MarketingFooter: `CtaButton label={t.cta.button}` = "Start with Telegram". All three resolve to the identical string in all 3 locales. All three instances use the same `CtaButton` primitive which reads `VITE_HERMES_BOT_URL` once at module scope — same URL for all three. |
| 4 | Sticky marketing nav includes a MarketingLocaleSwitcher that navigates to `/:locale` (no handle) and does not interfere with the fan-page locale switcher | ✓ VERIFIED | `MarketingNav.tsx`: `className="sticky top-0 z-50 ..."`. `MarketingLocaleSwitcher.tsx`: `onClick={() => setLocation(\`/${locale}\`)}` — single-segment path, never `/${locale}/${handle}`. No import from `components/fan/LocaleSwitcher.tsx`. No Radix `DropdownMenu`. Active pill: `bg-[--mkt-accent]` with `aria-current="page"`. |
| 5 | No component layout overflows at 375px viewport width | ? UNCERTAIN | Static analysis shows: `overflow-x-hidden` on root `<div data-surface="marketing">`. `overflow-hidden` on `HeroSection` outer `<section>` containing the 600px `HeroOrb`. All section wrappers use `w-full max-w-[1120px] mx-auto px-6`. Grid children carry `min-w-0`. `MarketingLocaleSwitcher` hidden on mobile (`hidden sm:flex` in nav). Footer uses `flex-wrap` on legal row. Static risk assessment = LOW. **Requires human browser verification** per plan Task 4 and per instruction; cannot be confirmed by static analysis alone. |

**Score:** 4/5 truths verified (SC-5 requires human verification)

---

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Hero disclosure pill "AI twin · not a real person" and demo attribution "@claire_ai" are hardcoded English, not localized — non-EN locale users see EN disclosure text (WR-04) | Phase 7 | Phase 7 SC-3: "A visible SB 243 AI-companion disclosure statement is present on the rendered page **in all three locales**" |
| 2 | `/:locale` route matches any single-segment path, rendering 200 for invalid locales instead of 404 (WR-02) | Phase 7 | Phase 7 SC-1 requires verifying locale switching works correctly; route constraint is part of Assembly scope |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `artifacts/web/src/components/marketing/CtaButton.tsx` | Telegram CTA primitive with always-visible mailto fallback | ✓ VERIFIED | 2,338 bytes. Reads `VITE_HERMES_BOT_URL` at module scope. Unconditionally renders mailto fallback. CR-01: when bot URL unset, primary `<a>` has `href={undefined}` — a11y defect noted by code review, fallback IS present |
| `artifacts/web/src/components/marketing/MarketingLocaleSwitcher.tsx` | Pill locale switcher navigating to `/:locale` | ✓ VERIFIED | 1,887 bytes. `setLocation(\`/${locale}\`)`. No fan imports. |
| `artifacts/web/src/components/marketing/HeroOrb.tsx` | Static violet→fuchsia decorative bloom | ✓ VERIFIED | 1,008 bytes. `aria-hidden`. `overflow-hidden` on container. No framer-motion. |
| `artifacts/web/src/components/marketing/index.ts` | 12-name named re-export barrel | ✓ VERIFIED | 1,149 bytes. Exactly 12 `export { X } from "./X"` lines. All 12 names: MarketingNav, MarketingLocaleSwitcher, CtaButton, HeroSection, HeroOrb, ValuePropSection, FourPillarsSection, HowItWorksSection, MultiChannelSection, DemoTranscriptSection, CtaSection, MarketingFooter. |
| `artifacts/web/src/components/marketing/HeroSection.tsx` | MKT-01 hero with CtaButton + HeroOrb | ✓ VERIFIED | 3,850 bytes. Imports and renders `HeroOrb` and `CtaButton`. `overflow-hidden` on outer `<section>`. `<h1>` at full opacity; only `motion.div` wrapper animates. |
| `artifacts/web/src/components/marketing/ValuePropSection.tsx` | MKT-02 value proposition | ✓ VERIFIED | 1,458 bytes. Renders `t.value_prop.title` + `t.value_prop.subtitle`. |
| `artifacts/web/src/components/marketing/FourPillarsSection.tsx` | MKT-03 four pillars with coming-soon badges | ✓ VERIFIED | 3,628 bytes. 4 PillarCards; Image+Video render badge from i18n `image_coming_soon`/`video_coming_soon`; Chat+Voice have no badge. Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`. All children `min-w-0`. |
| `artifacts/web/src/components/marketing/DemoTranscriptSection.tsx` | MKT-06 static localized demo transcript | ✓ VERIFIED | 3,409 bytes. 2-turn DEMO_TRANSCRIPT constant. AI attribution "AI twin · @claire_ai" below twin bubble. No prohibited copy. |
| `artifacts/web/src/components/marketing/HowItWorksSection.tsx` | MKT-04 3-step onboarding | ✓ VERIFIED | 2,571 bytes. 3 StepCards from `t.onboarding.step1/2/3_*`. Grid: `grid-cols-1 md:grid-cols-3`. |
| `artifacts/web/src/components/marketing/MultiChannelSection.tsx` | MKT-05 multi-channel deployment | ✓ VERIFIED | 2,217 bytes. 3 ChannelCards (Globe/lala.la, Send/Telegram, Share2/Social). Grid: `grid-cols-1 sm:grid-cols-3`. |
| `artifacts/web/src/components/marketing/CtaSection.tsx` | MKT-08 mid-page CTA repeat | ✓ VERIFIED | 1,669 bytes. Uses `CtaButton` primitive with `t.cta.button` + `t.cta.no_telegram` — same keys as footer. |
| `artifacts/web/src/components/marketing/MarketingNav.tsx` | MKT-14 sticky nav with locale switcher + CTA | ✓ VERIFIED | 1,882 bytes. `sticky top-0 z-50`. `hidden sm:flex` wrapper on MarketingLocaleSwitcher. `CtaButton size="sm"`. |
| `artifacts/web/src/components/marketing/MarketingFooter.tsx` | MKT-07 footer + MKT-08 footer CTA | ✓ VERIFIED | 2,869 bytes. All 4 MKT-07 items present: tagline (`t.footer.tagline`), privacy link (`/${locale}/account/data-request`), contact (`mailto:contact@lala.la`), AI-disclosure (`t.footer.ai_disclosure`). Third CTA: `CtaButton label={t.cta.button}`. Mobile-accessible `MarketingLocaleSwitcher`. |
| `artifacts/web/src/pages/home.tsx` | Assembled MarketingPage shell | ✓ VERIFIED | 1,663 bytes (reduced from 1,137-line prototype). `data-surface="marketing"`. `overflow-x-hidden`. All 9 sections imported from `@/components/marketing`. Default export. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CtaButton.tsx` | `import.meta.env.VITE_HERMES_BOT_URL` | Module-scope env read | ✓ WIRED | Line 19: `const HERMES_BOT_URL = import.meta.env.VITE_HERMES_BOT_URL ?? ""` |
| `MarketingLocaleSwitcher.tsx` | `setLocation(\`/${locale}\`)` | wouter `useLocation` | ✓ WIRED | Line 36: `onClick={() => setLocation(\`/${locale}\`)}` — single-segment only |
| `HeroSection.tsx` | `CtaButton` | import from `./CtaButton` | ✓ WIRED | Line 19: `import { CtaButton } from "./CtaButton"`. Used at line 73. |
| `FourPillarsSection.tsx` | `t.pillars.image_coming_soon` / `t.pillars.video_coming_soon` | PillarCard `comingSoonLabel` prop | ✓ WIRED | Lines 95+99: `comingSoonLabel={t.pillars.image_coming_soon}` / `comingSoonLabel={t.pillars.video_coming_soon}` |
| `CtaSection.tsx` | `CtaButton` with `t.cta.button` | import from `./CtaButton` | ✓ WIRED | Line 16: import. Line 42: `<CtaButton label={t.cta.button} .../>` |
| `home.tsx` | All 9 marketing sections via barrel | `import from @/components/marketing` | ✓ WIRED | Line 19-29: named imports. Lines 38-46: all 9 sections rendered. |
| `MarketingFooter.tsx` | `/${locale}/account/data-request` | privacy link href | ✓ WIRED | Line 40: `href={\`/${locale}/account/data-request\`}` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `home.tsx` | `t` (marketing messages) | `getMessages(locale).marketing` from `@/lib/i18n` | Yes — fully-typed EN/JA/ZH-TW static message objects | ✓ FLOWING |
| `FourPillarsSection.tsx` | `t.pillars.image_coming_soon` | Passed as prop from `home.tsx` → i18n | Yes — "Coming soon" in all locales | ✓ FLOWING |
| `DemoTranscriptSection.tsx` | `DEMO_TRANSCRIPT` | Module-level constant | Yes — static hardcoded EN (Phase 6 scope; Phase 7 localizes) | ✓ FLOWING |
| `CtaButton.tsx` | `HERMES_BOT_URL` | `import.meta.env.VITE_HERMES_BOT_URL` | Conditional — empty string if env var unset (intentional; fallback is mailto) | ⚠️ CONDITIONAL — by design |

---

### Behavioral Spot-Checks

Production build was confirmed at exit 0 (2,482 modules, 10.63s) by 06-04 QA gate. App cannot be tested without starting the dev server.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Production build succeeds | `pnpm --filter @workspace/web run build` | exit 0 per SUMMARY 06-04 | ✓ PASS (documented) |
| All 14 marketing files exist with content | `node -e "fs.statSync(f).size"` | All 14 files exist, sizes 1,008–3,850 bytes | ✓ PASS |
| Zero fan-page token bleed | `grep -rn 'bg-primary\|bg-background\|bg-card\|text-foreground\|text-primary\|border-border' marketing/` | No matches (exit 1 = no results) | ✓ PASS |
| Barrel has exactly 12 exports | `grep -c "^export {" index.ts` | 12 | ✓ PASS |
| `VITE_HERMES_BOT_URL` in .env.example | grep | Present at line 154 | ✓ PASS |
| `prefers-reduced-motion` guard in index.css | grep | Present, scoped to `[data-surface="marketing"] *` | ✓ PASS |
| `/:locale` route above `/:locale/:handle` | grep App.tsx | Line 46 vs line 73 | ✓ PASS |
| Visual render, CTA clicks, locale switching, 375px overflow | Requires running browser | Not runnable without dev server | ? SKIP |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MKT-01 | 06-02 | Hero section with localized headline, sub-headline, visual, single primary CTA | ✓ SATISFIED | HeroSection.tsx renders all four elements from i18n |
| MKT-02 | 06-02 | Value-proposition section | ✓ SATISFIED | ValuePropSection.tsx renders `t.value_prop.title` + `t.value_prop.subtitle` |
| MKT-03 | 06-02 | Four pillars: chat/voice live, image/video "coming soon" | ✓ SATISFIED | FourPillarsSection.tsx: live/coming-soon badge logic confirmed |
| MKT-04 | 06-03 | How it works — 3-step non-technical onboarding | ✓ SATISFIED | HowItWorksSection.tsx renders 3 steps from i18n |
| MKT-05 | 06-03 | Multi-channel section (lala.la + Telegram + social) | ✓ SATISFIED | MultiChannelSection.tsx renders 3 channel cards with correct icons |
| MKT-06 | 06-02 | Static demo transcript with AI attribution | ✓ SATISFIED | DemoTranscriptSection.tsx: 2-turn transcript, "AI twin · @claire_ai" attribution |
| MKT-07 | 06-04 | Footer: company name, contact email, privacy link, AI-disclosure | ✓ SATISFIED | MarketingFooter.tsx: all 4 items present and wired to i18n/locale |
| MKT-08 | 06-03, 06-04 | Primary CTA at hero + mid-page + footer with consistent wording | ✓ SATISFIED | All 3 positions: `CtaButton` primitive, same i18n keys, same URL. "Start with Telegram" in all locales. |
| MKT-09 | 06-01 | Deep-link to `https://t.me/<bot>?start=<alphanumeric>` with graceful fallback | ✓ SATISFIED (with caveat) | `VITE_HERMES_BOT_URL` documents the t.me URL format. Fallback `<a href="mailto:...">` is unconditionally rendered. CR-01 UX defect noted (dead primary anchor when bot URL unset) — functionally the fallback is present. |
| MKT-11 | 06-01, 06-04 | Responsive, no overflow at 375px | ? NEEDS HUMAN | Static analysis: `overflow-x-hidden` on root, `overflow-hidden` on hero, `min-w-0` on grid children, `flex-wrap` on legal row. Risk = LOW per 06-04 analysis. Cannot confirm without browser. |
| MKT-14 | 06-01, 06-04 | Locale switcher from marketing nav routes to `/:locale`, isolated from fan switcher | ✓ SATISFIED | `setLocation(\`/${locale}\`)`. No fan LocaleSwitcher import. MarketingLocaleSwitcher is a separate, isolated component. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `CtaButton.tsx` | 36 | `href={HERMES_BOT_URL \|\| undefined}` — primary `<a>` renders with no `href` when bot URL is unset; the anchor is fully styled, focusable-looking, and does nothing | ⚠️ Warning | MKT-09 fallback IS present (mailto unconditionally rendered), but the primary button gives no visual signal it is non-functional when env var is absent. UX defect documented in CR-01. The phase goal ("built as isolated, individually verifiable React components") is not blocked by this defect — it is a quality issue to fix before production deployment. |
| `HeroSection.tsx` | 92 | Hardcoded English `"AI twin · not a real person"` disclosure copy | ℹ️ Info | Intentional Phase 6 scope decision; Phase 7 localizes per MKT-18. |
| `DemoTranscriptSection.tsx` | 82 | Hardcoded `"AI twin · @claire_ai"` attribution; EN transcript constant shown for all locales | ℹ️ Info | Intentional Phase 6 scaffolding per plan; Phase 7 addresses. `@claire_ai` is a placeholder handle per comment. |
| `DemoTranscriptSection.tsx` | 53, 65 | `key={idx}` array index as React key | ℹ️ Info | Static 2-item constant; benign today, fragile if transcript becomes dynamic in Phase 7. |
| `MarketingFooter.tsx` | 48 | `mailto:contact@lala.la` hardcoded; does not read `VITE_CONTACT_EMAIL` as `CtaButton` does | ℹ️ Info | Minor single-source-of-truth drift; both resolve to the same address today. |

No `TBD`, `FIXME`, or `XXX` debt markers found in any marketing file.

---

### Human Verification Required

#### 1. 375px No-Overflow Check (SC-5 / MKT-11)

**Test:** Run `pnpm --filter @workspace/web run dev` (port 22333). Open `http://localhost:22333/en` in Chrome. Open DevTools, set responsive viewport to 375px. Run `document.documentElement.scrollWidth` in console.
**Expected:** Returns `375` — no horizontal scroll. Manually scroll the full page confirming no section escapes the viewport.
**Why human:** `scrollWidth` measurement requires a running browser at a specific viewport width. Static analysis cannot measure rendered layout.

#### 2. Visual Marketing Page Render

**Test:** With dev server running at `http://localhost:22333/en`, visually confirm the dark violet `Luminous Infrastructure` marketing page renders — not the old multi-variant prototype (`variant`, `compare`, `steady-pay`, `spotlight`) and not fan-page light styling.
**Expected:** Dark `--mkt-bg` background, violet accent, sticky nav visible, all 9 sections in order: Nav → Hero → ValueProp → FourPillars → HowItWorks → MultiChannel → Cta → Demo → Footer.
**Why human:** Visual appearance cannot be verified from static analysis or token inspection alone.

#### 3. CTA Deep-Link Click Behavior (MKT-09)

**Test:** Confirm "Start with Telegram" appears at hero, mid-page (`CtaSection`), and footer with identical wording. If `VITE_HERMES_BOT_URL` is configured: click each CTA — each should open `https://t.me/<bot>?start=creator_onboard` in a new tab. If `VITE_HERMES_BOT_URL` is unset: note whether the primary button is visually dead (per CR-01) and whether the "No Telegram? Contact us" mailto fallback is clearly actionable.
**Expected:** Identical label text at all 3 positions; all 3 instances route to the same URL (or all show the same fallback).
**Why human:** Navigation requires a browser; CR-01 real-world UX impact needs visual confirmation.

#### 4. Locale Switcher Routing (MKT-14)

**Test:** At `http://localhost:22333/en`, click the `日本語` pill in the marketing nav (desktop), then `繁中`, then `EN`. Also test the footer locale switcher on mobile viewport (375px).
**Expected:** URL changes to `/ja`, `/zh-TW`, `/en` — no handle segment appended. Page stays on the marketing page. Copy stays EN for all locales in Phase 6 (intentional scaffold).
**Why human:** SPA router behavior and URL mutations require a running browser.

#### 5. Fan Route Isolation (MKT-20)

**Test:** Visit `http://localhost:22333/en/somehandle`. Confirm the fan chat page loads with its own light styling and no visible `--mkt-*` CSS variables leaking in.
**Expected:** Fan chat page renders correctly, visually unchanged from before Phase 6.
**Why human:** CSS isolation between `[data-surface="marketing"]` scoped tokens and the fan page requires visual browser inspection.

---

### Gaps Summary

No gaps blocking goal achievement. All observable truths are verified or awaiting human verification. The phase goal — "isolated, individually verifiable React components consuming only `--mkt-*` tokens and the typed `marketing` i18n namespace" — is satisfied by the static code evidence:

- Zero fan-page token bleed across all 12 marketing components (grep confirmed)
- All components read copy exclusively from `ReturnType<typeof getMessages>["marketing"]`
- All 14 required files exist with substantive implementation (no stubs)
- All key links wired and data flowing
- Production build exits 0 per 06-04 QA gate

The one code-quality defect (CR-01: dead primary anchor when bot URL unset) does not block the phase goal but should be fixed before production deployment. It is flagged as a Warning, not a Blocker, because the MKT-09 fallback IS unconditionally present.

SC-5 (375px no-overflow) is routed to human verification per plan design — it requires a browser.

---

_Verified: 2026-06-01T09:10:11Z_
_Verifier: Claude (gsd-verifier)_
