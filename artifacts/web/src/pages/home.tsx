/**
 * home.tsx — MarketingPage shell.
 *
 * Assembled marketing page composing all 9 sections in UI-SPEC order under
 * [data-surface="marketing"]. This is the DEFAULT export consumed by App.tsx
 * lazy-import. Contains zero section-rendering logic — all rendering lives in
 * the section components.
 *
 * Locale is read from useParams (wouter route /:locale), validated with
 * isValidLocale, and defaulted to DEFAULT_LOCALE ("en"). t is the marketing
 * i18n namespace passed as props to section components that need copy.
 *
 * Fan route safety (MKT-20): App.tsx routes /:locale above /:locale/:handle;
 * no change to App.tsx routing required.
 */

import { useParams } from "wouter";
import { DEFAULT_LOCALE, getMessages, isValidLocale } from "@/lib/i18n";
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
