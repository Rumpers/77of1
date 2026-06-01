---
phase: 06-marketing-components-navigation
reviewed: 2026-06-01T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - artifacts/web/src/components/marketing/CtaButton.tsx
  - artifacts/web/src/components/marketing/MarketingLocaleSwitcher.tsx
  - artifacts/web/src/components/marketing/HeroOrb.tsx
  - artifacts/web/src/components/marketing/index.ts
  - artifacts/web/src/components/marketing/HeroSection.tsx
  - artifacts/web/src/components/marketing/ValuePropSection.tsx
  - artifacts/web/src/components/marketing/FourPillarsSection.tsx
  - artifacts/web/src/components/marketing/DemoTranscriptSection.tsx
  - artifacts/web/src/components/marketing/HowItWorksSection.tsx
  - artifacts/web/src/components/marketing/MultiChannelSection.tsx
  - artifacts/web/src/components/marketing/CtaSection.tsx
  - artifacts/web/src/components/marketing/MarketingNav.tsx
  - artifacts/web/src/components/marketing/MarketingFooter.tsx
  - artifacts/web/src/pages/home.tsx
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-06-01
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the 12 marketing components plus the `home.tsx` page shell and the barrel `index.ts`. The token discipline is genuinely good: every component routes color/radius/font through `--mkt-*` arbitrary-value classes, applies `font-family` via inline `style` to avoid the fan-page `--app-font-sans` (Inter) bleed, and the page mounts everything under `[data-surface="marketing"]` so the scoped CSS tokens in `index.css` actually resolve. No hardcoded hex colors, no fan-page semantic utilities (`bg-background`, `text-foreground`), and no fan-page `LocaleSwitcher` import leaked in. The SB-243 disclosure pill renders at the hero and footer per DESIGN.md.

However there is one real correctness defect that breaks the documented MKT-09 graceful-fallback contract (an `href` that silently does nothing while still rendering as an enabled, focusable link), plus a cluster of robustness, accessibility, and consistency warnings. Several of the component header comments assert security/behavioral guarantees that the code does not actually deliver — those gaps are the highest-value findings here because they will pass a casual "looks done" read.

## Critical Issues

### CR-01: Primary CTA renders an interactive `<a>` with no `href` when bot URL is unset — breaks MKT-09 fallback and is an a11y defect

**File:** `artifacts/web/src/components/marketing/CtaButton.tsx:35-53`
**Issue:** When `VITE_HERMES_BOT_URL` is absent, `HERMES_BOT_URL` is `""`, so `href={HERMES_BOT_URL || undefined}` evaluates to `href={undefined}`. The component still renders a fully-styled, glowing, focusable `<a>` element with the primary label and `target="_blank"`. An anchor without an `href` is **not a link** in the accessibility tree — it is not keyboard-focusable in most browsers, exposes no role, and visually it looks identical to a working CTA. A creator landing on the page in any environment where the env var was not injected (the exact "graceful fallback" scenario the file comment claims to handle) sees a prominent violet "Chat with the twin" button that does nothing when clicked, with no visual indication it is disabled. The mailto fallback below does not compensate because the primary button gives no signal that it is dead — the user clicks the obvious CTA, nothing happens, and they leave.

The file's own header comment (lines 4-7) states this path "satisfies MKT-09 graceful-fallback requirement" — it does not; it produces a silently-broken control.

**Fix:** When the bot URL is missing, do not render a dead primary anchor. Either promote the mailto fallback to the primary affordance, or render a disabled-looking element with explicit signaling. Minimal version:
```tsx
const hasBotUrl = HERMES_BOT_URL.length > 0;
// ...
{hasBotUrl ? (
  <a
    href={HERMES_BOT_URL}
    target="_blank"
    rel="noopener noreferrer"
    className={/* ...existing... */}
    style={/* ... */}
  >
    <Send className="h-4 w-4" aria-hidden="true" />
    {label}
  </a>
) : null}
<a href={`mailto:${CONTACT_EMAIL}`} /* fallback now the actionable control */>
  {fallbackLabel}
</a>
```
If keeping a single rendered element is required, at minimum add `aria-disabled="true"` and `role="link"` and visibly dim it when `!hasBotUrl`, and remove `target="_blank"` (meaningless without href).

## Warnings

### WR-01: `home.tsx` passes possibly-`undefined` `params.locale` into `isValidLocale(locale: string)`; only escapes the type checker via wouter's generic assertion

**File:** `artifacts/web/src/pages/home.tsx:32-33`
**Issue:** `useParams<{ locale: string }>()` asserts `locale: string`, but wouter populates the param from the matched route and the value is `string | undefined` at runtime. `isValidLocale(locale: string): locale is Locale` and `getMessages(locale: string)` both declare a `string` parameter, so `strictNullChecks` does not flag the call — the `undefined` is laundered through the generic. The sibling component `MarketingLocaleSwitcher.tsx:27` defends the identical read with `isValidLocale(params.locale ?? "")`; `home.tsx` does not. On the `/:locale` route the param is always present so this does not currently crash, but the two files handle the same input inconsistently and the page relies on an unguaranteed invariant.
**Fix:** Mirror the switcher's guard:
```tsx
const locale = isValidLocale(params.locale ?? "") ? (params.locale as Locale) : DEFAULT_LOCALE;
```
and type `useParams<{ locale?: string }>()` to reflect reality.

### WR-02: `/:locale` route matches any single-segment path, silently rendering the marketing page for invalid locales

**File:** `artifacts/web/src/pages/home.tsx:31-34` (in concert with `artifacts/web/src/App.tsx` `<Route path="/:locale">`)
**Issue:** The route `/:locale` matches *any* single path segment, not only the three allow-listed locales. A URL like `lala.la/foobar` matches `/:locale`, `isValidLocale("foobar")` is false, and the page silently falls back to `DEFAULT_LOCALE` and renders the full English marketing page under a garbage URL (returns HTTP 200, not 404). This is an SEO/duplicate-content hazard and contradicts the "fan route safety" intent in the header comment — the comment reasons about `/:locale/:handle` but never about the unconstrained single-segment match. Combined with the silent default-locale fallback, there is no path by which an invalid locale produces `NotFound`.
**Fix:** Constrain the route to the known locales (wouter supports regex segments), e.g. `<Route path="/:locale(en|ja|zh-TW)">`, so unknown single segments fall through to `NotFound`. Apply the same constraint to the other `/:locale/...` routes that should not accept arbitrary locales.

### WR-03: `key={idx}` array index used as React key in demo transcript

**File:** `artifacts/web/src/components/marketing/DemoTranscriptSection.tsx:53,65`
**Issue:** The transcript map keys on the array index. For a static, never-reordered two-item list this is benign today, but the pattern is fragile if the transcript becomes localized/dynamic in Phase 7 (the file comment explicitly anticipates "Phase 7 will add localized copies"). Index keys cause state/DOM reconciliation bugs when items are added, removed, or reordered.
**Fix:** Key on stable content, e.g. `key={`${turn.role}-${idx}`}` at minimum, or add an explicit `id` to each transcript entry.

### WR-04: SB-243 disclosure copy is inconsistent across surfaces and partially hardcoded outside i18n

**File:** `artifacts/web/src/components/marketing/HeroSection.tsx:92` and `artifacts/web/src/components/marketing/DemoTranscriptSection.tsx:82`
**Issue:** The hero disclosure pill text `"AI twin · not a real person"` (HeroSection:92) and the demo attribution `"AI twin · @claire_ai"` (DemoTranscriptSection:82) are hardcoded English string literals, while the footer disclosure uses the localized `t.footer.ai_disclosure`. For a JA/TW launch the legally-mandated SB-243 disclosure in the hero and the demo will render in English even on the `ja` and `zh-TW` pages. The disclosure is the one piece of copy with a compliance/legal requirement (per CLAUDE.md: "$1,000 per violation private right of action") and it is the piece that is not localized. Additionally `@claire_ai` hardcodes a real creator handle in shipped marketing source, which the file comment (DemoTranscriptSection:8) claims is a "generic placeholder" — it is not generic, it is Claire's handle.
**Fix:** Move both strings into the `marketing` i18n namespace (e.g. `t.hero.disclosure`, `t.demo.attribution`) and localize them. Replace `@claire_ai` with a non-identifying placeholder such as `@yourhandle_ai` unless legal has cleared naming Claire on the public marketing site.

### WR-05: Footer privacy link uses raw `<a href>` causing full-page reload, bypassing the wouter SPA router

**File:** `artifacts/web/src/components/marketing/MarketingFooter.tsx:39-46`
**Issue:** The privacy/data-request link is a plain `<a href={`/${locale}/account/data-request`}>`. Inside a wouter SPA every internal navigation should use `<Link>` / `setLocation` so it stays client-side; a raw `<a>` triggers a full document reload, discarding the React tree, query cache, and any in-flight state, and is noticeably slower. The DSAR route *is* an internal SPA route (`App.tsx` `<Route path="/:locale/account/data-request">`), so this should not hard-navigate. The locale switcher in the same file correctly uses `setLocation`; the footer link does not, so the file mixes navigation strategies.
**Fix:** Use wouter's `Link`:
```tsx
import { Link } from "wouter";
<Link href={`/${locale}/account/data-request`} className="...">{t.footer.privacy}</Link>
```

### WR-06: Decorative section markup uses non-semantic `<div>`s and several sections lack landmark/heading association

**File:** `artifacts/web/src/components/marketing/HowItWorksSection.tsx:16-48`, `artifacts/web/src/components/marketing/MultiChannelSection.tsx:16-39`
**Issue:** `StepCard` and `ChannelCard` render their content in bare `<div>`s with an `<h3>` but no enclosing semantic grouping, and the step numeral is `aria-hidden` while the `<h3>` label carries the only accessible name — fine — but the cards are not list items. A screen-reader user gets three or four unrelated headings with no indication they form a sequence/set. `FourPillarsSection` correctly uses `<article>`; `HowItWorks` and `MultiChannel` do not, so the semantic treatment is inconsistent across sibling sections. Additionally none of the `<section>` elements carry an `aria-labelledby` pointing at their `<h2>`, so they are unlabeled landmarks.
**Fix:** Wrap repeated cards in `<ul>`/`<li>` (steps are an ordered sequence — consider `<ol>`), and add `aria-labelledby` linking each `<section>` to its heading id for consistent landmark labeling.

## Info

### IN-01: `home.tsx` header comment says "all 9 sections" but renders sections out of the documented UI-SPEC order

**File:** `artifacts/web/src/pages/home.tsx:4,36-47`
**Issue:** The comment claims sections render "in UI-SPEC order," but `DemoTranscriptSection` is rendered *after* `CtaSection` (lines 44-45), whereas the barrel/`index.ts` ordering and the MKT numbering (MKT-06 demo before MKT-08 CTA) imply the demo precedes the mid-page CTA. Either the order or the comment is wrong. Confirm against 06-UI-SPEC.md and align.
**Fix:** Reorder to match the spec, or correct the comment to describe the actual intended order.

### IN-02: `_locale` prop is accepted then discarded in `HeroSection` and `MarketingNav`

**File:** `artifacts/web/src/components/marketing/HeroSection.tsx:27`, `artifacts/web/src/components/marketing/MarketingNav.tsx:23`
**Issue:** Both components destructure `locale: _locale` and never use it. The underscore signals intentional non-use, but the prop is still required on the call sites in `home.tsx`, adding noise. If locale is genuinely unused (copy already comes pre-localized via `t`), drop the prop from the component signatures and the call sites.
**Fix:** Remove the unused `locale` prop from `HeroSection` and `MarketingNav` and their invocations, unless it is a deliberate placeholder for imminent Phase 7 use (document if so).

### IN-03: Hover-tint utilities mixed into arbitrary-value class strings (`hover:border-[--mkt-accent]/40`) may not compile as intended under Tailwind v4

**File:** `artifacts/web/src/components/marketing/FourPillarsSection.tsx:34`, `artifacts/web/src/components/marketing/MultiChannelSection.tsx:28`
**Issue:** The opacity-modifier-on-arbitrary-CSS-var syntax `border-[--mkt-accent]/40` relies on Tailwind being able to apply the `/40` alpha to a bare CSS variable. Under Tailwind v4 arbitrary CSS-variable values the `/opacity` shorthand does not always resolve to a `color-mix` and can silently emit no alpha (full-opacity border on hover). Worth a visual check that the hover border is actually 40% alpha and not 100%. Not a correctness bug, but a likely-silent design drift from DESIGN.md.
**Fix:** If the alpha does not apply, use an explicit `hover:border-[color-mix(in_oklch,var(--mkt-accent)_40%,transparent)]` or define a dedicated `--mkt-accent-40` token.

### IN-04: Duplicated section-heading style object repeated verbatim across six components

**File:** `artifacts/web/src/components/marketing/ValuePropSection.tsx:23-27`, `FourPillarsSection.tsx:69-73`, `DemoTranscriptSection.tsx:37-41`, `HowItWorksSection.tsx:55-59`, `MultiChannelSection.tsx:47-51`, `CtaSection.tsx:27-31`
**Issue:** The identical `<h2>` style block (`fontFamily: var(--mkt-font-display)`, `fontWeight: 700`, `fontSize: clamp(2.25rem, 5vw, 4rem)`) is copy-pasted in six places, and the same clamp also appears on the hero `<h1>`. A future change to the section type scale requires editing seven files and risks drift. Note `--mkt-text-hero` / `--mkt-text-section` tokens already exist in `index.css` but are unused here — the clamp is hardcoded instead of referencing the token.
**Fix:** Extract a `MarketingSectionHeading` component (or a shared style constant), and prefer the existing `--mkt-text-section` token over the inline clamp literal.

### IN-05: Footer `mailto:contact@lala.la` is hardcoded while `CtaButton` reads `VITE_CONTACT_EMAIL`

**File:** `artifacts/web/src/components/marketing/MarketingFooter.tsx:48`
**Issue:** `CtaButton.tsx:20` sources the contact address from `VITE_CONTACT_EMAIL` (default `contact@lala.la`), but the footer hardcodes `mailto:contact@lala.la`. If the env-configured contact address is ever changed, the CTA fallback and the footer contact link diverge. Minor, but it is a single source-of-truth violation between two files that present the same contact affordance.
**Fix:** Have the footer read the same `VITE_CONTACT_EMAIL` constant (export it from a shared module so both `CtaButton` and `MarketingFooter` consume one value).

---

_Reviewed: 2026-06-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
