import * as React from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Globe2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { DEFAULT_LOCALE, getMessages, isValidLocale, type Locale } from "@/lib/i18n";

const LOCALES: Locale[] = ["en", "ja", "zh-TW"];
const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  ja: "日本語",
  "zh-TW": "繁中",
};

const VARIANT_ORDER = ["steady-pay", "violet-pop", "spotlight"] as const;
type VariantId = (typeof VARIANT_ORDER)[number];
const DEFAULT_VARIANT: VariantId = "steady-pay";

type SectionId = "what" | "how" | "features";

type Theme = {
  pageBg: string;
  pageGlow: string;
  text: string;
  muted: string;
  border: string;
  surface: string;
  surfaceSoft: string;
  primary: string;
  primaryText: string;
  secondary: string;
  accent: string;
  success: string;
  cta: string;
  ctaText: string;
  shadow: string;
};

type VariantConfig = {
  label: string;
  vibe: string;
  theme: Theme;
  sectionOrder: SectionId[];
  heroPanelTitle: string;
  heroPanelSubtitle: string;
  heroBullets: Array<{ label: string; value: string }>;
};

const VARIANTS: Record<VariantId, VariantConfig> = {
  "steady-pay": {
    label: "Steady Pay",
    vibe: "Calm, competent, low-effort",
    sectionOrder: ["what", "how", "features"],
    heroPanelTitle: "Steady Pay",
    heroPanelSubtitle: "The safest read: clear, direct, and easy to trust.",
    heroBullets: [
      { label: "Safe", value: "Clear disclosure and obvious control." },
      { label: "Easy", value: "One page, one CTA, no clutter." },
      { label: "Fun", value: "Warm creator energy without the chaos." },
    ],
    theme: {
      pageBg: "#f8fafc",
      pageGlow:
        "radial-gradient(circle at top left, rgba(13, 148, 136, 0.16), transparent 30%), radial-gradient(circle at top right, rgba(56, 189, 248, 0.16), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #ffffff 48%, #f8fafc 100%)",
      text: "#0f172a",
      muted: "#475569",
      border: "rgba(15, 23, 42, 0.10)",
      surface: "rgba(255, 255, 255, 0.94)",
      surfaceSoft: "rgba(15, 23, 42, 0.04)",
      primary: "#0D9488",
      primaryText: "#ffffff",
      secondary: "#0F172A",
      accent: "#38BDF8",
      success: "#22C55E",
      cta: "#F59E0B",
      ctaText: "#0F172A",
      shadow: "0 24px 60px rgba(15, 23, 42, 0.10)",
    },
  },
  "violet-pop": {
    label: "Violet Pop",
    vibe: "Playful, premium, creator-native",
    sectionOrder: ["what", "features", "how"],
    heroPanelTitle: "Violet Pop",
    heroPanelSubtitle: "Bright, social-native, and still easy to scan.",
    heroBullets: [
      { label: "Safe", value: "Premium polish without feeling corporate." },
      { label: "Easy", value: "Soft cards and simple language." },
      { label: "Fun", value: "Coral energy that feels like a creator feed." },
    ],
    theme: {
      pageBg: "#faf7ff",
      pageGlow:
        "radial-gradient(circle at top left, rgba(124, 58, 237, 0.16), transparent 30%), radial-gradient(circle at top right, rgba(251, 113, 133, 0.14), transparent 24%), linear-gradient(180deg, #faf7ff 0%, #ffffff 52%, #faf7ff 100%)",
      text: "#111827",
      muted: "#4b5563",
      border: "rgba(88, 28, 135, 0.12)",
      surface: "rgba(255, 255, 255, 0.96)",
      surfaceSoft: "rgba(124, 58, 237, 0.05)",
      primary: "#7C3AED",
      primaryText: "#ffffff",
      secondary: "#5B21B6",
      accent: "#FB7185",
      success: "#16A34A",
      cta: "#FB7185",
      ctaText: "#ffffff",
      shadow: "0 28px 72px rgba(91, 33, 182, 0.12)",
    },
  },
  spotlight: {
    label: "Spotlight",
    vibe: "Bold, aspirational, creator-stage",
    sectionOrder: ["features", "what", "how"],
    heroPanelTitle: "Spotlight",
    heroPanelSubtitle: "A dark stage where earnings and CTA both pop.",
    heroBullets: [
      { label: "Safe", value: "Dark, premium, but still readable." },
      { label: "Easy", value: "Big shapes and unmistakable hierarchy." },
      { label: "Fun", value: "The most creator-stage energy of the three." },
    ],
    theme: {
      pageBg: "#0b0b14",
      pageGlow:
        "radial-gradient(circle at top left, rgba(236, 72, 153, 0.18), transparent 30%), radial-gradient(circle at top right, rgba(250, 204, 21, 0.12), transparent 24%), linear-gradient(180deg, #0b0b14 0%, #111827 52%, #0b0b14 100%)",
      text: "#f8fafc",
      muted: "rgba(248, 250, 252, 0.72)",
      border: "rgba(255, 255, 255, 0.12)",
      surface: "rgba(23, 23, 42, 0.92)",
      surfaceSoft: "rgba(255, 255, 255, 0.05)",
      primary: "#EC4899",
      primaryText: "#ffffff",
      secondary: "#A855F7",
      accent: "#FACC15",
      success: "#34D399",
      cta: "#FACC15",
      ctaText: "#0b0b14",
      shadow: "0 34px 90px rgba(0, 0, 0, 0.45)",
    },
  },
};

const WHAT_CARDS = [
  {
    title: "Safe",
    description:
      "Fans see a clear AI twin experience, and the creator keeps the relationship and the rules.",
    icon: ShieldCheck,
  },
  {
    title: "Easy",
    description:
      "One headline, one CTA, and a clean path from curiosity to action.",
    icon: Globe2,
  },
  {
    title: "Fun",
    description:
      "Warm, creator-native energy that feels like a cheerleader — not a dashboard.",
    icon: Sparkles,
  },
] as const;

const HOW_STEPS = [
  {
    title: "Tell Lala the voice",
    description: "Share notes, examples, and the vibe you want your twin to keep.",
  },
  {
    title: "Lala runs the setup",
    description: "The twin is prepared, branded, and ready to answer fans in the right tone.",
  },
  {
    title: "Fans chat and earn flows",
    description: "Engagement stays up while the monetization route points to the creator's platform.",
  },
] as const;

const FEATURE_CARDS = [
  {
    title: "Creator voice control",
    description: "The page feels like the creator, not a generic bot.",
    icon: TrendingUp,
  },
  {
    title: "Host-platform monetization",
    description: "The earning path stays on the creator's existing platform.",
    icon: ExternalLink,
  },
  {
    title: "Locale switcher visible",
    description: "EN, 日本語, and 繁中 are always easy to spot.",
    icon: Globe2,
  },
  {
    title: "No extra clutter",
    description: "Simple first impression, fast to understand, low friction to try.",
    icon: CheckCircle2,
  },
] as const;

function isVariantId(value: string | null | undefined): value is VariantId {
  return value === "steady-pay" || value === "violet-pop" || value === "spotlight";
}

function buildLandingHref(locale: Locale, variant: VariantId): string {
  return `/${locale}?variant=${variant}`;
}

function buildCompareHref(locale: Locale): string {
  return `/${locale}/compare`;
}

function buildOnboardHref(locale: Locale): string {
  return `/${locale}/onboard`;
}

function NavChip({
  href,
  label,
  active,
  theme,
  onActivate,
}: {
  href: string;
  label: string;
  active?: boolean;
  theme: Theme;
  onActivate?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={(event) => {
        if (onActivate) {
          event.preventDefault();
          onActivate();
        }
      }}
      aria-current={active ? "page" : undefined}
      className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition-transform duration-150 hover:-translate-y-0.5"
      style={{
        borderColor: active ? theme.primary : theme.border,
        backgroundColor: active ? theme.primary : theme.surfaceSoft,
        color: active ? theme.primaryText : theme.text,
        boxShadow: active ? theme.shadow : "none",
      }}
    >
      {label}
    </a>
  );
}

function LocaleSwitcher({
  locale,
  theme,
  compareMode,
  variant,
  onLocaleChange,
}: {
  locale: Locale;
  theme: Theme;
  compareMode: boolean;
  variant: VariantId;
  onLocaleChange?: (nextLocale: Locale) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {LOCALES.map((nextLocale) => (
        <NavChip
          key={nextLocale}
          href={compareMode ? buildCompareHref(nextLocale) : buildLandingHref(nextLocale, variant)}
          label={LOCALE_LABELS[nextLocale]}
          active={nextLocale === locale}
          theme={theme}
          onActivate={onLocaleChange ? () => onLocaleChange(nextLocale) : undefined}
        />
      ))}
    </div>
  );
}

function VariantSwitcher({
  variant,
  theme,
  locale,
  onVariantChange,
}: {
  variant: VariantId;
  theme: Theme;
  locale: Locale;
  onVariantChange?: (nextVariant: VariantId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {VARIANT_ORDER.map((nextVariant) => (
        <NavChip
          key={nextVariant}
          href={buildLandingHref(locale, nextVariant)}
          label={VARIANTS[nextVariant].label}
          active={nextVariant === variant}
          theme={theme}
          onActivate={onVariantChange ? () => onVariantChange(nextVariant) : undefined}
        />
      ))}
      <NavChip href={buildCompareHref(locale)} label="Compare all three" theme={theme} />
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
  theme,
}: {
  title: string;
  subtitle: string;
  theme: Theme;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: theme.primary }}>
        {title}
      </p>
      <p className="max-w-2xl text-sm sm:text-base" style={{ color: theme.muted }}>
        {subtitle}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: Theme;
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        backgroundColor: theme.surfaceSoft,
        borderColor: theme.border,
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: theme.muted }}>
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold" style={{ color: theme.text }}>
        {value}
      </p>
    </div>
  );
}

function LandingActionButton({
  href,
  label,
  primary,
  theme,
  onClick,
}: {
  href: string;
  label: string;
  primary?: boolean;
  theme: Theme;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={(event) => {
        if (onClick) {
          event.preventDefault();
          onClick();
        }
      }}
      className="inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition-transform duration-150 hover:-translate-y-0.5"
      style={{
        borderColor: primary ? theme.cta : theme.border,
        backgroundColor: primary ? theme.cta : theme.surfaceSoft,
        color: primary ? theme.ctaText : theme.text,
        boxShadow: primary ? theme.shadow : "none",
      }}
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </a>
  );
}

function HeroPanel({ variant, theme }: { variant: VariantId; theme: Theme }) {
  const config = VARIANTS[variant];

  if (variant === "steady-pay") {
    return (
      <div
        className="rounded-[32px] border p-6 backdrop-blur-xl"
        style={{ backgroundColor: theme.surface, borderColor: theme.border, boxShadow: theme.shadow }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: theme.muted }}>
              {config.heroPanelTitle}
            </p>
            <p className="mt-2 text-lg font-semibold" style={{ color: theme.text }}>
              {config.heroPanelSubtitle}
            </p>
          </div>
          <div
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: theme.surfaceSoft, color: theme.primary }}
          >
            Safe / Easy / Fun
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {config.heroBullets.map((bullet) => (
            <div
              key={bullet.label}
              className="rounded-2xl border p-4"
              style={{ backgroundColor: theme.surfaceSoft, borderColor: theme.border }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold" style={{ color: theme.text }}>
                  {bullet.label}
                </p>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.success }} />
              </div>
              <p className="mt-2 text-sm" style={{ color: theme.muted }}>
                {bullet.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-3xl border p-4" style={{ backgroundColor: theme.primary, borderColor: theme.primary }}>
          <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: theme.primaryText }}>
            Earning path
          </p>
          <p className="mt-2 text-sm font-medium" style={{ color: theme.primaryText }}>
            Keep the fun on the page, keep the money on the creator's platform.
          </p>
        </div>
      </div>
    );
  }

  if (variant === "violet-pop") {
    return (
      <div
        className="rounded-[32px] border p-6 backdrop-blur-xl"
        style={{ backgroundColor: theme.surface, borderColor: theme.border, boxShadow: theme.shadow }}
      >
        <div className="rounded-[28px] border p-5" style={{ backgroundColor: theme.surfaceSoft, borderColor: theme.border }}>
          <p className="text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: theme.primary }}>
            {config.heroPanelTitle}
          </p>
          <p className="mt-2 text-lg font-semibold" style={{ color: theme.text }}>
            {config.heroPanelSubtitle}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {config.heroBullets.map((bullet, index) => (
              <div
                key={bullet.label}
                className="rounded-[24px] p-4"
                style={{
                  backgroundColor: index === 0 ? theme.primary : index === 1 ? theme.surface : theme.surfaceSoft,
                  color: index === 0 ? theme.primaryText : theme.text,
                  boxShadow: index === 0 ? theme.shadow : "none",
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ opacity: 0.82 }}>
                  {bullet.label}
                </p>
                <p className="mt-2 text-sm font-medium leading-6" style={{ opacity: 0.95 }}>
                  {bullet.value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[24px] border px-4 py-3" style={{ backgroundColor: theme.accent, borderColor: theme.accent }}>
            <p className="text-sm font-semibold" style={{ color: theme.primaryText }}>
              Premium energy, but still easy to read.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-[32px] border p-6 backdrop-blur-xl"
      style={{ backgroundColor: theme.surface, borderColor: theme.border, boxShadow: theme.shadow }}
    >
      <div className="rounded-[28px] border p-5" style={{ backgroundColor: theme.surfaceSoft, borderColor: theme.border }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: theme.accent }}>
              {config.heroPanelTitle}
            </p>
            <p className="mt-2 text-lg font-semibold" style={{ color: theme.text }}>
              {config.heroPanelSubtitle}
            </p>
          </div>
          <div className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: theme.accent, color: theme.ctaText }}>
            Spotlight
          </div>
        </div>

        <div className="mt-5 rounded-[28px] border p-5" style={{ backgroundColor: theme.pageBg, borderColor: theme.border }}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: theme.muted }}>
              Creator stage
            </p>
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: theme.success, color: "#0b0b14" }}>
              Earn
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {config.heroBullets.map((bullet, index) => (
              <div key={bullet.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm font-medium" style={{ color: theme.text }}>
                  <span>{bullet.label}</span>
                  <span>{index + 1}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: theme.surfaceSoft }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${78 - index * 12}%`,
                      backgroundColor: index === 0 ? theme.primary : index === 1 ? theme.accent : theme.success,
                    }}
                  />
                </div>
                <p className="text-sm" style={{ color: theme.muted }}>
                  {bullet.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatItDoesSection({ theme }: { theme: Theme }) {
  return (
    <section id="what-it-does" className="space-y-5">
      <SectionHeading
        title="What it does"
        subtitle="A first impression that says safe, easy, and fun before the reader has to think too hard."
        theme={theme}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {WHAT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="rounded-[28px] border p-5"
              style={{ backgroundColor: theme.surface, borderColor: theme.border, boxShadow: theme.shadow }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: theme.surfaceSoft }}>
                <Icon className="h-5 w-5" style={{ color: theme.primary }} />
              </div>
              <h3 className="mt-4 text-lg font-semibold" style={{ color: theme.text }}>
                {card.title}
              </h3>
              <p className="mt-2 text-sm leading-6" style={{ color: theme.muted }}>
                {card.description}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function HowItWorksSection({ theme }: { theme: Theme }) {
  return (
    <section id="how-it-works" className="space-y-5">
      <SectionHeading
        title="How it works"
        subtitle="Three steps, no rabbit hole, no hidden complexity."
        theme={theme}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {HOW_STEPS.map((step, index) => (
          <article
            key={step.title}
            className="rounded-[28px] border p-5"
            style={{ backgroundColor: theme.surface, borderColor: theme.border, boxShadow: theme.shadow }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
                style={{ backgroundColor: theme.primary, color: theme.primaryText }}
              >
                {index + 1}
              </div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em]" style={{ color: theme.muted }}>
                Step {index + 1}
              </p>
            </div>
            <h3 className="mt-4 text-lg font-semibold" style={{ color: theme.text }}>
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-6" style={{ color: theme.muted }}>
              {step.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function FeaturesSection({ theme }: { theme: Theme }) {
  return (
    <section id="features" className="space-y-5">
      <SectionHeading
        title="Features"
        subtitle="The page stays simple, but the system underneath still looks like a serious product."
        theme={theme}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {FEATURE_CARDS.map((feature) => {
          const Icon = feature.icon;
          return (
            <article
              key={feature.title}
              className="rounded-[28px] border p-5"
              style={{ backgroundColor: theme.surface, borderColor: theme.border, boxShadow: theme.shadow }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: theme.surfaceSoft }}>
                <Icon className="h-5 w-5" style={{ color: theme.primary }} />
              </div>
              <h3 className="mt-4 text-lg font-semibold" style={{ color: theme.text }}>
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-6" style={{ color: theme.muted }}>
                {feature.description}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LandingFooter({
  locale,
  theme,
  compareMode,
  variant,
  onLocaleChange,
  onVariantChange,
}: {
  locale: Locale;
  theme: Theme;
  compareMode: boolean;
  variant: VariantId;
  onLocaleChange?: (nextLocale: Locale) => void;
  onVariantChange?: (nextVariant: VariantId) => void;
}) {
  return (
    <footer className="mt-12 space-y-4 rounded-[32px] border p-6" style={{ backgroundColor: theme.surface, borderColor: theme.border, boxShadow: theme.shadow }}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: theme.primary }}>
            Lala
          </p>
          <p className="text-sm leading-6" style={{ color: theme.muted }}>
            Your AI twin, built and run for you.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LocaleSwitcher locale={locale} variant={variant} compareMode={compareMode} theme={theme} onLocaleChange={onLocaleChange} />
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: theme.border }}>
        <div className="text-xs uppercase tracking-[0.25em]" style={{ color: theme.muted }}>
          AI-generated content · Not a real person
        </div>
        <div className="flex flex-wrap gap-2">
          <VariantSwitcher variant={variant} locale={locale} theme={theme} onVariantChange={onVariantChange} />
        </div>
      </div>
    </footer>
  );
}

function MarketingLanding({
  locale,
  variant = DEFAULT_VARIANT,
  onLocaleChange,
  onVariantChange,
}: {
  locale: Locale;
  variant?: VariantId;
  onLocaleChange?: (nextLocale: Locale) => void;
  onVariantChange?: (nextVariant: VariantId) => void;
}) {
  const config = VARIANTS[variant];
  const theme = config.theme;
  const compareHref = buildCompareHref(locale);
  const onboardHref = buildOnboardHref(locale);

  return (
    <main
      className="min-h-screen overflow-hidden"
      style={{
        backgroundColor: theme.pageBg,
        backgroundImage: theme.pageGlow,
        color: theme.text,
      }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-12 pt-4 sm:px-6 lg:px-8">
        <header
          className="rounded-[32px] border p-4 backdrop-blur-xl"
          style={{ backgroundColor: theme.surface, borderColor: theme.border, boxShadow: theme.shadow }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-black"
                style={{ backgroundColor: theme.primary, color: theme.primaryText, boxShadow: theme.shadow }}
              >
                L
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: theme.muted }}>
                  lala.la · creator preview
                </p>
                <p className="mt-1 text-lg font-semibold" style={{ color: theme.text }}>
                  Lala
                </p>
                <p className="text-sm" style={{ color: theme.muted }}>
                  {config.label} · {config.vibe}
                </p>
              </div>
              <div
                className="hidden rounded-full px-3 py-1 text-xs font-semibold md:block"
                style={{ backgroundColor: theme.surfaceSoft, color: theme.primary }}
              >
                {variant === "spotlight" ? "Dark stage" : variant === "violet-pop" ? "Playful card stack" : "Calm editorial"}
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <LocaleSwitcher locale={locale} theme={theme} compareMode={false} variant={variant} onLocaleChange={onLocaleChange} />
              <VariantSwitcher variant={variant} locale={locale} theme={theme} onVariantChange={onVariantChange} />
            </div>
          </div>

          <nav className="mt-4 flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: theme.border }}>
            <NavChip href="#what-it-does" label="What it does" theme={theme} />
            <NavChip href="#how-it-works" label="How it works" theme={theme} />
            <NavChip href="#features" label="Features" theme={theme} />
            <NavChip href={compareHref} label="Compare all three" theme={theme} />
          </nav>
        </header>

        <div className="pt-10">
          {variant === "steady-pay" ? (
            <section className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-start">
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  {["Safe", "Easy", "Fun"].map((pill) => (
                    <span
                      key={pill}
                      className="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em]"
                      style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
                    >
                      {pill}
                    </span>
                  ))}
                </div>
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: theme.primary }}>
                    The safer, easier creator surface
                  </p>
                  <h1 className="max-w-3xl text-5xl font-black leading-[1.02] sm:text-6xl lg:text-7xl" style={{ color: theme.text }}>
                    Your AI twin, built and run for you.
                  </h1>
                  <p className="max-w-2xl text-lg leading-8" style={{ color: theme.muted }}>
                    We keep your fans engaged in your voice while you create.
                  </p>
                  <p className="max-w-2xl text-base leading-7" style={{ color: theme.muted }}>
                    Safe, easy, and fun for influencers who want to earn — without turning the page into a fintech maze.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <LandingActionButton href={onboardHref} label="Talk to Lala" primary theme={theme} />
                  <LandingActionButton href={compareHref} label="Compare all three" theme={theme} />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniStat label="Safe" value="Clear disclosure and clear control." theme={theme} />
                  <MiniStat label="Easy" value="One CTA, one path, no clutter." theme={theme} />
                  <MiniStat label="Fun" value="Warm, creator-native, and playful." theme={theme} />
                </div>
              </div>

              <HeroPanel variant={variant} theme={theme} />
            </section>
          ) : variant === "violet-pop" ? (
            <section className="space-y-8 text-center">
              <div className="mx-auto max-w-4xl space-y-6">
                <div className="flex flex-wrap justify-center gap-2">
                  {["Safe", "Easy", "Fun"].map((pill) => (
                    <span
                      key={pill}
                      className="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em]"
                      style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
                    >
                      {pill}
                    </span>
                  ))}
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: theme.primary }}>
                  More playful, still easy to scan
                </p>
                <h1 className="text-5xl font-black leading-[1.02] sm:text-6xl lg:text-7xl" style={{ color: theme.text }}>
                  Your AI twin, built and run for you.
                </h1>
                <p className="mx-auto max-w-2xl text-lg leading-8" style={{ color: theme.muted }}>
                  We keep your fans engaged in your voice while you create.
                </p>
                <p className="mx-auto max-w-2xl text-base leading-7" style={{ color: theme.muted }}>
                  Safe, easy, and fun for influencers who want to earn — with a brighter creator-first vibe.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <LandingActionButton href={onboardHref} label="Talk to Lala" primary theme={theme} />
                  <LandingActionButton href={compareHref} label="Compare all three" theme={theme} />
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <MiniStat label="Safe" value="Premium polish without feeling corporate." theme={theme} />
                <MiniStat label="Easy" value="Soft cards and simple language." theme={theme} />
                <MiniStat label="Fun" value="Creator-feed energy with a clear CTA." theme={theme} />
              </div>
              <HeroPanel variant={variant} theme={theme} />
            </section>
          ) : (
            <section className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-start">
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  {["Safe", "Easy", "Fun"].map((pill) => (
                    <span
                      key={pill}
                      className="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em]"
                      style={{ backgroundColor: theme.surfaceSoft, borderColor: theme.border, color: theme.text }}
                    >
                      {pill}
                    </span>
                  ))}
                </div>
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: theme.accent }}>
                    High-energy creator stage
                  </p>
                  <h1 className="max-w-3xl text-5xl font-black leading-[1.02] sm:text-6xl lg:text-7xl" style={{ color: theme.text }}>
                    Your AI twin, built and run for you.
                  </h1>
                  <p className="max-w-2xl text-lg leading-8" style={{ color: theme.muted }}>
                    We keep your fans engaged in your voice while you create.
                  </p>
                  <p className="max-w-2xl text-base leading-7" style={{ color: theme.muted }}>
                    Safe, easy, and fun for influencers who want to earn — with the most dramatic page of the three.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <LandingActionButton href={onboardHref} label="Talk to Lala" primary theme={theme} />
                  <LandingActionButton href={compareHref} label="Compare all three" theme={theme} />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniStat label="Safe" value="Dark, premium, and readable." theme={theme} />
                  <MiniStat label="Easy" value="Big shapes, clear hierarchy." theme={theme} />
                  <MiniStat label="Fun" value="The boldest creator-stage read." theme={theme} />
                </div>
              </div>

              <HeroPanel variant={variant} theme={theme} />
            </section>
          )}
        </div>

        <div className="mt-12 space-y-10">
          {config.sectionOrder.map((section) => {
            if (section === "what") return <WhatItDoesSection key={section} theme={theme} />;
            if (section === "how") return <HowItWorksSection key={section} theme={theme} />;
            return <FeaturesSection key={section} theme={theme} />;
          })}
        </div>

        <section className="mt-12 rounded-[32px] border p-6 sm:p-8" style={{ backgroundColor: theme.surface, borderColor: theme.border, boxShadow: theme.shadow }}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_auto] lg:items-center">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: theme.primary }}>
                Ready to compare the three directions?
              </p>
              <h2 className="text-3xl font-black leading-tight sm:text-4xl" style={{ color: theme.text }}>
                Talk to Lala, then pick the layout that feels safest, easiest, and most fun.
              </h2>
              <p className="max-w-2xl text-base leading-7" style={{ color: theme.muted }}>
                Same core copy, three different skins. That way you can see whether calm editorial, playful pop, or spotlight mode fits the creator better.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <LandingActionButton href={onboardHref} label="Talk to Lala" primary theme={theme} />
              <LandingActionButton href={compareHref} label="Compare all three" theme={theme} />
            </div>
          </div>
        </section>

        <LandingFooter
          locale={locale}
          theme={theme}
          compareMode={false}
          variant={variant}
          onLocaleChange={onLocaleChange}
          onVariantChange={onVariantChange}
        />
      </div>
    </main>
  );
}

function PreviewCard({
  title,
  subtitle,
  href,
  theme,
}: {
  title: string;
  subtitle: string;
  href: string;
  theme: Theme;
}) {
  return (
    <article className="rounded-[30px] border p-5" style={{ backgroundColor: theme.surface, borderColor: theme.border, boxShadow: theme.shadow }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: theme.primary }}>
            Preview
          </p>
          <h3 className="mt-2 text-xl font-black" style={{ color: theme.text }}>
            {title}
          </h3>
        </div>
        <a
          href={href}
          className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold"
          style={{ backgroundColor: theme.surfaceSoft, borderColor: theme.border, color: theme.text }}
        >
          Open
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <p className="mt-3 text-sm leading-6" style={{ color: theme.muted }}>
        {subtitle}
      </p>
      <div className="mt-5 rounded-[24px] border p-4" style={{ backgroundColor: theme.surfaceSoft, borderColor: theme.border }}>
        <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: theme.muted }}>
          Live URL
        </p>
        <p className="mt-2 break-all text-sm font-semibold" style={{ color: theme.text }}>
          {href}
        </p>
      </div>
    </article>
  );
}

function MarketingComparison({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange?: (nextLocale: Locale) => void;
}) {
  const theme: Theme = {
    pageBg: "#0b1020",
    pageGlow:
      "radial-gradient(circle at top left, rgba(99, 102, 241, 0.16), transparent 30%), radial-gradient(circle at top right, rgba(236, 72, 153, 0.16), transparent 24%), linear-gradient(180deg, #0b1020 0%, #111827 50%, #0b1020 100%)",
    text: "#f8fafc",
    muted: "rgba(248, 250, 252, 0.72)",
    border: "rgba(255, 255, 255, 0.12)",
    surface: "rgba(17, 24, 39, 0.78)",
    surfaceSoft: "rgba(255, 255, 255, 0.06)",
    primary: "#A78BFA",
    primaryText: "#ffffff",
    secondary: "#94A3B8",
    accent: "#FACC15",
    success: "#34D399",
    cta: "#FACC15",
    ctaText: "#0b1020",
    shadow: "0 24px 70px rgba(0, 0, 0, 0.40)",
  };

  return (
    <main className="min-h-screen overflow-hidden" style={{ backgroundColor: theme.pageBg, backgroundImage: theme.pageGlow, color: theme.text }}>
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-12 pt-4 sm:px-6 lg:px-8">
        <header className="rounded-[32px] border p-4 backdrop-blur-xl" style={{ backgroundColor: theme.surface, borderColor: theme.border, boxShadow: theme.shadow }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: theme.primary }}>
                Replit compare mode
              </p>
              <h1 className="text-3xl font-black sm:text-4xl" style={{ color: theme.text }}>
                Three different sites, same copy.
              </h1>
              <p className="max-w-3xl text-sm leading-6" style={{ color: theme.muted }}>
                Open each preview side-by-side and decide which tone feels safest, easiest, and most fun for creators to earn.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <LocaleSwitcher locale={locale} theme={theme} compareMode variant={DEFAULT_VARIANT} onLocaleChange={onLocaleChange} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: theme.border }}>
            {VARIANT_ORDER.map((variant) => (
              <NavChip
                key={variant}
                href={buildLandingHref(locale, variant)}
                label={VARIANTS[variant].label}
                active={false}
                theme={theme}
              />
            ))}
          </div>
        </header>

        <div className="mt-8 grid gap-6 xl:grid-cols-3">
          {VARIANT_ORDER.map((variant) => {
            const config = VARIANTS[variant];
            const previewUrl = buildLandingHref(locale, variant);
            return (
              <div key={variant} className="space-y-4">
                <PreviewCard title={config.label} subtitle={config.vibe} href={previewUrl} theme={theme} />
                <div className="overflow-hidden rounded-[32px] border" style={{ borderColor: theme.border, boxShadow: theme.shadow }}>
                  <iframe
                    title={`${config.label} preview`}
                    src={previewUrl}
                    className="h-[1080px] w-full bg-white"
                    loading="lazy"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <section className="mt-8 rounded-[32px] border p-6" style={{ backgroundColor: theme.surface, borderColor: theme.border, boxShadow: theme.shadow }}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_auto] lg:items-center">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: theme.primary }}>
                Direct links
              </p>
              <h2 className="text-2xl font-black sm:text-3xl" style={{ color: theme.text }}>
                Open any of the three versions in its own Replit URL.
              </h2>
              <p className="max-w-2xl text-sm leading-6" style={{ color: theme.muted }}>
                You can keep the same underlying copy and compare the layout, the tone, and the color system without guessing.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <LandingActionButton href={buildOnboardHref(locale)} label="Talk to Lala" primary theme={theme} />
              <LandingActionButton href={buildCompareHref(locale)} label="Stay on compare" theme={theme} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function HomePage() {
  const params = useParams<{ locale: string }>();
  const [location, setLocation] = useLocation();

  const rawLocale = params.locale ?? DEFAULT_LOCALE;
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const compareMode = location.endsWith("/compare");
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const queryVariant = searchParams.get("variant");
  const variant = isVariantId(queryVariant) ? queryVariant : DEFAULT_VARIANT;
  const marketingCopy = getMessages(locale).marketing;

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = compareMode
      ? `${marketingCopy.meta.title} · compare`
      : `${marketingCopy.meta.title} · ${VARIANTS[variant].label}`;
  }, [compareMode, marketingCopy.meta.title, variant]);

  const navigateToLocale = (nextLocale: Locale) => {
    setLocation(compareMode ? buildCompareHref(nextLocale) : buildLandingHref(nextLocale, variant));
  };

  const navigateToVariant = (nextVariant: VariantId) => {
    setLocation(buildLandingHref(locale, nextVariant));
  };

  return compareMode ? (
    <MarketingComparison locale={locale} onLocaleChange={navigateToLocale} />
  ) : (
    <MarketingLanding
      locale={locale}
      variant={variant}
      onLocaleChange={navigateToLocale}
      onVariantChange={navigateToVariant}
    />
  );
}

export { MarketingComparison, MarketingLanding };
export default HomePage;
