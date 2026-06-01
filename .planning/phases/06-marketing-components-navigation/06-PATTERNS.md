# Phase 6: Marketing Components & Navigation — Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 14 (12 new components + home.tsx replacement + marketing/index.ts barrel)
**Analogs found:** 13 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `artifacts/web/src/pages/home.tsx` | page shell | transform | `artifacts/web/src/pages/fan-page.tsx` | role-match |
| `artifacts/web/src/components/marketing/index.ts` | barrel | — | `artifacts/web/src/components/fan/` (directory pattern) | structural |
| `artifacts/web/src/components/marketing/MarketingNav.tsx` | component | request-response | `artifacts/web/src/pages/home.tsx` (NavChip + LocaleSwitcher) | role-match |
| `artifacts/web/src/components/marketing/MarketingLocaleSwitcher.tsx` | component | event-driven | `artifacts/web/src/components/fan/LocaleSwitcher.tsx` | exact |
| `artifacts/web/src/components/marketing/CtaButton.tsx` | component | request-response | `artifacts/web/src/components/fan/MonetizationCTA.tsx` | role-match |
| `artifacts/web/src/components/marketing/HeroSection.tsx` | component | transform | `artifacts/web/src/pages/home.tsx` (HeroPanel) | role-match |
| `artifacts/web/src/components/marketing/HeroOrb.tsx` | component | — | none — pure decorative CSS | no analog |
| `artifacts/web/src/components/marketing/ValuePropSection.tsx` | component | transform | `artifacts/web/src/pages/home.tsx` (SectionHeading) | role-match |
| `artifacts/web/src/components/marketing/FourPillarsSection.tsx` | component | transform | `artifacts/web/src/pages/home.tsx` (WHAT_CARDS grid) | role-match |
| `artifacts/web/src/components/marketing/HowItWorksSection.tsx` | component | transform | `artifacts/web/src/pages/home.tsx` (HOW_STEPS) | role-match |
| `artifacts/web/src/components/marketing/MultiChannelSection.tsx` | component | transform | `artifacts/web/src/pages/home.tsx` (FEATURE_CARDS) | role-match |
| `artifacts/web/src/components/marketing/DemoTranscriptSection.tsx` | component | transform | `artifacts/web/src/components/fan/MessageBubble.tsx` | role-match |
| `artifacts/web/src/components/marketing/CtaSection.tsx` | component | transform | `artifacts/web/src/pages/home.tsx` (LandingActionButton) | role-match |
| `artifacts/web/src/components/marketing/MarketingFooter.tsx` | component | transform | `artifacts/web/src/components/fan/DisclosureFooter.tsx` | role-match |

---

## Pattern Assignments

### `artifacts/web/src/pages/home.tsx` (page shell, transform)

**Analog:** `artifacts/web/src/pages/fan-page.tsx` (locale read + useParams pattern) and `artifacts/web/src/pages/onboard-step1.tsx` (i18n lookup pattern)

**Imports pattern** — copy from `artifacts/web/src/pages/fan-page.tsx` lines 1–16, trimmed to marketing needs:
```tsx
import { useParams } from "wouter";
import { DEFAULT_LOCALE, getMessages, isValidLocale } from "@/lib/i18n";
// Import all marketing section components from barrel
import {
  MarketingNav,
  HeroSection,
  ValuePropSection,
  FourPillarsSection,
  HowItWorksSection,
  MultiChannelSection,
  CtaSection,
  DemoTranscriptSection,
  MarketingFooter,
} from "@/components/marketing";
```

**Locale read pattern** — copy from `artifacts/web/src/pages/onboard-step1.tsx` lines 24–26:
```tsx
const params = useParams<{ locale: string }>();
const locale = isValidLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
```

**Core shell pattern** — `[data-surface="marketing"]` root div, overflow-x hidden, sections composed in order:
```tsx
export default function MarketingPage() {
  const params = useParams<{ locale: string }>();
  const locale = isValidLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const t = getMessages(locale).marketing;

  return (
    <div data-surface="marketing" className="min-h-screen bg-[--mkt-bg] overflow-x-hidden">
      <MarketingNav locale={locale} t={t} />
      <HeroSection locale={locale} t={t} />
      <ValuePropSection t={t} />
      <FourPillarsSection t={t} />
      <HowItWorksSection t={t} />
      <MultiChannelSection t={t} />
      <CtaSection t={t} />
      <DemoTranscriptSection t={t} />
      <MarketingFooter locale={locale} t={t} />
    </div>
  );
}
```

**Critical:** No logic, no state, no hooks beyond locale read. All rendering lives in section components.

---

### `artifacts/web/src/components/marketing/MarketingLocaleSwitcher.tsx` (component, event-driven)

**Analog:** `artifacts/web/src/components/fan/LocaleSwitcher.tsx` (lines 1–73) — exact role match; main difference is marketing navigates to `/${locale}` (no handle) and does NOT use Radix DropdownMenu (inline pill buttons instead).

**Imports pattern** (copy/adapt from `LocaleSwitcher.tsx` lines 1–11):
```tsx
import { useParams } from "wouter";
import { useLocation } from "wouter";
import { LOCALES, isValidLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
```

**LOCALE_LABELS constant** (copy verbatim from `LocaleSwitcher.tsx` lines 27–31):
```tsx
const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  ja: "日本語",
  "zh-TW": "繁中",
};
```

**Core locale-switch pattern** — adapted from `LocaleSwitcher.tsx` lines 38–73; drop Radix DropdownMenu, use inline pill buttons, navigate to `/${locale}` not `/${loc}/${handle}`:
```tsx
export function MarketingLocaleSwitcher() {
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
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--mkt-accent]
            focus-visible:ring-offset-1 focus-visible:ring-offset-[--mkt-bg]
            ${locale === currentLocale
              ? "bg-[--mkt-accent] text-[--mkt-accent-fg]"
              : "text-[--mkt-muted-fg] hover:text-[--mkt-fg]"
            }`}
          style={{ fontFamily: "var(--mkt-font-sans)" }}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
```

**Do NOT import:** `Globe`, `Check`, `DropdownMenu`, `Button` from the fan `LocaleSwitcher.tsx`. Those pull in Radix + fan token classes.

---

### `artifacts/web/src/components/marketing/CtaButton.tsx` (component, request-response)

**Analog:** `artifacts/web/src/components/fan/MonetizationCTA.tsx` (lines 31–52) — same pattern: `<a>` element, `target="_blank" rel="noopener noreferrer"`, brand-color fill, Telegram deep-link.

**Imports pattern**:
```tsx
import { Send } from "lucide-react";
```

**Build-time env var** — read once at module load (no runtime fetch):
```tsx
const HERMES_BOT_URL = import.meta.env.VITE_HERMES_BOT_URL ?? "";
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL ?? "contact@lala.la";
```

**Core pattern** (adapted from `MonetizationCTA.tsx` lines 31–52; add size variant and glow shadow):
```tsx
export function CtaButton({
  label,
  fallbackLabel,
  size = "md",
}: {
  label: string;
  fallbackLabel: string;
  size?: "sm" | "md";
}) {
  const padding = size === "sm" ? "px-4 py-2" : "px-6 py-3";

  return (
    <div className="flex flex-col items-center gap-2">
      <a
        href={HERMES_BOT_URL || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 rounded-[--mkt-radius-pill]
          bg-[--mkt-accent] text-[--mkt-accent-fg] font-semibold
          transition-colors min-h-[44px]
          hover:bg-[--mkt-accent-hover] active:scale-[0.98]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--mkt-accent]
          focus-visible:ring-offset-2 focus-visible:ring-offset-[--mkt-bg]
          ${padding}`}
        style={{
          fontFamily: "var(--mkt-font-sans)",
          boxShadow: "0 0 24px color-mix(in oklch, var(--mkt-glow-from) 40%, transparent)",
        }}
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        {label}
      </a>
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="text-[0.875rem] text-[--mkt-muted-fg] underline underline-offset-4
                   hover:text-[--mkt-fg] transition-colors"
        style={{ fontFamily: "var(--mkt-font-sans)" }}
      >
        {fallbackLabel}
      </a>
    </div>
  );
}
```

**Key difference from MonetizationCTA:** uses `--mkt-*` tokens not `var(--brand)`, adds glow box-shadow, adds `size` prop, always renders the fallback mailto link below.

---

### `artifacts/web/src/components/marketing/HeroSection.tsx` (component, transform)

**Analog:** `artifacts/web/src/pages/home.tsx` `HeroPanel` function (lines 400–415) for layout reference; `artifacts/web/src/pages/onboard-step1.tsx` lines 24–26 for i18n read.

**Imports pattern**:
```tsx
import { motion } from "framer-motion";
import { CtaButton } from "./CtaButton";
import { HeroOrb } from "./HeroOrb";
import type { Locale } from "@/lib/i18n";
```

**Core section pattern** — asymmetric hero grid, LCP-safe animation (wrapper animates, not `<h1>` text itself):
```tsx
export function HeroSection({ locale, t }: { locale: Locale; t: MarketingMessages }) {
  return (
    <section className="relative overflow-hidden w-full">
      <HeroOrb />
      <div className="w-full max-w-[1120px] mx-auto px-6 py-24 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
          {/* Left: text stack — render at full opacity; animate wrapper only */}
          <motion.div
            className="flex flex-col"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {/* Eyebrow */}
            <span
              className="text-[0.875rem] font-medium uppercase tracking-[0.14em] text-[--mkt-accent] mb-4"
              style={{ fontFamily: "var(--mkt-font-sans)" }}
            >
              lala.la
            </span>

            {/* h1 — must render at full opacity on first paint (LCP) */}
            <h1
              className="text-[--mkt-fg] leading-[1.04] tracking-[-0.02em]"
              style={{
                fontFamily: "var(--mkt-font-display)",
                fontWeight: 700,
                fontSize: "clamp(2.25rem, 5vw, 4rem)",
              }}
            >
              {t.hero.headline}
            </h1>

            <p
              className="mt-4 text-[1rem] leading-[1.6] text-[--mkt-muted-fg]"
              style={{ fontFamily: "var(--mkt-font-sans)" }}
            >
              {t.hero.subheadline}
            </p>

            <div className="mt-8">
              <CtaButton label={t.hero.cta_primary} fallbackLabel={t.hero.cta_no_telegram} />
            </div>

            {/* SB-243 disclosure pill */}
            <div className="mt-6 inline-flex items-center gap-2 self-start
              border border-[--mkt-accent] rounded-[--mkt-radius-pill] px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-[--mkt-glow-to]" aria-hidden="true" />
              <span
                className="text-[0.875rem] text-[--mkt-muted-fg]"
                style={{ fontFamily: "var(--mkt-font-sans)" }}
              >
                AI twin · not a real person
              </span>
            </div>
          </motion.div>

          {/* Right: decorative orb — hidden on mobile */}
          <div className="hidden lg:block relative h-[480px]" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
```

**LCP rule:** `<h1>` is NOT given `initial={{ opacity: 0 }}`. Only the outer `motion.div` wrapper is animated. See UI-SPEC interaction states contract.

---

### `artifacts/web/src/components/marketing/HeroOrb.tsx` (component, decorative)

**Analog:** None — pure CSS decorative element. RESEARCH.md Pattern 6 provides the exact implementation.

**No imports needed.** Pure static JSX:
```tsx
export function HeroOrb() {
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

**Parent section must have `overflow-hidden`** to prevent 600px orb from causing horizontal scroll at 375px.

---

### `artifacts/web/src/components/marketing/ValuePropSection.tsx` (component, transform)

**Analog:** `artifacts/web/src/pages/home.tsx` `SectionHeading` function (lines 316–335) — text-centered heading + subtitle pattern.

**Section wrapper pattern** (universal for all content sections, derived from RESEARCH.md Pattern 7):
```tsx
// SectionWrapper — reuse this exact structure in every content section
<section className="w-full py-20">
  <div className="w-full max-w-[1120px] mx-auto px-6">
    {/* content */}
  </div>
</section>
```

**Core pattern** — centered heading block, max-w-[640px], no card grid:
```tsx
export function ValuePropSection({ t }: { t: MarketingMessages }) {
  return (
    <section className="w-full py-20">
      <div className="w-full max-w-[1120px] mx-auto px-6">
        <div className="text-center mx-auto" style={{ maxWidth: "640px" }}>
          <h2
            className="text-[--mkt-fg] leading-[1.04] tracking-[-0.02em]"
            style={{
              fontFamily: "var(--mkt-font-display)",
              fontWeight: 700,
              fontSize: "clamp(2.25rem, 5vw, 4rem)",
            }}
          >
            {t.value_prop.title}
          </h2>
          <p
            className="mt-4 text-[1rem] leading-[1.6] text-[--mkt-muted-fg]"
            style={{ fontFamily: "var(--mkt-font-sans)" }}
          >
            {t.value_prop.subtitle}
          </p>
        </div>
      </div>
    </section>
  );
}
```

---

### `artifacts/web/src/components/marketing/FourPillarsSection.tsx` (component, transform)

**Analog:** `artifacts/web/src/pages/home.tsx` `WHAT_CARDS` + grid pattern (lines 148–167 for data; see grid rendered in main body). Also matches RESEARCH.md Pattern 5 for the "coming soon" badge.

**Imports**:
```tsx
import { MessageCircle, Mic, Image, Video } from "lucide-react";
```

**PillarCard sub-component** (extract inline; mirrors home.tsx MiniStat card shape with `--mkt-*` tokens):
```tsx
function PillarCard({
  icon: Icon,
  label,
  desc,
  live,
  comingSoonLabel,
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  desc: string;
  live: boolean;
  comingSoonLabel?: string;
}) {
  return (
    <article
      className="relative rounded-[--mkt-radius-md] border border-[--mkt-border]
                 bg-[--mkt-surface-1] p-5 min-w-0
                 transition-colors hover:border-[--mkt-accent]/40"
    >
      {!live && comingSoonLabel && (
        <span
          className="absolute right-3 top-3 rounded-[--mkt-radius-pill]
                     border border-[--mkt-border] bg-[--mkt-surface-2]
                     px-2 py-0.5 text-[0.875rem] text-[--mkt-muted-fg]"
          style={{ fontFamily: "var(--mkt-font-sans)" }}
        >
          {comingSoonLabel}
        </span>
      )}
      <Icon className="h-6 w-6 text-[--mkt-muted-fg]" aria-hidden="true" />
      <h3
        className="mt-3 text-[1.5rem] font-semibold leading-[1.2] text-[--mkt-fg]"
        style={{ fontFamily: "var(--mkt-font-sans)" }}
      >
        {label}
      </h3>
      <p
        className="mt-2 text-[0.875rem] leading-[1.6] text-[--mkt-muted-fg]"
        style={{ fontFamily: "var(--mkt-font-sans)" }}
      >
        {desc}
      </p>
    </article>
  );
}
```

**Grid** — collapse 1→2→4 columns:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
```

---

### `artifacts/web/src/components/marketing/HowItWorksSection.tsx` (component, transform)

**Analog:** `artifacts/web/src/pages/home.tsx` `HOW_STEPS` constant (lines 169–182) and the step rendering pattern (no card borders — open flex column layout).

**StepCard sub-component** — step numeral in display font weight 800, accent color; label in Geist weight 600:
```tsx
function StepCard({
  numeral,
  label,
  desc,
}: {
  numeral: string; // "01" | "02" | "03"
  label: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <span
        className="text-[1.5rem] leading-[1.04] text-[--mkt-accent]"
        style={{ fontFamily: "var(--mkt-font-display)", fontWeight: 800 }}
        aria-hidden="true"
      >
        {numeral}
      </span>
      <h3
        className="text-[1.5rem] font-semibold leading-[1.2] text-[--mkt-fg]"
        style={{ fontFamily: "var(--mkt-font-sans)" }}
      >
        {label}
      </h3>
      <p
        className="text-[1rem] leading-[1.6] text-[--mkt-muted-fg]"
        style={{ fontFamily: "var(--mkt-font-sans)" }}
      >
        {desc}
      </p>
    </div>
  );
}
```

**Grid** — collapse 1→3:
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
```

---

### `artifacts/web/src/components/marketing/MultiChannelSection.tsx` (component, transform)

**Analog:** `artifacts/web/src/pages/home.tsx` `FEATURE_CARDS` grid (lines 184–205). Exact same structure: icon + heading + optional desc, 3-col grid.

**Imports**:
```tsx
import { Globe, Send, Share2 } from "lucide-react";
```

**ChannelCard sub-component** — centered, accent icon, card border:
```tsx
function ChannelCard({ icon: Icon, label }: { icon: React.FC<{ className?: string }>; label: string }) {
  return (
    <div
      className="flex flex-col items-center gap-3 p-6 min-w-0
                 rounded-[--mkt-radius-lg] border border-[--mkt-border]
                 bg-[--mkt-surface-1] text-center
                 transition-colors hover:border-[--mkt-accent]/40"
    >
      <Icon className="h-8 w-8 text-[--mkt-accent]" aria-hidden="true" />
      <h3
        className="text-[1.5rem] font-semibold leading-[1.2] text-[--mkt-fg]"
        style={{ fontFamily: "var(--mkt-font-sans)" }}
      >
        {label}
      </h3>
    </div>
  );
}
```

**Grid**:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
```

---

### `artifacts/web/src/components/marketing/DemoTranscriptSection.tsx` (component, transform)

**Analog:** `artifacts/web/src/components/fan/MessageBubble.tsx` (lines 26–67) — bubble role/alignment pattern. Also `artifacts/web/src/components/fan/DisclosureFooter.tsx` (lines 29–38) for the twin attribution line below the bubble.

**Static transcript constant** (hardcoded English for Phase 6):
```tsx
const DEMO_TRANSCRIPT = [
  { role: "fan" as const, text: "Are you really her?" },
  {
    role: "twin" as const,
    text: "I'm her AI twin — same energy, available whenever you are. The real one will check in too 💜",
  },
] as const;
```

**Bubble rendering** — adapted from `MessageBubble.tsx` lines 46–66 but using `--mkt-*` tokens:
```tsx
// Fan bubble (right-aligned) — copy cn() alignment from MessageBubble, swap token classes
<div className="flex justify-end">
  <div
    className="max-w-[80%] rounded-[--mkt-radius-md] px-4 py-2
               text-[0.875rem] leading-[1.6] text-[--mkt-fg]
               bg-[--mkt-surface-2]"
    style={{ fontFamily: "var(--mkt-font-sans)" }}
  >
    {turn.text}
  </div>
</div>

// Twin bubble (left-aligned) — adapted from MessageBubble "ai" role
<div className="flex flex-col items-start gap-1">
  <div
    className="max-w-[80%] rounded-[--mkt-radius-md] px-4 py-2
               text-[0.875rem] leading-[1.6] text-[--mkt-fg]"
    style={{
      fontFamily: "var(--mkt-font-sans)",
      background: "color-mix(in oklch, var(--mkt-accent) 15%, transparent)",
    }}
  >
    {turn.text}
  </div>
  {/* Attribution — adapted from DisclosureFooter.tsx lines 29-38 */}
  <span className="pl-1 text-[0.875rem] text-[--mkt-muted-fg]"
        style={{ fontFamily: "var(--mkt-font-sans)" }}>
    AI twin · @claire_ai
  </span>
</div>
```

**Card wrapper**:
```tsx
<div className="max-w-lg mx-auto rounded-[--mkt-radius-lg] border border-[--mkt-border]
                bg-[--mkt-surface-1] p-6 flex flex-col gap-4">
```

---

### `artifacts/web/src/components/marketing/CtaSection.tsx` (component, transform)

**Analog:** `artifacts/web/src/pages/home.tsx` `LandingActionButton` function (lines 364–398) — same concept: centered CTA block with heading, subtitle, and primary action link. Uses `CtaButton` primitive.

**Core pattern** — text-center block, optional subtle bloom, CtaButton reuse:
```tsx
export function CtaSection({ t }: { t: MarketingMessages }) {
  return (
    <section className="w-full py-20">
      <div className="w-full max-w-[1120px] mx-auto px-6 text-center">
        <h2
          className="text-[--mkt-fg] leading-[1.04] tracking-[-0.02em]"
          style={{
            fontFamily: "var(--mkt-font-display)",
            fontWeight: 700,
            fontSize: "clamp(2.25rem, 5vw, 4rem)",
          }}
        >
          {t.cta.headline}
        </h2>
        <p
          className="mt-4 text-[1rem] leading-[1.6] text-[--mkt-muted-fg]"
          style={{ fontFamily: "var(--mkt-font-sans)" }}
        >
          {t.cta.subheadline}
        </p>
        <div className="mt-8 flex justify-center">
          <CtaButton label={t.cta.button} fallbackLabel={t.cta.no_telegram} />
        </div>
      </div>
    </section>
  );
}
```

---

### `artifacts/web/src/components/marketing/MarketingNav.tsx` (component, request-response)

**Analog:** `artifacts/web/src/pages/home.tsx` inline nav pattern (the `NavChip` + `LocaleSwitcher` row, lines 223–286). Also `artifacts/web/src/components/fan/DisclosureBanner.tsx` for sticky/fixed positioning pattern.

**Core pattern** — sticky nav, backdrop blur, wordmark + right-side row:
```tsx
export function MarketingNav({ locale, t }: { locale: Locale; t: MarketingMessages }) {
  return (
    <nav
      className="sticky top-0 z-50 w-full border-b border-[--mkt-border]
                 bg-[--mkt-bg]/90 backdrop-blur-md"
    >
      <div className="max-w-[1120px] mx-auto px-6 h-14 flex items-center justify-between">
        {/* Wordmark */}
        <span
          className="font-bold text-[--mkt-fg]"
          style={{ fontFamily: "var(--mkt-font-display)", fontWeight: 700 }}
        >
          lala.la
        </span>

        {/* Right side — desktop: locale switcher + CTA; mobile: CTA only */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex">
            <MarketingLocaleSwitcher />
          </div>
          <CtaButton
            label={t.nav.cta_creator}
            fallbackLabel={t.hero.cta_no_telegram}
            size="sm"
          />
        </div>
      </div>
    </nav>
  );
}
```

**Mobile rule:** `MarketingLocaleSwitcher` is `hidden sm:flex` in the nav — duplicated in `MarketingFooter` for mobile access.

---

### `artifacts/web/src/components/marketing/MarketingFooter.tsx` (component, transform)

**Analog:** `artifacts/web/src/components/fan/DisclosureFooter.tsx` (lines 29–38) — attribution line pattern. Also `artifacts/web/src/pages/home.tsx` inline footer locale switcher for the bottom-of-page locale row.

**Core pattern** — centered flex column, CTA + locale switcher + legal row:
```tsx
export function MarketingFooter({ locale, t }: { locale: Locale; t: MarketingMessages }) {
  return (
    <footer
      className="w-full py-16 border-t border-[--mkt-border] bg-[--mkt-bg]"
    >
      <div
        className="max-w-[1120px] mx-auto px-6 flex flex-col items-center gap-8 text-center"
      >
        {/* Top block: CTA + locale switcher */}
        <CtaButton label={t.cta.button} fallbackLabel={t.cta.no_telegram} />
        <MarketingLocaleSwitcher />

        {/* Legal row — adapted from DisclosureFooter.tsx */}
        <div className="flex flex-wrap gap-4 justify-center items-center">
          <span
            className="text-[0.875rem] text-[--mkt-muted-fg]"
            style={{ fontFamily: "var(--mkt-font-sans)" }}
          >
            {t.footer.tagline}
          </span>
          <a
            href={`/${locale}/account/data-request`}
            className="text-[0.875rem] text-[--mkt-muted-fg] underline underline-offset-4
                       hover:text-[--mkt-fg] transition-colors"
            style={{ fontFamily: "var(--mkt-font-sans)" }}
          >
            {t.footer.privacy}
          </a>
          <a
            href="mailto:contact@lala.la"
            className="text-[0.875rem] text-[--mkt-muted-fg] underline underline-offset-4
                       hover:text-[--mkt-fg] transition-colors"
            style={{ fontFamily: "var(--mkt-font-sans)" }}
          >
            {t.footer.contact}
          </a>
          <span
            className="text-[0.875rem] text-[--mkt-muted-fg]"
            style={{ fontFamily: "var(--mkt-font-sans)" }}
          >
            {t.footer.ai_disclosure}
          </span>
        </div>
      </div>
    </footer>
  );
}
```

---

### `artifacts/web/src/components/marketing/index.ts` (barrel)

**Analog:** The `components/fan/` directory — no explicit barrel there; each file has named exports. For marketing, a barrel is warranted because home.tsx imports all 9 section components.

**Pattern** — named re-exports only (no default re-exports):
```ts
export { MarketingNav } from "./MarketingNav";
export { MarketingLocaleSwitcher } from "./MarketingLocaleSwitcher";
export { CtaButton } from "./CtaButton";
export { HeroSection } from "./HeroSection";
export { HeroOrb } from "./HeroOrb";
export { ValuePropSection } from "./ValuePropSection";
export { FourPillarsSection } from "./FourPillarsSection";
export { HowItWorksSection } from "./HowItWorksSection";
export { MultiChannelSection } from "./MultiChannelSection";
export { DemoTranscriptSection } from "./DemoTranscriptSection";
export { CtaSection } from "./CtaSection";
export { MarketingFooter } from "./MarketingFooter";
```

---

## Shared Patterns

### Token Consumption (applies to ALL 12 marketing components)

**Source:** `artifacts/web/src/index.css` lines 403–451 — `@layer marketing-tokens` block

Every marketing class reference uses Tailwind arbitrary-value syntax. No fan-page semantic utilities inside `[data-surface="marketing"]`.

```tsx
// CORRECT — always use this form inside marketing components
className="bg-[--mkt-bg] text-[--mkt-fg] border-[--mkt-border]"

// WRONG — these resolve to fan-page HSL variables and will look wrong
className="bg-background text-foreground border-border bg-primary text-primary"
```

Token quick-reference (from `index.css` lines 406–450):
- Canvas: `--mkt-bg` (#0D0A14), `--mkt-surface-1` (#16111F), `--mkt-surface-2` (#1F1830)
- Text: `--mkt-fg` (#F4F1FA), `--mkt-muted-fg` (#9D94B5)
- Accent: `--mkt-accent` (#7C3AED), `--mkt-accent-hover` (#6D28D9), `--mkt-accent-fg` (#FFFFFF)
- Glow: `--mkt-glow-from` (#7C3AED), `--mkt-glow-to` (#D946EF)
- Border: `--mkt-border` (#2A2238)
- Radius: `--mkt-radius-sm` (0.5rem), `--mkt-radius-md` (0.875rem), `--mkt-radius-lg` (1.25rem), `--mkt-radius-pill` (999px)

### Font Application (applies to ALL 12 marketing components)

**Source:** `artifacts/web/src/index.css` lines 429–431

`font-sans` Tailwind utility maps to `--app-font-sans` (Inter, fan stack), NOT `--mkt-font-sans` (Geist). Always use inline style:

```tsx
// CORRECT — always use inline style for marketing fonts
style={{ fontFamily: "var(--mkt-font-sans)" }}     // body, UI, labels
style={{ fontFamily: "var(--mkt-font-display)" }}  // h1, h2, wordmark, step numerals

// WRONG — resolves to fan-page Inter stack
className="font-sans"
```

### i18n Read Pattern (applies to home.tsx and all section components that need copy)

**Source:** `artifacts/web/src/pages/onboard-step1.tsx` lines 24–26 + `artifacts/web/src/lib/i18n.ts`

```tsx
// In home.tsx (locale owner):
const params = useParams<{ locale: string }>();
const locale = isValidLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
const t = getMessages(locale).marketing;
// Pass t and locale as props down to section components

// In section components (locale consumer via prop):
// t.hero.headline, t.pillars.chat_label, etc.
// Full type: getMessages("en").marketing satisfies the Messages["marketing"] shape
```

Available `marketing.*` keys confirmed in `artifacts/web/src/lib/i18n.ts` lines 199–263 (type) and lines 794–858 (EN values). No new keys are required for the core sections.

### Section Wrapper (applies to all content sections)

**Source:** RESEARCH.md Pattern 7 + UI-SPEC Responsive Contract

Every content section uses this identical wrapper. No deviations:

```tsx
<section className="w-full py-20">
  <div className="w-full max-w-[1120px] mx-auto px-6">
    {/* section content */}
  </div>
</section>
```

Hero uses `py-24 lg:py-32` (not `py-20`) per UI-SPEC.

### Section Heading (applies to all sections with h2)

```tsx
<h2
  className="text-[--mkt-fg] leading-[1.04] tracking-[-0.02em]"
  style={{
    fontFamily: "var(--mkt-font-display)",
    fontWeight: 700,
    fontSize: "clamp(2.25rem, 5vw, 4rem)",
  }}
>
  {t.section.title}
</h2>
```

### Section Subtitle (applies to all sections with subtitle `<p>`)

```tsx
<p
  className="mt-4 text-[1rem] leading-[1.6] text-[--mkt-muted-fg]"
  style={{ fontFamily: "var(--mkt-font-sans)" }}
>
  {t.section.subtitle}
</p>
```

### Eyebrow Label (HeroSection, optionally other sections)

**Source:** `artifacts/web/src/pages/home.tsx` line 327 (`SectionHeading` uppercase tracking pattern) adapted to `--mkt-*` tokens:

```tsx
<span
  className="text-[0.875rem] font-medium uppercase tracking-[0.14em] text-[--mkt-accent]"
  style={{ fontFamily: "var(--mkt-font-sans)" }}
>
  label text
</span>
```

### wouter Navigation Pattern (MarketingLocaleSwitcher, MarketingFooter privacy link)

**Source:** `artifacts/web/src/components/fan/LocaleSwitcher.tsx` lines 1–2, 39

```tsx
import { useLocation, useParams } from "wouter";
const [, setLocation] = useLocation();
// Navigate to marketing home (no handle):
setLocation(`/${locale}`);
// Navigate to fan page (not used in marketing — for contrast):
setLocation(`/${loc}/${handle}`);  // DO NOT use this form in marketing components
```

### `cn()` Utility (for conditional class merging)

**Source:** `artifacts/web/src/lib/utils.ts` lines 1–6

```tsx
import { cn } from "@/lib/utils";
// Use for conditional class strings:
className={cn(
  "base-classes",
  condition && "conditional-class",
  anotherCondition ? "this" : "that"
)}
```

### `min-w-0` on Grid Children (ALL grid layouts)

Every `grid` or `flex` child inside a marketing section must have `min-w-0` to prevent flex/grid blowout at 375px. This is confirmed in the UI-SPEC Responsive Contract.

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <article className="... min-w-0">  {/* REQUIRED on every grid child */}
```

### Hover/Focus States (CtaButton, locale pills, cards, footer links)

**Source:** UI-SPEC Component Contracts — Interaction States table

```tsx
// CtaButton hover + focus
className="hover:bg-[--mkt-accent-hover] active:scale-[0.98] transition-colors
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--mkt-accent]
           focus-visible:ring-offset-2 focus-visible:ring-offset-[--mkt-bg]"

// Card hover
className="transition-colors hover:border-[--mkt-accent]/40"

// Footer link hover
className="hover:text-[--mkt-fg] transition-colors"

// Locale pill focus
className="focus-visible:ring-2 focus-visible:ring-[--mkt-accent] focus-visible:ring-offset-1
           focus-visible:ring-offset-[--mkt-bg]"
```

### Reduced-Motion Guard

**Source:** UI-SPEC Interaction States — Reduced motion section. Add to `index.css` `@layer marketing-tokens` block:

```css
@media (prefers-reduced-motion: reduce) {
  [data-surface="marketing"] * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `artifacts/web/src/components/marketing/HeroOrb.tsx` | component | decorative | No animated CSS bloom or decorative orb component exists in the codebase. RESEARCH.md Pattern 6 is the sole reference — plain static CSS, no framer-motion yet. |

---

## QA Grep Gate (include in each plan's QA task)

After each marketing file is written, run:

```bash
grep -rn "bg-primary\|bg-background\|bg-card\|text-foreground\|text-primary\|border-border\|font-sans" \
  /home/joe/Workspace/77of1/artifacts/web/src/components/marketing/
```

Any match is a bug (fan-page token bleed). Zero matches required before committing.

---

## Metadata

**Analog search scope:**
- `artifacts/web/src/components/fan/` — all 9 fan components read
- `artifacts/web/src/pages/home.tsx` — existing marketing prototype read (lines 1–416)
- `artifacts/web/src/pages/fan-page.tsx` — locale/params pattern (lines 1–60)
- `artifacts/web/src/pages/onboard-step1.tsx` — i18n read pattern (lines 24–26)
- `artifacts/web/src/App.tsx` — route order and lazy-load pattern (full)
- `artifacts/web/src/lib/i18n.ts` — marketing type (lines 199–263) and EN values (lines 794–858)
- `artifacts/web/src/index.css` — marketing-tokens layer (lines 396–451)
- `artifacts/web/src/lib/utils.ts` — cn() helper (full)
- `artifacts/web/src/components/ui/button.tsx` — cva pattern (full, confirmed NOT for marketing use)
- `artifacts/web/src/components/CookieConsentBanner.tsx` — inline style pattern reference
- `DESIGN.md` — aesthetic source of truth (lines 1–80)

**Files scanned:** 14 source files
**Pattern extraction date:** 2026-06-01
