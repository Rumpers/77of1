# Design System — lala.la Marketing Site

> **Scope:** the public marketing site only (`artifacts/web`, milestone v2.0).
> All values map to `--mkt-*` tokens scoped under `[data-surface="marketing"]` in
> `artifacts/web/src/index.css` (`@layer marketing-tokens`). **Never** add `--mkt-*`
> to `@theme inline` or `:root`, and never reference them outside the
> `[data-surface="marketing"]` ancestor — that isolation keeps the fan chat page
> visually untouched (Phase 5 success criterion 1).

## Product Context
- **What this is:** Managed AI digital-twin service for influencers. Creators onboard via Telegram ("Lala"); fans chat with the creator's AI twin at `lala.la/[handle]` or a fan-twin bot; the twin nudges fans toward the creator's existing monetization platforms.
- **Who it's for (this site):** Creators (17 LIVE influencers, JP / TW / HK) deciding whether to onboard. Secondary: their fans arriving from links.
- **Space/industry:** Creator monetization tooling × AI companion product. Peers: Fanvue, Patreon, 17LIVE (creator side); Character.ai, Replika (AI-companion side).
- **Project type:** Marketing site (single localized landing page, EN / JA / ZH-TW).
- **Memorable thing:** *Your presence, always on* — a violet glow that feels alive against deep dark. The one image to remember is the **violet→fuchsia bloom** behind the twin.

## Aesthetic Direction
- **Direction:** Luminous Infrastructure — premium managed-service credibility with human warmth.
- **Decoration level:** intentional, expressive at focal points (hero + CTAs only). Gradient-mesh glow + faint grain for depth; restraint everywhere else.
- **Mood:** Trustworthy, premium, alive. A creator is handing over her likeness and voice — the site must feel like serious infrastructure, not a toy, while staying warm enough for an expressive audience.
- **Core move (anti-slop):** invert the canvas. Violet light on **deep violet-ink**, never violet-on-white. This is the single decision that separates lala.la from the white-SaaS norm and from the AI-slop "purple gradient on white" pattern.
- **Reference feel:** Linear / Vercel aurora depth, recolored to an owned violet→fuchsia and warmed for creators.

## Typography
- **Display/Hero:** **Bricolage Grotesque** (700–800) — characterful geometric display, distinctive without being gimmicky. Used for h1/h2, the wordmark, and step numerals.
- **Body / UI:** **Geist** (400/500/600) — clean, modern, credible "infrastructure" tone; good tabular figures.
- **CJK:** **Noto Sans JP** (JA) and **Noto Sans TC** (ZH-TW) — already wired in Phase 5 via Fontsource with `font-display: swap` + 400-weight preload. Body font stack lists Geist first, then Noto for CJK fallback.
- **Code/labels (minor):** **Geist Mono** — token labels, timestamps, technical accents only.
- **Loading:** self-hosted via Fontsource (Phase 5 strategy — no Google Fonts CDN in production). The preview page uses the CDN for convenience only.
- **Scale (`--mkt-text-*`, unchanged from Phase 5 structure):**
  - hero `clamp(2.6rem, 6vw, 4.6rem)` · section `clamp(1.7rem, 3.5vw, 2.6rem)`
  - 3xl 1.875 · 2xl 1.5 · xl 1.25 · lg 1.125 · base 1 · sm .875 · xs .75 (rem)
- **Leading:** tight 1.04 (display), body 1.6, **cjk 1.8** (mandatory for JA/TC legibility).
- **Tracking:** display `-0.02em`; eyebrows `+0.14em` uppercase.

## Color
- **Approach:** expressive accent on a restrained dark neutral base. Violet is the brand; the violet→fuchsia bloom is the one expressive flourish.
- **Canvas / text:**
  - `--mkt-bg` **#0D0A14** — violet-tinted near-black (not pure black, not white)
  - `--mkt-fg` **#F4F1FA** — warm violet-white
  - `--mkt-muted-fg` **#9D94B5** — violet-gray secondary text
- **Surfaces / lines:**
  - `--mkt-surface-1` **#16111F** · `--mkt-surface-2` **#1F1830** · `--mkt-border` **#2A2238**
- **Accent (brand violet — matches the twin brand `263 80% 58%` in the fan app):**
  - `--mkt-accent` **#7C3AED** · `--mkt-accent-hover` **#6D28D9** · `--mkt-accent-fg` **#FFFFFF**
- **Signature glow:**
  - `--mkt-glow-from` **#7C3AED** → `--mkt-glow-to` **#D946EF** (violet→fuchsia). Used for hero/footer mesh blooms, gradient headline spans, the orb, and CTA shadow.
- **Semantic (inherit fan-app hues, retuned for dark):** success #34D399 · warning #FBBF24 · error #F87171 · info #38BDF8. Use sparingly — marketing rarely needs them.
- **Dark mode:** the site IS dark-first by design. There is no light variant for v1 (a light toggle would misrepresent the system). If ever needed, redesign surfaces rather than inverting.
- **Contrast:** `#F4F1FA` on `#0D0A14` ≈ 16:1 (AAA). Muted `#9D94B5` on bg ≈ 6.5:1 (AA). Accent `#7C3AED` is for fills/glow, not body text.

## Spacing
- **Base unit:** 4px (`--mkt-spacing` scale unchanged from Phase 5).
- **Density:** comfortable → spacious. Sections at ~84px vertical padding; hero ~90–120px.
- **Scale:** xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64).
- **Max content width:** `--mkt-maxw` **1120px**, 24px gutters.

## Layout
- **Approach:** hybrid — disciplined grid for the four content sections; one editorial asymmetric hero (`1.15fr / .85fr`) with the twin visual overlapping the bloom.
- **Grid:** 2-col pillars / 3-col steps on desktop, all collapse to 1-col ≤860px.
- **Border radius (`--mkt-radius-*`):** sm 0.5rem · md 0.875rem · lg 1.25rem · pill 999px.
- **Mobile-first invariant:** no horizontal overflow at 375px (verified: scrollWidth = 375 in preview).

## Motion
- **Approach:** intentional, not decorative. One orchestrated hero load (eyebrow → headline → sub → CTA → bloom ignites, staggered), slow "breathing" glow on bloom/orb.
- **Easing:** enter `ease-out` · exit `ease-in` · move `ease-in-out`.
- **Duration:** micro 50–100ms · short 150–250ms (hover/CTA lift) · medium 250–400ms · long 400–700ms (entrance). Breathe loop ~7s.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables the breathe loop and all scroll-reveal (enforced in Phase 7). Hero headline/image render at full opacity on first paint — no `initial opacity:0` on LCP elements.

## Compliance — SB 243 Disclosure
- A **visible** AI-companion disclosure renders on the page, not only a footer ToS link.
- Pattern: violet-outlined pill, `AI twin · not a real person`, with a glowing fuchsia LED dot. Present at the hero and repeated in the footer legal line.

## `--mkt-*` Token Map (replace Phase 5 placeholders wholesale)
| Token | Old placeholder | New value |
|---|---|---|
| `--mkt-bg` | `#ffffff` | `#0D0A14` |
| `--mkt-fg` | `#111111` | `#F4F1FA` |
| `--mkt-surface-1` | `#f5f5f5` | `#16111F` |
| `--mkt-surface-2` | `#ebebeb` | `#1F1830` |
| `--mkt-border` | `#e0e0e0` | `#2A2238` |
| `--mkt-accent` | `hsl(263 80% 58%)` | `#7C3AED` |
| `--mkt-accent-hover` | `hsl(263 80% 50%)` | `#6D28D9` |
| `--mkt-accent-fg` | `#ffffff` | `#FFFFFF` |
| `--mkt-muted-fg` | `#666666` | `#9D94B5` |
| `--mkt-glow-from` | _(new)_ | `#7C3AED` |
| `--mkt-glow-to` | _(new)_ | `#D946EF` |
| `--mkt-font-sans` | `'Inter Variable', ...` | `'Geist', 'Noto Sans JP', 'Noto Sans TC', system-ui, sans-serif` |
| `--mkt-font-display` | _(new)_ | `'Bricolage Grotesque', system-ui, sans-serif` |
| `--mkt-radius-sm/md/lg` | `.375/.625/1rem` | `0.5/0.875/1.25rem` |
| `--mkt-radius-pill` | _(new)_ | `999px` |

Spacing and type-scale tokens are kept as-is from Phase 5 (structure was sound).

## Artifacts
- Live preview (real fonts/tokens): `~/.gstack/projects/Rumpers-77of1/designs/design-system-20260601/preview.html`
- Renders: `shot-desktop.png`, `shot-mobile.png`, `shot-hero.png` (same dir)

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-01 | Initial design system "Luminous Infrastructure" | Created by /design-consultation. Formalizes the chosen "violet pop" direction; inverts to dark violet-ink canvas to escape the AI-slop white+Inter+purple placeholder shipped in Phase 5. |
| 2026-06-01 | Dark-first, no light variant (v1) | Premium-trust signal + luminous violet only reads on dark. A light toggle would misrepresent the system. |
| 2026-06-01 | Bricolage Grotesque (display) + Geist (body) | Distinctive without gimmick; both self-hostable via Fontsource; harmonize with Noto CJK. Explicitly avoids Inter / Space Grotesk convergence. |
| 2026-06-01 | Violet→fuchsia (#7C3AED→#D946EF) signature bloom | The single expressive risk; the memorable "always on" glow. Brand violet #7C3AED matches the fan-app twin brand for cross-surface coherence. |
