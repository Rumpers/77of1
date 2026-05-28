---
phase: 02-twin-runtime-core
plan: 06b
type: execute
wave: 6
depends_on: [02-06a]
files_modified:
  - artifacts/fan-twin/package.json
  - artifacts/fan-twin/src/index.ts
  - artifacts/fan-twin/src/session.ts
  - artifacts/fan-twin/src/conversation.ts
  - artifacts/fan-twin/src/locale.ts
  - artifacts/fan-twin/src/__tests__/webhook-ack.test.ts
  - artifacts/worker/src/workers/text-generation.ts
  - artifacts/worker/package.json
autonomous: true
requirements: [CHAT-02, CHAT-06, COMPLY-01, MOD-01, MOD-03, MOD-04, MOD-05, MOD-06, COMPLY-02, PERSONA-02, I18N-02]
tags: [phase-2, fan-twin, telegram, worker, async, chat-06]

must_haves:
  truths:
    - "Fan posts text to fan-twin Telegram bot → bot returns HTTP 200 within ~50ms (BullMQ enqueue) — no Telegram 60s timeout possible"
    - "Worker drains textGeneration queue, runs L1/L2/L3 moderation pipeline, calls GMI, sends reply via bot.telegram.sendMessage"
    - "Worker calls readConstitution(creatorId) and passes result to buildSystemPrompt — PERSONA-02 honored on Telegram surface as well as web"
    - "Duplicate Telegram update (same update_id) processed once (BullMQ jobId dedup)"
    - "Telegram reply includes COMPLY-01 disclosure footer in detected locale (— AI twin · @handle_ai)"
    - "Self-harm input via Telegram → helpline + deflection delivered; safety_audit_log written; founder notify fired"
    - "Outbound Telegraf client in worker has no .launch() (no webhook conflict with fan-twin artifact)"
    - "fan-twin uses @telegraf/session/pg for session persistence (survives Replit restart)"
    - "fan-twin imports @workspace/twin-runtime (built in 02-06a) — no direct imports from api-server source"
  artifacts:
    - path: "artifacts/fan-twin/src/index.ts"
      provides: "Telegraf bot with async-ack webhook handler"
    - path: "artifacts/worker/src/workers/text-generation.ts"
      provides: "Real pipeline body — L1/L3 moderation + GMI + Telegram delivery + PERSONA-02 constitution"
    - path: "artifacts/fan-twin/src/__tests__/webhook-ack.test.ts"
      provides: "Integration test asserting webhook ACKs <100ms regardless of downstream LLM latency"
  key_links:
    - from: "artifacts/fan-twin/src/index.ts"
      to: "@workspace/queue textGeneration queue"
      via: "textGeneration.add(...)"
      pattern: "textGeneration\\.add"
    - from: "artifacts/fan-twin/src/index.ts"
      to: "BullMQ jobId for idempotency"
      via: "jobId: `tg-${update_id}`"
      pattern: "jobId.*tg-"
    - from: "artifacts/worker/src/workers/text-generation.ts"
      to: "fanTwinOut.telegram.sendMessage"
      via: "outbound Telegraf client (no .launch)"
      pattern: "telegram\\.sendMessage"
    - from: "artifacts/worker/src/workers/text-generation.ts"
      to: "@workspace/twin-runtime readConstitution + buildSystemPrompt"
      via: "constitution awaited then passed into prompt builder"
      pattern: "readConstitution|buildSystemPrompt"
    - from: "artifacts/worker/src/workers/text-generation.ts"
      to: "getModeratorProvider + getTextProvider"
      via: "imports from @workspace/providers"
      pattern: "getModeratorProvider|getTextProvider"
---

<objective>
Wave 6 (split out of original 02-06 per checker WARNING 7): stand up the Telegram fan-twin artifact and fill the worker's text-generation body so a fan can chat with the creator's twin through Telegram. Webhook ACKs immediately; worker handles LLM + moderation + delivery asynchronously per CHAT-06. Depends on 02-06a — all twin-runtime libs are now imported from `@workspace/twin-runtime`.

Purpose: CHAT-02 (fan-twin bot) and CHAT-06 (async ack) are mandated by REQUIREMENTS. Pitfall #7 (429 retry storm) is the technical reason — sync paths under load cause Telegram to re-deliver updates and amplify outbound load. The async pattern is architectural, not performance optimization.

Output: Functional `artifacts/fan-twin/` artifact + worker pipeline filled. Self-harm flow works end-to-end through Telegram (helpline injection, founder notify, audit row). PERSONA-02 constitution is read by worker just like the web pipeline reads it in 02-03. Single-tenant per D-02-01.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-twin-runtime-core/02-CONTEXT.md
@.planning/phases/02-twin-runtime-core/02-RESEARCH.md
@.planning/phases/02-twin-runtime-core/02-PATTERNS.md
@.planning/phases/02-twin-runtime-core/02-01-SUMMARY.md
@.planning/phases/02-twin-runtime-core/02-02-SUMMARY.md
@.planning/phases/02-twin-runtime-core/02-05-SUMMARY.md
@.planning/phases/02-twin-runtime-core/02-06a-SUMMARY.md
@artifacts/hermes/src/index.ts
@artifacts/hermes/package.json
@artifacts/worker/src/workers/text-generation.ts
@lib/queue/src/types.ts
</context>

<interfaces>
<!-- All twin-runtime libs are now in @workspace/twin-runtime (built in 02-06a) -->

From @workspace/queue (lib/queue/src/queues.ts):
- `textGeneration: Queue<TextGenerationPayload>` exported
- `.add(jobName, payload, opts?)` where opts.jobId enables dedup

From @workspace/twin-runtime (built in 02-06a):
- runL1Moderation, runL3Moderation, composeFlaggedReply, severityFromCategories
- loadHistory, persistTurn
- buildSystemPrompt(card, locale, constitution?)
- readConstitution(creatorId) — PERSONA-02 reader (D-02-13)
- getDisclosureFooter
- getHelpline, getDeflection
- deriveTelegramConversationId
- notifyFounderAsync (already invoked inside moderation.ts internals)

From lib/queue/src/types.ts (extended in 02-06a):
- TextGenerationPayload now includes locale, conversationId, deliveryChannel, telegramChatId, twinId, handle

From artifacts/hermes/src/index.ts (lines 524-541):
- Telegraf launch pattern: webhook in prod (`WEBHOOK_URL` + optional `WEBHOOK_SECRET`), long-poll in dev
- SIGTERM/SIGINT graceful shutdown

From hermes outbound pattern (Pitfall: worker can't .launch()):
- `new Telegraf(token)` without `.launch()` → only `bot.telegram.sendMessage(...)` calls allowed
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Scaffold artifacts/fan-twin/src/ + install deps + async webhook ACK + session/conversation/locale helpers</name>
  <files>artifacts/fan-twin/package.json, artifacts/fan-twin/src/index.ts, artifacts/fan-twin/src/session.ts, artifacts/fan-twin/src/conversation.ts, artifacts/fan-twin/src/locale.ts, artifacts/fan-twin/src/__tests__/webhook-ack.test.ts</files>
  <read_first>
    - artifacts/fan-twin/package.json (skeleton from 02-01 + @workspace/twin-runtime added in 02-06a)
    - artifacts/hermes/src/index.ts (Telegraf launch pattern — lines 524-541; bot.on('text') pattern)
    - .planning/phases/02-twin-runtime-core/02-PATTERNS.md (C3 — fan-twin index.ts skeleton; C1 — package.json diff; S5 — Telegraf launch)
    - .planning/phases/02-twin-runtime-core/02-RESEARCH.md (Pattern 4 — full fan-twin index.ts with @telegraf/session/pg; Pitfall #7 — async ack mandate)
    - lib/queue/src/queues.ts (textGeneration queue handle)
    - lib/queue/src/types.ts (extended TextGenerationPayload from 02-06a)
  </read_first>
  <behavior>
    - Bot starts in dev (long-poll) and prod (webhook) modes per WEBHOOK_URL_FAN_TWIN env
    - bot.on('text') handler enqueues to textGeneration queue with jobId=`tg-${update_id}` for dedup
    - Webhook ACK test: simulate a webhook POST with a text message; assert handler resolves in <100ms regardless of downstream queue latency (Telegraf returns 200 once handler resolves)
    - Duplicate update_id: second add() with same jobId is silently dropped by BullMQ (verified via queue inspection)
    - deriveTelegramConversationId from @workspace/twin-runtime gives deterministic ID for same chatId+creatorId
    - detectLocaleFromTelegramCtx(ctx) reads ctx.from.language_code, maps zh→zh-TW, else fallback to en
  </behavior>
  <action>
    Update `artifacts/fan-twin/package.json` per PATTERNS C1:
    - Add deps: `@workspace/db`, `@workspace/queue`, `@workspace/twin-runtime` (already added in 02-06a), `@telegraf/session` (version confirmed in 02-01 Task 0), `telegraf ^4.16.3`, `drizzle-orm catalog:`, `pg ^8.20.0`, `zod catalog:`
    - Mirror hermes devDependencies (esbuild + tsx + vitest)
    - Run `pnpm --filter @workspace/fan-twin add @telegraf/session@<version> @workspace/db @workspace/queue pg telegraf drizzle-orm zod`
    - Run `pnpm --filter @workspace/fan-twin add -D vitest tsx esbuild`

    Create `artifacts/fan-twin/src/session.ts` per RESEARCH Pattern 4:
    - Import `session` from "telegraf"; `Pool` from "pg"; `PostgresAdapter` from "@telegraf/session/pg"
    - Export `sessionMiddleware = session({ store: new PostgresAdapter({ pool: new Pool({ connectionString: process.env.DATABASE_URL! }) }) })`

    Create `artifacts/fan-twin/src/conversation.ts`:
    - Re-export `deriveTelegramConversationId` from `@workspace/twin-runtime`
    - Export `async function resolveCreatorForFanTwinBot(bot: Telegraf): Promise<{ id: string; handle: string }>` — per D-02-01 single-tenant: read `CREATOR_HANDLE_FAN_TWIN` env var (set per-Replit-instance); look up `creators` row by handle; return id+handle. Throw at startup if env unset.

    Create `artifacts/fan-twin/src/locale.ts`:
    - Export `detectLocaleFromTelegramCtx(ctx): Locale` — read ctx.from?.language_code; map "ja"→"ja", "zh"|"zh-tw"|"zh-hant"→"zh-TW", "en"→"en", else "en". Per I18N-02.

    Create `artifacts/fan-twin/src/index.ts` per PATTERNS C3 + RESEARCH Pattern 4:
    - Import Telegraf, sessionMiddleware, textGeneration (from @workspace/queue), deriveTelegramConversationId, detectLocaleFromTelegramCtx, resolveCreatorForFanTwinBot
    - Construct bot with TELEGRAM_BOT_TOKEN_FAN_TWIN (throw if missing)
    - `bot.use(sessionMiddleware)`
    - `bot.on('text', async (ctx) => {  resolveCreator; derive convId; await textGeneration.add('fan-text', {type: 'text-generation', jobDbId: \`tg-${update_id}\`, creatorId, fanId: String(ctx.from.id), consentGrantVersion: 'v1.0', prompt: ctx.message.text, locale, conversationId, deliveryChannel: 'telegram', telegramChatId: ctx.chat.id, handle}, { jobId: \`tg-${update_id}\` });  })` — NO ctx.reply here
    - Add basic /start handler that replies with creator intro (Character Card V2 first_mes if available) and the disclosure footer
    - Launch per PATTERNS S5: webhook in prod (WEBHOOK_URL_FAN_TWIN + port from PORT env, default 3002 per D-02-06) with optional secretToken; long-poll in dev. SIGTERM/SIGINT graceful shutdown.

    Create `artifacts/fan-twin/src/__tests__/webhook-ack.test.ts`:
    - Mock @workspace/queue textGeneration.add to track calls and resolve after 5000ms (simulating slow Redis)
    - Construct bot via `new Telegraf("test-token")` with `process.env.TELEGRAM_BOT_TOKEN_FAN_TWIN='test-token'`
    - Invoke bot.handleUpdate({ update_id: 1, message: { ... text: "hi" ... } }) and measure elapsed time — assert <100ms
    - Add second invocation with same update_id; assert textGeneration.add was called twice but BullMQ would dedup (verify by jobId arg)
  </action>
  <verify>
    <automated>pnpm --filter @workspace/fan-twin exec tsc --noEmit && pnpm --filter @workspace/fan-twin exec vitest run src/__tests__/webhook-ack.test.ts && grep -c "textGeneration\\.add" artifacts/fan-twin/src/index.ts | awk '{exit ($1>=1)?0:1}' && grep -c "jobId.*tg-" artifacts/fan-twin/src/index.ts | awk '{exit ($1>=1)?0:1}' && ! grep -E "ctx\\.reply|ctx\\.sendMessage" artifacts/fan-twin/src/index.ts</automated>
  </verify>
  <done>
    - All 5 fan-twin source files exist
    - Bot typechecks and webhook-ack test passes (<100ms ack)
    - No `ctx.reply` in webhook handler (worker owns delivery — Pitfall #7)
    - jobId pattern `tg-{update_id}` present
  </done>
  <acceptance_criteria>
    - Per CHAT-06: webhook ACKs immediately
    - Per Pitfall #7: idempotency via jobId; no sync reply
    - Per D-02-01: single-tenant via resolveCreatorForFanTwinBot
    - Per D-02-06: port 3002 (or alternative from 02-01 SUMMARY)
    - Per PATTERNS S5: Telegraf launch with webhook prod / long-poll dev
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fill artifacts/worker/src/workers/text-generation.ts pipeline + outbound Telegraf client + PERSONA-02 constitution read</name>
  <files>artifacts/worker/src/workers/text-generation.ts, artifacts/worker/package.json</files>
  <read_first>
    - artifacts/worker/src/workers/text-generation.ts (existing stub — KEEP lifecycle scaffolding lines 8-38, 58-77 verbatim per PATTERNS B1)
    - artifacts/worker/src/workers/voice-generation.ts (sibling skeleton — pattern reference)
    - .planning/phases/02-twin-runtime-core/02-PATTERNS.md (B1 — text-generation pipeline; Pitfall: worker can't .launch())
    - .planning/phases/02-twin-runtime-core/02-RESEARCH.md (Pattern 5 — full worker-side delivery)
    - lib/queue/src/types.ts (newly extended TextGenerationPayload from 02-06a)
    - artifacts/api-server/src/routes/twin.ts (web-side pipeline — same shape; worker mirrors it including readConstitution wiring from 02-03)
    - lib/db/src/schema/index.ts (creatorConfigTable, creatorsTable, twinsTable, conversationMessagesTable)
  </read_first>
  <behavior>
    - Worker drains textGeneration queue with concurrency=N (existing CONCURRENCY const)
    - For deliveryChannel="telegram" jobs: runs same 6-layer moderation pipeline as web; sends reply via fanTwinOut.telegram.sendMessage
    - For deliveryChannel="web" jobs: NO-OP (web is sync — this worker only handles Telegram)
    - Pause/kill-switch gate: if creator_config.paused OR creators.kill_switch_active → send pause message + return (no LLM call)
    - L1 flagged: send helpline + deflection via Telegram; audit + founder notify; return
    - LLM call: persist user turn, READ CONSTITUTION via readConstitution(creatorId), build system prompt from twin.characterCard + constitution, call getTextProvider().generateText with history
    - L3 flagged: replace with deflection; audit + founder notify
    - Persist assistant turn (safe reply only)
    - Outbound: bot.telegram.sendMessage(chatId, safeReply + "\n\n— " + getDisclosureFooter(locale, handle), {parse_mode: "Markdown"})
    - Crisis path: TWO sendMessage calls — helpline first, deflection second — per UI-SPEC Telegram formatting
    - Outbound Telegraf instance: module-scope singleton `new Telegraf(token)` with NO .launch() — pure HTTP client per Pitfall
  </behavior>
  <action>
    Ensure `@workspace/twin-runtime` is in `artifacts/worker/package.json` deps (added in 02-06a Task 1).

    Read existing `artifacts/worker/src/workers/text-generation.ts` to preserve lifecycle scaffolding per PATTERNS B1 (status update to 'processing' with bullmqJobId+attemptCount, failed handler, complete status update).

    Replace the STUB log body (around line 40-41) with the pipeline. Per RESEARCH Pattern 5 + PATTERNS B1:

    1. Module-scope: `const fanTwinOut = new Telegraf(process.env.TELEGRAM_BOT_TOKEN_FAN_TWIN!)` (NO `.launch()`)
    2. Inside processor: `const payload = job.data as TextGenerationPayload`
    3. If `payload.deliveryChannel !== 'telegram'` → return (web is sync, handled by api-server)
    4. Destructure: `{creatorId, fanId, prompt, locale, conversationId, telegramChatId, handle}`
    5. Pause/kill gate: query creatorsTable + creatorConfigTable; if `kill_switch_active || paused`: `await fanTwinOut.telegram.sendMessage(telegramChatId, getErrorString(locale, "paused"))` ; return (still mark job complete — not a job failure)
    6. L1 mod: `const l1 = await runL1Moderation({text: prompt, locale, creatorId, fanIdHash: hashFanId(fanId), sessionId: conversationId})` (use twin-runtime helpers). If flagged: handle crisis path (helpline + deflection — TWO sendMessage calls per UI-SPEC Telegram formatting) OR single deflection sendMessage; return
    7. Resolve twin: `const twin = await db.select().from(twinsTable).where(eq(twinsTable.creatorId, creatorId)).limit(1)`
    8. Load history: `loadHistory(conversationId, 20)`
    9. **PERSONA-02 read (D-02-13):** `const constitution = await readConstitution(creatorId)` — null when absent or storage unavailable; never throws
    10. Build system prompt: `buildSystemPrompt(twin[0]?.characterCard, locale, constitution)` — same call signature as 02-03 web path
    11. Persist user turn
    12. LLM: `getTextProvider().generateText({creatorId, fanId: hashFanId(fanId), messages: [...history, {role: 'user', content: prompt}], systemPrompt, maxTokens: 512})`
    13. L3 mod on llm.content
    14. `const safeReply = l3.flagged ? l3.reply! : llm.content`
    15. Persist assistant turn (safeReply)
    16. Deliver: `await fanTwinOut.telegram.sendMessage(telegramChatId, safeReply + "\n\n— " + getDisclosureFooter(locale, handle), {parse_mode: 'Markdown'})`
    17. On any error in pipeline: log via pino, throw to let BullMQ retry per existing failed handler

    Imports from @workspace/twin-runtime: `runL1Moderation, runL3Moderation, loadHistory, persistTurn, buildSystemPrompt, readConstitution, getDisclosureFooter, composeFlaggedReply, getHelpline, getDeflection`. Imports from @workspace/api-server are NOT used — twin-runtime is the shared lib.

    Update payload type assertion to use extended TextGenerationPayload from lib/queue/src/types.ts.
  </action>
  <verify>
    <automated>pnpm --filter @workspace/worker exec tsc --noEmit && grep -c "fanTwinOut\\.telegram\\.sendMessage\|fanTwinOut.telegram.sendMessage" artifacts/worker/src/workers/text-generation.ts | awk '{exit ($1>=1)?0:1}' && ! grep -E "fanTwinOut\\.launch|\\.launch\\(\\)" artifacts/worker/src/workers/text-generation.ts && grep -c "runL1Moderation\|runL3Moderation" artifacts/worker/src/workers/text-generation.ts | awk '{exit ($1>=2)?0:1}' && grep -c "readConstitution" artifacts/worker/src/workers/text-generation.ts | awk '{exit ($1>=1)?0:1}'</automated>
  </verify>
  <done>
    - Worker typechecks
    - Pipeline body replaces STUB; lifecycle scaffolding preserved
    - Outbound Telegraf client has no .launch() (Pitfall mitigated)
    - L1 + L3 moderation invoked
    - readConstitution called and passed to buildSystemPrompt (PERSONA-02 parity with web pipeline)
    - Disclosure footer appended to every outbound message
  </done>
  <acceptance_criteria>
    - Per CHAT-06: worker is the delivery point (sync over Telegram HTTP after async queue drain)
    - Per MOD-01/03/04/05/06: full moderation pipeline runs in worker (mirrors api-server web path)
    - Per COMPLY-01: disclosure footer on every Telegram reply
    - Per COMPLY-02: self-harm flagged input → helpline + deflection delivered via two sendMessage calls
    - Per PERSONA-02 (D-02-13): constitution read happens in BOTH the web (02-03) and Telegram (this plan) pipelines — single source helper readConstitution
    - Per PATTERNS S6: KYC gate runs inline in worker (paste isKycSigned check before pause gate, OR rely on api-server having gated via twin-profile API — discretion: keep redundant in-worker check for defense-in-depth)
    - Per S2: notify-founder is fire-and-forget (already inside moderation.ts wrappers)
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Telegram → fan-twin webhook | untrusted; verified via WEBHOOK_SECRET (X-Telegram-Bot-Api-Secret-Token header) |
| fan-twin → BullMQ Redis | trusted (same Replit instance); payload type-checked via TextGenerationPayload |
| worker → GMI + OpenAI moderation | outbound HTTPS; same trust as api-server |
| worker → Telegram Bot API | outbound HTTPS; uses TELEGRAM_BOT_TOKEN_FAN_TWIN |
| worker → Replit Object Storage (constitution read) | outbound HTTPS; same trust as api-server |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-06b-01 | Spoofing | webhook spoofing (third-party POST to fan-twin URL) | mitigate | Telegraf launch with `secretToken: WEBHOOK_SECRET_FAN_TWIN`; Telegram includes header `X-Telegram-Bot-Api-Secret-Token`; Telegraf rejects mismatches |
| T-02-06b-02 | DoS | 429 Telegram retry storm (sync handler) | mitigate | Async ACK mandated (CHAT-06); webhook handler only enqueues; worker rate-limited via BullMQ concurrency |
| T-02-06b-03 | Tampering | duplicate update_id replay | mitigate | `jobId: tg-${update_id}` — BullMQ silently drops dupes |
| T-02-06b-04 | Tampering | KYC gate bypass on Telegram path | mitigate | PATTERNS S6 — worker re-runs isKycSigned check inline; api-server's gate not relied on (defense-in-depth) |
| T-02-06b-05 | Info Disclosure | TELEGRAM_BOT_TOKEN_FAN_TWIN in worker logs | mitigate | Token never interpolated into log strings; only used as Telegraf constructor arg |
| T-02-06b-06 | Info Disclosure | bot.telegram error response leaks chat metadata to logs | mitigate | pino redact extension covers `req.body`; worker logs error.message only, not error.cause |
| T-02-06b-07 | Tampering | worker .launch() conflict with fan-twin .launch() | mitigate | New module-level pitfall (RESEARCH calls out): worker uses `new Telegraf(token)` without `.launch()` — verified via grep in <verify> |
| T-02-06b-08 | Compliance violation | crisis helpline not delivered to Telegram fan | mitigate | UI-SPEC Telegram formatting mandates two sendMessage calls (helpline first, deflection second); composeFlaggedReply returns helpline+deflection joined which the worker splits |
| T-02-06b-09 | Info Disclosure | constitution.md content delivered to fan via Telegram | accept | Same disposition as T-02-02-06 (web path): constitution IS deliberately injected into LLM context; L3 moderation catches accidental disclosure |
| T-02-06b-SC | Tampering | @telegraf/session install | mitigate | Plan 02-01 Task 0 founder approval; version pinned from approval message |
</threat_model>

<verification>
- `pnpm --filter @workspace/twin-runtime exec tsc --noEmit` exits 0 (regression check)
- `pnpm --filter @workspace/fan-twin exec tsc --noEmit` exits 0
- `pnpm --filter @workspace/worker exec tsc --noEmit` exits 0
- `pnpm --filter @workspace/api-server exec tsc --noEmit` exits 0 (regression check after 02-06a)
- `pnpm --filter @workspace/api-server run test` full suite still passes
- `pnpm --filter @workspace/fan-twin exec vitest run src/__tests__/webhook-ack.test.ts` exits 0
- `grep -c "\\.launch" artifacts/worker/src/workers/text-generation.ts` returns 0
- `grep -c "readConstitution" artifacts/worker/src/workers/text-generation.ts` ≥ 1 (PERSONA-02 wired on Telegram path)
- Manual integration (founder, in Replit): send "hi" to fan-twin bot → reply arrives within ~5s with disclosure footer; send "I want to hurt myself" in JP locale → two messages arrive (helpline 0120-279-338, then deflection); founder Telegram receives alert
- Manual integration: with `creators/{creatorId}/constitution.md` present in bucket → assistant replies reflect its content; remove the file → assistant replies degrade gracefully to Character Card V2 alone
</verification>

<success_criteria>
- fan-twin artifact compiles and starts (founder boot smoke)
- Webhook ACKs <100ms (test passes)
- Worker drains queue and delivers reply via Telegram with disclosure footer
- Crisis path delivers helpline + deflection in two messages
- PERSONA-02 constitution is read and prepended on the Telegram path (parity with web path in 02-03)
- fan-twin and worker consume @workspace/twin-runtime exclusively (no reach into api-server source)
</success_criteria>

<output>
Create `.planning/phases/02-twin-runtime-core/02-06b-SUMMARY.md` with: BotFather bot username, founder smoke-test result (text path + crisis path + constitution presence/absence), fan-twin port confirmation.
</output>
