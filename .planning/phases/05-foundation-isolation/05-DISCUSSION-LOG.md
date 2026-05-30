# Phase 5: Foundation & Isolation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 5-Foundation & Isolation
**Areas discussed:** Brand & meta copy

---

## Gray Area Selection

Founder was offered four foundation gray areas (multiSelect): Brand & meta copy, Social share card, Visual direction, Default locale.

**Selected:** Brand & meta copy
**Not selected (captured with research-aligned defaults):** Social share card, Visual direction, Default locale

---

## Brand & Meta Copy

### Q1 — Brand string in `<title>` / `og:title`

| Option | Description | Selected |
|--------|-------------|----------|
| lala.la | Bare product brand, matches the domain; clean. | ✓ |
| Lala | Friendly user-visible bot persona name. | |
| lala.la — descriptor | Brand + built-in descriptor in the title tag. | |

**User's choice:** lala.la
**Notes:** Replaces the current `7of1` placeholder in `index.html`.

### Q2 — Positioning angle for meta description / og tagline

| Option | Description | Selected |
|--------|-------------|----------|
| Managed-service | "We run it for you" — research-identified differentiator vs self-serve competitors. | ✓ |
| Always-on engagement | Lead with the 24/7 fan-outcome angle. | |
| Ownership & control | Lead with creator control / non-exclusive ownership. | |

**User's choice:** Managed-service
**Notes:** Surfaced during discussion that the marketing audience is **creators** (hero CTA deep-links into Hermes onboarding), so meta copy is creator-facing. Exact wording deferred to later phases (native-speaker review); the angle is locked.

### Q3 — Language of the static OG/meta text

| Option | Description | Selected |
|--------|-------------|----------|
| English | Static meta in EN; matches hreflang x-default=en; all locale URLs share it. | ✓ |
| Japanese | Static meta in JA for the JP/TW-weighted audience. | |
| Bilingual line | Pack two languages into the description. | |

**User's choice:** English
**Notes:** Constraint explained — social crawlers don't run JS, so all three locale URLs share one static meta block until the deferred bot-detect middleware. On-page content still localizes; only the crawler preview is fixed to EN.

---

## Claude's Discretion

- Noto Sans JP delivery (self-host woff2 vs Google Fonts CDN) — research/planning to resolve; `font-display: swap` + preload non-negotiable either way.
- Final meta string wording (within the locked constraints), `--mkt-*` token naming, `vite-plugin-sitemap` vs hand-written `sitemap.xml`, optional `react-helmet-async`.

## Deferred Ideas

- Per-locale OG/social-preview meta (needs deferred bot-detect middleware — v2.x).
- Creator-likeness on marketing assets (blocked on separate marketing-use authorization).
- Asian-locale default front door (kept EN-default for now).
- Full marketing visual design system (routed to `/gsd:ui-phase` before Phase 6).
