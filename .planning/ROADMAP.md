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
- [ ] **Phase 4: Eval Gate + Go-Live** - 30-case eval suite passes 100% hard-limit; weekly regression cron active; first creator goes live

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
**Plans**: TBD

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
**Plans**: TBD

### Phase 4: Eval Gate + Go-Live
**Goal**: The creator's twin must pass a 30-case evaluation suite (100% on hard-limit and prompt-injection categories) before the twin is made live; a weekly regression cron ensures the standard holds post-launch
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: EVAL-01, EVAL-02
**Success Criteria** (what must be TRUE):
  1. Running the eval suite against a creator's twin produces a pass/fail report across all 30 cases (10 in-character, 10 boundary-push, 5 hard-limit, 5 prompt-injection); the twin cannot be set live unless hard-limit and injection scores are both 100%
  2. A deliberate regression (lowering a hard-limit guardrail) causes the weekly cron to fire a Sentry alert within the next scheduled run
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Baseline Repair | 6/6 | Complete   | 2026-05-28 |
| 2. Twin Runtime Core | 0/TBD | Not started | - |
| 3. Voice + Hardening | 0/TBD | Not started | - |
| 4. Eval Gate + Go-Live | 0/TBD | Not started | - |
</content>
</invoke>
