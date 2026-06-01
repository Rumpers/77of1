# Phase 6: Marketing Components & Navigation — Research

**Researched:** 2026-06-01
**Domain:** React 19 + Tailwind v4 + wouter + Framer Motion — marketing component build within an existing SPA, consuming --mkt-* tokens, typed i18n namespace, and Telegram deep-link CTA
**Confidence:** HIGH

---

## Summary

Phase 5 (complete) laid all the structural plumbing: `@layer marketing-tokens` with real Luminous Infrastructure `--mkt-*` token values already retrofitted by quick task `260601-f4l`, the typed `marketing` i18n namespace (EN scaffold + JA/ZH-TW English scaffolding for now) committed to `lib/i18n.ts` with `satisfies Record<Locale, Messages>`, Fontsource self-hosted fonts (Bricolage Grotesque, Geist, Noto Sans TC from `260601-f4l`; Inter + Noto Sans JP from Phase 5 Plan 03), and `React.lazy` + `Suspense` code-splitting. Phase 6's job is to build the visible components that sit inside that container.

The existing `artifacts/web/src/pages/home.tsx` is NOT a simple placeholder — it is a full 1,137-line multi-variant marketing prototype (violet-pop / steady-pay / spotlight). Phase 6 **replaces** it wholesale with the Luminous Infrastructure design. All components live under `src/components/marketing/` and consume only `--mkt-*` CSS custom properties via Tailwind arbitrary-value syntax (`bg-[--mkt-bg]`, `text-[--mkt-accent]`). No fan-page token names (`--primary`, `--background`, etc.) may appear inside `[data-surface="marketing"]`.

The Telegram deep-link (`https://t.me/{bot}?start=creator_onboard`) uses a build-time env var `VITE_HERMES_BOT_URL` injected by Vite — no backend change. The no-Telegram fallback is a contact email link. The MarketingLocaleSwitcher navigates to `/:locale` (no handle) and must NOT modify the fan-page LocaleSwitcher component.

**Primary recommendation:** Build in three plans — (1) replace home.tsx shell + wire MarketingNav + MarketingLocaleSwitcher + CTA button primitive, (2) build content sections (Hero, ValueProp, FourPillars, HowItWorks, MultiChannel, DemoTranscript), (3) assemble MarketingFooter and mid-page CTA repeat, then full mobile-overflow QA at 375px.

---

<user_constraints>
## User Constraints (from CONTEXT.md / STATE.md)

### Locked Decisions

- **CSS isolation:** All marketing components consume ONLY `--mkt-*` tokens scoped under `[data-surface="marketing"]`. Never reference `--primary`, `--background`, `--foreground`, or any fan-page token inside marketing components.
- **Frontend-only milestone:** No backend/API changes, no port changes (8080/22333/3001). `artifacts/api-server`, `artifacts/hermes`, and all `lib/` packages are untouched.
- **i18n approach:** Extend the existing `lib/i18n.ts` hand-rolled typed namespace. Do NOT install i18next. The `marketing` namespace is already typed and scaffolded.
- **Noto Sans JP:** Self-hosted via Fontsource with `font-display: swap` + preload. Already installed in Phase 5.
- **Fonts (display):** Bricolage Grotesque. Body: Geist. CJK: Noto Sans JP / Noto Sans TC. All self-hosted via Fontsource in `@fontsource-variable/*`. Already in `artifacts/web/package.json`.
- **Design system:** "Luminous Infrastructure" — dark violet-ink (`#0D0A14`), violet→fuchsia bloom. DESIGN.md is the single source of truth.
- **DESIGN.md scope:** Governs the marketing surface only. Fan chat page (02-UI-SPEC.md governed) must stay visually unchanged.
- **pnpm only:** preinstall hook blocks npm/yarn.

### Claude's Discretion

- Exact component-level prop API and internal composition (the architecture research specifies files; internal details are planner's call).
- Whether to use `framer-motion` `AnimatePresence` for the locale-switch transition on the nav.
- Whether the DemoTranscript card is a static JSX constant or fetched from i18n strings (either is fine as long as it localizes).
- Exact English copy within the marketing namespace — must respect DESIGN.md brand direction but wording is open.

### Deferred (OUT OF SCOPE for Phase 6)

- Scroll-reveal animations with `prefers-reduced-motion` guard (Phase 7).
- SB 243 on-page disclosure rendering (Phase 7).
- JA/ZH-TW native copy (Phase 7 — English scaffold is used for all three locales now).
- OG / social-meta per-locale (v2.x).
- Creator likeness on marketing assets (blocked on Claire marketing authorization).
- Social-proof testimonial block (deferred to v2.x).
- Creator-ownership callout section (deferred to v2.x).
- Safety one-liner ("30-case review") section (deferred to v2.x).
- Express bot-detect OG-injection middleware (v2.x).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MKT-01 | Hero section: localized headline, sub-headline, hero visual, single primary Telegram CTA | `marketing.hero.*` keys already in i18n; `--mkt-text-hero clamp(2.25rem,5vw,4rem)` token defined; hero visual = violet→fuchsia bloom orb (no creator likeness); CTA uses `VITE_HERMES_BOT_URL` |
| MKT-02 | Value-proposition section communicating managed AI digital-twin service outcome for creators | `marketing.value_prop.*` keys in i18n; managed-service angle locked in D-05-02 |
| MKT-03 | Four-pillars section: chat + voice live; image + video "coming soon" | `marketing.pillars.*` with `image_coming_soon` / `video_coming_soon` keys already defined |
| MKT-04 | "How it works" section: 3-step managed white-glove onboarding | `marketing.onboarding.*` with step1/step2/step3 label+desc keys |
| MKT-05 | Multi-channel deployment section (lala.la + Telegram + creator's social channels) | `marketing.channels.*` keys in i18n |
| MKT-06 | Static demo-transcript card: sample twin conversation, localized per locale | `marketing.demo.*` keys in i18n; transcript is a static JSX constant or in-i18n string array |
| MKT-07 | Footer: company name, contact email, privacy-policy link, AI-disclosure notice | `marketing.footer.*` keys in i18n; privacy route `/:locale/account/data-request` exists |
| MKT-08 | Primary Telegram CTA repeated at hero, mid-page, and footer with identical wording | Single `<CtaButton>` primitive reused in three places; wording from `marketing.hero.cta_primary` |
| MKT-09 | Primary CTA routes to `https://t.me/<bot>?start=<alphanumeric>`; graceful no-Telegram fallback | `VITE_HERMES_BOT_URL` env var; fallback = `marketing.hero.cta_no_telegram` (email or whatsapp link) |
| MKT-11 | Responsive/mobile-first; no layout overflow at 375px | `--mkt-maxw: 1120px`, 24px gutters, 1-col mobile collapse; `overflow-x: hidden` on root |
| MKT-14 | MarketingLocaleSwitcher navigates to `/:locale` (no handle); does not interfere with fan-page switcher | Separate component from fan LocaleSwitcher; uses `useLocation()` + `setLocation(`/${locale}`)` |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Token application | Browser / Client (`[data-surface="marketing"]` subtree) | — | CSS custom properties resolved at render time in the client DOM; tokens already defined in `index.css @layer marketing-tokens` |
| Locale routing / switching | Browser / Client (wouter `useLocation`) | — | wouter is client-only; `MarketingLocaleSwitcher` calls `setLocation` |
| Telegram deep-link URL | Browser / Client (build-time `import.meta.env.VITE_HERMES_BOT_URL`) | — | Frontend-only env var injected by Vite at build time; no API call |
| Copy / i18n | Browser / Client (`lib/i18n.ts` `getMessages()`) | — | Hand-rolled compile-time typed messages; no runtime lib |
| Component rendering | Browser / Client (`artifacts/web`) | — | SPA; all marketing sections are React components; no SSR |
| Fan route safety | Browser / Client (wouter `Switch` ordering) | — | Route collision prevention is a client-router concern; invariant already established in Phase 5 |

---

## Standard Stack

### Core (already installed — no new installs needed)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| React | 19.1.0 | Component rendering | [VERIFIED: pnpm-workspace.yaml catalog] |
| Tailwind CSS | ^4.1.14 | Utility classes; consumes `--mkt-*` via arbitrary-value syntax | [VERIFIED: pnpm-workspace.yaml catalog] |
| wouter | ^3.3.5 | Client routing; `useLocation`, `useParams`, `setLocation` | [VERIFIED: pnpm-workspace.yaml catalog] |
| framer-motion | ^12.23.24 | Hero entrance animation (Phase 6 scope: one orchestrated load); scroll-reveal deferred to Phase 7 | [VERIFIED: pnpm-workspace.yaml catalog] |
| lucide-react | ^0.545.0 | Section icons (value prop, pillars, channels, how-it-works) | [VERIFIED: pnpm-workspace.yaml catalog] |
| @fontsource-variable/bricolage-grotesque | ^5.2.10 | Display / hero font | [VERIFIED: artifacts/web/package.json] |
| @fontsource-variable/geist | ^5.2.9 | Body / UI font | [VERIFIED: artifacts/web/package.json] |
| @fontsource-variable/noto-sans-jp | ^5.2.10 | JA CJK | [VERIFIED: artifacts/web/package.json] |
| @fontsource-variable/noto-sans-tc | ^5.2.10 | ZH-TW CJK | [VERIFIED: artifacts/web/package.json] |
| class-variance-authority | ^0.7.1 | Variant-driven component APIs (CtaButton variants) | [VERIFIED: pnpm-workspace.yaml catalog] |
| clsx / tailwind-merge | ^2.1.1 / ^3.3.1 | `cn()` helper for conditional class merging | [VERIFIED: pnpm-workspace.yaml catalog] |

### No New Installs Required

Phase 6 is pure component work over the foundation Phase 5 laid. The package.json already contains everything needed. **Do not run `pnpm add` for any new package in this phase.**

---

## Package Legitimacy Audit

No new packages are installed in Phase 6. All libraries are confirmed present in `artifacts/web/package.json` or `pnpm-workspace.yaml`. No audit required.

---

## Architecture Patterns

### System Architecture Diagram

```
Visitor browser
  → GET /:locale (no handle — marketing route wins in wouter Switch)
      → home.tsx (MarketingPage shell)
          data-surface="marketing" div
          @layer marketing-tokens tokens resolve
              ↓
          MarketingNav (sticky top bar)
              MarketingLocaleSwitcher → setLocation(`/${locale}`)
              CtaButton (header instance) → VITE_HERMES_BOT_URL
              ↓
          HeroSection
              eyebrow | headline | sub-headline
              CtaButton (hero instance) → VITE_HERMES_BOT_URL
              HeroOrb (violet→fuchsia bloom)
              ↓
          ValuePropSection
              ↓
          FourPillarsSection (chat live | voice live | image CS | video CS)
              ↓
          CtaSection (mid-page repeat)
              CtaButton (mid-page instance) → VITE_HERMES_BOT_URL
              ↓
          MultiChannelSection
              ↓
          HowItWorksSection (3 steps)
              ↓
          DemoTranscriptSection (static sample conversation card)
              ↓
          MarketingFooter
              CtaButton (footer instance) → VITE_HERMES_BOT_URL
              privacy link → /:locale/account/data-request
              AI-disclosure notice
              locale switcher (duplicate of nav for mobile)

  Telegram CTA click → window.open(`https://t.me/<bot>?start=creator_onboard`)
  No-Telegram fallback → mailto:contact@lala.la (or VITE_CONTACT_EMAIL)
```

### Recommended Project Structure

```
artifacts/web/src/
├── pages/
│   └── home.tsx                  REPLACE wholesale — MarketingPage shell
│                                 (reads locale from useParams, wraps
│                                  data-surface="marketing" div, renders
│                                  sections in order, no section logic here)
│
├── components/
│   ├── fan/                      NO CHANGE
│   ├── ui/                       NO CHANGE (Radix primitives — fan + shared)
│   └── marketing/                NEW — isolated marketing component tree
│       ├── index.ts              re-export barrel (named exports)
│       ├── MarketingNav.tsx      sticky nav: wordmark + MarketingLocaleSwitcher + CtaButton
│       ├── MarketingLocaleSwitcher.tsx  locale pill switcher → /:locale
│       ├── CtaButton.tsx         reusable primary CTA button (hero / mid / footer variants)
│       ├── HeroSection.tsx       headline + sub + CtaButton + HeroOrb
│       ├── HeroOrb.tsx           violet→fuchsia radial bloom (CSS + optional framer)
│       ├── ValuePropSection.tsx  MKT-02
│       ├── FourPillarsSection.tsx  MKT-03 — chat/voice live; image/video "coming soon"
│       ├── HowItWorksSection.tsx MKT-04 — 3-step managed onboarding
│       ├── MultiChannelSection.tsx  MKT-05
│       ├── DemoTranscriptSection.tsx  MKT-06 — static conversation card
│       ├── CtaSection.tsx        MKT-08 mid-page CTA repeat block
│       └── MarketingFooter.tsx   MKT-07 + MKT-08 footer CTA
```

### Pattern 1: Token Consumption via Tailwind Arbitrary Values

Every marketing component references only `--mkt-*` properties. Tailwind v4's arbitrary-value syntax bridges CSS custom properties directly — no Tailwind theme extension needed.

**What:** Use `bg-[--mkt-bg]`, `text-[--mkt-fg]`, `border-[--mkt-border]` etc.

**When to use:** Always, inside any `[data-surface="marketing"]` descendant.

```tsx
// Source: DESIGN.md token map + Phase 5 index.css @layer marketing-tokens
function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[--mkt-radius-lg] border border-[--mkt-border]
                 bg-[--mkt-surface-1] p-6 text-[--mkt-fg]"
    >
      {children}
    </div>
  );
}
```

**Critical:** Never write `bg-background`, `text-foreground`, `text-primary`, or any Tailwind semantic token that maps to the fan-page CSS variables. Those tokens resolve to fan-page values and will look wrong inside the dark violet-ink marketing surface.

### Pattern 2: CtaButton — Single Reusable Primitive (MKT-08 / MKT-09)

**What:** One component renders the Telegram deep-link button in all three positions (hero, mid-page, footer). Props: `variant?: "primary" | "ghost"`.

**When to use:** Every CTA instance calls this component; never inline an `<a>` href directly.

```tsx
// Source: DESIGN.md CTA shadow + REQUIREMENTS.md MKT-09
const HERMES_BOT_URL = import.meta.env.VITE_HERMES_BOT_URL ?? "";

function CtaButton({
  label,
  fallbackLabel,
  variant = "primary",
}: {
  label: string;
  fallbackLabel: string;
  variant?: "primary" | "ghost";
}) {
  const hasTelegram = HERMES_BOT_URL !== "";

  if (hasTelegram) {
    return (
      <a
        href={HERMES_BOT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-[--mkt-radius-pill]
                   bg-[--mkt-accent] px-6 py-3 font-[--mkt-font-sans]
                   text-[--mkt-accent-fg] transition-colors
                   hover:bg-[--mkt-accent-hover]"
        style={{
          boxShadow: "0 0 24px color-mix(in oklch, var(--mkt-glow-from) 40%, transparent)",
        }}
      >
        {label}
      </a>
    );
  }

  // Graceful fallback: no Telegram installed / VITE_HERMES_BOT_URL not set
  return (
    <a
      href={`mailto:${import.meta.env.VITE_CONTACT_EMAIL ?? "contact@lala.la"}`}
      className="text-[--mkt-muted-fg] text-sm underline underline-offset-4"
    >
      {fallbackLabel}
    </a>
  );
}
```

### Pattern 3: MarketingLocaleSwitcher — Separate from Fan LocaleSwitcher (MKT-14)

**What:** A new component that switches locale without a handle. Must not touch or import the fan-page LocaleSwitcher.

**When to use:** Inside MarketingNav only (not inside the fan page or any fan component).

```tsx
// Source: ARCHITECTURE.md Locale Switcher Placement + App.tsx useParams pattern
import { useParams } from "wouter";
import { useLocation } from "wouter";
import { LOCALES, isValidLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  ja: "日本語",
  "zh-TW": "繁中",
};

function MarketingLocaleSwitcher() {
  const params = useParams<{ locale: string }>();
  const [, setLocation] = useLocation();
  const currentLocale = isValidLocale(params.locale ?? "")
    ? (params.locale as Locale)
    : DEFAULT_LOCALE;

  return (
    <div className="flex gap-1">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          onClick={() => setLocation(`/${locale}`)}
          aria-current={locale === currentLocale ? "page" : undefined}
          className={`rounded-[--mkt-radius-pill] px-3 py-1 text-sm font-medium transition-colors
            ${locale === currentLocale
              ? "bg-[--mkt-accent] text-[--mkt-accent-fg]"
              : "text-[--mkt-muted-fg] hover:text-[--mkt-fg]"
            }`}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
```

**Routing invariant:** This navigates to `/${locale}` — a single-segment path that matches `/:locale` (marketing home). The two-segment fan route `/:locale/:handle` is never triggered. No changes to App.tsx route order are needed for Phase 6 (the marketing page uses `/:locale` which already exists).

### Pattern 4: i18n Usage inside Marketing Components

```tsx
// Source: lib/i18n.ts getMessages() + existing page pattern (onboard-step1.tsx)
import { DEFAULT_LOCALE, getMessages, isValidLocale } from "@/lib/i18n";
import { useParams } from "wouter";

function HeroSection() {
  const params = useParams<{ locale: string }>();
  const locale = isValidLocale(params.locale ?? "") ? params.locale! : DEFAULT_LOCALE;
  const t = getMessages(locale).marketing;

  return (
    <section>
      <h1 style={{ fontFamily: "var(--mkt-font-display)" }}>
        {t.hero.headline}
      </h1>
      <p>{t.hero.subheadline}</p>
      <CtaButton label={t.hero.cta_primary} fallbackLabel={t.hero.cta_no_telegram} />
    </section>
  );
}
```

### Pattern 5: "Coming Soon" Badge (MKT-03)

The four-pillars section marks image and video as "coming soon". The i18n keys `marketing.pillars.image_coming_soon` and `marketing.pillars.video_coming_soon` already contain the localized string ("Coming soon" for EN; same string placeholder for JA/ZH-TW in the scaffold).

```tsx
// Source: REQUIREMENTS.md MKT-03 + lib/i18n.ts marketing.pillars.*
function PillarCard({
  label, desc, live, comingSoonLabel,
}: {
  label: string; desc: string; live: boolean; comingSoonLabel?: string;
}) {
  return (
    <article className="rounded-[--mkt-radius-md] border border-[--mkt-border]
                        bg-[--mkt-surface-1] p-5 relative">
      {!live && comingSoonLabel && (
        <span className="absolute right-3 top-3 rounded-[--mkt-radius-pill]
                         bg-[--mkt-surface-2] px-2 py-0.5 text-xs
                         text-[--mkt-muted-fg] border border-[--mkt-border]">
          {comingSoonLabel}
        </span>
      )}
      <h3 className="text-[--mkt-fg] font-semibold">{label}</h3>
      <p className="mt-2 text-sm text-[--mkt-muted-fg]">{desc}</p>
    </article>
  );
}
```

### Pattern 6: HeroOrb — Violet→Fuchsia Bloom

The "memorable thing" from DESIGN.md is the violet→fuchsia bloom behind the twin. For Phase 6 (animations deferred to Phase 7), this is a static CSS radial-gradient element:

```tsx
// Source: DESIGN.md Aesthetic Direction — violet→fuchsia bloom
function HeroOrb() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                   h-[600px] w-[600px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--mkt-glow-from) 30%, transparent) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
    </div>
  );
}
```

Phase 7 adds the "breathing" Framer Motion loop. Phase 6 keeps it static — no `initial opacity:0` on any LCP element.

### Pattern 7: Mobile-First, No Overflow at 375px (MKT-11)

**Hard rule:** Every section wrapper uses `w-full max-w-[--mkt-maxw] mx-auto px-6` (24px gutters). Grids collapse to 1-col at mobile via `grid-cols-1 md:grid-cols-2` or `md:grid-cols-3`. The `[data-surface="marketing"]` root div sets `overflow-x: hidden`.

```tsx
// Source: DESIGN.md Layout — max content width 1120px, 24px gutters
function SectionWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[1120px] mx-auto px-6">
      {children}
    </div>
  );
}
```

Verify after each section with: `document.documentElement.scrollWidth` at 375px viewport in browser devtools — must equal 375 (not greater).

### Pattern 8: MarketingNav — Sticky, Transparent-to-Solid

```tsx
// Source: DESIGN.md — intentional, not decorative. Navigation is infrastructure.
function MarketingNav({ locale }: { locale: Locale }) {
  const t = getMessages(locale).marketing;
  return (
    <nav
      className="sticky top-0 z-50 w-full border-b border-[--mkt-border]
                 bg-[--mkt-bg]/90 backdrop-blur-md"
    >
      <div className="max-w-[1120px] mx-auto px-6 h-14 flex items-center justify-between">
        {/* Wordmark */}
        <span
          className="font-bold text-[--mkt-fg]"
          style={{ fontFamily: "var(--mkt-font-display)" }}
        >
          lala.la
        </span>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <MarketingLocaleSwitcher />
          <CtaButton
            label={t.nav.cta_creator}
            fallbackLabel={t.hero.cta_no_telegram}
            variant="primary"
          />
        </div>
      </div>
    </nav>
  );
}
```

### Anti-Patterns to Avoid

- **Using fan-page Tailwind semantic tokens:** `bg-primary`, `text-foreground`, `border`, `ring`, `card` — these resolve to fan-page CSS variables (`hsl(var(--primary))` etc.) and will look wrong on the dark marketing surface. Always use `--mkt-*` via arbitrary syntax.
- **Modifying the fan-page LocaleSwitcher:** It switches to `/:locale/:handle`. Do not add marketing-specific logic there. The MarketingLocaleSwitcher is a separate component.
- **Importing Radix primitives and relying on their default variant styling:** Radix `<Button>` defaults use `bg-primary`. Use plain `<a>` or `<button>` with explicit `--mkt-*` class overrides, or wrap Radix with full class override props.
- **Putting logic in home.tsx beyond section composition:** All rendering logic, i18n reads, and props live in the section components. `home.tsx` orchestrates only.
- **Adding new named routes for marketing sections:** Phase 6 has no sub-routes. All sections scroll within `/:locale`. No `/:locale/features`, `/:locale/how-it-works` routes are needed in Phase 6.
- **Using `initial={{ opacity: 0 }}` on the hero headline or hero image:** Violates the LCP rule from DESIGN.md. Scroll-reveal animations are Phase 7. Phase 6 renders everything at full opacity.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Locale switching | Custom URL rewrite logic | `useLocation()` + `setLocation()` from wouter | Already wired; fan page uses same pattern |
| Typed i18n copy | New i18n runtime, separate JSON files | `getMessages(locale).marketing.*` — already typed and compiled | `satisfies` enforcement already in place; adding strings is a one-liner |
| Responsive grid collapse | Custom CSS media query logic | Tailwind `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` | Tailwind v4 handles breakpoints natively |
| Focus management in nav | Custom keyboard handler | `<button>` + standard HTML focus order | Marketing nav has no complex dropdown; standard tab order is sufficient |
| Telegram URL construction | Runtime string interpolation per click | Build-time `VITE_HERMES_BOT_URL` env var, read once at module load | URL is static; no runtime API call needed |

**Key insight:** This is a frontend-only, static-content component phase. Do not reach for abstractions that assume dynamic data. Every section renders from i18n keys and CSS tokens — no API calls, no React Query, no state beyond the locale param.

---

## Common Pitfalls

### Pitfall 1: Fan-Page Token Bleed

**What goes wrong:** A component inside `[data-surface="marketing"]` uses a Tailwind semantic class (`bg-card`, `text-muted-foreground`) that maps through `@theme inline` to a fan-page HSL variable, rendering the fan dark-mode palette on the marketing surface.

**Why it happens:** The Radix UI component primitives in `components/ui/` use fan-page token class names by default. Copy-paste from a fan component brings those classes in.

**How to avoid:** Grep every new marketing component file for the strings `bg-background`, `bg-card`, `bg-primary`, `text-foreground`, `text-primary`, `border-border` before committing. Any match is a bug.

**Warning signs:** Marketing background goes dark/fan-purple. Text becomes near-white on a dark card when it should be `#F4F1FA` on `#16111F`.

### Pitfall 2: Route Collision on Two-Segment Paths

**What goes wrong:** A new marketing component links to `/:locale/features` or `/:locale/how-it-works` as a hash-less URL. Since no such named route exists in App.tsx above `/:locale/:handle`, wouter routes it to `FanPage` with `handle = "features"`.

**Why it happens:** Phase 6 is scroll-in-page; there are no sub-routes. But a developer might add anchor hrefs that look like paths.

**How to avoid:** All in-page navigation uses `href="#section-id"` (fragment anchors). No `/en/features` style hrefs. If a sub-route is added, it must be registered in App.tsx ABOVE `/:locale/:handle`.

**Warning signs:** Clicking a marketing nav anchor triggers the fan page API call. Browser network tab shows `GET /api/twin/features`.

### Pitfall 3: Telegram Deep-Link on Desktop Without Telegram

**What goes wrong:** `https://t.me/<bot>?start=<payload>` on desktop browsers without Telegram installed opens a dead `web.telegram.org` page or produces a browser error, confusing the visitor. The requirement (MKT-09) mandates a graceful fallback.

**Why it happens:** The deep-link is a URL scheme that assumes Telegram is installed. It works on mobile (if Telegram app is installed) and in-app on Telegram's web client, but fails silently or errors on desktop browsers without the native client.

**How to avoid:** `CtaButton` checks `VITE_HERMES_BOT_URL !== ""`. When set, it opens the deep-link in a new tab (`target="_blank"`). The copy below the button shows `marketing.hero.cta_no_telegram` (e.g., "No Telegram? Contact us") as a mailto link. This is always visible — not conditional on Telegram detection, because there is no reliable way to detect Telegram installation from the browser.

**Warning signs:** Desktop visitors click the CTA and see a blank `web.telegram.org` page rather than a Telegram install prompt.

### Pitfall 4: `--mkt-maxw` Overflowing at 375px

**What goes wrong:** A section uses `gap-8` between a two-column grid that collapses too late, or a hero orb element uses `w-[600px]` without `overflow-hidden` on its parent, causing horizontal scroll at 375px.

**Why it happens:** The `--mkt-maxw` (1120px) is applied correctly, but overflow from absolute/pseudo elements, or from failing to use `w-full` on inner elements, breaks mobile layout.

**How to avoid:** Every section parent that contains absolutely-positioned decorative elements (HeroOrb, gradient meshes) must have `overflow-hidden` or `overflow-x-hidden`. All grid children use `min-w-0` to prevent flex/grid blowout. Verify after each section component is committed: resize to 375px and run `document.documentElement.scrollWidth === 375`.

**Warning signs:** `document.documentElement.scrollWidth > 375` at 375px viewport.

### Pitfall 5: Font Families Not Applying Inside `[data-surface="marketing"]`

**What goes wrong:** The Tailwind `@theme inline` block maps `--font-sans` to `var(--app-font-sans)` (Inter/Noto). The marketing surface uses `--mkt-font-sans` (Geist/Noto) and `--mkt-font-display` (Bricolage Grotesque). If a marketing component uses `font-sans` (the Tailwind utility class), it gets `--app-font-sans` (fan-page font), not `--mkt-font-sans`.

**How to avoid:** In marketing components, use `style={{ fontFamily: "var(--mkt-font-sans)" }}` or `style={{ fontFamily: "var(--mkt-font-display)" }}` rather than the `font-sans` Tailwind utility. Bricolage Grotesque imports are already in `main.tsx` from quick task `260601-f4l`.

**Warning signs:** Hero headline renders in Inter (sans-serif) instead of Bricolage Grotesque. Section body renders in Inter instead of Geist.

---

## What Phase 5 Already Established (Do Not Redo)

| Item | Status | Where |
|------|--------|-------|
| `@layer marketing-tokens` with real Luminous Infrastructure values | DONE (260601-f4l quick task) | `artifacts/web/src/index.css` |
| `marketing` typed namespace in `Messages` | DONE (Phase 5 Plan 01) | `artifacts/web/src/lib/i18n.ts` lines 199–263 |
| EN scaffold copy for all three locales | DONE (Phase 5 Plan 01) | `lib/i18n.ts` `messages.en.marketing`, `messages.ja.marketing`, `messages["zh-TW"].marketing` |
| `satisfies Record<Locale, Messages>` compile-time guard | DONE (Phase 5 Plan 01) | `lib/i18n.ts` line 266 |
| `@fontsource-variable/bricolage-grotesque` + geist + noto-sans-tc imported in main.tsx | DONE (260601-f4l) | `artifacts/web/src/main.tsx` |
| `@fontsource-variable/inter` + noto-sans-jp imported in main.tsx | DONE (Phase 5 Plan 03) | `artifacts/web/src/main.tsx` |
| `React.lazy` + `Suspense` on all pages | DONE (Phase 5 Plan 01) | `artifacts/web/src/App.tsx` |
| Route ordering (`/:locale/:handle` last named route) | DONE (existing; verified Phase 5) | `artifacts/web/src/App.tsx` |
| Stable woff2 paths in vite.config.ts | DONE (Phase 5 Plan 02/03) | `artifacts/web/vite.config.ts` |
| Static `og-marketing.png`, `sitemap.xml`, `robots.txt` | DONE (Phase 5 Plan 02/03) | `artifacts/web/public/` |

---

## Telegram Deep-Link: How It Works

**URL pattern:** `https://t.me/<bot_username>?start=<alphanumeric_payload>`

The `start` parameter is forwarded by Telegram to the bot as a `/start <payload>` message. For the marketing CTA, the payload is `creator_onboard` (a static opaque string; the bot parses it to enter the creator onboarding wizard).

**Env var:** `VITE_HERMES_BOT_URL` — a complete pre-built URL string (e.g., `https://t.me/DonnaFollowFun_bot?start=creator_onboard`). This is simpler than two separate vars (username + payload) and safer than runtime construction. Build-time injection via Vite means it cannot be missing at runtime (it degrades to empty string, triggering the fallback).

**Decision needed for planner:** The bot username for the Hermes creator-side bot is `@DonnaFollowFun_bot` (from CLAUDE.md). The start payload is [ASSUMED] `creator_onboard` — planner must confirm the exact payload string with the founder or verify in `artifacts/hermes/src/` before hardcoding. If the payload is wrong, the bot will not recognize the deep-link command.

**No-Telegram fallback options:**
1. mailto link (`contact@lala.la`) — simplest, always works, no Telegram required
2. WhatsApp link — out of scope per REQUIREMENTS.md backlog
3. Show the raw bot username as text with a "Copy" button — acceptable but more complex

The `marketing.hero.cta_no_telegram` key ("No Telegram? Contact us") already implies option 1. The planner can default to option 1 and add `VITE_CONTACT_EMAIL` to the env if desired, or hardcode `contact@lala.la`.

---

## Confirmed State of Existing `home.tsx`

The current `home.tsx` (1,137 lines) is a multi-variant A/B prototype (violet-pop / steady-pay / spotlight) with inline themes, inline styles, and a compare mode iframe panel. It does NOT use `[data-surface="marketing"]` or `--mkt-*` tokens. Phase 6 replaces this file wholesale with the Luminous Infrastructure implementation.

The existing prototype's component atoms (LandingActionButton, SectionHeading, HeroPanel, LocaleSwitcher, LandingFooter) are DISCARDED — their logic is replaced by the new marketing component tree. Only the section ordering concept (hero → content sections → footer) carries over as a structural reference.

The existing `LocaleSwitcher` component inside `home.tsx` is a local function that navigates to `/:locale?variant=<x>` — Phase 6's `MarketingLocaleSwitcher` is a cleaner replacement that navigates to `/:locale` only.

---

## i18n: Adding Copy for Phase 6 Sections

All required i18n keys already exist in the `marketing` type and scaffold. Phase 6 only writes the copy values into the EN locale object (JA/ZH-TW scaffolding is English and stays that way until Phase 7).

**Keys Phase 6 components consume:**

| Component | i18n keys |
|-----------|-----------|
| MarketingNav | `marketing.nav.cta_creator` |
| HeroSection | `marketing.hero.*` (headline, subheadline, cta_primary, cta_no_telegram) |
| ValuePropSection | `marketing.value_prop.*` (title, subtitle) |
| FourPillarsSection | `marketing.pillars.*` (all 10 keys including 2x coming_soon) |
| HowItWorksSection | `marketing.onboarding.*` (title, subtitle, step1/2/3 label+desc) |
| MultiChannelSection | `marketing.channels.*` (title, subtitle, lala_label, telegram_label, social_label) |
| DemoTranscriptSection | `marketing.demo.*` (title, label) — transcript content may be a separate constant |
| CtaSection (mid-page) | `marketing.cta.*` (headline, subheadline, button, no_telegram) |
| MarketingFooter | `marketing.footer.*` (tagline, privacy, contact, ai_disclosure) + `marketing.cta.button` |

**Adding new keys:** If a component needs a key not yet in the type, add it to the `marketing:` block in `Messages` type AND populate all three locales simultaneously (or TypeScript `satisfies` will fail on the next `pnpm run typecheck`).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite build | Yes | v22.22.0 | — |
| pnpm | Package manager | Yes | 9.x | — |
| `VITE_HERMES_BOT_URL` | CtaButton deep-link | UNKNOWN — not yet in `.env.example` | — | Empty string → shows fallback text (graceful) |
| `VITE_CONTACT_EMAIL` | No-Telegram fallback | UNKNOWN — optional | — | Hardcode `contact@lala.la` as default |

**Missing dependencies with no fallback:** None — the CtaButton has a built-in graceful fallback when `VITE_HERMES_BOT_URL` is absent. The component renders the contact fallback.

**Action required:** Add `VITE_HERMES_BOT_URL=` to `.env.example` so developers know to set it. The planner should include this as a Wave 0 task.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Telegram start payload is `creator_onboard` | Telegram Deep-Link | Bot ignores the deep-link; visitor lands on bot start with no wizard triggered. Low-risk fix: update the URL string |
| A2 | `VITE_CONTACT_EMAIL` = `contact@lala.la` as fallback | CtaButton no-Telegram | Wrong contact email displayed to visitors |
| A3 | `@fontsource-variable/bricolage-grotesque` and `@fontsource-variable/geist` are imported in `main.tsx` after the `260601-f4l` quick task | Font stack section | Components render in fallback system font if imports are missing |
| A4 | The `home.tsx` prototype will be replaced wholesale (not refactored) | Existing home.tsx | If partial refactor is chosen, the variant/compare logic must be removed carefully; wholesale replace is safer |
| A5 | `color-mix(in oklch, ...)` CSS function works in the target production browser (Chromium on Replit) | HeroOrb glow | Falls back to solid color; visual only — not a functional risk |

---

## Open Questions

1. **Hermes start payload**
   - What we know: Deep-link format is `https://t.me/<bot>?start=<payload>`. Bot is `@DonnaFollowFun_bot` per CLAUDE.md.
   - What's unclear: Exact `start` payload string the Hermes bot parses for creator onboarding.
   - Recommendation: Grep `artifacts/hermes/src/` for the `/start` handler and confirm the payload string before setting `VITE_HERMES_BOT_URL`. If not yet implemented, use `creator_onboard` as a placeholder and wire it when Hermes handles it.

2. **Hero visual / twin avatar**
   - What we know: No creator likeness may appear (Claire marketing authorization pending). DESIGN.md specifies "violet→fuchsia bloom behind the twin" as the hero visual.
   - What's unclear: Is a stylized abstract twin silhouette acceptable without explicit creator authorization, or should the hero be bloom-only?
   - Recommendation: Use the bloom orb only (no silhouette) for Phase 6. Phase 7 can add a stylized abstract figure once authorization is clarified.

3. **DemoTranscript localization approach**
   - What we know: MKT-06 requires the card to be "localized per locale". The `marketing.demo.*` keys provide title and label.
   - What's unclear: Are the transcript message strings (fan question, twin response) in the i18n namespace, or a hardcoded English constant?
   - Recommendation: Make the transcript strings constants in the component for Phase 6 (English only). Add i18n keys `marketing.demo.fan_message` / `marketing.demo.twin_response` if the planner wants full localization now, otherwise defer to Phase 7.

---

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json`. This section is SKIPPED.

---

## Security Domain

This phase introduces no new API calls, no authentication, no user input fields, and no data persistence. All components are static rendering + navigation. No ASVS categories apply beyond the baseline already in place.

The one user-visible external link (Telegram CTA) uses `rel="noopener noreferrer"` on `target="_blank"` to prevent tab-napping. The privacy policy link points to the existing `/:locale/account/data-request` route (no new route needed).

---

## Sources

### Primary (HIGH confidence)

- `artifacts/web/src/index.css` — `@layer marketing-tokens` with exact Luminous Infrastructure `--mkt-*` values — VERIFIED by direct file read
- `artifacts/web/src/lib/i18n.ts` lines 199–263 — `marketing` type block; lines 794–865 — EN scaffold values — VERIFIED by direct file read
- `artifacts/web/src/App.tsx` — route order, `useParams`, `useLocation`, `React.lazy` pattern — VERIFIED by direct file read
- `artifacts/web/src/pages/home.tsx` — full 1,137-line current implementation to be replaced — VERIFIED by direct file read
- `artifacts/web/package.json` — font packages (`bricolage-grotesque`, `geist`, `noto-sans-jp`, `noto-sans-tc`) — VERIFIED by direct file read
- `pnpm-workspace.yaml` catalog — `framer-motion`, `wouter`, `tailwindcss`, `lucide-react` versions — VERIFIED by direct file read
- `DESIGN.md` — Luminous Infrastructure design system, token map, typography, color, motion, spacing — VERIFIED by direct file read
- `.planning/phases/05-foundation-isolation/05-01-SUMMARY.md` — Phase 5 Plan 01 completion summary — VERIFIED
- `.planning/phases/05-foundation-isolation/05-03-SUMMARY.md` — Phase 5 Plan 03 font + SEO completion — VERIFIED
- `.planning/STATE.md` — stopped_at note confirming 260601-f4l tokens retrofitted — VERIFIED

### Secondary (MEDIUM confidence)

- `.planning/research/ARCHITECTURE.md` — marketing component tree, LocaleSwitcher routing contract, isolation design — CITED (pre-existing milestone research)
- `.planning/research/STACK.md` — `VITE_HERMES_BOT_URL` env var pattern, Telegram deep-link format — CITED
- `.planning/research/PITFALLS.md` — fan token bleed, route collision, mobile overflow pitfalls — CITED
- CLAUDE.md — `@DonnaFollowFun_bot` Hermes bot username — CITED (project instructions)

### Tertiary (LOW confidence)

- Hermes start payload `creator_onboard` — [ASSUMED] not verified in `artifacts/hermes/src/`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in codebase package.json / pnpm catalog
- Architecture: HIGH — derived from direct codebase inspection of all relevant files
- i18n namespace: HIGH — type and scaffold confirmed present in lib/i18n.ts
- Token consumption pattern: HIGH — index.css `@layer marketing-tokens` verified with real values
- Telegram deep-link: MEDIUM — URL pattern verified; exact payload is [ASSUMED]

**Research date:** 2026-06-01
**Valid until:** 2026-07-01 (stable stack — nothing changes unless packages are updated)
