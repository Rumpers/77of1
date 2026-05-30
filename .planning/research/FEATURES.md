# Feature Landscape: lala.la Marketing Site (Milestone v2.0)

**Domain:** B2B2C SaaS marketing site — managed AI digital-twin service for non-technical influencer creators in JP/TW/HK
**Researched:** 2026-05-30
**Confidence:** HIGH (SaaS landing page patterns), HIGH (East Asian trust/UX signals), MEDIUM (direct competitor analogues)

---

## Scope Reminder

This file covers the **marketing site only** — the public front door at the locale root that sells lala.la to potential creator customers and routes them into Hermes onboarding. It does NOT cover the twin engine, fan chat page, or Hermes bot (all already shipped).

**Milestone constraint:** Frontend-only. No backend changes. Single CTA surfaces: the Hermes Telegram deep-link. Existing i18n infrastructure (i18next + react-i18next) must be reused.

---

## Audience Model

**Primary audience:** Non-technical creators (17 LIVE streamers, Fanvue/Patreon creators) in JP/TW/HK. They are:
- Mobile-first (80%+ of traffic will be mobile)
- High uncertainty-avoidance (especially JP) — they need thoroughness before action
- Not developers — any hint of "API" or "setup" language is a trust killer
- Already using Telegram daily — a Telegram CTA has zero friction for this cohort
- Strongly relationship/trust-driven — personal social proof outweighs brand authority

**Secondary audience:** Any English-speaking creator or agency stumbling onto the site.

---

## Table Stakes

Features where absence makes the site feel incomplete, unprofessional, or untrustworthy to a non-technical East Asian creator.

| Feature | Why Expected | Complexity | Dependencies / Notes |
|---------|--------------|------------|----------------------|
| Hero section with headline + value-prop subhead + single primary CTA | Every serious SaaS page opens this way; absence signals "placeholder still up" | LOW | CTA = Hermes deep-link (`https://t.me/LalaBot?start=...`); headline must localize per locale |
| Product demo visual in hero | Non-technical creators need to *see* a conversation happening, not read about it; motion/screenshot raises comprehension and trust | MEDIUM | A short looping chat animation (fake or real transcript) in the hero card; does not require live API calls — can be a static/animated asset |
| Value proposition section (above fold or immediately below hero) | Creators need to understand "what do I get" within 5 seconds before they scroll; Japanese UX norm: elaborate, not sparse | LOW | Three-benefit layout (chat / voice / multi-channel) with icons; copy must be outcome-focused, not feature-focused |
| Four generative pillars section (chat / voice / image / video) | Roadmap mandates this section; creators comparing AI services expect a capability list | LOW | Image + video can be shown as "coming soon" — they are part of the product story even if not live yet; avoids positioning gap vs future |
| "How it works" — 3-step onboarding flow | Non-technical creators need reassurance that setup is simple; "managed white-glove" must be made concrete | LOW | Three steps: (1) message Lala on Telegram, (2) we build your twin, (3) your fans chat with it; no technical jargon; each step needs a visual |
| Multi-channel deployment story section | Roadmap mandates this; creators want to know where their twin lives (lala.la + Telegram + their own channels) | LOW | Illustrate the three surfaces with screenshots/icons; "your own channels" = downloadable assets for social (future), described as coming |
| Primary CTA button — sticky or repeated | Single conversion goal; SaaS pages that have one CTA convert at ~13.5% vs ~10.5% for 5+ CTAs | LOW | Same Hermes deep-link at hero, mid-page, and footer; consistent wording across locales |
| Responsive / mobile-first layout | 80%+ of JP/TW/HK creator traffic is mobile; Taiwan particularly large-block mobile-oriented design norm | MEDIUM | Mobile-first CSS; Tailwind v4 already in stack; full-bleed blocks on mobile, grid layout on desktop |
| EN / JA / ZH-TW localization of all copy | JP/TW/HK creators will be skeptical of any service not in their language; Japanese in particular sees language as a trust signal | MEDIUM | Uses existing i18next infrastructure; CTA copy must be culturally adapted, not literal translate (e.g., JA button: 「無料で始める」not "Sign Up") |
| Footer with basic company info | Japanese users specifically expect company credentials (company name, contact, legal notice) in footer; absence raises fraud suspicion | LOW | Company name, contact email or form link, privacy policy link, AI disclosure notice |
| Privacy / data notice (linked) | GDPR/APPI/PDPA — Japanese and Taiwanese creators are data-conscious; privacy link in footer is a trust prerequisite | LOW | Links to existing DSAR portal or a static privacy page; does not need to be full GDPR text on marketing site |
| Page load performance (LCP < 2.5s on mobile) | East Asian mobile networks can be fast but creators will bounce on slow pages; Google PageSpeed matters for SEO too | MEDIUM | Lazy-load images, use WebP/AVIF, preload hero assets; Vite handles this well; no external font blocking |

---

## Differentiators

Features that set the lala.la marketing site apart from generic "AI chatbot for creators" competitors like Fanvue AI, FanWake, Delphi.ai, and Character.AI's creator tools.

| Feature | Value Proposition | Complexity | Dependencies / Notes |
|---------|-------------------|------------|----------------------|
| "Managed service" messaging framing | Competitors are self-serve tools; lala.la's pitch is "we do the work" — this is a distinct positioning most creator AI sites don't have | LOW | Copy must repeatedly use "we manage", "done for you", "your twin is ready in days"; use founder/concierge framing not "configure your bot" |
| Social proof section with creator quote(s) | Asian creator market is testimonial-driven; even one authentic quote from Claire (or a placeholder testimonial for launch) dramatically increases trust | LOW | A single named creator testimonial with photo earns more trust than brand stats; use Claire's voice once she is live; placeholder OK for launch |
| "White-glove onboarding" concreteness block | Competitors are vague about setup; lala.la can differentiate by showing exactly what the onboarding looks like (e.g., a screenshot of the Hermes Telegram DM flow) | MEDIUM | A real or staged screenshot of the Hermes bot conversation; shows non-technical creators it's a simple DM exchange, not a form |
| Compliance / safety trust badges or paragraph | JP/TW creators care about not embarrassing themselves; showing that lala.la has a moderation pipeline and eval gate (without technical detail) is a conversion differentiator | LOW | "Your twin never goes live without passing our 30-case safety review" — short, plain-language, no need to describe the eval suite architecture |
| Creator ownership / portability callout | Non-exclusive license + "your data is yours" is a trust signal that sophisticated creators respond to; most competitors don't surface this | LOW | One-liner in the value-prop section or a dedicated "creator rights" callout block |
| Locale-adaptive CTA copy (not just translated) | Most localized SaaS sites translate; JP/TW creators respond to culturally-tuned CTA language (e.g., JA: 「まずはラーラに話しかけてみて」, not a corporate imperative) | MEDIUM | Requires native copywriting per locale; budget a round of native speaker review |
| Demo section — sample conversation transcript | Showing a realistic sample conversation (in-locale) lets creators visualize the product; reduces "I don't understand what this does" drop-off | MEDIUM | Static transcript cards (not live API) in each locale language; shows character voice, soft CTA nudge, and AI disclosure footer in the transcript |
| Animated or video hero visual | Motion captures attention and explains the product faster than text; creator audiences are visually oriented | MEDIUM | Short MP4/WebM loop (10-15s) of a fan chat interaction; autoplay muted; fallback static image for slow connections |

---

## Anti-Features

Things to deliberately NOT build in this milestone, even if they seem natural or are commonly requested.

| Anti-Feature | Why Requested | Why It's Wrong Here | What to Do Instead |
|--------------|---------------|---------------------|--------------------|
| Pricing / billing page | Creators naturally want to know cost | Locked out-of-scope (PROJECT.md); self-serve signup not yet built; a pricing page without a payment flow creates expectation gaps | "Contact us / Start via Hermes" model; pricing is discussed in the onboarding DM |
| Self-serve signup form or waitlist form | Standard SaaS pattern | No backend to handle signups; adds a broken flow; managed onboarding means Hermes is the intake; a form creates a second funnel that competes with the Telegram CTA | Single CTA to Hermes deep-link; no email capture form on the marketing site |
| Blog / documentation / help-center | Creators expect support content | Out-of-scope (PROJECT.md, milestone v2.0); content operations cost not justified at N=1 | Defer to a future milestone; FAQs can be answered in the Hermes DM flow |
| Live demo / interactive chat widget | Shows the product in action | Would require the twin engine to be exposed publicly with an anonymous session — security, moderation, and billing implications; not a frontend-only change | Use a static animated transcript card instead; visually equivalent, zero backend risk |
| Social media links / community icons | Standard footer element | lala.la has no public social presence at N=1 launch; empty/placeholder links erode trust | Omit until there is content to link to |
| Creator dashboard / login CTA | Creators who are already onboarded need a dashboard | Authenticated dashboard is a separate surface (admin port 3001); linking to it from the marketing site before it is polished creates bad first impressions | Route existing creators to Hermes directly; dashboard link can be added after admin surface is stable |
| Popup / exit-intent modal | Common SaaS conversion tactic | JP/TW users have strong aversion to pushy pop-up patterns; creates negative brand signal in high-uncertainty-avoidance cultures | Repeat the CTA natively in the page flow at hero, mid-page, and footer; inline > interruptive |
| Video autoplay with sound | Eye-catching | Aggressive on mobile, banned by browsers anyway; JP mobile culture values subtle UX | Autoplay muted loop; user initiates sound; or use animated GIF equivalent |
| Cookie consent banner (heavy EU-style) | GDPR compliance reflex | The marketing site has no analytics/tracking cookies at launch (Vite SPA, no third-party scripts assumed); a heavy banner where none is needed increases bounce | Add only if analytics tools requiring consent are added; start cookie-free or with a lightweight notice |

---

## Feature Dependencies

```
Hermes Telegram deep-link (already exists)
  └──required by──> Primary CTA button (hero, mid-page, footer)

Existing i18next infrastructure (already in web artifact)
  └──required by──> Locale-adaptive copy (EN / JA / ZH-TW)
                       └──enhances──> Locale-adaptive CTA copy
                       └──enhances──> Demo conversation transcript (per-locale)

Static/animated hero visual (new asset)
  └──required by──> Hero section
  └──optional enhancement──> Animated demo section

Net-new marketing design system (new — separate from fan-chat page styles)
  └──required by──> Every visible section
  └──must not affect──> Fan page (lala.la/[handle]) styles (separate Vite entry or scoped CSS)

Native-speaker copywriting review (ops dependency)
  └──required by──> JA + ZH-TW locale-adaptive CTA copy
  └──recommended for──> "How it works" step copy (plain language in locale)

Claire creator testimonial (ops dependency — available after she goes live)
  └──enhances──> Social proof section
  └──placeholder OK at launch──> Use anonymized quote or launch without social proof block
```

---

## MVP Definition

### Launch With (v2.0 — this milestone)

The minimum set that turns "placeholder page" into a real public front door.

- [ ] Hero: localized headline + sub-head + single Hermes CTA button + hero visual (static or looping animation)
- [ ] Value proposition: three-benefit block (chat / voice / multi-channel)
- [ ] Four generative pillars section (chat / voice / image-coming-soon / video-coming-soon)
- [ ] "How it works" — 3-step managed onboarding flow with visuals
- [ ] Multi-channel deployment story (lala.la + Telegram + own socials)
- [ ] Demo transcript card (static, per-locale, shows the AI in action)
- [ ] Social proof block (even a single quote; placeholder acceptable at launch if Claire not yet live)
- [ ] Compliance / safety one-liner ("all twins pass a 30-case safety review before going live")
- [ ] Creator ownership callout (non-exclusive license, data portability)
- [ ] Repeated CTA (mid-page + footer version of Hermes deep-link)
- [ ] Responsive / mobile-first layout throughout
- [ ] EN / JA / ZH-TW full copy localization (all sections)
- [ ] Footer: company info + privacy policy link + AI disclosure notice
- [ ] Net-new design system (typography, color, motion — separate from fan-chat page)
- [ ] lala.la/[handle] fan route unaffected (routing guard already in place)

### Add After Validation (v2.x — when Claire is live and generating signal)

- [ ] Real Claire creator testimonial (replaces placeholder)
- [ ] Hermes DM screenshot in "white-glove onboarding" block (requires Claire permission)
- [ ] Light analytics (Plausible / self-hosted, no third-party cookies) to measure CTA click-through
- [ ] OG/Twitter card meta tags per locale for social sharing

### Future Consideration (v3+)

- [ ] Animated/video hero (MP4/WebM product demo loop) — high production value, deferred until budget
- [ ] Blog / FAQ / help content — requires content operations
- [ ] Pricing page — requires self-serve billing to be built first
- [ ] Creator portal CTA — requires admin dashboard to be polished

---

## Feature Prioritization Matrix

| Feature | Creator Value | Implementation Cost | Priority |
|---------|---------------|---------------------|----------|
| Hero + primary CTA | HIGH | LOW | P1 |
| "How it works" 3-step | HIGH | LOW | P1 |
| Value proposition block | HIGH | LOW | P1 |
| EN/JA/ZH-TW localization | HIGH | MEDIUM | P1 |
| Mobile-first responsive layout | HIGH | MEDIUM | P1 |
| Four generative pillars | HIGH | LOW | P1 |
| Multi-channel deployment story | HIGH | LOW | P1 |
| Demo transcript card (static) | HIGH | MEDIUM | P1 |
| Net-new design system | HIGH | HIGH | P1 (milestone prerequisite) |
| Footer + privacy + compliance notice | MEDIUM | LOW | P1 |
| Social proof block | HIGH | LOW | P2 (depends on Claire going live) |
| Creator ownership callout | MEDIUM | LOW | P2 |
| Repeated CTA (mid + footer) | HIGH | LOW | P1 |
| Locale-adaptive CTA copy | MEDIUM | MEDIUM | P2 (native speaker review needed) |
| Page performance (LCP < 2.5s) | MEDIUM | MEDIUM | P2 |
| OG meta tags per locale | LOW | LOW | P3 |
| Analytics integration | LOW | LOW | P3 |

---

## East Asian Market-Specific Considerations

These are requirements born from the JP/TW/HK creator audience, not generic SaaS wisdom. Ignoring them produces a site that reads as culturally foreign to the exact audience it is targeting.

### Japan (JA)

- **Information density norm:** Japanese users equate thoroughness with trustworthiness. A sparse, ultra-minimal page signals that lala.la is hiding something. Each section should elaborate; use structured bullet lists inside feature blocks rather than single-line claims.
- **CTA copy tone:** Use 敬語 (keigo) register — respectful, not commanding. "まずは話しかけてみてください" (Please try talking to it first) converts better than "Start Now." Avoid imperative-mood buttons.
- **Company credentials:** The footer must have a visible company/service name and contact email. Japanese users do a background check before acting; missing credentials = scam signal.
- **Testimonial format:** A real name + photo testimonial from a JP creator would be extremely high-value. An anonymized testimonial ("A creator on 17 LIVE Japan") is acceptable but lower trust.
- **Font:** Use a JP-optimized web font (Noto Sans JP or Hiragino fallback); system default CJK rendering on non-Mac is poor.

### Taiwan (ZH-TW)

- **Mobile-first large blocks:** Taiwanese mobile UX norm is full-width content blocks with larger imagery and less text density than JP. Avoid the information-dense JP pattern on ZH-TW locale.
- **Traditional Chinese only:** Use ZH-TW (Traditional) throughout; Simplified Chinese (ZH-CN) signals mainland China product and is actively off-putting to Taiwanese creators.
- **Trust via familiarity:** Taiwan's creator market trusts products that feel embedded in their existing daily life (Telegram, Instagram). Showing that lala.la works *within* Telegram (not requiring a new app) is critical.
- **Social referral over brand authority:** Taiwanese creators respond to peer recommendations. A testimonial from another TW creator outweighs any brand stat.

### Hong Kong (ZH-HK / EN)

- **Bilingual by default:** HK creators often switch between Traditional Chinese and English in the same sentence. Consider offering ZH-TW and EN, and noting ZH-HK differences are minimal (ZH-TW covers HK adequately for launch).
- **Skepticism of mainland-origin AI products:** HK creators are particularly sensitive to data sovereignty. A clear "your data stays yours, non-exclusive license, delete any time" callout is high-value in HK.

---

## Competitor Reference

No direct competitor markets themselves specifically to JP/TW/HK managed AI twin services at this positioning. Closest analogues:

| Competitor | What They Show | What lala.la Should Do Differently |
|------------|---------------|-------------------------------------|
| Delphi.ai | Self-serve "clone yourself" SaaS; simple hero, pricing page, feature list | Managed service framing ("we build it for you") vs self-serve; no pricing page; Telegram CTA |
| Fanvue AI | Embedded feature within Fanvue; no standalone marketing site | Standalone brand; not tied to any specific monetization platform |
| FanWake | Simple hero + "request access" form; EN-only | Full locale support; Telegram intake vs email form |
| Character.AI creator tools | Developer-focused; technical docs front-and-center | Non-technical onboarding story; zero developer framing |

---

## Sources

- SaaS landing page best practices: [Webflow Blog](https://webflow.com/blog/saas-landing-page), [Lollypop Design SaaS anatomy](https://lollypop.design/blog/2025/june/saas-landing-page-design/)
- Japanese web design and trust patterns: [Humble Bunny](https://www.humblebunny.com/japanese-web-design-trends-in-japan/), [iCrossing Japan](https://www.icrossborderjapan.com/en/blog/website-design/japanese-web-design-trends/), [IGNITE Japan UX](https://igni7e.com/blog/navigating-japanese-website-design-and-ui-ux)
- East Asia influencer market: [AnyMind Group 2026 East Asia Playbook](https://anymindgroup.com/blog/2026-east-asia-influencer-marketing/)
- Cultural localization conversion: [Blend Localization](https://www.getblend.com/blog/localization-in-marketing-how-global-brands-drive-3x-conversion-with-cultural-adaptation/)
- CTA conversion research: [KlientBoost SaaS Landing Pages](https://www.klientboost.com/landing-pages/saas-landing-page/), single CTA vs multiple CTA conversion delta
- "How it works" section patterns: [Cortes.design SaaS breakdown](https://www.cortes.design/post/saas-landing-page-breakdown-example)
- White-glove onboarding positioning: [Bootstrapped Founder](https://thebootstrappedfounder.com/white-glove-onboarding/)
- Managed service / creator platform comparison: [Passion.io white label case studies](https://passion.io/blog/white-label-app-case-studies-creator-revenue-results)
- Internal project context: `.planning/PROJECT.md`, `docs/roadmap.md` — HIGH confidence (locked decisions)

---
*Feature research for: lala.la marketing site (milestone v2.0)*
*Researched: 2026-05-30*
