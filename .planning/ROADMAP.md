# Roadmap: lala.la

> **Canonical product roadmap:** [`../docs/roadmap.md`](../docs/roadmap.md) — shipped state and the forward initiatives.
> This file is the **GSD execution tracker**: per-phase plans, success criteria, and requirement traceability that record *how* each initiative was (or will be) delivered.

## Overview

The **v1.0 Launch Sprint** (Phases 1–4) is **complete** — the first creator (Claire) is live with chat, voice, both Telegram surfaces, web fan chat, and the full compliance/eval stack. Phase 1 stripped Supabase and laid the legal-grade foundation (KYC gate, Drizzle schema, data minimization). Phase 2 wired the full twin runtime — both chat surfaces, six-layer moderation, compliance disclosures, and async webhook decoupling. Phase 3 added voice synthesis, escalation-pattern detection, OCR intake, full i18n, and DSAR deletion. Phase 4 closed with a 30-case eval gate that passes 100% before the twin goes live.

The **v2.0 Full Twin Platform** milestone (Phases 5–9) is the live forward plan, tracking delivery against the five initiatives in [`../docs/roadmap.md`](../docs/roadmap.md): marketing site, Lala Concierge, image generation + LoRA, video generation, and content studio + social export.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3…): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

### Milestone v1.0 — Launch Sprint (COMPLETE)

- [x] **Phase 1: Baseline Repair** - Supabase removed, Drizzle + Replit PG live, KYC gate enforced, data minimization wired (completed 2026-05-28)
- [x] **Phase 2: Twin Runtime Core** - Both chat surfaces live with full moderation pipeline, SB 243 compliance, and async Telegram ack (completed 2026-05-29; founder UAT pending)
- [x] **Phase 3: Voice + Hardening** - GMI XTTS voice replies, escalation scoring, OCR intake queue, i18n complete, DSAR deletion (completed 2026-05-30; founder UAT pending)
- [x] **Phase 4: Eval Gate + Go-Live** - 30-case eval suite passes 100% hard-limit; weekly regression cron active; first creator goes live (completed 2026-05-30)

### Milestone v2.0 — Full Twin Platform (PLANNED)

Forward initiatives, detailed in [`../docs/roadmap.md`](../docs/roadmap.md). Requirement codes and per-phase success criteria are defined when each phase is planned via the GSD flow.

- [ ] **Phase 5: Lala.la marketing site** — polished, localized (en/ja/zh-TW) marketing front door; CTA into onboarding *(independent)* — see [docs/roadmap.md §1](../docs/roadmap.md)
- [ ] **Phase 6: Lala Concierge** — creator-facing help twin (reuses GMI chat engine) on Hermes + web dashboard; status-aware; KB-grounded *(independent)* — see [docs/roadmap.md §2](../docs/roadmap.md)
- [ ] **Phase 7: Image generation + LoRA management** — LoRA training jobs from onboarding photos + text-to-image + LoRA lifecycle, async via worker/queue *(independent)* — see [docs/roadmap.md §3](../docs/roadmap.md)
- [ ] **Phase 8: Video generation** — real talking-video provider (HeyGen or GMI) replacing stubs, async with status, asset-moderation gated *(independent)* — see [docs/roadmap.md §4](../docs/roadmap.md)
- [ ] **Phase 9: Content studio + social export** — unified studio (image/video/voice + gallery) with download + copy-ready caption/disclosure for manual social posting *(depends on Phase 7 + 8)* — see [docs/roadmap.md §5](../docs/roadmap.md)

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
**Plans:** 9 plans
- [x] 02-01-PLAN.md — Wave 0 unblock: api-server env schema (Supabase removed, OPENAI + HMAC required), Hermes token rename (TELEGRAM_BOT_TOKEN_LALA), fan-twin artifact scaffold (port 3002), 10 RED test files staged
- [x] 02-02-PLAN.md — Wave 1 foundations: Character Card V2 Zod schema, twins.voiceReferenceUrl + creators.monetizationUrl columns, HMAC conversation IDs, conversation history (loadHistory/persistTurn), inline locale detection, system-prompt builder + disclosure footer (CHAT-03/04, PERSONA-01/02, MOD-02, I18N-02)
- [x] 02-03-PLAN.md — Web fan chat pipeline: POST /api/twin/chat full pipeline (KYC → L1 → LLM → L3 → disclosure + 5th-turn monetization pivot) + GET /api/twin/:handle/profile (CHAT-01/02, MOD-01/03, COMPLY-01)
- [x] 02-04-PLAN.md — Fan-page extraction: fan-page.tsx reduced to composition shell + 8 typed fan components + typed lib/api.ts client + dark-mode CSS per UI-SPEC
- [x] 02-05-PLAN.md — Moderation pipeline L1+L3+L4+L5+L6: OpenAI omni-moderation wrapper, flagged-turn deflection (L4), founder Telegram notify (L5), safety_audit_log writes (L6), CrisisHelplineBubble (COMPLY-02), CTA suppression on flagged turns (MOD-04/05/06)
- [x] 02-06a-PLAN.md — Extract @workspace/twin-runtime shared lib: 10 twin-pipeline modules lifted out of api-server with 14 subpath exports + DI seam + extended TextGenerationPayload Telegram contract
- [x] 02-06b-PLAN.md — fan-twin async-ack + worker delivery: Telegraf webhook enqueue-only (<100ms), BullMQ textGeneration queue with update_id dedup, worker 6-layer moderation mirror + GMI LLM + Telegram sendMessage, helpline-first split, disclosure footer (CHAT-05/06, COMPLY-01)
- [x] 02-07-PLAN.md — Hermes scenes + persona wizard: @telegraf/session/pg persistence (replaces in-memory Map), consent WizardScene, 8-step persona wizard → Character Card V2 + monetizationUrl, /status KYC visibility, /pause /resume SLA (KYC-03, ONBOARD-01/02)
- [x] 02-08-PLAN.md — Voice sample + revoke: /voice WizardScene (Telegram voice → Object Storage → twins.voice_reference_url), /revoke_voice (consent revoke + clear URL + enqueue revocation), worker modality + 60s SLA logging (ONBOARD-03)

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
**Plans:** 8/8 plans complete (founder UAT of SC1–SC5 runbook pending)
- [x] 03-01-PLAN.md — Wave 0 unblock: opossum legitimacy gate, founder GMI TTS endpoint confirmation, VOICE_URL_SIGNING_SECRET provisioning, normalizeLocale helper (cross-lib locale drift fix)
- [x] 03-02-PLAN.md — Wave 1: schema foundation — safety_audit_log.category_scores jsonb + fan_name_masks + creator_deletion_log tables + dsarDeletion BullMQ queue + extended VoiceGenerationPayload + [BLOCKING] drizzle-kit push + Supabase migration (MOD-07, ONBOARD-04, COMPLY-04 prereqs)
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
- v1.0 Launch Sprint: Phases execute in numeric order 1 → 2 → 3 → 4 (complete)
- v2.0 Full Twin Platform: Phases 5, 6, 7, 8 are independent (parallelizable); Phase 9 depends on 7 + 8

### Milestone v1.0 — Launch Sprint

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Baseline Repair | 6/6 | Complete | 2026-05-28 |
| 2. Twin Runtime Core | 9/9 | Complete — except DSAR web portal + email suppression still 503-stubbed (see gap note) | 2026-05-29 |
| 3. Voice + Hardening | 8/8 | Code-complete; pending live execution | 2026-05-30 |
| 4. Eval Gate + Go-Live | 4/4 | Complete | 2026-05-30 |

**Milestone v1.0: COMPLETE** — 27/27 plans shipped. Status of the remaining live-execution items:

- **Schema** — good (Drizzle migrations applied).
- **Object Storage** — wired; needs a live round-trip test (voice reference upload + signed proxy fetch).
- **SB 243 disclosure + crisis helpline (COMPLY-01/02)** — code-complete; pending live execution/visual smoke test.
- **Voice (Phase 3 SC1–SC5)** — code-complete; pending live execution: voice happy-path + circuit-breaker fallback, Crescendo escalation, /review_masks, i18n routing, DSAR-bot sweep.

**Known gap (NOT code-complete despite the Phase 2 label):** the **self-service web DSAR portal** (`artifacts/api-server/src/routes/dsar.ts` + `dsar-portal.tsx`/`fan-dsar.tsx`) and **email suppression-log writes** (`routes/email-webhooks.ts`) are still `PHASE_1_STUB` 503s — their "restored in Phase 2" comment was never actioned. The creator DSAR *bot* path (COMPLY-04, plan 03-04) IS complete; only the fan-facing web self-service flow + email suppression remain. Neither maps to a numbered v1 requirement; tracked as a v1.0 follow-up (candidate for an inserted phase or v2.0 hardening).

### Milestone v2.0 — Full Twin Platform

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Lala.la marketing site | 0/TBD | Not started | - |
| 6. Lala Concierge | 0/TBD | Not started | - |
| 7. Image generation + LoRA | 0/TBD | Not started | - |
| 8. Video generation | 0/TBD | Not started | - |
| 9. Content studio + social export | 0/TBD | Not started | - |
