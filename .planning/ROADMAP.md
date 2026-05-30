# Roadmap: lala.la

## Overview

Four phases over four weeks deliver the first live creator: Phase 1 strips Supabase and lays the legal-grade foundation (KYC gate, Drizzle schema, data minimization). Phase 2 wires the full twin runtime — both chat surfaces, six-layer moderation, compliance disclosures, and async webhook decoupling. Phase 3 adds voice synthesis, escalation-pattern detection, OCR intake, full i18n, and DSAR deletion. Phase 4 closes with a 30-case eval gate that must pass 100% before the twin goes live.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Baseline Repair** - Supabase removed, Drizzle + Replit PG live, KYC gate enforced, data minimization wired (completed 2026-05-28)
- [ ] **Phase 2: Twin Runtime Core** - Both chat surfaces live with full moderation pipeline, SB 243 compliance, and async Telegram ack
- [ ] **Phase 3: Voice + Hardening** - GMI XTTS voice replies, escalation scoring, OCR intake queue, i18n complete, DSAR deletion
- [x] **Phase 4: Eval Gate + Go-Live** - 30-case eval suite passes 100% hard-limit; weekly regression cron active; first creator goes live (completed 2026-05-30)

## Phase Details

### Phase 1: Baseline Repair
**Goal**: The platform runs cleanly on Replit PostgreSQL with no Supabase dependency, a legally correct KYC gate that blocks all twin chat until the creator signs, and data-minimization guarantees baked into the schema from day one
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, KYC-01, KYC-02, PERSONA-03, COMPLY-03
**Success Criteria** (what must be TRUE):
  1. All three Replit ports (8080, 22333, 3001) respond without error after a cold deploy; no Supabase client import survives in the codebase
  2. `POST /chat` with a creator whose `creator_kyc.status` is null, pending, or unknown returns HTTP 423 with a locale-appropriate error message — never passes through
  3. The KYC agreement text presented to a creator explicitly names voice synthesis scope, duration, and revocability as a signed line item
  4. The Drizzle schema migration runs clean and defines all seven core tables: `creators`, `twins`, `creator_kyc`, `consent_grants`, `conversation_messages`, `generation_jobs`, `safety_audit_log`
  5. No raw fan message content or PII appears in any log line or audit record; only hashed identifiers are persisted
**Plans**: 6 plans
- [x] 01-01-PLAN.md — Drizzle schema for 8 core tables + creator_totp; drizzle-kit push to Replit PG; failing E2E test for KYC gate
- [x] 01-02-PLAN.md — api-server KYC vertical slice: isKycSigned + twin route 423 gate + Drizzle health probe + SignWell voice-synthesis clause checkpoint
- [x] 01-03-PLAN.md — Hermes Telegram bot fully migrated to @workspace/db; kill-switch SLA preserved; fan-payment functions deleted
- [x] 01-04a-PLAN.md — api-server leaf route stubs: safety-audit.ts rewritten with retention_category; supabase.ts deleted; 15 leaf route files Drizzle-migrated or 503-stubbed
- [x] 01-04b-PLAN.md — artifacts/worker migrated to @workspace/db; BullMQ scaffolding preserved; worker bodies stubbed per D-13
- [x] 01-04c-PLAN.md — Phase 1 cleanup: scrub @supabase/supabase-js from api-server/worker; delete apps/web/; cold-start verification; founder Replit Secrets checkpoint

### Phase 2: Twin Runtime Core
**Goal**: A fan can open `lala.la/[handle]` or a Telegram fan-twin bot, send a message to the creator's AI twin, receive a response that passed six moderation layers, and see a California SB 243 AI disclosure — all within 30 seconds of first message
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: KYC-03, ONBOARD-01, ONBOARD-02, ONBOARD-03, PERSONA-01, PERSONA-02, CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06, MOD-01, MOD-02, MOD-03, MOD-04, MOD-05, MOD-06, COMPLY-01, COMPLY-02, I18N-02
**Success Criteria** (what must be TRUE):
  1. Fan opens `lala.la/[handle]`, sees an AI disclosure in their detected locale, sends a text message, and receives an in-character twin reply with a soft CTA linking to the creator's monetization platform
  2. Fan sends a message to the Telegram fan-twin bot; the bot returns HTTP 200 immediately and delivers the twin reply asynchronously — no Telegram timeout occurs under normal LLM latency
  3. A harmful fan input (e.g., self-harm phrasing) is blocked before reaching the LLM, replaced with a locale-appropriate safe deflection, and triggers a crisis helpline injection; the turn is appended to `safety_audit_log` with hashed identifiers only
  4. A high-risk moderation flag triggers a Sentry alert and a Lala bot notification to the founder within the request lifecycle
  5. Creator can complete full onboarding (consent, persona intake, voice sample upload, character card generation) via Lala Telegram bot with no technical skills required; creator can pause/resume or revoke voice consent from the same bot
**UI hint**: yes
**Plans:** 4 plans
- [x] 04-01-PLAN.md — Wave 1: scaffold @workspace/eval package + 30-case suite (10 in-character / 10 boundary-push / 5 hard-limit / 5 prompt-injection) + pure gradeCase + grader unit tests + RED runner E2E test [BLOCKING pnpm install] (EVAL-01)
- [x] 04-02-PLAN.md — Wave 2: eval_runs Drizzle table + migration + [BLOCKING] drizzle push, runner.ts (direct twin-runtime calls, temperature 0, isolated eval-probe sessions), persist + isGoLiveEligible + CLI; turns RED runner test GREEN (EVAL-01)
- [x] 04-03-PLAN.md — Wave 3 (parallel with 04-04): founderAuth middleware + POST /api/admin/twin/:creatorId/activate go-live gate (422 unless isGoLiveEligible) + 401/422/200 tests (EVAL-01)
- [x] 04-04-PLAN.md — Wave 3 (parallel with 04-03): evalRegression queue + weekly upsertJobScheduler cron + eval-regression worker with Sentry regression alert + deliberate-regression test (success criterion 2) (EVAL-02)

### Phase 3: Voice + Hardening
**Goal**: Twin replies include optional voice audio via GMI Cloud XTTS, the moderation pipeline detects gradual-escalation patterns across turns, founders can review OCR-extracted fan-name masks, all user-facing strings are available in EN/JP/ZH-TW, and creators can request full data deletion
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: ONBOARD-04, VOICE-01, VOICE-02, VOICE-03, MOD-07, COMPLY-04, I18N-01
**Success Criteria** (what must be TRUE):
  1. Fan receives a voice reply (pre-signed URL with TTL) generated from the creator's reference sample via GMI XTTS; when GMI is unavailable the circuit-breaker falls back to text-only without surfacing an error to the fan
  2. A multi-turn gradual-escalation attempt (Crescendo-style) is detected and escalated before any individual turn would score high enough to trigger L1/L3 alone
  3. Founder sees a Telegram review queue with OCR-extracted fan-name mask candidates and can approve or reject each with a single action
  4. Every user-facing string (CTA, disclosure statement, deflection, helpline) renders correctly in EN, JP, and ZH-TW; switching Telegram language or browser Accept-Language changes the locale within one session
  5. Creator can send a DSAR deletion request via Lala bot; all conversation history and voice files for that creator are deleted within the 30-day SLA
**Plans:** 6/8 plans executed
- [ ] 03-01-PLAN.md — Wave 0 unblock: opossum legitimacy gate, founder GMI TTS endpoint confirmation, VOICE_URL_SIGNING_SECRET provisioning, normalizeLocale helper (cross-lib locale drift fix)
- [ ] 03-02-PLAN.md — Wave 1: schema foundation — safety_audit_log.category_scores jsonb + fan_name_masks + creator_deletion_log tables + dsarDeletion BullMQ queue + extended VoiceGenerationPayload + [BLOCKING] drizzle-kit push + Supabase migration (MOD-07, ONBOARD-04, COMPLY-04 prereqs)
- [x] 03-03-PLAN.md — Wave 2 (parallel): MOD-07 vertical slice — escalation.ts scorer + categoryScores persistence in moderation.ts + scoreEscalation wired into both /api/twin/chat and text-generation worker; flagged escalation triggers same deflection+helpline+notify flow as L1
- [x] 03-04-PLAN.md — Wave 2 (parallel): COMPLY-04 vertical slice — Hermes /dsar wizard scene (CONFIRM gate, kill-switch flip BEFORE enqueue per Pitfall 8) + dsar-deletion worker (8-step sweep, anonymize-not-delete per Pitfall 4) + Hermes i18n strings (EN/JA/ZH-TW)
- [x] 03-05-PLAN.md — Wave 3 (parallel with 03-06; disjoint files): ONBOARD-04 vertical slice — Hermes /review_masks scene with Telegraf inline keyboards + founder gate via FOUNDER_TELEGRAM_USER_ID + UUID-regex callback_data validation + getNextPendingMask/setMaskReviewed helpers + i18n
- [x] 03-06-PLAN.md — Wave 3: voice provider — opossum-wrapped GMI TTS client (timeout 30s, breaker trips at 50% over 60s) + GmiVoiceProvider real impl + full voice-generation worker body (SB 243 self-harm short-circuit, dual consent rechecks per Pitfall 7, size-aware sendVoice/sendAudio per Pitfall 5, disclosure caption) + shouldGenerateVoice/enqueueVoiceJob helpers
- [x] 03-07-PLAN.md — Wave 4: VOICE-03 wiring — HMAC voice-token.ts + GET /api/voice/:jobId proxy (Replit Object Storage has no presigned URLs per Pitfall 2) + OpenAPI spec addition + codegen + enqueueVoiceJob wired into /api/twin/chat and text-generation worker + VoiceMessageBubble (fan SPA)
- [x] 03-08-PLAN.md — Wave 5: E2E verification — voice happy-path + circuit-breaker integration test + Crescendo integration test + comprehensive human-verify checkpoint across all 5 ROADMAP success criteria

### Phase 4: Eval Gate + Go-Live
**Goal**: The creator's twin must pass a 30-case evaluation suite (100% on hard-limit and prompt-injection categories) before the twin is made live; a weekly regression cron ensures the standard holds post-launch
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: EVAL-01, EVAL-02
**Success Criteria** (what must be TRUE):
  1. Running the eval suite against a creator's twin produces a pass/fail report across all 30 cases (10 in-character, 10 boundary-push, 5 hard-limit, 5 prompt-injection); the twin cannot be set live unless hard-limit and injection scores are both 100%
  2. A deliberate regression (lowering a hard-limit guardrail) causes the weekly cron to fire a Sentry alert within the next scheduled run
**Plans:** 4/4 plans complete
- [x] 04-01-PLAN.md — Wave 1: scaffold @workspace/eval package + 30-case suite (10 in-character / 10 boundary-push / 5 hard-limit / 5 prompt-injection) + pure gradeCase + grader unit tests + RED runner E2E test [BLOCKING pnpm install] (EVAL-01)
- [x] 04-02-PLAN.md — Wave 2: eval_runs Drizzle table + migration + [BLOCKING] drizzle push, runner.ts (direct twin-runtime calls, temperature 0, isolated eval-probe sessions), persist + isGoLiveEligible + CLI; turns RED runner test GREEN (EVAL-01)
- [x] 04-03-PLAN.md — Wave 3 (parallel with 04-04): founderAuth middleware + POST /api/admin/twin/:creatorId/activate go-live gate (422 unless isGoLiveEligible) + 401/422/200 tests (EVAL-01)
- [x] 04-04-PLAN.md — Wave 3 (parallel with 04-03): evalRegression queue + weekly upsertJobScheduler cron + eval-regression worker with Sentry regression alert + deliberate-regression test (success criterion 2) (EVAL-02)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Baseline Repair | 6/6 | Complete   | 2026-05-28 |
| 2. Twin Runtime Core | 0/TBD | Not started | - |
| 3. Voice + Hardening | 6/8 | In Progress|  |
| 4. Eval Gate + Go-Live | 4/4 | Complete   | 2026-05-30 |

---

## Milestone v2.0 — Marketing Site

Replace the placeholder landing page with a polished, localized public marketing front door that sells lala.la as a managed AI digital-twin service and routes creators into onboarding. Frontend-only: all work lives in `artifacts/web`. No backend/API changes, no new artifact, no port changes.

### Phases (v2.0)

- [ ] **Phase 5: Foundation & Isolation** - CSS token isolation, typed i18n namespace, static SEO assets, CJK fonts, and fan-route safety locked before any section component is written
- [ ] **Phase 6: Marketing Components & Navigation** - All content sections, footer, locale-switching nav, Telegram CTA deep-link, and responsive layout built as isolated components
- [ ] **Phase 7: Assembly, Polish & Compliance** - Page assembled from components, locale verification across EN/JA/ZH-TW, scroll animations with reduced-motion respect, visible SB 243 disclosure, and no-overclaiming copy confirmed

### Phase Details (v2.0)

### Phase 5: Foundation & Isolation
**Goal**: The marketing site's CSS tokens, i18n types, static SEO assets, and CJK font loading are locked in place so no component work can cause fan-page contamination, OG-tag invisibility, i18n drift, or route collisions
**Depends on**: Phase 4 (v1.0 milestone complete; this is the first v2.0 phase)
**Requirements**: MKT-10, MKT-13, MKT-15, MKT-16, MKT-17, MKT-20
**Success Criteria** (what must be TRUE):
  1. All marketing CSS is scoped under `[data-surface="marketing"]` using `--mkt-*` tokens in a dedicated `@layer marketing-tokens` block; the fan chat page is visually unchanged after a full marketing CSS commit
  2. The `marketing` namespace is added to `lib/i18n.ts` with `satisfies Record<Locale, Messages>` enforced; adding a key in EN without adding it in JA or ZH-TW causes a TypeScript compile error
  3. `index.html` carries real marketing `<title>`, `<meta description>`, and all `og:*` / `twitter:card` tags statically; `curl -A "Twitterbot/1.0" https://lala.la/en` returns the correct `og:title` without JavaScript execution
  4. `public/og-marketing.png`, `public/sitemap.xml` (3 locale URLs), and `public/robots.txt` are committed and served as static assets
  5. Noto Sans JP is loaded with `font-display: swap` and a `<link rel="preload">` for the 400-weight woff2; on a simulated slow-3G connection text shows a system fallback immediately with no invisible-text period
**Plans**: 3 plans (2 waves)
- [ ] 05-01-PLAN.md — CSS token isolation (@layer marketing-tokens / [data-surface="marketing"]), typed marketing i18n namespace (satisfies-enforced), React.lazy code-split + route-safety (MKT-10, MKT-13, MKT-20)
- [ ] 05-02-PLAN.md — Static SEO assets: public/sitemap.xml (3 locale URLs + hreflang), public/robots.txt (allow roots / disallow fan pages), public/og-marketing.png brand card (MKT-16, MKT-17)
- [ ] 05-03-PLAN.md — Self-hosted Fontsource fonts + vite stable-woff2 filename + index.html marketing meta/og/twitter/hreflang + working Noto Sans JP preload; Google Fonts CDN removed (MKT-15, MKT-16, MKT-17)
**UI hint**: yes

### Phase 6: Marketing Components & Navigation
**Goal**: Every content section, the marketing footer, the sticky nav with locale switcher, and the Telegram CTA deep-link are built as isolated, individually verifiable React components that consume only `--mkt-*` tokens and the typed `marketing` i18n namespace
**Depends on**: Phase 5
**Requirements**: MKT-01, MKT-02, MKT-03, MKT-04, MKT-05, MKT-06, MKT-07, MKT-08, MKT-09, MKT-11, MKT-14
**Success Criteria** (what must be TRUE):
  1. Visiting the hero section in isolation shows a localized headline, sub-headline, hero visual, and a single primary Telegram CTA button that opens the correct Hermes deep-link (`https://t.me/<bot>?start=<payload>`); visitors without Telegram see a graceful fallback text prompt
  2. Each of the four content sections (value proposition, four pillars, multi-channel, how it works) renders correctly in EN with accurate copy; the two deferred pillars (image, video) are visually marked "coming soon"
  3. The primary CTA button appears at hero, mid-page, and footer with identical wording; tapping any instance routes to the same deep-link URL
  4. The sticky marketing nav includes a `MarketingLocaleSwitcher` that navigates to `/:locale` (no handle) and does not interfere with the fan-page locale switcher
  5. No component layout overflows at 375px viewport width; verified by resizing browser or using DevTools responsive mode
**Plans**: TBD
**UI hint**: yes

### Phase 7: Assembly, Polish & Compliance
**Goal**: The marketing page is assembled from all components, verified in all three locales, animated tastefully with reduced-motion support, and confirmed compliant — visible AI disclosure on screen, no deceptive copy, fan route intact
**Depends on**: Phase 6
**Requirements**: MKT-12, MKT-18, MKT-19
**Success Criteria** (what must be TRUE):
  1. `src/pages/home.tsx` renders the complete marketing page with all sections assembled in correct order; switching locale via the nav updates all copy without a full page reload and without navigating to a fan-page handle
  2. Scroll-reveal animations trigger on non-LCP elements only; the hero headline and image render at full opacity on first paint with no `initial={{ opacity: 0 }}`; toggling `prefers-reduced-motion: reduce` in OS accessibility settings disables all scroll animations
  3. A visible SB 243 AI-companion disclosure statement (not only a footer ToS link) is present on the rendered page in all three locales
  4. The fan route `lala.la/[handle]` loads the fan chat page correctly after the marketing site is deployed; no marketing CSS variable leaks into the fan page UI
**Plans**: TBD
**UI hint**: yes

### Progress (v2.0)

**Execution Order:**
Phases execute in numeric order: 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Foundation & Isolation | 0/3 | Not started | - |
| 6. Marketing Components & Navigation | 0/TBD | Not started | - |
| 7. Assembly, Polish & Compliance | 0/TBD | Not started | - |
