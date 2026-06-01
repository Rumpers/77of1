/**
 * Marketing component barrel — named re-exports for all 12 marketing components.
 *
 * All 12 names are exported upfront so that home.tsx and downstream plans never
 * need to edit this file as new components are built in later plans (Wave 2).
 *
 * Note: TypeScript will error on `pnpm run typecheck` until all referenced
 * component files exist (Wave 2 builds them). The barrel is fully valid after
 * plan 06-04 completes. Build verification via `pnpm run build` is gated to
 * the end of plan 06-04.
 */

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
