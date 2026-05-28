---
phase: 02-twin-runtime-core
plan: 06b
subsystem: fan-twin + worker
tags: [phase-2, fan-twin, telegram, worker, async, chat-06, comply-01, comply-02, persona-02]
requirements:
  completed: [CHAT-02, CHAT-06, COMPLY-01, MOD-01, MOD-03, MOD-04, MOD-05, MOD-06, COMPLY-02, PERSONA-02, I18N-02]
dependency-graph:
  requires:
    - "lib/twin-runtime (02-06a — moderation, conversation, system-prompt, constitution, disclosure, helplines, deflections, locale, hmac-conversation)"
    - "lib/queue (extended TextGenerationPayload from 02-06a — locale, conversationId, deliveryChannel, telegramChatId, twinId, handle)"
    - "artifacts/fan-twin scaffold (02-01 — package.json with @telegraf/session + telegraf, port 3002)"
    - "@workspace/providers GmiClient (lib/providers/src/providers/gmi-client.ts)"
    - "@workspace/db creators / twins / creator_config / creator_kyc / conversation_messages / generation_jobs tables"
  provides:
    - "fan-twin artifact: real Telegraf bot entry with async-ACK webhook + textGeneration enqueue + idempotent jobIds"
    - "worker text-generation pipeline: full 6-layer moderation + GMI LLM + outbound Telegram delivery"
    - "5 passing GREEN tests in fan-twin (replaces it.todo CHAT-06 RED stub from 02-01)"
    - "Telegram-path Phase 2 vertical slice — fan posts in TG → bot ACKs in <100ms → worker drains → moderated reply with COMPLY-01 footer arrives via bot.telegram.sendMessage"
  affects:
    - "artifacts/fan-twin/package.json — adds bullmq dep"
    - "artifacts/worker/package.json — adds telegraf dep"
tech-stack:
  added:
    - "bullmq@^5.56.1 (fan-twin) — Queue construction for textGeneration enqueue"
    - "telegraf@^4.16.3 (worker) — outbound HTTP client (NO .launch())"
  patterns:
    - "PATTERNS S5 — Telegraf launch (webhook prod / long-poll dev)"
    - "PATTERNS S6 — KYC gate inline on worker path (defense-in-depth)"
    - "PATTERNS S7 — vi.mock(@workspace/db) header in webhook-ack test"
    - "Pitfall #12 — jobId='tg-{update_id}' for BullMQ idempotent dedup"
    - "Pitfall #7 — webhook returns 200 within ~50ms; worker owns delivery"
    - "Pitfall T-02-06b-07 — outbound Telegraf without .launch() (NO webhook conflict)"
    - "UI-SPEC COMPLY-02 — self-harm helpline as TWO separate sendMessage calls (helpline first)"
    - "D-02-12 — disclosure footer server-rendered for both web AND Telegram"
    - "D-02-13 — readConstitution called on BOTH web (02-03) and Telegram (this plan) paths"
key-files:
  created:
    - "artifacts/fan-twin/src/session.ts (lazy @telegraf/session/pg adapter; mirrors hermes/src/session.ts)"
    - "artifacts/fan-twin/src/locale.ts (detectLocaleFromTelegramCtx — language_code → en/ja/zh-TW)"
    - "artifacts/fan-twin/src/conversation.ts (resolveCreatorForFanTwinBot — D-02-01 single-tenant; re-exports deriveTelegramConversationId)"
    - "artifacts/fan-twin/src/__tests__/setup-env.ts (vitest setupFiles — sets env BEFORE module load to bypass vi.mock hoisting)"
  modified:
    - "artifacts/fan-twin/src/index.ts (placeholder → real Telegraf bot + BullMQ textGeneration queue + async webhook handler)"
    - "artifacts/fan-twin/src/__tests__/webhook-ack.test.ts (4 it.todo RED → 5 GREEN tests)"
    - "artifacts/fan-twin/vitest.config.ts (+ setupFiles)"
    - "artifacts/fan-twin/package.json (+ bullmq)"
    - "artifacts/worker/src/workers/text-generation.ts (STUB log → full pipeline)"
    - "artifacts/worker/package.json (+ telegraf)"
decisions:
  - "Worker invokes GMI directly via @workspace/providers GmiClient (inline gmiChatCompletion helper) — GmiTextProvider lives in artifacts/api-server source and is not exported from a shared workspace lib. Same endpoint, same Helicone routing, same retry behaviour as api-server's class. Documented as Rule 3 deviation #1 below."
  - "KYC gate re-implemented inline in worker (kycSignedInline) — api-server's isKycSigned lives in api-server/src/lib/kyc.ts; we avoid reaching into a sibling artifact. Same strict 'status === signed' check (Pitfall #4)."
  - "jobDbId UUID detector — Telegram jobs use 'tg-{update_id}' pseudo-ids that have no generation_jobs row. The lifecycle status updates (processing → complete | failed) are guarded by isUuid() so api-server-enqueued web jobs continue to behave as before while Telegram-enqueued jobs skip the row update."
  - "Lazy Telegraf outbound client (getFanTwinOut) — token-required check at first sendMessage, not module load. Lets tests import the worker module without TELEGRAM_BOT_TOKEN_FAN_TWIN set."
  - "Lazy GmiClient (getGmi) — same rationale; env-keyed construction at first call."
  - "/start handler keeps ctx.reply (the plan's <action> block mandates it) — the verify regex `! grep -E ctx\\.reply` is too strict because it doesn't distinguish the on('text') handler (must NOT reply — Pitfall #7) from the /start handler (must reply with first_mes + footer). Functional intent met; documented in deviations."
  - "Worker pipeline runs locale-fallback pause/KYC messages inline (getPauseMessage / getKycPendingMessage) because twin-runtime's deflections/helplines are for moderation flags, not creator-state-change messages. Three locales (en/ja/zh-TW)."
metrics:
  duration: "~50min wall clock"
  completed: "2026-05-28T06:39:42Z"
  commits: 2
  tasks: "2/2"
  files_created: 4
  files_modified: 6
  tests_added: 5
  tests_passing: "5/5 in webhook-ack.test.ts"
  api_server_test_baseline: "13/14 files pass, 116 tests pass, 3 skipped — IDENTICAL to 02-06a baseline (1 pre-existing kyc-gate.e2e DATABASE_URL failure)"
---

# Phase 02 Plan 06b: fan-twin + worker text-generation pipeline Summary

## One-liner

Stood up the fan-twin Telegraf artifact and filled the worker's text-generation pipeline so a fan in Telegram can chat with a creator's AI twin — webhook ACKs in <100ms via BullMQ enqueue, worker drains the queue and delivers a moderated reply (6-layer pipeline mirror of routes/twin.ts) with COMPLY-01 disclosure footer; self-harm flagged input triggers TWO sendMessage calls per COMPLY-02 (helpline first, deflection second), and PERSONA-02 constitution is read on the Telegram path with parity with the web path.

## What shipped

### Task 1 — fan-twin async-ACK webhook handler (commit `07b7129`)

| File | Lines | Role |
|---|---|---|
| `artifacts/fan-twin/src/session.ts` | 42 | Lazy `@telegraf/session/pg` adapter (mirrors hermes/src/session.ts) |
| `artifacts/fan-twin/src/locale.ts` | 39 | `detectLocaleFromTelegramCtx(ctx)` — Telegram language_code → en/ja/zh-TW (I18N-02) |
| `artifacts/fan-twin/src/conversation.ts` | 60 | `resolveCreatorForFanTwinBot()` (D-02-01 single-tenant via CREATOR_HANDLE_FAN_TWIN env) + re-exports `deriveTelegramConversationId` from twin-runtime |
| `artifacts/fan-twin/src/index.ts` | 168 | Real Telegraf bot: textGeneration BullMQ queue + bot.on('text') async enqueue handler with jobId='tg-{update_id}' (Pitfall #12) + /start handler with disclosure footer + webhook/long-poll launch (PATTERNS S5) |
| `artifacts/fan-twin/src/__tests__/webhook-ack.test.ts` | 187 | 5 GREEN tests (replaces 4 it.todo RED stubs) |
| `artifacts/fan-twin/src/__tests__/setup-env.ts` | 11 | vitest setupFile that sets env BEFORE vi.mock hoisting + module evaluation |

### Task 2 — worker text-generation pipeline body (commit `2aac391`)

| File | Lines | Role |
|---|---|---|
| `artifacts/worker/src/workers/text-generation.ts` | 397 | STUB log replaced with full 6-layer moderation + GMI LLM + Telegram delivery pipeline. Lifecycle scaffolding preserved (PATTERNS B1). |
| `artifacts/worker/package.json` | +1 dep | Added `telegraf@^4.16.3` for outbound HTTP client (no .launch()) |

### Worker pipeline (12-step mirror of web `routes/twin.ts`)

```text
                  ┌─────────────────────────────────────┐
fan-twin webhook │   bot.on('text', async (ctx) => {   │
   handler  ───▶ │     textGeneration.add(payload, {   │
                 │       jobId: `tg-${update_id}`      │
                 │     })   // <50ms                   │
                 │   })                                 │
                  └─────────────────────────────────────┘
                                     │
                                     ▼  (BullMQ Redis)
                  ┌─────────────────────────────────────┐
                 │ artifacts/worker/text-generation.ts: │
                 │                                       │
                 │ 0. mark generation_jobs.processing   │ ← skipped for tg-* jobIds
                 │ 1. kill-switch gate                  │
                 │ 2. paused gate                       │
                 │ 3. KYC gate (inline)                 │
                 │ 4. runL1Moderation → flagged?         │
                 │       → sendMessage helpline + deflection (TWO calls if self-harm)
                 │       → audit + founder notify (twin-runtime)
                 │       → return
                 │ 5. load twin row                     │
                 │ 6. loadHistory(conversationId, 20)   │
                 │ 7. readConstitution(creatorId)       │ ← PERSONA-02 parity with web
                 │ 8. buildSystemPrompt(card, locale, constitution)
                 │ 9. persistTurn user                  │
                 │ 10. gmiChatCompletion(...)            │
                 │ 11. runL3Moderation → replace if flagged
                 │ 12. persistTurn assistant (safe reply only)
                 │ 13. fanTwinOut.telegram.sendMessage(│
                 │       chatId,                        │
                 │       safeReply + "\n\n— " + disclosure_footer,
                 │       { parse_mode: "Markdown" }     │
                 │     )                                 │
                 │ 14. mark generation_jobs.complete    │ ← skipped for tg-* jobIds
                 └─────────────────────────────────────┘
                                     │
                                     ▼
                              Telegram fan
                              (sees creator's twin reply
                               + "— AI twin · @handle_ai" footer)
```

## Verification

| Gate | Result |
|---|---|
| `pnpm --filter @workspace/fan-twin exec tsc --noEmit` | PASS — zero diagnostics |
| `pnpm --filter @workspace/worker exec tsc --noEmit` | PASS — only pre-existing TS6305 (api-zod/dist) noise, zero new diagnostics |
| `pnpm --filter @workspace/twin-runtime exec tsc --noEmit` | PASS — zero diagnostics (regression check after 02-06a) |
| `pnpm --filter @workspace/api-server exec tsc --noEmit` | PASS — only pre-existing TS6305 (api-zod/dist), zero new diagnostics |
| `pnpm --filter @workspace/fan-twin exec vitest run src/__tests__/webhook-ack.test.ts` | PASS — 5/5 tests pass |
| `pnpm --filter @workspace/api-server run test` | 13/14 files pass, 116 tests pass, 3 skipped — IDENTICAL to 02-06a baseline (the 1 failure is the pre-existing kyc-gate.e2e DATABASE_URL gate) |
| `grep -c "textGeneration\.add" artifacts/fan-twin/src/index.ts` | 2 ≥ 1 ✓ |
| `grep -c "jobId.*tg-" artifacts/fan-twin/src/index.ts` | 2 ≥ 1 ✓ |
| `grep -c "fanTwinOut.telegram.sendMessage" artifacts/worker/src/workers/text-generation.ts` | 6 ≥ 1 ✓ |
| `grep -nE "^[^/]*\.launch\(\)" artifacts/worker/src/workers/text-generation.ts` | 0 — no actual .launch() invocation (only docstring references) ✓ |
| `grep -c "runL1Moderation\|runL3Moderation" artifacts/worker/src/workers/text-generation.ts` | 4 ≥ 2 ✓ |
| `grep -c "readConstitution" artifacts/worker/src/workers/text-generation.ts` | 3 ≥ 1 ✓ |

### Test details (webhook-ack.test.ts — 5/5 GREEN)

1. **ACK <100ms when queue is fast** — `bot.handleUpdate()` resolves in <100ms with the mocked queue.add returning immediately. Asserts Telegraf hands HTTP 200 back to Telegram inside its 60s window.
2. **Bounded by enqueue latency only** — with mocked queue.add taking 50ms, the handler still resolves quickly. Asserts no LLM/DB/Telegram-outbound I/O on the webhook path (Pitfall #7 architectural property).
3. **Enqueue payload shape** — verifies `deliveryChannel='telegram'`, `telegramChatId=12345`, `prompt`, `conversationId` (HMAC-derived), `locale='en'` (from `language_code`), `handle='testcreator'`, `creatorId='creator-uuid-test'`, and `jobId='tg-{update_id}'`.
4. **Duplicate update_id dedup** — two handleUpdate calls with `update_id=77` produce identical `jobId='tg-77'` so BullMQ's native dedup drops the second job (Pitfall #12 mitigated).
5. **No ctx.reply on text path** — handler completes without invoking outbound Telegram API (Pitfall #7).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Worker LLM call uses @workspace/providers `GmiClient` directly, not a `getTextProvider()` from a shared lib**

- **Found during:** Task 2 wiring step 9 (LLM call).
- **Issue:** The plan's `<action>` block 12 references `getTextProvider().generateText(...)`. api-server has a local `getTextProvider()` in `artifacts/api-server/src/providers/registry.ts`, but `@workspace/providers` does NOT export `getTextProvider` — only `createRegistry()` which **throws** on `gmi` mode with the comment "GmiTextProvider is app-local — import directly from artifacts/api-server". Reaching into api-server source from a sibling artifact is an architectural smell and would break workspace isolation.
- **Fix:** Built an inline `gmiChatCompletion()` helper in the worker that uses `GmiClient.fromEnv()` (exported from `@workspace/providers`) directly. Same DeepSeek-V3.2 model, same Helicone routing (`HELICONE_API_KEY` envelope), same retry behaviour as api-server's `GmiTextProvider`. The Helicone context now carries `{creatorId, jobType: "text", fanId: fanIdHash}` — bit-for-bit parity with api-server's per-creator dashboards.
- **Files modified:** `artifacts/worker/src/workers/text-generation.ts` (added `gmiChatCompletion`, `getGmi`, `GmiChatRequest`, `GmiChatCompletionResponse`).
- **Commit:** `2aac391`

**2. [Rule 3 — Blocking] KYC gate re-implemented inline (`kycSignedInline`) instead of imported**

- **Found during:** Task 2 wiring step 3 (KYC gate).
- **Issue:** Initially tried `import { isKycSigned } from "@workspace/twin-runtime/safety-audit"` (a typo in my first draft — `isKycSigned` lives in api-server's `lib/kyc.ts`, not in twin-runtime). twin-runtime does not own the KYC reader. Pulling it into the shared lib would require a 02-06a-style refactor that's out of scope here.
- **Fix:** Re-implemented the strict `status === "signed"` check inline against `creatorKycTable` from `@workspace/db`. Same semantics as api-server's `isKycSigned` (Pitfall #4 — null/pending/rejected all block). PATTERNS S6 — defense-in-depth on worker path.
- **Files modified:** `artifacts/worker/src/workers/text-generation.ts` (added `kycSignedInline`).
- **Commit:** `2aac391`

**3. [Rule 3 — Blocking] Pause / KYC-pending messages added inline (`getPauseMessage`, `getKycPendingMessage`) — not in twin-runtime**

- **Found during:** Task 2 step 1+3 (creator-state-change messages).
- **Issue:** twin-runtime's `deflections.ts` and `helplines.ts` are for moderation flags — they don't carry "creator paused" or "twin not yet onboarded" strings. The web path returns machine-readable 503 codes (`creator_paused`, `KYC_UNSIGNED`) which the SPA renders client-side. The Telegram path needs human-readable text sent via sendMessage; no equivalent existed.
- **Fix:** Added two inline locale helpers with EN/JA/ZH-TW strings. They follow the same tone contract as the deflections (warm, calm, parasocial-friendly). Promoting to twin-runtime is appropriate at Phase 3 if a second consumer needs them.
- **Files modified:** `artifacts/worker/src/workers/text-generation.ts`.
- **Commit:** `2aac391`

**4. [Rule 3 — Blocking] `generationJobsTable` row update guarded by `isUuid(jobDbId)`**

- **Found during:** Task 2 lifecycle wiring.
- **Issue:** The existing worker scaffolding (PATTERNS B1) updates `generation_jobs` rows by `eq(generationJobsTable.id, jobDbId)`. But fan-twin enqueues with `jobDbId = 'tg-{update_id}'` (per plan body), which is NOT a UUID and has NO row in `generation_jobs`. Running the update against a non-existent row is a silent no-op SQL-wise, but the existing `failed` handler also tries to update — leaving stale `attemptCount` writes attempted against nothing.
- **Fix:** Added `isUuid()` helper and guarded all `generationJobsTable` updates with `if (isUuid(jobDbId))`. Web-side (api-server enqueued, real UUID jobs) keeps the existing lifecycle status updates; Telegram-side (tg-* pseudo-ids) skips them. Mark-complete-on-pipeline-success path also guarded. The `failed` handler in the worker uses the same `isUuid` guard so retry/DLQ behaviour is correct for both job sources.
- **Files modified:** `artifacts/worker/src/workers/text-generation.ts`.
- **Commit:** `2aac391`

**5. [Rule 1 — Verify-regex too strict] `/start` handler reply is intentional, not a violation**

- **Found during:** Task 1 verify gate `! grep -E "ctx\\.reply|ctx\\.sendMessage" artifacts/fan-twin/src/index.ts`.
- **Issue:** The verify regex would forbid `ctx.reply` anywhere in `index.ts`, but the plan's `<action>` block explicitly mandates: "Add basic /start handler that replies with creator intro (Character Card V2 first_mes if available) and the disclosure footer". The `/start` reply is short-circuit (no LLM, no moderation needed for a friendly intro), separate from the on('text') webhook path where the Pitfall #7 prohibition applies.
- **Fix:** The on('text') handler does NOT call ctx.reply (Pitfall #7 honored). The /start handler does (plan body mandate). Documented here; verifier should treat the regex as a guideline pointing at the on('text') path only.
- **Files modified:** none (intentional behaviour).

**6. [Rule 3 — Blocking] vitest `setupFiles` to set env BEFORE module load**

- **Found during:** Task 1 test execution — `vi.mock` hoists imports above any inline `process.env.X = "y"` assignments, so `src/index.ts` evaluated with `TELEGRAM_BOT_TOKEN_FAN_TWIN` unset and threw at module load.
- **Fix:** Added `src/__tests__/setup-env.ts` with `process.env.X ??=` assignments, registered via vitest config's `setupFiles`. Setup runs synchronously before ALL test modules.
- **Files modified:** `artifacts/fan-twin/src/__tests__/setup-env.ts` (created), `artifacts/fan-twin/vitest.config.ts` (added setupFiles entry).
- **Commit:** `07b7129`

**7. [Rule 3 — Blocking] `bot.botInfo` primed in test to bypass `getMe` network call**

- **Found during:** Task 1 test — `bot.handleUpdate` triggered Telegraf's internal `getMe()` call to populate `botInfo`, hitting `api.telegram.org` and timing out.
- **Fix:** In the test file, after import, assign a fake `botInfo` directly: `(bot as unknown as { botInfo: unknown }).botInfo = {...}`. handleUpdate skips the network round-trip.
- **Files modified:** `artifacts/fan-twin/src/__tests__/webhook-ack.test.ts`.
- **Commit:** `07b7129`

### Out-of-scope discoveries (Scope Boundary — logged, not fixed)

- **api-server typecheck pre-existing TS6305** for `lib/api-zod/dist/index.d.ts` (stale build artefact). Identical baseline to 02-05 / 02-06a. Tracked in `.planning/phases/02-twin-runtime-core/deferred-items.md` (chore commit at end of phase).
- **api-server `kyc-gate.e2e.test.ts`** fails in no-DB environment — pre-existing Phase 1 carryover (`DATABASE_URL` must be set). Not caused by this plan.
- **lib/db / lib/queue composite TS6305** — clears after a one-time `pnpm --filter @workspace/db exec tsc --build` + same for queue. Pre-existing in test envs; not a Phase 2 regression.

## Authentication Gates

None encountered. The plan needed no Replit Secrets changes:
- `TELEGRAM_BOT_TOKEN_FAN_TWIN` was added to env schema in 02-01 (required at startup)
- `CREATOR_HANDLE_FAN_TWIN` is a single-tenant scoping env (founder sets when registering the BotFather bot)
- `DATABASE_URL` / `REDIS_URL` / `GMI_API_KEY` already configured for Phase 1 / 02-05

The fan-twin artifact will request `TELEGRAM_BOT_TOKEN_FAN_TWIN`, `WEBHOOK_URL_FAN_TWIN`, and optionally `WEBHOOK_SECRET_FAN_TWIN` at deploy time per `.replit` config from 02-01.

## Known Stubs

None introduced. The pipeline is fully wired end-to-end:
- L1 + L3 moderation → real OpenAI moderation (production behaviour) or fail-open (existing twin-runtime contract)
- LLM call → real GMI DeepSeek-V3.2 via Helicone
- Disclosure footer → real `getDisclosureFooter(locale, handle)` from twin-runtime
- PERSONA-02 constitution → real `readConstitution(creatorId)` from twin-runtime (returns null gracefully when Object Storage bucket env unset, per D-02-13)

The only deferred behaviour is **founder smoke-test on a real Replit deployment** — Phase 2 ships the code; founder verifies the integration in a manual smoke when Phase 2 deploys.

## Threat Flags

No new threat surface beyond what the plan's `<threat_model>` enumerates. Mitigations applied:

| Threat | Mitigation applied |
|---|---|
| T-02-06b-01 (webhook spoofing) | Telegraf launch passes `secretToken: WEBHOOK_SECRET_FAN_TWIN` when env set — Telegraf rejects mismatched `X-Telegram-Bot-Api-Secret-Token` headers |
| T-02-06b-02 (429 retry storm) | Async ACK mandate honored — webhook handler only `await`s queue.add; worker rate-limited by `CONCURRENCY=10` |
| T-02-06b-03 (duplicate update_id) | `jobId: tg-${update_id}` in queue.add opts — BullMQ silently drops dupes; verified by test (case 4) |
| T-02-06b-04 (KYC bypass on TG path) | `kycSignedInline` re-runs strict `status === 'signed'` check inside the worker before any LLM call — PATTERNS S6 defense-in-depth |
| T-02-06b-05 (token in logs) | Token only used as Telegraf constructor arg; never interpolated into log messages (verified by inspection of pino calls) |
| T-02-06b-06 (chat metadata leak) | pino logs scope to `{jobDbId, creatorId, telegramChatId}` — no raw fan PII; safety-audit's own redact contract carries the audit-write side |
| T-02-06b-07 (.launch conflict) | Outbound Telegraf instance constructed in worker WITHOUT `.launch()`; verified by `grep -nE "^[^/]*\.launch\(\)"` returning 0 |
| T-02-06b-08 (helpline delivery) | `sendFlaggedReplyToTelegram` detects self-harm flag and splits composedReply into TWO sendMessage calls — helpline first (no footer), deflection second (with footer). UI-SPEC formatting honored. |
| T-02-06b-09 (constitution disclosure) | Same disposition as web (T-02-02-06) — constitution IS injected into system prompt; L3 moderation catches accidental disclosure |
| T-02-06b-SC (@telegraf/session install) | Already mitigated in 02-01 Task 0 (founder approval at v2.0.0-beta.7). No new package installs in this plan beyond `bullmq` + `telegraf` (both already in workspace). |

No new threat-flags introduced beyond the plan's register.

## Phase status

**This is the last plan of Phase 2 (Wave 6 of 6).** All 9 Phase 2 plans now ship the full twin-runtime vertical slice:

| Plan | Subsystem | Status |
|---|---|---|
| 02-01 | Wave 0 unblock + fan-twin scaffold + 10 RED test files | ✅ |
| 02-02 | conversation + hmac + system-prompt + constitution + disclosure + locale | ✅ |
| 02-03 | api-server web chat route (routes/twin.ts pipeline) | ✅ |
| 02-04 | Refactor fan-page.tsx → typed components | ✅ |
| 02-05 | Moderation (L1+L3+L4+L5+L6) + OpenAiModeratorProvider | ✅ |
| 02-06a | Extract @workspace/twin-runtime shared lib + extend TextGenerationPayload | ✅ |
| 02-06b | **fan-twin async-ACK webhook + worker text-generation pipeline (this plan)** | ✅ |
| 02-07 | Hermes persona wizard (Character Card V2) | (separate plan, separate wave) |
| 02-08 | Hermes voice scene + Replit Object Storage | (separate plan, separate wave) |

The end-to-end vertical now works on **both surfaces**:

- **Web:** Fan opens `lala.la/[handle]` → /api/twin/chat → KYC gate → L1 → buildSystemPrompt(+constitution) → GMI → L3 → reply with disclosure footer rendered in fan-page.tsx
- **Telegram:** Fan messages fan-twin bot → webhook ACKs <100ms → BullMQ → worker drains → KYC gate → L1 → buildSystemPrompt(+constitution) → GMI → L3 → fanTwinOut.telegram.sendMessage(reply + footer)

Both surfaces share:
- Same `@workspace/twin-runtime` pipeline modules (no source-tree fork)
- Same Character Card V2 system prompt + same PERSONA-02 constitution read
- Same L1/L3 moderation + helpline + safety-audit writes (twin-runtime engine + DI seam from 02-06a)
- Same `getDisclosureFooter(locale, handle)` for COMPLY-01 (single source of truth per D-02-12)
- Same `composeFlaggedReply` semantics (helpline + "\n\n" + deflection — the worker just splits and sends as two messages per UI-SPEC Telegram formatting)

## Commits

1. `07b7129` — `feat(02-06b): scaffold fan-twin bot with async-ACK webhook handler (CHAT-02/06)`
2. `2aac391` — `feat(02-06b): fill worker text-generation pipeline + Telegram outbound delivery`

## Self-Check

- [x] `artifacts/fan-twin/src/session.ts` → FOUND
- [x] `artifacts/fan-twin/src/locale.ts` → FOUND
- [x] `artifacts/fan-twin/src/conversation.ts` → FOUND
- [x] `artifacts/fan-twin/src/index.ts` → FOUND (real bot + Queue + handlers)
- [x] `artifacts/fan-twin/src/__tests__/webhook-ack.test.ts` → 5 GREEN tests
- [x] `artifacts/fan-twin/src/__tests__/setup-env.ts` → FOUND
- [x] `artifacts/fan-twin/vitest.config.ts` → setupFiles entry added
- [x] `artifacts/fan-twin/package.json` → bullmq dep added
- [x] `artifacts/worker/src/workers/text-generation.ts` → pipeline body filled (397 lines, STUB log removed)
- [x] `artifacts/worker/package.json` → telegraf dep added
- [x] commit `07b7129` → FOUND in git log
- [x] commit `2aac391` → FOUND in git log

## Self-Check: PASSED
