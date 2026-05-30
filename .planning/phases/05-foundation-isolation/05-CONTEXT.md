# Phase 5: Foundation & Isolation - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

First phase of Milestone v2.0 (Marketing Site). Lock the marketing site's **foundation** so no later component work can contaminate the fan page, break social previews, drift i18n, or collide routes. This phase produces **no visible marketing sections** — it commits plumbing only.

**In scope (MKT-10, MKT-13, MKT-15, MKT-16, MKT-17, MKT-20):**
- `@layer marketing-tokens` in `index.css` with `[data-surface="marketing"]`-scoped `--mkt-*` tokens (net-new, isolated from fan-page tokens)
- `marketing` namespace added to `artifacts/web/src/lib/i18n.ts`, typed and compile-time key-complete across EN/JA/ZH-TW
- Real marketing meta in `index.html` (title, description, `og:*`, `twitter:card`) + committed `public/og-marketing.png`
- Static `public/sitemap.xml` (3 locale URLs), `public/robots.txt`, and per-locale `hreflang` `<link>` tags in `index.html`
- Noto Sans JP loaded with `font-display: swap` + preload (no mobile FOIT); self-host Inter, remove Google Fonts CDN `<link>`
- Fan route `lala.la/[handle]` and fixed Replit ports (8080/22333/3001) unaffected; marketing routes ordered above the fan catch-all; zero CSS leak into the fan page

**Out of scope (later phases / deferred):**
- Any marketing section component, nav, footer, or copy beyond meta strings (Phase 6)
- Page assembly, scroll animations, on-page SB 243 disclosure (Phase 7)
- Express bot-detect OG-injection middleware (deferred to v2.x — static `index.html` covers the use case)
- Any creator (Claire) likeness/asset on the marketing site (blocked on separate marketing-use authorization)

</domain>

<decisions>
## Implementation Decisions

### Brand & Meta Copy *(discussed with founder)*
- **D-05-01: Public brand string = `lala.la`.** The marketing `<title>` and `og:title` use the bare product brand `lala.la` (matches the domain), replacing the current `7of1` placeholder in `index.html`. Not "Lala" (the friendly bot persona name) and not a brand+descriptor composite.
- **D-05-02: Positioning angle = managed-service, creator-facing.** The meta description / og tagline leads with "we run your AI twin for you" (managed service is the research-identified differentiator vs self-serve competitors). The marketing site's audience is **creators** (the hero CTA deep-links into the Hermes onboarding bot), not fans — copy speaks to creators. Exact wording is open (subject to native-speaker review for on-page copy in later phases); the *angle* is locked. Reference seed: "Your AI twin, fully managed — we keep your fans engaged in your voice while you create."
- **D-05-03: Static OG/meta text is written in English.** Because social-card crawlers don't execute JS, all three locale URLs (`/en`, `/ja`, `/zh-TW`) share one static meta block in `index.html`. That static block is English, matching `hreflang x-default=en`. Shared `/ja` and `/zh-TW` links show the EN preview until the (deferred) bot-detect middleware exists. On-page content still localizes via the `marketing` i18n namespace; only the crawler preview is fixed to EN.

### Skipped Areas — Research-Aligned Defaults (founder may override before/at planning)
- **D-05-04 (Social share card): `og-marketing.png` = logo + tagline only, no creator likeness.** Brand-level card (1200×630), no Claire/creator asset (no marketing-use authorization on file). Founder did not elect to design this in discussion — default stands unless overridden.
- **D-05-05 (Visual direction): commit neutral placeholder `--mkt-*` tokens now; defer the real marketing design system to a UI-SPEC.** Phase 5 establishes the *token structure and isolation mechanism* (`@layer marketing-tokens`, `[data-surface="marketing"]`), seeded with neutral/placeholder values. The actual marketing aesthetic (palette, type personality, light/dark surface, motion) is settled via `/gsd:ui-phase` before Phase 6 component work. This keeps Phase 5 about isolation, not brand design.
- **D-05-06 (Default locale): keep EN-default.** `DEFAULT_LOCALE = "en"` stays; root `/` continues redirecting to `/en` (already implemented in `App.tsx`); `hreflang x-default = en`. Least-change default despite the JP/TW-weighted audience. Founder may revisit if they want an Asian-locale front door.

### Claude's Discretion
- Noto Sans JP delivery — **self-host (Fontsource woff2) vs Google Fonts CDN** — left to research/planning. Open technical question flagged in research SUMMARY: confirm whether Replit serves `public/` static assets through a CDN; if static serving of the ~4.5 MB woff2 is slow, Google Fonts CDN for Noto Sans JP only is acceptable. **Non-negotiable regardless of choice:** `font-display: swap` + `<link rel="preload">` for the 400-weight woff2.
- Exact final wording of all meta strings (within D-05-01/02/03 constraints), token naming conventions under `--mkt-*`, and `vite-plugin-sitemap` vs hand-written `sitemap.xml` — planner's call.
- Whether to add `react-helmet-async` for `<html lang>` switching (research marks it optional) — planner's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone v2.0 research (read all — HIGH confidence, code-derived)
- `.planning/research/SUMMARY.md` — synthesis + cross-document tension resolutions; the spine for this milestone
- `.planning/research/STACK.md` — exact package additions (Fontsource Inter/Noto Sans JP, vite-plugin-sitemap), versions, "do NOT add i18next"
- `.planning/research/ARCHITECTURE.md` — `[data-surface="marketing"]` / `--mkt-*` isolation, route-ordering, file-level change map
- `.planning/research/PITFALLS.md` — Pitfalls 1–4/9/11 are the failure modes this phase exists to prevent (OG invisibility, CSS leakage, i18n drift, CJK FOIT, JS-injected hreflang, bundle bloat)
- `.planning/research/FEATURES.md` — audience (non-technical JP/TW/HK creators, mobile-first) and managed-service framing rationale

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — MKT-10, MKT-13, MKT-15, MKT-16, MKT-17, MKT-20 (acceptance criteria, source of truth)
- `.planning/ROADMAP.md` §"Phase 5: Foundation & Isolation" — goal + 5 success criteria

### Codebase touch-points (files this phase modifies)
- `artifacts/web/index.html` — current placeholder meta ("7of1", Google Fonts CDN `<link>`) to be replaced
- `artifacts/web/src/lib/i18n.ts` — `Locale` type + `Messages` type + `messages: Record<Locale, Messages>` (806 lines); `marketing` namespace appends here
- `artifacts/web/src/index.css` — Tailwind v4 `@theme inline`; existing `@layer base`/`@layer utilities`; add `@layer marketing-tokens`
- `artifacts/web/src/App.tsx` — wouter `Switch`; `/:locale` (home) above `/:locale/:handle` (fan catch-all); `DEFAULT_LOCALE` redirect
- `artifacts/web/src/pages/home.tsx` — current 8-line placeholder (untouched this phase beyond what foundation requires; replaced in Phase 7)
- `artifacts/web/vite.config.ts`, `artifacts/web/public/` — sitemap/robots/og asset wiring

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/i18n.ts` already uses an explicit `Record<Locale, Messages>` annotation (line 176) — adding `marketing` to the `Messages` type already enforces compile-time key completeness across all three locales (the `satisfies` guarantee MKT-13 asks for is effectively already the pattern; keep it).
- `App.tsx` already enumerates named routes (`onboard`, `account/data-request`, `dashboard`) **above** the `/:locale/:handle` fan catch-all — the route-ordering safety pattern MKT-20 requires already exists; this phase must preserve it, not invent it.
- `public/robots.txt` and `public/opengraph.jpg` already exist — MKT-16/17 update/replace these rather than create from scratch (note: research specifies a fresh `og-marketing.png` 1200×630, distinct from the existing `opengraph.jpg`).

### Established Patterns
- Tailwind v4 with `@theme inline` mapping `--color-*` → `hsl(var(--token))`; fan page consumes `--primary`, `--background`, `.dark` block (D-02-08: fan UI is dark-mode-only). Marketing tokens must be a **separate** `--mkt-*` namespace — never reference fan-page tokens (Pitfall 2).
- i18n is hand-rolled and typed (no runtime i18n lib on web); `getMessages(locale)` / `isValidLocale(locale)` already exported.

### Integration Points
- Root `/` → `/${DEFAULT_LOCALE}` redirect and `getPageLocale()` derive locale from the first path segment — sitemap/hreflang URLs must match this exact `/:locale` shape (`/en`, `/ja`, `/zh-TW`).

</code_context>

<specifics>
## Specific Ideas

- Reference seed for the meta description (managed-service, EN, creator-facing): "Your AI twin, fully managed — we keep your fans engaged in your voice while you create." Treat as a direction, not final copy.
- Brand wordmark in copy is lowercase `lala.la`; user-visible bot name elsewhere is "Lala" — do not conflate the two in marketing meta.

</specifics>

<deferred>
## Deferred Ideas

- **Per-locale OG/social-preview meta** — requires the Express bot-detect OG-injection middleware, explicitly deferred to v2.x (STATE.md deferred items). For now the static EN meta serves all locales (D-05-03).
- **Creator-likeness on marketing assets (OG card, hero, testimonial)** — blocked on a separate written marketing-use authorization from Claire (current consent covers twin operation only). Tracked in STATE.md blockers.
- **Asian-locale default front door** — keeping EN-default for now (D-05-06); revisit if founder wants `/ja` or detected-locale as the canonical entry.
- **Full marketing visual design system** — routed to `/gsd:ui-phase` (UI-SPEC) before Phase 6; Phase 5 only commits placeholder `--mkt-*` token scaffolding (D-05-05).

None of the above are in Phase 5 scope — discussion stayed within the foundation boundary.

</deferred>

---

*Phase: 5-Foundation & Isolation*
*Context gathered: 2026-05-31*
