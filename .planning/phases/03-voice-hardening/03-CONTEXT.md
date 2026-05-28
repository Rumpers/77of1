# Phase 3: Voice + Hardening - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous full-send — discuss skipped per user "trust planner defaults" choice)

<domain>
## Phase Boundary

Twin replies include optional voice audio via GMI Cloud XTTS, the moderation pipeline detects gradual-escalation patterns across turns, founders can review OCR-extracted fan-name masks, all user-facing strings are available in EN/JP/ZH-TW, and creators can request full data deletion.

**Phase 3 requirements:** ONBOARD-04, VOICE-01, VOICE-02, VOICE-03, MOD-07, COMPLY-04, I18N-01

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, REQUIREMENTS.md acceptance criteria, and codebase conventions (CLAUDE.md tech stack section) to guide decisions.

### Pre-locked by upstream phases (do NOT re-decide)
- D-02-12: JP crisis helpline `0120-279-338` (any new helpline references must use this)
- D-02-13: PERSONA-02 constitution storage = Replit Object Storage at `creators/{creatorId}/constitution.md` — voice files follow the same bucket pattern (`creators/{creatorId}/voice_reference.wav`, `creators/{creatorId}/generations/{jobId}.wav`)
- D-02-15: MOD-02 owned by `lib/twin-runtime/src/system-prompt.ts` — new MOD-07 (escalation scoring) lives alongside in twin-runtime, not in api-server
- `@workspace/twin-runtime` is the canonical shared lib for all moderation/conversation/system-prompt code; new voice + escalation libs go there, not in api-server
- BullMQ + ioredis already wired; voice-generation queue is a new queue but reuses the worker artifact (no new artifact)
- All Telegram outbound from worker uses `bot.telegram.sendMessage` without `.launch()` — same pattern as Phase 2's text path
- COMPLY-01 disclosure footer applies to voice deliveries too (caption text on the audio message)

### Autonomous-mode defaults (Claude picks reasonable values, founder overrides via discuss-phase if needed)
1. **XTTS endpoint:** Confirm with GMI support / Helicone proxy inspection. If endpoint TBD at execution time, surface a `[BLOCKING]` founder checkpoint. Fall-back placeholder for tests: `https://api.gmi-serving.com/v1/audio/xtts` (per CLAUDE.md MEDIUM-confidence guess) — but actual production endpoint MUST be founder-confirmed.
2. **Voice job timeout:** 30s default, circuit-breaker trips at 3 consecutive failures within 60s → fall back to text-only with no fan-facing error.
3. **Pre-signed URL TTL:** 24 hours (long enough for fan to play in-session and shortly after; short enough to limit re-distribution).
4. **MOD-07 escalation scoring:** Sliding window of last 10 conversation turns per (creator_id, fan_id). Score is sum of L1+L3 category_scores weighted by recency (exponential decay, half-life 3 turns). Threshold 1.5 (sum, not individual). When exceeded → treat as L1 flag → deflection + helpline + audit + founder notify.
5. **DSAR deletion SLA:** Synchronous deletion within 24h (well under the 30-day legal SLA). Worker job sweeps: safety_audit_log, conversation_messages, generation_jobs, twins.character_card, twins.voiceReferenceUrl, Object Storage `creators/{id}/*`, consent_grants. Retain `creator_deletion_log` row (id only, hashed) for audit trail.
6. **OCR fan-name mask review (ONBOARD-04):** Telegram review queue command `/review_masks` in Hermes. Shows pending masks one at a time with approve/reject inline buttons. Approved masks land in a `fan_name_masks` table (handle ↔ mask string, used to redact names from logs).
7. **I18N-01 creator-facing strings:** Use `i18next` + JSON locale files for Hermes (mirror the web pattern). Locale resolution from Telegram `language_code` (en/ja/zh-TW), creator-side override stored in `creators.locale_preference`.
8. **Voice circuit breaker library:** Use `opossum` (npm package) if licensing-clean, else hand-roll a 30-line state machine. Founder approval needed for the package add (same supply-chain gate as `@telegraf/session` in 02-01).
9. **Telegram voice message format:** Send as voice note (Opus-encoded, ≤1MB), not as audio file — better fan UX. If voice file >1MB, send as audio file with caption.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research. Key consumption points:
- `lib/twin-runtime/` (Phase 2) — extend with `voice.ts`, `escalation.ts`, `dsar.ts`
- `artifacts/api-server/src/routes/twin.ts` (Phase 2) — extend to enqueue voice job + return voice URL when ready
- `artifacts/worker/src/workers/` — new voice-generation worker file
- `artifacts/hermes/src/` — new scenes for `/dsar`, `/review_masks`, i18n string extraction
- `lib/db/src/schema/index.ts` — new tables: `fan_name_masks`, `creator_deletion_log`, `voice_generation_jobs` (or reuse `generation_jobs`)
- `lib/queue/` — add `voice-generation` queue type

</code_context>

<specifics>
## Specific Ideas

- Voice reply UX on web: audio `<source>` element with native player + transcript fallback for accessibility (a11y)
- DSAR confirmation flow: Hermes asks `/dsar` → countdown message ("All your fan conversations + voice files will be deleted in 24 hours. Type CONFIRM to proceed.") → worker enqueues at 24h mark → final confirmation message with hashed audit ID
- Escalation detection should write to `safety_audit_log` with category `escalation_detected` and the cumulative score, NOT just the triggering message
- OCR provider: defer to founder discretion (Tesseract local vs cloud OCR like Google Vision). Phase 3 ships the review queue + table; OCR ingestion of media can be N=2 (deferred to creator #3+)

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped. Founder may add deferrals in plan-phase review.

</deferred>
