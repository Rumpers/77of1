# Phase 3: Voice + Hardening - Research

**Researched:** 2026-05-28
**Domain:** Voice synthesis (GMI Cloud TTS), conversation-level moderation (Crescendo detection), creator-facing i18n, DSAR worker, founder review queue (Telegram inline keyboards)
**Confidence:** MEDIUM-HIGH overall — HIGH for everything that builds on Phase 2 codebase patterns; MEDIUM for GMI TTS endpoint (model name unverified, request shape unknown); LOW for Replit Object Storage pre-signed URL support (SDK does NOT expose it — workaround required).

## Summary

Phase 3 is mostly a **composition layer** over Phase 2 — the moderation pipeline, conversation persistence, worker scaffolding, BullMQ queues, Object Storage helpers, Telegraf scenes, and `@workspace/twin-runtime` shared lib all exist and only need extensions. The four genuinely new technical surfaces are: (1) a TTS provider call that GMI Cloud has not publicly documented at endpoint level, (2) a conversation-level escalation scorer that runs *across* turns (the existing L1/L3 pipeline scores only single messages), (3) a creator-facing DSAR sweep that touches every table written in Phases 1–2 plus Object Storage, and (4) a Telegram inline-keyboard review queue — a UI pattern not yet used in Hermes.

**Primary recommendation:** Front-load the **GMI TTS endpoint confirmation** before any other Phase 3 work begins. It is the only item in the phase with `MEDIUM` confidence on basic existence. Every other requirement (MOD-07, COMPLY-04, I18N-01, ONBOARD-04) can be implemented from existing patterns in this repo without external dependency-shape uncertainty. The plan must include a `[BLOCKING]` Wave-0 founder checkpoint that either (a) confirms the GMI TTS model identifier + request shape via GMI support email or Helicone proxy inspection, or (b) approves a fallback plan (text-only Phase 3, defer VOICE-01/02/03 to Phase 3.5).

**Second recommendation:** Replit Object Storage SDK does **not** expose pre-signed URL generation. VOICE-03 acceptance criterion "fan receives a pre-signed URL with TTL" cannot be met with the existing `lib/object-storage.ts` helper as-written. The plan needs one of: (a) proxy the audio bytes through `/api/voice/:jobId` with an HMAC-signed short-lived token (recommended — keeps storage path uniform with `creators/{id}/constitution.md`), or (b) switch the bucket to direct Google Cloud Storage SDK access (Replit uses GCS underneath) and use GCS `getSignedUrl()`. Recommend (a) — smaller blast radius, no new dependency.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Pre-locked by upstream phases (do NOT re-decide):**
- D-02-12: JP crisis helpline `0120-279-338` (any new helpline references must use this)
- D-02-13: PERSONA-02 constitution storage = Replit Object Storage at `creators/{creatorId}/constitution.md` — voice files follow the same bucket pattern (`creators/{creatorId}/voice_reference.{ogg|wav}`, `creators/{creatorId}/generations/{jobId}.{ogg|wav}`)
- D-02-15: MOD-02 owned by `lib/twin-runtime/src/system-prompt.ts` — new MOD-07 (escalation scoring) lives alongside in twin-runtime, not in api-server
- `@workspace/twin-runtime` is the canonical shared lib for all moderation/conversation/system-prompt code; new voice + escalation libs go there, not in api-server
- BullMQ + ioredis already wired; voice-generation queue is a new queue but reuses the worker artifact (no new artifact)
- All Telegram outbound from worker uses `bot.telegram.sendMessage` without `.launch()` — same pattern as Phase 2's text path
- COMPLY-01 disclosure footer applies to voice deliveries too (caption text on the audio message)

### Claude's Discretion

All implementation choices below the pre-locked decisions are at Claude's discretion (discuss phase skipped). Use ROADMAP phase goal, success criteria, REQUIREMENTS.md acceptance criteria, and codebase conventions (CLAUDE.md tech stack section) to guide decisions.

**Autonomous-mode defaults (founder may override via discuss-phase if needed):**
1. **XTTS endpoint:** Confirm with GMI support / Helicone proxy inspection. If endpoint TBD at execution time, surface a `[BLOCKING]` founder checkpoint. Fall-back placeholder for tests: `https://api.gmi-serving.com/v1/audio/xtts` — actual production endpoint MUST be founder-confirmed.
2. **Voice job timeout:** 30s default, circuit-breaker trips at 3 consecutive failures within 60s → fall back to text-only with no fan-facing error.
3. **Pre-signed URL TTL:** 24 hours (long enough for fan to play in-session and shortly after; short enough to limit re-distribution).
4. **MOD-07 escalation scoring:** Sliding window of last 10 conversation turns per (creator_id, fan_id). Score is sum of L1+L3 category_scores weighted by recency (exponential decay, half-life 3 turns). Threshold 1.5 (sum, not individual). When exceeded → treat as L1 flag → deflection + helpline + audit + founder notify.
5. **DSAR deletion SLA:** Synchronous deletion within 24h (well under the 30-day legal SLA). Worker job sweeps: safety_audit_log, conversation_messages, generation_jobs, twins.character_card, twins.voiceReferenceUrl, Object Storage `creators/{id}/*`, consent_grants. Retain `creator_deletion_log` row (id only, hashed) for audit trail.
6. **OCR fan-name mask review (ONBOARD-04):** Telegram review queue command `/review_masks` in Hermes. Shows pending masks one at a time with approve/reject inline buttons. Approved masks land in a `fan_name_masks` table (handle ↔ mask string, used to redact names from logs).
7. **I18N-01 creator-facing strings:** Use `i18next` + JSON locale files for Hermes (mirror the web pattern). Locale resolution from Telegram `language_code` (en/ja/zh-TW), creator-side override stored in `creators.locale_preference` (or reuse `creator_config.hermes_language`).
8. **Voice circuit breaker library:** Use `opossum` (npm package) if licensing-clean, else hand-roll a 30-line state machine. Founder approval needed for the package add (same supply-chain gate as `@telegraf/session` in 02-01). [VERIFIED: opossum v9.0.0 Apache-2.0 license, actively maintained by Node.js Foundation nodeshift team, [OK] from slopcheck.]
9. **Telegram voice message format:** Send as voice note (Opus-encoded, ≤1MB), not as audio file — better fan UX. If voice file >1MB, send as audio file with caption.

### Deferred Ideas (OUT OF SCOPE)

None — discuss phase skipped. Founder may add deferrals in plan-phase review.

Per Phase 2 CONTEXT `## Deferred Ideas` (still in force for Phase 3):
- Multi-tenant fan-twin bot routing (deep-link `/start <handle>`) — v2 when scale demands. Phase 3 does NOT need to revisit this; ONE creator at N=1.
- Streaming token-by-token LLM responses — STREAM-01 / v2
- Brand color WCAG check — Phase 3 hygiene; founder may opt in
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ONBOARD-04 | Founder review queue (Telegram) shows OCR-extracted fan-name masks with approve/reject action for uncertain masks | Telegraf v4 inline keyboard pattern + new `fan_name_masks` table + Hermes `/review_masks` command. OCR ingestion DEFERRED to creator #2+ per CONTEXT specifics — Phase 3 ships review queue scaffold + table only. |
| VOICE-01 | Twin can reply with voice audio generated from creator's reference sample via GMI Cloud XTTS zero-shot voice synthesis | GMI TTS endpoint must be founder-confirmed in Wave 0. Available GMI Cloud TTS models (per docs.gmicloud.ai): ElevenLabs v3 (ToS-blocked per CLAUDE.md), MiniMax Voice Clone Speech 2.6 HD/Turbo, Step Audio Edit X (zero-shot voice cloning). Implementation: extend `lib/providers/src/providers/gmi-client.ts` for audio endpoint OR add `GmiTtsClient`; fill `GmiVoiceProvider.enqueueVoiceGeneration` stub. |
| VOICE-02 | Voice generation runs as an async BullMQ job; circuit-breaker fallback to text-only reply when GMI is unavailable | `voice-generation` BullMQ queue already exists in `lib/queue/src/queues.ts`. Worker stub exists at `artifacts/worker/src/workers/voice-generation.ts`. Wrap GMI call in opossum CircuitBreaker; on `breaker.fallback()`, worker writes no `result_url` and posts only the text reply via the existing text-generation outbound path. |
| VOICE-03 | Generated voice files stored in Replit Object Storage; fan receives a pre-signed URL with TTL | Replit Object Storage TypeScript SDK does NOT support pre-signed URLs. Recommend HMAC-signed token proxy endpoint `GET /api/voice/:jobId?token=...` that streams from `creators/{id}/generations/{jobId}.ogg`. Storage path mirrors Phase 2 D-02-13 convention. |
| MOD-07 | Conversation-level escalation scoring detects gradual-escalation bypass patterns (Crescendo-style) across turns, not only per-message | New module `lib/twin-runtime/src/escalation.ts` reads last N moderation results per (creator_id, fan_id) from `safety_audit_log` and computes recency-weighted score. Falls back to "no signal" when audit log has no rows. Runs AFTER L1, BEFORE LLM call. |
| COMPLY-04 | Creator can request full data deletion (DSAR) via Lala bot; all twin conversation history and voice files deleted within 30 days | New `/dsar` Hermes WizardScene with 24h confirmation delay. BullMQ `dsar-deletion` queue + worker sweeps 6 tables + Object Storage prefix. New `creator_deletion_log` table (creator_id_hash, deleted_at, audit_id) preserves trail without retaining the creator's PII. |
| I18N-01 | All user-facing strings in web funnel (CTAs, disclosure, deflections) and Telegram bot messages available in EN, JP, and ZH-TW | Web side: largely DONE in Phase 2 (`artifacts/web/src/lib/i18n.ts` exists). Fan-twin: bot replies route via `@workspace/twin-runtime/deflections|helplines|disclosure` — already i18n'd. **NEW work for Phase 3:** extract Hermes inline strings (`artifacts/hermes/src/index.ts`, `scenes/*.ts`, `revoke-voice.ts`) into Hermes `i18n.ts` (already has the pattern — extend it). Add `i18next` ONLY if a third consumer needs middleware-style locale negotiation; otherwise keep the hand-rolled `t(lang)` pattern that already works. |

**Mapping to ROADMAP Success Criteria:**
- SC1 (voice reply with TTL) → VOICE-01 + VOICE-02 + VOICE-03
- SC2 (multi-turn escalation detection) → MOD-07
- SC3 (Telegram review queue) → ONBOARD-04
- SC4 (EN/JP/ZH-TW in one session) → I18N-01
- SC5 (DSAR within 30-day SLA) → COMPLY-04
</phase_requirements>

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives are load-bearing for this phase. The planner MUST verify each task complies:

- **pnpm only** — preinstall hook blocks npm/yarn. New package installs go through pnpm. [VERIFIED: `package.json` preinstall script in repo]
- **GMI Cloud for LLM + voice** — commodity-provider mandate. **ElevenLabs explicitly OUT** per CLAUDE.md "Explicit ToS concern for creator monetization use case". This rules out GMI's `elevenlabs-tts-v3` and `multilingual-v2` even though they're available on the GMI catalog.
- **No fan payment loop** — no Stripe extensions. DSAR worker must touch but not re-activate any dormant Stripe code paths.
- **Generated files** — `lib/api-zod/`, `lib/api-client-react/` are codegen targets. Any new endpoint (e.g., `GET /api/voice/:jobId`) must be added to `lib/api-spec/openapi.yaml` first, then regenerated. [Confirm by inspecting `lib/api-spec/`.]
- **Drizzle migrations** — schema changes go through `supabase/migrations/YYYYMMDDHHMMSS_name.sql` (primary) and `lib/db/src/schema/index.ts` (Drizzle source). Phase 3 needs new tables: `fan_name_masks`, `creator_deletion_log`, `dsar_requests` (or fold into `creator_deletion_log`).
- **`artifacts/hermes` does NOT use `@workspace/db`** — has its own inline DB layer at `artifacts/hermes/src/db.ts`. Any new Hermes DB calls (fan_name_masks reads/writes, dsar_requests inserts) MUST be added to `db.ts`, not imported from `@workspace/db`. (Verified in Phase 2 verification — `hermes/session.ts` uses `@telegraf/session/pg`'s own Pool, not the shared db.)
- **Ports fixed** — 8080 / 22333 / 3001 / 3002 (fan-twin from D-02-06). Phase 3 introduces no new HTTP server processes.
- **TypeScript strict mode** — `noImplicitAny: true`, `strictNullChecks: true`. New code must compile under root `tsconfig.base.json`.
- **Commit convention** — `feat(scope): description` / `fix(scope): description`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| GMI TTS HTTP call | API / Backend (`lib/providers`) | Worker (consumes via registry) | LLM/TTS provider HTTP lives in `lib/providers`, matching `GmiTextProvider` precedent. Workers consume via `ProviderRegistry.voice`. |
| Voice job enqueue | API / Backend (`api-server` route) | Worker (consumer) | Web `/api/twin/chat` route + fan-twin webhook both decide whether to enqueue voice synthesis; the worker is purely a consumer. |
| Voice job processing | Worker (`artifacts/worker/src/workers/voice-generation.ts`) | API (status polling) | Long-running (5-30s); cannot run inline in HTTP request without exceeding Telegram 30s timeout. |
| Voice file storage | Backend (`lib/object-storage.ts` shared) | — | Same bucket as Phase 2 constitution + voice reference. Single storage owner. |
| Pre-signed URL serving | API (new `GET /api/voice/:jobId` route) | — | Replit SDK lacks pre-signed URL primitive; proxy through API with HMAC token. |
| Voice playback UI | Browser / Client (fan SPA) | Frontend Server (none) | New `<VoiceMessageBubble>` React component; HTML5 `<audio>` element + native controls. Fan-twin path: Telegram client renders the voice note natively. |
| Escalation scoring (MOD-07) | API / Backend (`lib/twin-runtime/src/escalation.ts`) | Worker (worker calls same function) | Pure function over `safety_audit_log` rows. Shared between web `routes/twin.ts` and `worker/text-generation.ts` via twin-runtime — same dual-consumer pattern as L1/L3. |
| OCR ingestion (deferred) | Worker (future job type) | — | Out of Phase 3 scope per CONTEXT specifics. Phase 3 ships review queue only. |
| Mask review queue (Hermes) | Creator-facing client (Hermes Telegraf) | DB (`fan_name_masks`) | Hermes is the creator's only client; `/review_masks` belongs there. DB writes via `hermes/src/db.ts`. |
| DSAR confirmation (Hermes) | Creator-facing client (Hermes Telegraf) | Queue (enqueues deletion job at +24h) | Telegraf WizardScene with `CONFIRM` text gate; enqueues `dsar-deletion` BullMQ job with `delay: 24*60*60*1000`. |
| DSAR sweep | Worker (`artifacts/worker/src/workers/dsar-deletion.ts` NEW) | DB + Object Storage | Long-running, idempotent; must touch 6 tables + ObjectStorage `list` + `delete`. |
| Hermes i18n | Creator-facing client (Hermes) | — | Extend existing `hermes/src/i18n.ts` `t()` function — no new lib. |
| Crisis helpline (already done) | Shared lib (`@workspace/twin-runtime/helplines`) | — | Phase 2 done. No Phase 3 work. |

## Standard Stack

### Core (new for Phase 3)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| opossum | ^9.0.0 | Circuit breaker around GMI TTS provider | [VERIFIED: GitHub.com/nodeshift/opossum] Maintained by Node.js Foundation nodeshift team; Apache-2.0; 1.7k stars; 62 releases; v9.0.0 (June 2025) requires Node.js ≥20; provides `fallback()`, `timeout`, `errorThresholdPercentage`, `resetTimeout`. De facto Node.js circuit breaker. [OK] from slopcheck. |
| @types/opossum | ^4.x | TypeScript types | [OK] from slopcheck. Opossum itself ships without bundled types; @types/opossum provides them via DefinitelyTyped. |

### Supporting (already in monorepo — reused for Phase 3)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| bullmq | ^5.56.1 | DSAR + voice-generation queues | Already wired. Just add `dsar-deletion` to `QUEUE_NAMES` + `createAllQueues`. |
| telegraf | ^4.16.3 | Hermes `/dsar`, `/review_masks` commands + inline keyboards | [VERIFIED: 4.16.3 latest stable] Already a dep. Inline keyboards via `Markup.inlineKeyboard([Markup.button.callback("✅ Approve", "approve:{id}")])`; callback handler via `bot.action(/^approve:(.+)$/, ...)`. |
| drizzle-orm | ^0.45.2 | New tables: `fan_name_masks`, `creator_deletion_log` | Established. Tables go in `lib/db/src/schema/index.ts`; Hermes consumes via its own `db.ts` (not `@workspace/db`). |
| @workspace/twin-runtime | (workspace) | escalation.ts, voice.ts, dsar.ts | Phase 2 established this as the shared lib. Phase 3 adds 3 new modules. |
| @workspace/db | (workspace) | API-server + worker DB access | Worker DSAR sweep, voice job status updates. |
| @telegraf/session | ^2.x | DSAR WizardScene state | Already wired in Hermes via Postgres adapter. |

### Hermes i18n — recommendation: extend the existing pattern

`artifacts/hermes/src/i18n.ts` already implements a hand-rolled `t(lang): Strings` pattern with `as const satisfies Record<Lang, Record<string, unknown>>` for type safety. This is sufficient for Phase 3 — **do NOT add `i18next` here**. The reason: Hermes has ~20 user-facing strings; adding `i18next` (peer-loader patterns, JSON loading, async init) is overkill for that count and would duplicate runtime locale-resolution logic that `@workspace/twin-runtime/locale` already owns.

| Decision | Path |
|----------|------|
| Extend `hermes/src/i18n.ts` `Strings` interface | New keys for `/dsar` flow, `/review_masks` flow, all scene replies |
| Locale source | `ctx.from.language_code` → coerce to `'en' \| 'ja' \| 'zh-tw'` → fall back to `'en'`; persist creator's override to `creator_config.hermes_language` (column already exists, line 193 of schema) |
| Web side | Already done in Phase 2 — no new work |
| Fan-twin side | Already i18n'd via shared `@workspace/twin-runtime` strings — no new work |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| opossum | Hand-rolled state machine (~30 lines) | Hand-roll loses jitter, halfOpen semantics, prometheus metrics integration, battle-tested edge cases. Opossum is small (no transitive runtime deps); the cost is one supply-chain entry. **Recommend opossum.** |
| Proxy endpoint for voice URLs | Direct GCS pre-signed URL via `@google-cloud/storage` SDK | GCS SDK works (Replit Object Storage IS GCS underneath) but adds a 2MB+ dep and requires service account credentials. Proxy endpoint is 30 lines, zero new deps, HMAC-based token (same crypto as `hmac-conversation.ts`). **Recommend proxy.** |
| i18next for Hermes | Hand-rolled `t(lang)` in `i18n.ts` | i18next is the industry standard but for ~20-50 strings the existing pattern is type-safer (compile-time exhaustiveness via `satisfies`) and zero-runtime-dep. **Recommend extending existing pattern.** Revisit if string count exceeds ~100. |
| Synchronous DSAR delete | Scheduled at +24h with confirmation | CONTEXT autonomous-default chose +24h delay for safety margin. Trade-off: synchronous deletion is faster but unrecoverable from user mistakes (typo'd `/dsar` could nuke the creator). Delayed deletion gives a 24h "oops" window. **Honor CONTEXT default.** |
| `omni-moderation-latest` for escalation scoring | Local heuristics (sentiment shift, lexical drift) | OpenAI's per-message scores are already computed in L1/L3; storing the raw `category_scores` (not just the binary `flagged`) in `safety_audit_log` lets us reuse them. Local heuristics add complexity and false-positive risk. **Recommend OpenAI score reuse** (requires audit log schema extension). |

### Installation Reference

```bash
# Phase 3 new packages — install in api-server (provider lives here) and worker (consumer)
pnpm --filter @workspace/api-server add opossum
pnpm --filter @workspace/api-server add -D @types/opossum
pnpm --filter @workspace/worker add opossum
pnpm --filter @workspace/worker add -D @types/opossum

# OR consolidate in lib/providers if the breaker wraps the GMI TTS client at provider level
pnpm --filter @workspace/providers add opossum
pnpm --filter @workspace/providers add -D @types/opossum
```

**Verified versions:**
- `opossum@9.0.0` (latest, June 2025) — `npm view opossum version` → `9.0.0`
- `@types/opossum@4.x` — `npm view @types/opossum version` → 4.x range
- `i18next@26.3.0` (NOT recommended for Hermes; listed for reference if web side needs upgrade)
- `tesseract.js@7.0.0` (NOT installing in Phase 3 — OCR deferred)
- `sharp@0.34.5` (NOT installing — image processing not required for review-queue scaffold)

## Package Legitimacy Audit

slopcheck v0.6.1 ran successfully on the new Phase 3 packages.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| opossum | npm | ~9 years (1st publish 2016) | ~2M/week (estimate from prior research) | github.com/nodeshift/opossum | [OK] | Approved |
| @types/opossum | npm | Long-standing (DefinitelyTyped) | high | github.com/DefinitelyTyped/DefinitelyTyped | [OK] | Approved |
| i18next | npm | ~13 years | ~10M/week | github.com/i18next/i18next | [OK] | Approved (only if needed beyond Hermes — not recommended) |
| i18next-fs-backend | npm | mature | high | github.com/i18next/i18next-fs-backend | [OK] | Approved (only if i18next adopted) |
| sharp | npm | mature | very high | github.com/lovell/sharp | [OK] | Approved (not in Phase 3 — OCR deferred) |
| tesseract.js | npm | mature | high | github.com/naptha/tesseract.js | [OK] | Approved (not in Phase 3 — OCR deferred) |
| **minimax-voice-clone** | **npm** | **does not exist** | **0** | **none** | **[SLOP]** | **REMOVED — never reference** |

**Packages removed due to slopcheck [SLOP] verdict:** `minimax-voice-clone` — slopcheck verdict: *"Package 'minimax-voice-clone' does not exist on npm. Your AI made it up."* Any AI-generated suggestion to install a "MiniMax voice clone npm SDK" must be rejected. MiniMax voice models on GMI Cloud are accessed via GMI's HTTP API, not via a per-vendor SDK.

**Packages flagged as suspicious [SUS]:** None.

**Caveat:** Future Phase 3 plan tasks may suggest additional packages (e.g., `node-clamav` if attachment scanning is added, audio-conversion libs for Opus encoding). Each such suggestion MUST be re-checked through slopcheck at plan-execution time. The plan should include `Task: legitimacy gate` per CONTEXT autonomous-default #8.

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│ FAN SURFACES                                                           │
│  • Fan Web (lala.la/{handle})        • Fan-Twin Telegram bot           │
└─────────┬───────────────────────────────────────┬──────────────────────┘
          │ POST /api/twin/chat                   │ webhook update
          ▼                                       ▼
┌────────────────────────┐               ┌──────────────────────────┐
│ api-server (port 8080) │               │ fan-twin (port 3002)     │
│  routes/twin.ts        │               │  src/index.ts (async-ack)│
│  ├ KYC gate            │               │  └ enqueue text-gen job  │
│  ├ verifyConversation  │               └────┬─────────────────────┘
│  ├ runL1Moderation     │                    │
│  ├ NEW: scoreEscalation│  ◄─── (MOD-07)     │
│  │   (reads safety_log)│                    │
│  ├ loadHistory         │                    │
│  ├ buildSystemPrompt   │                    ▼
│  ├ getTextProvider().generateText()  ┌──────────────────────────┐
│  ├ runL3Moderation     │              │ BullMQ (Redis)           │
│  ├ persistTurn         │              │  • text-generation       │
│  ├ NEW: enqueue voice  │  ──────────► │  • voice-generation NEW  │
│  │   job (if consent + │              │  • dsar-deletion NEW     │
│  │   creator opted-in) │              │  • consent-revocation    │
│  └ return text + voice │              └────┬─────────────────────┘
│    URL placeholder     │                   │                         
└────────────┬───────────┘                   ▼                         
             │                  ┌──────────────────────────────────┐
             │                  │ artifacts/worker                  │
             │                  │  ├ text-generation.ts (Phase 2)   │
             │                  │  ├ voice-generation.ts NEW BODY:  │
             │                  │  │   • opossum-wrapped GMI TTS    │
             │                  │  │   • write to ObjectStorage     │
             │                  │  │   • update generation_jobs.    │
             │                  │  │     result_url                 │
             │                  │  │   • fallback → text-only path  │
             │                  │  └ dsar-deletion.ts NEW           │
             │                  │    • sweep 6 tables + ObjStorage  │
             │                  └────────┬─────────────────────────┘
             │                           │
             │ poll /api/voice/:jobId    ▼
             │ (HMAC-token)    ┌────────────────────────────────────┐
             └────────────────►│ NEW: GET /api/voice/:jobId         │
                               │  • verify HMAC token (24h TTL)     │
                               │  • stream from ObjectStorage       │
                               │    creators/{id}/generations/...   │
                               └─────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ CREATOR SURFACE (Hermes — port assigned by Replit)                     │
│  • /dsar     → DSAR WizardScene (24h confirm)  → BullMQ dsar-deletion │
│  • /review_masks  → fan-name mask review queue (inline buttons)        │
│  • i18n: extend hermes/src/i18n.ts t() — EN/JA/ZH-TW                  │
└────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

Net-new files (additions to Phase 2 structure):

```
lib/twin-runtime/src/
├── escalation.ts          # MOD-07: scoreEscalation(creatorId, fanId, currentTurnScores)
├── voice.ts               # NEW: enqueueVoiceJob + helper for opting-in based on creator config
└── dsar.ts                # NEW: sweepCreatorData — pure function (no DB), takes db + bucket

lib/providers/src/providers/
├── gmi-client.ts          # MODIFY: extend with audio endpoint OR add gmi-tts-client.ts sibling
└── gmi-tts-client.ts      # NEW (optional): if audio API differs from chat/completions enough

artifacts/api-server/src/
├── providers/gmi/GmiVoiceProvider.ts  # MODIFY: fill stub with real GMI call wrapped in opossum
├── routes/voice.ts                    # NEW: GET /api/voice/:jobId — HMAC-token-gated proxy
├── lib/voice-token.ts                 # NEW: signVoiceToken(jobId, ttlSeconds), verifyVoiceToken
└── routes/twin.ts                     # MODIFY: after persistTurn, if voice opt-in: enqueueVoiceJob

artifacts/worker/src/workers/
├── voice-generation.ts                # MODIFY: fill stub — GMI TTS + opossum + ObjectStorage + result_url
└── dsar-deletion.ts                   # NEW

artifacts/hermes/src/
├── scenes/dsar.scene.ts               # NEW: WizardScene with CONFIRM gate, enqueue dsar-deletion delayed +24h
├── scenes/review-masks.scene.ts       # NEW: queue iterator + inline-keyboard approve/reject
├── db.ts                              # MODIFY: add fan-name-mask + dsar-request queries
├── i18n.ts                            # MODIFY: add Strings keys for /dsar, /review_masks, scene replies
└── index.ts                           # MODIFY: register dsarWizard + reviewMasksWizard; bot.command("/dsar"), bot.action(/^mask:(approve|reject):(.+)$/, ...)

lib/db/src/schema/
└── index.ts                           # MODIFY: + fan_name_masks, + creator_deletion_log, + safety_audit_log.category_scores (jsonb column)

lib/queue/src/
├── names.ts                           # MODIFY: + dsarDeletion: "dsar-deletion"
├── types.ts                           # MODIFY: + DsarDeletionPayload; extend VoiceGenerationPayload
├── queues.ts                          # MODIFY: + dsarDeletion: new Queue(...)
└── options.ts                         # MODIFY: + dsarDeletion job options (delay: 24h, attempts: 3)

supabase/migrations/
└── 20260601000001_phase3_voice_dsar_ocr.sql  # NEW: fan_name_masks + creator_deletion_log + safety_audit_log.category_scores

lib/api-spec/
└── openapi.yaml                       # MODIFY: + GET /api/voice/:jobId schema → regenerate api-zod + api-client-react

artifacts/web/src/components/fan/
└── VoiceMessageBubble.tsx             # NEW: <audio src={voice_url}> with native controls + transcript fallback
```

### Pattern 1: GMI TTS provider wrapped in opossum circuit breaker

**What:** Wrap the GMI TTS HTTP call in an opossum CircuitBreaker so that consecutive failures trip the breaker and the voice path silently falls back to text-only.

**When to use:** Any provider call where degraded mode (text-only) is acceptable AND repeated upstream failures would otherwise burn CPU/credits/latency.

**Example (illustrative — actual GMI endpoint TBD):**

```typescript
// lib/providers/src/providers/gmi-tts-client.ts
// Source: opossum docs https://github.com/nodeshift/opossum + GmiTextProvider precedent
import CircuitBreaker from "opossum";
import { GmiClient } from "./gmi-client.js";

const BREAKER_OPTS: CircuitBreaker.Options = {
  timeout: 30_000,                   // CONTEXT default #2: 30s
  errorThresholdPercentage: 50,
  resetTimeout: 60_000,              // CONTEXT default #2: 60s window
  rollingCountTimeout: 60_000,
  rollingCountBuckets: 6,
  name: "gmi-tts",
};

async function callGmiTts(input: {
  text: string;
  referenceUrl: string;
  language: "en" | "ja" | "zh-TW";
  creatorId: string;
}): Promise<{ audioBytes: Buffer; durationSeconds: number }> {
  const client = GmiClient.fromEnv();
  // PLACEHOLDER endpoint — Wave 0 must confirm with GMI support / Helicone proxy.
  // Per docs.gmicloud.ai catalog the model identifier is one of:
  //   minimax-audio-voice-clone-speech-2.6-hd | minimax-audio-voice-clone-speech-2.6-turbo |
  //   step-audio-edit-x | chatterbox-tts
  // Reference clip handling: zero-shot models accept either inline base64 or a signed URL.
  const res = await client.post<{ audio_b64: string; duration_seconds: number }>({
    path: "/v1/audio/tts",     // [ASSUMED — must confirm]
    body: {
      model: "step-audio-edit-x",  // [ASSUMED — must confirm with GMI]
      text: input.text,
      language: input.language,
      reference_audio_url: input.referenceUrl,
    },
    heliconeContext: { creatorId: input.creatorId, jobType: "voice-tts", fanId: "n/a" },
  });
  return {
    audioBytes: Buffer.from(res.audio_b64, "base64"),
    durationSeconds: res.duration_seconds,
  };
}

export const gmiTtsBreaker = new CircuitBreaker(callGmiTts, BREAKER_OPTS);
gmiTtsBreaker.fallback(() => {
  // Returning null signals to the worker: skip voice delivery, send text only.
  // Logged by worker; no fan-facing error per VOICE-02 acceptance criterion.
  return null;
});
gmiTtsBreaker.on("open", () => console.warn("[gmi-tts] circuit OPEN — falling back to text-only"));
gmiTtsBreaker.on("halfOpen", () => console.info("[gmi-tts] circuit halfOpen — probing"));
gmiTtsBreaker.on("close", () => console.info("[gmi-tts] circuit CLOSE — voice restored"));
```

### Pattern 2: Conversation-level escalation scoring (MOD-07)

**What:** Read the last N (default 10) `safety_audit_log` rows for the (creator_id, fan_id_hash) pair, compute a recency-weighted sum of OpenAI category_scores, and flag when over threshold.

**When to use:** Detecting Crescendo / gradual-escalation jailbreaks. Runs alongside L1, BEFORE LLM call. Cheap (one DB query, no provider call).

**Why this design:** Per the Crescendo paper (arXiv:2404.01833 §6.2), the authors propose NO conversation-level defense — they only suggest training-time filtering, model fine-tuning, and per-message input/output filtering. Our MOD-07 fills the gap they explicitly leave open. The recency-weighted sum approach is novel-for-this-project but follows standard time-decay scoring (exponential decay, half-life 3 turns) used in security anomaly detection.

**Required schema change:** `safety_audit_log` currently stores `crisis_level` (enum), `crisis_type` (text), `confidence` (real). To compute the score we need the raw OpenAI `category_scores` per turn — add a `category_scores jsonb` column (nullable for backward-compat).

```typescript
// lib/twin-runtime/src/escalation.ts
import { db, safetyAuditLogTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const WINDOW_TURNS = 10;
const HALF_LIFE = 3;
const THRESHOLD = 1.5;  // CONTEXT default #4

export interface EscalationResult {
  flagged: boolean;
  cumulativeScore: number;
  windowSize: number;
  triggeringCategory?: string;
}

export async function scoreEscalation(
  creatorId: string,
  fanIdHash: string,
  currentTurnCategoryScores: Record<string, number>,
): Promise<EscalationResult> {
  const recent = await db
    .select({
      categoryScores: safetyAuditLogTable.categoryScores,  // NEW column
      createdAt: safetyAuditLogTable.createdAt,
    })
    .from(safetyAuditLogTable)
    .where(
      and(
        eq(safetyAuditLogTable.creatorId, creatorId),
        eq(safetyAuditLogTable.fanIdHash, fanIdHash),
      ),
    )
    .orderBy(desc(safetyAuditLogTable.createdAt))
    .limit(WINDOW_TURNS - 1);  // -1 because we add the current turn below

  const turns = [
    { categoryScores: currentTurnCategoryScores, age: 0 },
    ...recent.map((r, i) => ({
      categoryScores: (r.categoryScores ?? {}) as Record<string, number>,
      age: i + 1,
    })),
  ];

  let cumulative = 0;
  let topCategory: string | undefined;
  let topContribution = 0;
  for (const turn of turns) {
    const weight = Math.pow(0.5, turn.age / HALF_LIFE);
    for (const [cat, score] of Object.entries(turn.categoryScores)) {
      const contribution = score * weight;
      cumulative += contribution;
      if (contribution > topContribution) {
        topContribution = contribution;
        topCategory = cat;
      }
    }
  }

  return {
    flagged: cumulative >= THRESHOLD,
    cumulativeScore: cumulative,
    windowSize: turns.length,
    triggeringCategory: topCategory,
  };
}
```

**Audit log entry on escalation flag:** Write a `safety_audit_log` row with `crisis_type = "escalation_detected"` and `confidence = cumulativeScore` (NOT the triggering message's individual score). Per CONTEXT specifics: *"Escalation detection should write to safety_audit_log with category escalation_detected and the cumulative score, NOT just the triggering message."*

### Pattern 3: Replit Object Storage proxy with HMAC-signed URL (VOICE-03)

**What:** Replit Object Storage SDK does not expose pre-signed URL generation. We mint a short-lived HMAC token using the existing `hmac-conversation.ts` crypto pattern, embed it in a URL like `lala.la/api/voice/{jobId}?token={hmac}&exp={epoch}`, and have a new Express route verify the token before streaming bytes from the bucket.

**When to use:** Any time you need to give a fan time-bounded access to a file stored in Replit Object Storage.

```typescript
// artifacts/api-server/src/lib/voice-token.ts
import { createHmac, timingSafeEqual } from "crypto";

const SECRET = () => {
  const s = process.env.VOICE_URL_SIGNING_SECRET;
  if (!s) throw new Error("VOICE_URL_SIGNING_SECRET not set");
  return s;
};

export function signVoiceUrl(jobId: string, ttlSeconds = 86_400): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${jobId}.${exp}`;
  const token = createHmac("sha256", SECRET()).update(payload).digest("hex");
  return `/api/voice/${encodeURIComponent(jobId)}?exp=${exp}&token=${token}`;
}

export function verifyVoiceUrl(jobId: string, exp: number, token: string): boolean {
  if (exp * 1000 < Date.now()) return false;
  const payload = `${jobId}.${exp}`;
  const expected = createHmac("sha256", SECRET()).update(payload).digest("hex");
  const a = Buffer.from(token, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

```typescript
// artifacts/api-server/src/routes/voice.ts
import { Router } from "express";
import { Client } from "@replit/object-storage";   // [ASSUMED — verify package name]
import { verifyVoiceUrl } from "../lib/voice-token.js";

export const voiceRouter = Router();

voiceRouter.get("/voice/:jobId", async (req, res) => {
  const jobId = req.params.jobId;
  const token = req.query.token as string | undefined;
  const exp = parseInt(req.query.exp as string, 10);
  if (!token || isNaN(exp) || !verifyVoiceUrl(jobId, exp, token)) {
    return res.status(403).send("invalid or expired token");
  }
  // Look up creator_id from generation_jobs row; storage key = creators/{creatorId}/generations/{jobId}.ogg
  // Stream the file bytes back. Set Content-Type: audio/ogg, Cache-Control: private, max-age=0.
  // ... implementation ...
});
```

### Pattern 4: Telegram inline-keyboard review queue (ONBOARD-04)

**What:** Hermes `/review_masks` command pops one pending row from `fan_name_masks WHERE reviewed=false`, presents it with two inline buttons (`✅ Approve`, `❌ Reject`), waits for `bot.action()` callback, updates the row, and shows the next one.

**When to use:** Founder-facing batch review of any queue (could later be reused for image moderation review, voice sample QA, etc.).

```typescript
// artifacts/hermes/src/scenes/review-masks.scene.ts
import { Scenes, Markup } from "telegraf";
import { getNextPendingMask, setMaskReviewed } from "../db.js";  // NEW queries

export const reviewMasksWizard = new Scenes.WizardScene<Scenes.WizardContext>(
  "review-masks-wizard",
  async (ctx) => {
    const next = await getNextPendingMask();
    if (!next) {
      await ctx.reply("No masks pending review. ✅");
      return ctx.scene.leave();
    }
    await ctx.reply(
      `Mask candidate:\n\n**Handle:** ${next.handle}\n**Detected name:** ${next.candidate}\n**Source:** ${next.source ?? "OCR"}\n\nApprove this mask?`,
      Markup.inlineKeyboard([
        Markup.button.callback("✅ Approve", `mask:approve:${next.id}`),
        Markup.button.callback("❌ Reject", `mask:reject:${next.id}`),
      ]),
    );
    // Stay in scene; the action handlers below resolve it.
  },
);

// Registered at bot scope in index.ts — NOT inside the scene, because actions
// fire on callback_query updates which the wizard step iterator doesn't handle:
//   bot.action(/^mask:(approve|reject):(.+)$/, async (ctx) => {
//     const [, decision, id] = ctx.match;
//     await setMaskReviewed(id, decision === "approve");
//     await ctx.answerCbQuery(decision === "approve" ? "Approved" : "Rejected");
//     await ctx.editMessageReplyMarkup(undefined);  // remove buttons
//     // Re-enter scene to show next:
//     await ctx.scene.enter("review-masks-wizard");
//   });
```

### Pattern 5: DSAR worker (COMPLY-04)

**What:** A BullMQ worker that sweeps every place a creator's data lives — DB tables, Object Storage prefix, BullMQ in-flight jobs — and writes a hashed audit row.

```typescript
// artifacts/worker/src/workers/dsar-deletion.ts (skeleton)
import { Worker } from "bullmq";
import { db, conversationMessagesTable, safetyAuditLogTable, generationJobsTable,
         consentGrantsTable, twinsTable, creatorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Client } from "@replit/object-storage";  // [ASSUMED]
import { createHash } from "crypto";

export function createDsarWorker(redisUrl: string) {
  return new Worker(
    "dsar-deletion",
    async (job) => {
      const { creatorId, requestedAt } = job.data;
      const t0 = Date.now();

      // 1. Delete all conversation_messages for this creator
      await db.delete(conversationMessagesTable).where(eq(conversationMessagesTable.creatorId, creatorId));
      // 2. Delete all safety_audit_log rows
      await db.delete(safetyAuditLogTable).where(eq(safetyAuditLogTable.creatorId, creatorId));
      // 3. Delete all generation_jobs rows (text + voice + video)
      await db.delete(generationJobsTable).where(eq(generationJobsTable.creatorId, creatorId));
      // 4. Delete consent_grants
      await db.delete(consentGrantsTable).where(eq(consentGrantsTable.creatorId, creatorId));
      // 5. Clear twins.character_card + twins.voice_reference_url (keep row for FK integrity, set fields NULL)
      await db.update(twinsTable).set({ characterCard: null, voiceReferenceUrl: null, status: "deleted" })
              .where(eq(twinsTable.creatorId, creatorId));
      // 6. List + delete Object Storage prefix `creators/{creatorId}/`
      const client = new Client();
      const objects = await client.list({ prefix: `creators/${creatorId}/` });
      if (objects.ok) {
        for (const o of objects.value) {
          await client.delete(o.name);
        }
      }
      // 7. Finally — anonymize creators row (keep id for FK; clear PII)
      await db.update(creatorsTable).set({
        displayName: "DELETED",
        telegramUserId: null,
        replitUserId: null,
        monetizationUrl: null,
        config: {},
      }).where(eq(creatorsTable.id, creatorId));

      // 8. Write hashed audit row to creator_deletion_log (NEW table)
      const auditId = createHash("sha256").update(`${creatorId}.${requestedAt}`).digest("hex").slice(0, 16);
      // ... insert into creator_deletion_log ...

      const sweepMs = Date.now() - t0;
      console.log(`[dsar] complete creator=${creatorId} audit=${auditId} sweepMs=${sweepMs}`);
    },
    { connection: { url: redisUrl }, concurrency: 1 },  // serialize — destructive operation
  );
}
```

### Anti-Patterns to Avoid

- **Don't call GMI TTS synchronously from the HTTP route.** TTS takes 5-30s per clip; Telegram's webhook timeout is 30s and fan SPA polling assumes <2s. Always enqueue.
- **Don't store voice files outside the `creators/{creatorId}/` prefix.** The DSAR worker sweeps by prefix; files outside the prefix would survive deletion (legal violation).
- **Don't hand-roll the circuit breaker.** opossum's halfOpen + jitter + percentage-based tripping has subtle bugs in hand-rolled versions (mis-counting attempts, race in halfOpen).
- **Don't send voice files >1MB as Telegram voice notes.** Telegram's `sendVoice` capped at 1MB for URL-based sends; falls back to `sendAudio` (capped 50MB) which renders as an audio file, not a voice note (lower fan UX). CONTEXT default #9 handles this.
- **Don't compute escalation score with `flagged` booleans only.** L1's binary `flagged` field is OpenAI's THRESHOLD output — the underlying `category_scores` are continuous and that's what we need for cumulative scoring. This requires the `safety_audit_log.category_scores` jsonb column add.
- **Don't perform DSAR deletion synchronously from the bot reply path.** 6 table deletes + Object Storage prefix sweep can exceed Telegraf reply timeout. Always BullMQ-delayed.
- **Don't use `Markup.button.url()` for callback actions.** URL buttons open browsers; we want `Markup.button.callback()` for in-bot actions.
- **Don't bypass the codegen pipeline.** New `GET /api/voice/:jobId` endpoint MUST go through `lib/api-spec/openapi.yaml` first and be regenerated.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circuit breaker for voice provider | DIY state machine | `opossum` v9 | halfOpen / jitter / rolling window edge cases are subtle; opossum is Apache-2.0, Node Foundation-maintained, tiny |
| Telegram inline keyboard parsing | Manual JSON construction | `Markup.inlineKeyboard([Markup.button.callback(...)])` from telegraf | Already a dep; type-safe; renders correctly across Telegram clients |
| HMAC URL signing | Custom signing scheme | Reuse the `hmac-conversation.ts` pattern (createHmac + timingSafeEqual) | Already audited; consistent crypto across phases |
| Hermes locale dispatch | Per-handler `if (lang === "ja") ...` | Existing `t(lang)` from `hermes/src/i18n.ts` | Type-safe; one source of truth; the Phase 2 verifier already confirmed this pattern |
| Audio decoding/encoding for Telegram | Custom Opus encoder | If GMI returns Opus-OGG: pass through. If WAV/MP3: use `ffmpeg-static` + child_process (but defer to Phase 3.5 — most TTS providers can return Opus natively) | Audio codec work has CVE history; native libraries exist |
| Object Storage prefix delete | Iterate one-by-one with re-listing | `client.list({ prefix })` then loop `client.delete(name)` | Replit SDK exposes both; no need for parallelism (creator-scoped sweep is small) |

**Key insight:** The Phase 3 surface is composition over existing primitives. The only genuinely new external dependency is `opossum`, and even that is essentially a stateful wrapper. Don't build custom solutions for circuit breaking, URL signing, or inline keyboards — all three have battle-tested patterns one `import` away.

## Common Pitfalls

### Pitfall 1: GMI TTS endpoint shape assumed before confirmation
**What goes wrong:** Plan is written assuming a specific request shape (e.g., `multipart/form-data` with file upload); GMI's actual endpoint expects JSON with a signed reference URL; the GmiVoiceProvider implementation has to be rewritten.
**Why it happens:** GMI Cloud's voice/audio API endpoints are not in the public `docs.gmicloud.ai/llms.txt` index — only the model catalog is. The actual API contract requires GMI support contact OR Helicone proxy inspection.
**How to avoid:** Wave 0 founder checkpoint: send a `curl` test against GMI's audio API with founder's credentials and document the exact request/response shape BEFORE writing GmiVoiceProvider.
**Warning signs:** Plan tasks contain phrases like "the GMI TTS endpoint accepts...". Halt on those.

### Pitfall 2: Replit Object Storage pre-signed URL assumption
**What goes wrong:** VOICE-03 acceptance criterion says "pre-signed URL with TTL"; Replit SDK doesn't support this; plan ships with `client.getSignedUrl()` calls that throw `is not a function`.
**Why it happens:** Other cloud storages (S3, GCS, Cloudflare R2) all support pre-signed URLs as a first-class primitive; the Replit SDK does not.
**How to avoid:** Use the HMAC-token proxy pattern in this RESEARCH.md (Pattern 3). Treat "pre-signed URL" in VOICE-03 as a behavioral specification (time-limited download URL), not a literal Replit SDK call.
**Warning signs:** Any plan task referencing `getSignedUrl`, `presign`, or `signedDownloadUrl` against `@replit/object-storage`. Reject.

### Pitfall 3: Escalation scoring without storing category_scores
**What goes wrong:** Phase 2 `safety_audit_log` schema persists `crisis_level` (enum) and `confidence` (real) but NOT the raw category_scores. MOD-07 can't compute cumulative scores without them.
**Why it happens:** Phase 2 was scoped to single-message moderation; raw OpenAI scores were treated as ephemeral.
**How to avoid:** Phase 3 schema migration MUST add `safety_audit_log.category_scores jsonb` (nullable for back-compat). Phase 2's `runL1Moderation` / `runL3Moderation` must be modified to persist `mod.categoryScores` to this column when writing the audit row.
**Warning signs:** MOD-07 plan task that doesn't include a schema migration.

### Pitfall 4: DSAR worker leaves orphan rows
**What goes wrong:** DSAR sweeps `conversation_messages` but `creator_deletion_log` is empty; or the worker FK-chains nuke `creators` row and then the `audit_log` FK-cascade breaks Phase 4's eval queries.
**Why it happens:** Drizzle schema uses `onDelete: "cascade"` on FK columns (verified: `twinsTable.creatorId.references(...creatorsTable.id, {onDelete:"cascade"})`). Cascading is fast but can hide deletion-order bugs.
**How to avoid:** Do NOT delete the `creators` row — anonymize in place (set `display_name = "DELETED"`, NULL the PII columns) so FK cascade doesn't fire on `twins`, `consent_grants`, `creator_kyc`, etc. Worker explicitly handles each child table BEFORE clearing parent fields. Write the audit row LAST, AFTER all deletes succeed.
**Warning signs:** DSAR worker that calls `db.delete(creatorsTable).where(eq(...id))` — that's the killshot. Replace with `db.update(creatorsTable).set({displayName: "DELETED", ...}).where(...)`.

### Pitfall 5: Telegram voice file >1MB silently downgrades to audio file
**What goes wrong:** Long TTS outputs (≥30s narration) exceed 1MB Opus encoded; `sendVoice(url)` rejects; bot falls back to `sendAudio` or `sendDocument` — fans see "audio attachment" instead of native voice note, breaking the UX promise.
**Why it happens:** Telegram's URL-based `sendVoice` is capped at 1MB; multipart upload allows 50MB but renders as `audio` not `voice` if codec mismatch.
**How to avoid:** Inspect generated file size before `sendVoice`; if >900KB, either re-call GMI with shorter `max_tokens`/`max_seconds`, OR fall back to multipart upload as `audio` with a caption flagging it. CONTEXT default #9 picks the latter. Add a regression test asserting the size check.
**Warning signs:** No file-size check between GMI response and `bot.telegram.sendVoice`.

### Pitfall 6: I18N consumer drift between Hermes hand-rolled and twin-runtime exports
**What goes wrong:** Hermes uses `t(lang).statusTwin(state)` while twin-runtime exports `getDeflection(locale, category)` — same conceptual locale but DIFFERENT key shapes (`'zh-tw'` vs `'zh-TW'`); typo in handoff breaks ZH-TW deflections silently.
**Why it happens:** Hermes uses lowercase `'zh-tw'` (see `i18n.ts:5`); twin-runtime uses BCP-47 `'zh-TW'` (see `helplines.ts`, `Locale` type). The Phase 2 verification confirmed Hermes is internally consistent but the cross-lib seam is a footgun.
**How to avoid:** Add a normalizer `normalizeLocale(input: string): "en" | "ja" | "zh-TW"` in `@workspace/twin-runtime/locale` that's used by all consumers (web, fan-twin, Hermes). Hermes `t()` keeps its internal `'zh-tw'` representation but normalizes BEFORE calling any twin-runtime helper.
**Warning signs:** Strings comparison `lang === 'zh-tw'` and `locale === 'zh-TW'` side-by-side in the same file.

### Pitfall 7: Voice consent revoked mid-job
**What goes wrong:** Fan requests voice; job enqueued; before worker picks it up, creator runs `/revoke_voice` (Phase 2 ONBOARD-03); job processes anyway, voice file written to Object Storage, billed to GMI, fan receives the audio — VIOLATING revoked consent.
**Why it happens:** The consent-revocation worker (Phase 1, line 31-35) DOES include `voiceGeneration` in its queue sweep, but if the voice-gen job is already in `processing` state, the cancel signal `updateData({cancelled: true})` reaches the worker WHILE it's mid-GMI call — and the GMI call isn't checking `cancelled`.
**How to avoid:** Voice-generation worker MUST re-check creator's voice consent (`creator_kyc.voice_synthesis_consent_granted` + `consent_grants` for modality=voice) immediately before writing the result to Object Storage. If revoked between enqueue and finish: discard the audio bytes, do not write storage, do not deliver.
**Warning signs:** Voice worker that calls GMI then ObjectStorage without a consent recheck between.

### Pitfall 8: DSAR 24h delay vs Telegram session expiry
**What goes wrong:** Fan-twin webhook tries to deliver a text reply 23h after DSAR confirmation — by then conversation history is intact but creator's `voiceReferenceUrl` is being swept. Voice job partially completes against a missing reference file.
**Why it happens:** 24h delay between DSAR confirmation and DSAR sweep (CONTEXT default #5) creates a race window where new fan interactions can interleave.
**How to avoid:** When DSAR is confirmed, IMMEDIATELY set `creators.kill_switch_active = true` so all twin-chat routes return 423 instantly. Then the 24h delay only affects the destructive cleanup, not the visibility surface.
**Warning signs:** DSAR scene that enqueues the deletion job without flipping kill_switch_active first.

## Code Examples

### Common Operation 1: Enqueueing voice generation from text-generation worker (after L3 passes)

```typescript
// artifacts/worker/src/workers/text-generation.ts (modification)
// Source: existing text-generation.ts pattern + lib/queue/src/queues.ts createAllQueues
import { createAllQueues } from "@workspace/queue";

// after persisting assistant turn + before Telegram outbound:
if (await shouldGenerateVoice(creatorId, twin.voiceReferenceUrl)) {
  await queues.voiceGeneration.add(
    "voice-gen",
    {
      type: "voice-generation",
      jobDbId: voiceJobDbId,
      creatorId,
      fanId: fanIdHash,
      consentGrantVersion: "v1.0",
      transcript: safeReply,
      language: locale,
      twinId: twin.id,
      deliveryChannel: "telegram",  // or "web"
      telegramChatId,                // for telegram path
      conversationId,                // for web path callback
    } as VoiceGenerationPayload,
    { jobId: voiceJobDbId, attempts: 2, backoff: { type: "exponential", delay: 1000 } },
  );
}
```

### Common Operation 2: Hermes DSAR scene with 24h delayed deletion

```typescript
// artifacts/hermes/src/scenes/dsar.scene.ts
import { Scenes } from "telegraf";
import { createAllQueues } from "@workspace/queue";
import { setKillSwitchActive, recordDsarRequest } from "../db.js";  // NEW queries

const queues = createAllQueues(process.env.REDIS_URL!);
const DSAR_DELAY_MS = 24 * 60 * 60 * 1000;  // CONTEXT default #5

export const dsarWizard = new Scenes.WizardScene<Scenes.WizardContext>(
  "dsar-wizard",
  async (ctx) => {
    await ctx.reply(
      "⚠️ Data Deletion Request\n\n" +
      "This will permanently delete:\n" +
      "  • All fan conversation history with your twin\n" +
      "  • Your voice reference sample\n" +
      "  • Your persona / constitution\n" +
      "  • All generated voice files\n\n" +
      "Your twin will go offline IMMEDIATELY. Deletion completes within 24 hours.\n\n" +
      "Type CONFIRM to proceed, or /cancel to abort.",
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = (ctx.message as { text?: string } | undefined)?.text;
    if (text !== "CONFIRM") {
      await ctx.reply("Cancelled. Send /dsar again if you change your mind.");
      return ctx.scene.leave();
    }
    const creatorId = (ctx.wizard.state as { creatorId: string }).creatorId;
    await setKillSwitchActive(creatorId, true);  // immediate twin offline
    const auditId = await recordDsarRequest(creatorId);  // returns hashed id for trail
    await queues.dsarDeletion.add(
      "dsar",
      { creatorId, requestedAt: new Date().toISOString(), auditId },
      { delay: DSAR_DELAY_MS, attempts: 3, backoff: { type: "exponential", delay: 60_000 } },
    );
    await ctx.reply(
      `Confirmed. Your twin is now offline. Audit ID: ${auditId}\n\n` +
      "All data will be deleted within 24 hours. You'll receive a final confirmation when complete.",
    );
    return ctx.scene.leave();
  },
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-message moderation only (L1+L3 binary `flagged`) | Per-message + conversation-level cumulative scoring | Crescendo paper published April 2024 (arXiv:2404.01833); industry response slow but growing through 2025 | Phase 2's L1+L3 alone leaves a known Crescendo gap; MOD-07 closes it. The Crescendo authors themselves propose no conversation-level defense (their §6.2) — this is "ahead of the literature" for an N=1 product. |
| Hand-rolled retry/circuit logic per call site | Library-backed circuit breaker (opossum) | Node.js ecosystem matured around 2020-2022; opossum became de-facto standard | One library replaces N copies of error-counting logic. Apache-2.0; Node Foundation backing. |
| Pre-signed URLs via cloud SDK first-class API | HMAC-token proxy for storage without pre-signed support | Replit Object Storage SDK released without pre-signed primitive (still missing as of 2026-05) | Adds 30 lines of `voice-token.ts` + a route. Equivalent security guarantee. |
| Synchronous DSAR deletion | Delayed BullMQ + kill-switch flip | GDPR Article 17 says "without undue delay"; CPRA/CCPA say within 45 days; SB 243 silent on DSAR specifics | 24h delay gives "oops" window; legal floor is generous. The IMMEDIATE kill-switch flip is the user-visible change; the destructive sweep happens later. |
| OCR for fan-name extraction at ingest time | Review-queue-first, OCR ingestion deferred | Defer to creator #3+ per CONTEXT specifics | Phase 3 ships scaffolding without committing to a specific OCR provider (Tesseract local vs Google Vision vs Tesseract WASM) — choice made later when actual volume is known. |

**Deprecated/outdated:**
- **express-validator** for request validation: replaced by Zod (Phase 1 baseline). No new Phase 3 code should add express-validator dependencies.
- **Hand-rolled session storage** in fan-twin: replaced by `@telegraf/session/pg` (Phase 2 baseline).
- **`creator_personas` / `creator_content_embeddings` tables**: dropped in Phase 2 D-02-03. Any Phase 3 code referencing them is a bug.

## Runtime State Inventory

This is a feature-addition phase (not rename/refactor), but Phase 3 touches several pre-existing runtime state buckets — worth surfacing for the planner.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | (1) `safety_audit_log` rows from Phase 2 already exist for verified creators — MOD-07 reads them. (2) Object Storage `creators/{id}/constitution.md` + `voice_reference.{ext}` already populated from Phase 2 voice wizard. (3) Telegraf session rows in PG (`telegraf_sessions` table). | (1) Backfill: existing rows have NULL `category_scores`; treat as zero-contribution in escalation scorer. (2) No action — voice generations write to NEW `generations/{jobId}.{ogg|wav}` subkey, not the same path. (3) DSAR sweep must include `DELETE FROM telegraf_sessions WHERE session_id LIKE '{creator_tg_id}:%'` or equivalent — Telegraf sessions contain creator state. |
| Live service config | Replit Object Storage bucket settings (CORS, IAM) — set up in Phase 2 D-02-02; voice files use the same bucket so no new config. | Founder must verify bucket allows the Express API to GET objects (proxy route reads). |
| OS-registered state | None — no Windows tasks, no systemd, no cron yet. (Phase 4 will add weekly regression cron.) | None for Phase 3. |
| Secrets / env vars | NEW: `VOICE_URL_SIGNING_SECRET` (HMAC for proxy URLs). EXISTING used: `GMI_API_KEY`, `GMI_API_BASE_URL`, `HELICONE_API_KEY` (optional), `REPLIT_OBJECT_STORAGE_BUCKET`, `REDIS_URL`, `TELEGRAM_BOT_TOKEN_LALA`, `TELEGRAM_BOT_TOKEN_FAN_TWIN`. | Founder checkpoint: add `VOICE_URL_SIGNING_SECRET=<64-char random hex>` to Replit Secrets. |
| Build artifacts | None new — Phase 3 doesn't introduce a new artifact (worker + api-server + hermes + fan-twin all already build). | None. |

## Common Pitfalls (continued — operational)

Already covered above in the main Common Pitfalls section. No additional category here.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20+ | opossum v9 | ✓ | v22.22.0 (per /home/joe/CLAUDE.md) | — |
| pnpm 9+ | All installs | ✓ | per project | — |
| Redis (BullMQ) | Voice gen + DSAR queues | Assumed live in Replit prod | — | Without Redis, voice-generation gracefully no-ops (worker not running) per Phase 1 `REDIS_URL absent` pattern. **DSAR queue cannot no-op** — without Redis, `/dsar` confirmation immediately runs sync deletion (acceptable fallback). |
| Replit Object Storage | Voice file storage + DSAR sweep | Founder checkpoint from Phase 2 | — | Without bucket: GmiVoiceProvider returns null → text-only fallback; DSAR sweeps DB only. |
| GMI Cloud account with TTS access | VOICE-01 | **UNKNOWN — must verify** | — | **No fallback** — text-only Phase 3; defer VOICE-* to Phase 3.5. |
| Helicone (optional) | LLM + TTS observability | Already wired for LLM in Phase 2; extend to voice path | — | Voice generation works without Helicone; just no per-creator cost dashboards. |
| `@replit/object-storage` npm package | Storage SDK | Used in Phase 2 via `hermes/src/lib/object-storage.ts` — but that file uses **raw fetch** to `https://storage.replit.com/v1/buckets/...`, not the SDK. | — | The raw-fetch pattern already works for upload; for list+delete (DSAR) we either install the SDK now OR use raw fetch with the equivalent endpoints. Recommend **install the SDK** for DSAR — list+delete via raw fetch is more error-prone than upload. |

**Missing dependencies with no fallback:**
- GMI Cloud TTS endpoint shape / model identifier — **BLOCKS Phase 3 voice plans until confirmed**.

**Missing dependencies with fallback:**
- Redis: voice queue no-ops (text-only); DSAR runs sync.
- Object Storage: voice falls back to text; DSAR DB-only.
- Helicone: voice works, no observability.

## Validation Architecture

> SKIPPED — `.planning/config.json` has `workflow.nyquist_validation: false`. Per agent instructions, this section is omitted entirely.

## Security Domain

Phase 3 ships compliance-sensitive features (DSAR — GDPR Article 17, SB 243 self-harm detection extended cross-turn, voice synthesis with explicit consent gating). The following ASVS categories apply.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Hermes /dsar is creator-authenticated via Telegram identity (existing `findCreatorByTelegramId` pattern); no new auth surface |
| V3 Session Management | yes | Voice URL HMAC token (24h TTL) is essentially a session token for a single object; uses `timingSafeEqual` for constant-time comparison |
| V4 Access Control | yes | DSAR can only delete the requesting creator's own data; worker must verify `creatorId` matches the requester's session (defense-in-depth — the WizardScene state already binds creator_id) |
| V5 Input Validation | yes | Zod for `/api/voice/:jobId` params; OpenAPI schema for the route; manual validation of Telegram callback_data payloads (`mask:approve:{uuid}` — UUID must be regex-validated before DB lookup) |
| V6 Cryptography | yes | HMAC-SHA256 with constant-time comparison (reuse `hmac-conversation.ts` pattern). NEW `VOICE_URL_SIGNING_SECRET` env var — must be 256-bit random. Never log. |
| V7 Error Handling | yes | Fan-facing errors must not leak GMI internals (`opossum` fallback returns null silently per VOICE-02 acceptance). Founder-facing errors (Sentry) include full provider error message |
| V11 Business Logic | yes | DSAR 24h delay window: a malicious creator could trigger DSAR then immediately revert via support; require manual founder unblock for any DSAR cancellation |
| V13 API Security | yes | New `/api/voice/:jobId` endpoint — 403 on bad token, 404 on missing job, no rate limit needed (token-gated) |

### Known Threat Patterns for {api-server + worker + Hermes}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Voice URL guessing / brute-force | I (Information disclosure) | HMAC token + 24h TTL; URL leak doesn't permit re-derivation (signing secret never client-side) |
| Cross-creator voice URL reuse | E (Elevation of privilege) | jobId scoped to one `generation_jobs` row → one `creatorId` ; route handler must SELECT the row and verify caller's session matches the creator |
| DSAR replay (same `auditId` enqueued twice) | T (Tampering) | BullMQ `jobId: auditId` deduplicates; second `/dsar` shows "already requested" |
| Crescendo bypass exploiting MOD-07 reset | T | Anchor the recency window on `created_at`, not on insertion order, so backfill can't trick the scorer; window is 10 turns OR last 24h whichever is shorter |
| OCR mask review used to dox fans | I | `fan_name_masks` table contains the redacted MASK not the original name; founder reviewing the mask only sees the redaction string, not the raw fan PII |
| Voice consent revoked between enqueue and finish | T (against creator's intent) | Voice-gen worker re-checks consent immediately before Object Storage write (Pitfall 7) |
| Helicone leaking creator data via voice path | I | Helicone context already hashes fan_id (verified in `gmi-client.ts:87`); voice path inherits the same hashing |
| Self-harm helpline missing on voice replies | (compliance — SB 243) | If L3 flagged self-harm AND voice was about to be generated: do NOT generate voice; send helpline text + deflection text only |

**SB 243-specific:** The phase MUST ensure that voice replies cannot deliver a self-harm-flagged response. The check is: after L3, if `mod.flagged && mod.categories.includes("self-harm")`, the worker MUST skip voice generation entirely. This is a defense-in-depth measure beyond the L4 deflection swap.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GMI TTS endpoint is reachable at `/v1/audio/tts` or similar OpenAI-compatible path | Standard Stack / Pattern 1 | Plan rewrite of GmiVoiceProvider; founder UAT blocker |
| A2 | GMI TTS model identifier is `step-audio-edit-x` OR `minimax-audio-voice-clone-speech-2.6-turbo` | Pattern 1 | Wrong model = wrong cost / wrong language support / wrong voice quality |
| A3 | GMI TTS accepts `reference_audio_url` (signed URL pointing to Object Storage `voice_reference.{ext}`) | Pattern 1 | If GMI requires raw bytes inline: extra round-trip to fetch the reference from storage before TTS call |
| A4 | `@replit/object-storage` npm package is installable and exposes `Client` with `list`, `delete`, `downloadAsStream` | Pattern 5, Pitfall 2 | Verified by reading docs.replit.com TypeScript reference; package name guessed |
| A5 | Telegram `sendVoice` URL-based send accepts a `lala.la/api/voice/...` URL (not just files-uploaded URLs) | Pattern 3 / Pitfall 5 | If Telegram only accepts file-uploaded URLs (i.e., from Telegram's own API), we'd need to upload via multipart instead |
| A6 | i18next is not needed for Hermes (existing `t()` pattern suffices) | Standard Stack | If Hermes string count grows >100 strings: refactor to i18next later — low risk |
| A7 | Crescendo defense via recency-weighted cumulative scoring is novel-enough to ship without academic precedent | Pattern 2 | Could over-/under-trigger; auto-CONTEXT picked threshold 1.5 with half-life 3 turns based on engineering intuition — needs founder eval-suite tuning in Phase 4 |
| A8 | `safety_audit_log.category_scores jsonb` migration is non-breaking for existing rows | Pitfall 3 | NULL backfill is safe (treat as zero contribution) — verified by Pattern 2 implementation |
| A9 | Replit Object Storage permits `client.list({prefix})` even though docs don't explicitly confirm prefix filtering | Environment Availability | If prefix not supported: list all + filter client-side (works but slower at scale) |
| A10 | Telegraf v4 inline keyboard callback action regex `bot.action(/^mask:(approve\|reject):(.+)$/, ...)` correctly captures both groups | Pattern 4 | Verified pattern in Telegraf v4 docs — LOW risk |
| A11 | Voice-gen worker can call `bot.telegram.sendVoice(chatId, {source: buffer})` from worker artifact (no `.launch()`) | Common Operation 1 (implicit) | Confirmed pattern from Phase 2 text-generation.ts which already uses the no-launch Telegraf for sendMessage |

**Founder confirmation needed for:** A1, A2, A3, A5, A7 (threshold).

## Open Questions

1. **GMI TTS endpoint + model + request shape — primary unknown.**
   - What we know: GMI Cloud lists ~5 TTS / voice-clone models in their catalog (MiniMax 2.6 HD/Turbo, Step Audio Edit X, Chatterbox-tts, ElevenLabs variants).
   - What's unclear: API path, auth (same `Authorization: Bearer GMI_API_KEY` as `/chat/completions`?), request body schema, response shape (sync vs async job), supported languages per model.
   - Recommendation: Wave 0 `[BLOCKING]` founder checkpoint — founder runs a `curl` test against GMI's API with their account and documents the contract OR contacts GMI support.

2. **Should voice generation be opt-in per-fan, per-creator, or always-on?**
   - What we know: Creator has consented to voice synthesis (Phase 1 KYC `voice_synthesis_consent_granted` + Phase 2 `voiceReferenceUrl` populated).
   - What's unclear: Does the FAN need an opt-in too? Some fans may prefer text-only (data usage, accessibility, environment with no audio).
   - Recommendation: Default to voice ON when creator has consent + reference uploaded; add fan-side toggle in Phase 3.5 if user research shows demand. For now: text always + voice opportunistically when conditions met.

3. **DSAR cancellation window: can a creator un-do a confirmed `/dsar` within the 24h window?**
   - What we know: Kill-switch flips immediately; deletion happens at +24h.
   - What's unclear: Should `/dsar_cancel` exist as a 24h-window escape hatch?
   - Recommendation: NO — silently providing cancellation undermines GDPR Article 17's "without undue delay" intent. Manual founder-side support override only.

4. **Should Hermes language preference (`creator_config.hermes_language`) ALSO change the locale of L4 deflections delivered to the creator's fans?**
   - What we know: Fan-side locale resolution is from fan's Accept-Language / Telegram language_code (Phase 2).
   - What's unclear: A JP creator who has set Hermes to JA may expect her fans to ALWAYS see JP deflections (her brand language) regardless of fan locale.
   - Recommendation: Defer — current behavior (fan locale wins) is the SB 243 expectation (helpline must match the FAN's locale for compliance). Override at creator request only.

5. **MOD-07 threshold tuning — is 1.5 the right number?**
   - What we know: CONTEXT default #4 picks threshold 1.5, half-life 3 turns, window 10 turns.
   - What's unclear: Without an eval suite (that's Phase 4 EVAL-01) we can't calibrate.
   - Recommendation: Ship CONTEXT default; expose the constants as env vars `MOD_07_THRESHOLD`, `MOD_07_HALF_LIFE` so Phase 4 calibration can adjust without code change.

6. **OCR provider choice (deferred per CONTEXT specifics, but worth flagging).**
   - What we know: Phase 3 ships the review queue only; OCR ingestion is deferred to creator #3+.
   - What's unclear: Tesseract.js (local, free, accuracy 70-80%) vs Google Vision OCR (cloud, $1.50/1k requests, accuracy 95%+) vs Tesseract WASM in worker.
   - Recommendation: Decision deferred. RESEARCH does not commit to a provider; planner does not include OCR ingestion tasks in Phase 3.

## Sources

### Primary (HIGH confidence)
- `/home/joe/Workspace/77of1/.planning/phases/02-twin-runtime-core/02-VERIFICATION.md` — Phase 2 closure state with 5 human_needed items + 20 must-haves verified
- `/home/joe/Workspace/77of1/.planning/phases/02-twin-runtime-core/02-CONTEXT.md` — D-02-01 through D-02-15 locked decisions
- `/home/joe/Workspace/77of1/.planning/phases/03-voice-hardening/03-CONTEXT.md` — autonomous defaults + pre-locked carry-forward
- `/home/joe/Workspace/77of1/lib/twin-runtime/src/*.ts` — Phase 2 shared lib structure (13 modules)
- `/home/joe/Workspace/77of1/lib/queue/src/{types,queues,names}.ts` — existing voice-generation queue scaffolding
- `/home/joe/Workspace/77of1/artifacts/worker/src/workers/{voice-generation,text-generation,consent-revocation}.ts` — worker patterns
- `/home/joe/Workspace/77of1/artifacts/hermes/src/{i18n,index,scenes/voice.scene,lib/object-storage}.ts` — Hermes patterns
- `/home/joe/Workspace/77of1/lib/providers/src/providers/{gmi-client,interfaces}.ts` — provider lib structure
- `/home/joe/Workspace/77of1/lib/db/src/schema/index.ts` — Drizzle schema (creators, twins, safety_audit_log, generation_jobs, consent_grants, conversation_messages, creator_config, creator_kyc)
- `/home/joe/CLAUDE.md` + `/home/joe/Workspace/77of1/CLAUDE.md` — project constraints (verified during research)
- [opossum on GitHub](https://github.com/nodeshift/opossum) — v9.0.0 Apache-2.0, fallback example, halfOpen semantics
- [Replit Object Storage TypeScript SDK reference](https://docs.replit.com/cloud-services/storage-and-databases/object-storage/typescript-api-reference) — Client methods: copy, delete, downloadAsBytes, downloadAsStream, downloadAsText, downloadToFilename, exists, getBucket, init, list, uploadFromBytes, uploadFromFilename, uploadFromStream, uploadFromText. **NO pre-signed URL support.**
- [Telegram Bot API — sendVoice](https://core.telegram.org/bots/api) — voice notes audio/ogg ≤1MB for URL, ≤50MB for upload
- [Crescendo paper (arXiv:2404.01833)](https://arxiv.org/abs/2404.01833) — multi-turn jailbreak attack
- [Crescendo §6.2 mitigation](https://arxiv.org/html/2404.01833v1) — authors propose NO conversation-level defense; explicit gap MOD-07 fills
- slopcheck v0.6.1 output (run during research): opossum [OK], i18next [OK], i18next-fs-backend [OK], sharp [OK], tesseract.js [OK], @types/opossum [OK], **minimax-voice-clone [SLOP — hallucinated, refused install]**
- `npm view` version verification: opossum@9.0.0, i18next@26.3.0, i18next-fs-backend@2.6.6, sharp@0.34.5, tesseract.js@7.0.0, telegraf@4.16.3, @bull-board/express@7.1.5

### Secondary (MEDIUM confidence)
- [GMI Cloud docs landing](https://docs.gmicloud.ai/) — confirms audio model catalog exists, individual model pages exist, but does not expose endpoint URLs or request schemas in the indexable content
- [GMI Cloud audio overview (paywalled / index-only)](https://docs.gmicloud.ai/model-quickstarts/audio/overview) — confirms 18 audio models including MiniMax voice-clone and Step Audio Edit X; specific endpoints not in fetched content
- [GDPR DSAR 30-day SLA — Ketch](https://www.ketch.com/blog/posts/dsars-101-how-to-handle-data-deletion-requests) — 30-day legal floor, recommends 20/27 day escalation paths, audit trail requirement
- [Opossum Node.js circuit breaker production guide — DEV](https://dev.to/axiom_agent/nodejs-circuit-breaker-pattern-in-production-opossum-fallbacks-and-resilience-engineering-1mj4) — production patterns, fallback functions
- [i18next backend fallback](https://www.i18next.com/how-to/backend-fallback) + [i18next TypeScript](https://www.i18next.com/overview/typescript) — for reference if Hermes ever needs to migrate

### Tertiary (LOW confidence — for awareness, not commitment)
- [Coqui XTTS streaming server endpoints](https://deepwiki.com/coqui-ai/xtts-streaming-server/3.1-api-endpoints) — pattern of speaker_embedding extraction + non-streaming TTS; informs Assumption A3 about reference audio handling, but GMI's actual API may differ
- [Telegram bot SDK sendVoice docs](https://telegram-bot-sdk.readme.io/reference/sendvoice) — third-party doc; corroborates Telegram core API 1MB/50MB limits

## Metadata

**Confidence breakdown:**
- Standard stack (opossum): HIGH — verified version, license, slopcheck OK, well-documented usage patterns
- Architecture (composition over Phase 2): HIGH — every new file has a Phase 2 analog; the twin-runtime + worker + Hermes patterns are established
- Pitfalls: MEDIUM-HIGH — most pitfalls derived from reading Phase 2 verified code; voice-specific pitfalls (5, 7) are projected from precedent
- GMI TTS endpoint: MEDIUM — model catalog confirmed, endpoint URL is informed guess
- Replit Object Storage pre-signed URL workaround: HIGH — confirmed SDK doesn't expose it; HMAC proxy is straightforward
- Crescendo (MOD-07) detection approach: MEDIUM — academic paper confirms gap exists; specific threshold/window/half-life is engineering choice without empirical calibration (Phase 4 EVAL-01 will tune)
- DSAR worker design: HIGH — patterns derived from existing consent-revocation.ts worker
- I18n strategy: HIGH — confirmed by reading existing `hermes/src/i18n.ts` Phase 2-completed pattern

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (30 days for opossum + general patterns; **7 days for GMI TTS endpoint assumptions** — refresh if Wave 0 hasn't started by 2026-06-04)
