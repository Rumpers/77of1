import React, { type ElementType, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowRight, Check, Globe, Image, MessageCircle, Mic, Sparkles, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_LOCALE, getMessages, isValidLocale, LOCALES, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const HERO_HEADLINE = "Your AI twin, built and run for you.";
const HERO_SUBHEADLINE =
  "Lala handles setup, fan chat, and platform routing so you can stay focused on creating.";
const PRIMARY_CTA = "Talk to Lala";
const NAV_ITEMS = [
  { label: "What it does", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Channels", href: "#channels" },
  { label: "Contact", href: "#contact" },
] as const;

const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  ja: "日本語",
  "zh-TW": "繁中",
};

type MarketingLandingProps = {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
};

function LocaleSwitcher({ locale, onLocaleChange }: MarketingLandingProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 text-xs shadow-sm">
      <Globe className="ml-2 h-3.5 w-3.5 text-white/45" />
      {LOCALES.map((loc) => {
        const active = loc === locale;
        return (
          <button
            key={loc}
            type="button"
            onClick={() => onLocaleChange(loc)}
            aria-pressed={active}
            className={cn(
              "rounded-full px-3 py-1.5 transition-colors",
              active ? "bg-white text-black" : "text-white/65 hover:text-white",
            )}
          >
            {LOCALE_LABELS[loc]}
          </button>
        );
      })}
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  badge,
}: {
  icon: ElementType;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-white/90">
          <Icon className="h-4.5 w-4.5" />
        </div>
        {badge && (
          <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-white/55">
            {badge}
          </span>
        )}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/65">{description}</p>
    </article>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
      <p className="text-xs uppercase tracking-[0.24em] text-white/45">{step}</p>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/65">{description}</p>
    </article>
  );
}

export function MarketingLanding({ locale, onLocaleChange }: MarketingLandingProps) {
  const t = getMessages(locale).marketing;

  return (
    <main className="min-h-screen bg-[#09090d] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-4 sm:px-6 lg:px-8">
        <header className="border-b border-white/10 pb-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <a href={`/${locale}`} className="flex items-baseline gap-2 self-start">
              <span className="text-lg font-semibold tracking-tight">Lala</span>
              <span className="text-[0.7rem] uppercase tracking-[0.28em] text-white/45">lala.la</span>
            </a>

            <div className="flex flex-wrap items-center gap-3">
              <nav className="flex flex-wrap items-center gap-4 text-sm text-white/65">
                {NAV_ITEMS.map((item) => (
                  <a key={item.href} href={item.href} className="transition-colors hover:text-white">
                    {item.label}
                  </a>
                ))}
              </nav>

              <LocaleSwitcher locale={locale} onLocaleChange={onLocaleChange} />

              <Button asChild size="sm" className="shrink-0">
                <a href={`/${locale}/onboard`}>
                  {PRIMARY_CTA}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:py-18">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/55">
              <Sparkles className="h-3.5 w-3.5" />
              Managed AI digital twin
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">{HERO_HEADLINE}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/70">{HERO_SUBHEADLINE}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href={`/${locale}/onboard`}>
                  {PRIMARY_CTA}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-white/45">{t.meta.description}</p>
          </div>

          <aside className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">{t.value_prop.title}</p>
                <h2 className="mt-2 text-2xl font-semibold">{t.value_prop.subtitle}</h2>
              </div>
              <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
                {LOCALE_LABELS[locale]}
              </div>
            </div>
            <ul className="mt-6 space-y-3 text-sm text-white/70">
              <li className="flex gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>Fans chat on Telegram or at lala.la/[handle].</span>
              </li>
              <li className="flex gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>Replies stay on-brand and safety-aware.</span>
              </li>
              <li className="flex gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>Monetization stays on the creator&apos;s existing platform.</span>
              </li>
            </ul>
          </aside>
        </section>

        <section id="features" className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 md:p-8">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Features</p>
            <h2 className="mt-2 text-2xl font-semibold">{t.pillars.title}</h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FeatureCard icon={MessageCircle} title={t.pillars.chat_label} description={t.pillars.chat_desc} />
            <FeatureCard icon={Mic} title={t.pillars.voice_label} description={t.pillars.voice_desc} />
            <FeatureCard
              icon={Image}
              title={t.pillars.image_label}
              description={t.pillars.image_desc}
              badge={t.pillars.image_coming_soon}
            />
            <FeatureCard
              icon={Video}
              title={t.pillars.video_label}
              description={t.pillars.video_desc}
              badge={t.pillars.video_coming_soon}
            />
          </div>
        </section>

        <section id="how-it-works" className="mt-4 rounded-[1.75rem] border border-white/10 bg-[#101018] p-6 md:p-8">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">{t.onboarding.title}</p>
            <h2 className="mt-2 text-2xl font-semibold">{t.onboarding.subtitle}</h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <StepCard step="01" title={t.onboarding.step1_label} description={t.onboarding.step1_desc} />
            <StepCard step="02" title={t.onboarding.step2_label} description={t.onboarding.step2_desc} />
            <StepCard step="03" title={t.onboarding.step3_label} description={t.onboarding.step3_desc} />
          </div>
        </section>

        <section id="channels" className="mt-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-6 md:p-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">{t.channels.title}</p>
              <h2 className="mt-2 text-2xl font-semibold">{t.channels.subtitle}</h2>
            </div>
            <p className="text-sm text-white/50">{t.footer.ai_disclosure}</p>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">{t.channels.lala_label}</p>
              <p className="mt-2 text-sm leading-6 text-white/65">The public fan-facing front door.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">{t.channels.telegram_label}</p>
              <p className="mt-2 text-sm leading-6 text-white/65">Fast, intimate chat where fans already live.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">{t.channels.social_label}</p>
              <p className="mt-2 text-sm leading-6 text-white/65">Hand off to the creator&apos;s existing monetization stack.</p>
            </div>
          </div>
        </section>

        <section
          id="contact"
          className="mt-4 flex flex-col gap-5 rounded-[1.75rem] border border-white/10 bg-white/5 p-6 md:flex-row md:items-center md:justify-between md:p-8"
        >
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">{t.cta.headline}</p>
            <h2 className="mt-2 text-2xl font-semibold">{HERO_HEADLINE}</h2>
            <p className="mt-3 text-sm leading-6 text-white/65">{t.cta.subheadline}</p>
          </div>
          <Button asChild size="lg">
            <a href={`/${locale}/onboard`}>
              {PRIMARY_CTA}
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </section>

        <footer className="flex flex-col gap-3 border-t border-white/10 py-6 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>{t.footer.tagline}</p>
          <p>{t.footer.privacy} · {t.footer.contact} · {t.footer.ai_disclosure}</p>
        </footer>
      </div>
    </main>
  );
}

export default function HomePage() {
  const params = useParams<{ locale: string }>();
  const [, setLocation] = useLocation();
  const locale = isValidLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const t = getMessages(locale).marketing;

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.title = t.meta.title;
    document.documentElement.lang = locale;

    const selector = 'meta[name="description"]';
    let meta = document.head.querySelector<HTMLMetaElement>(selector);
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", HERO_SUBHEADLINE);
  }, [locale, t.meta.title]);

  return <MarketingLanding locale={locale} onLocaleChange={(next) => setLocation(`/${next}`)} />;
}
