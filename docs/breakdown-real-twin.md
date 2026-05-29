# Real Twin — Breakdown for Paperclip

The **Real Twin** block (was "Phase 1" in pre-rename plan) makes the twin actually respond like the creator instead of returning canned stubs, and makes Lala actually accept the creator's raw material from Telegram. Two parallel tracks (Twin Runtime + Lala Intake) plus an agent-harness scaffold where they meet.

Tickets below are sized so one engineer can pick one up and ship a PR in 1-3 days. Each is paste-ready for Paperclip → OF-* assignment.

**Scope rule:** layer on existing code; do **not** delete or restructure the dormant Stripe / credits / fan-payment scaffolding. It stays in-tree per Option A.

---

## Track A — Twin Runtime

### [RT-01] Wire `/api/twin/chat` to the real GMI text provider

**Why:** Today the fan-twin endpoint returns a random pick from a hardcoded `STUB_RESPONSES` dict per locale. Until it actually calls a provider, the twin can't say anything meaningful and we can't validate persona / RAG end-to-end.

**Scope:**
- `artifacts/api-server/src/routes/twin.ts:33` — replace `STUB_RESPONSES` random selection with a call to `registry.text.generate(...)`.
- Use the existing provider registry at `artifacts/api-server/src/providers/registry.ts:42-101` (env-var driven; `TEXT_PROVIDER` defaults to `gmi`).
- For this ticket pass empty `systemPrompt` and `ragChunks` — those get populated in RT-03 and RT-04.
- Wrap the provider call in a try/catch; on error log with creator handle + return a friendly "twin is resting" message, no 500.

**Acceptance:**
- [ ] `POST /api/twin/chat` with a known creator handle returns a non-stub response on the happy path.
- [ ] Provider errors return 200 with a friendly message (no 500s leaking to the fan).
- [ ] `STUB_RESPONSES` constant removed from the route.
- [ ] The existing web fan-page chat UI still works against the route.

**Files:** `artifacts/api-server/src/routes/twin.ts`
**Effort:** S
**Depends on:** —

---

### [RT-02] Restore RAG + persona pipeline from `.migration-backup/`

**Why:** The Hermes bot already calls `triggerPersonaRagIngest()` (`artifacts/hermes/src/onboarding.ts:38-72`) but the actual RAG embedding + retrieval implementation lives in `.migration-backup/` — archived during the Replit restructure. Twin runtime can't ground responses in creator content until this is restored.

**Scope:**
- Create a new package `lib/twin-engine/` (workspace name `@workspace/twin-engine`).
- Port the RAG ingest + retrieval code from `.migration-backup/` into the new package. Identify which files are actually needed; leave the rest archived.
- Expose two clean entry points: `ingestPersonaContent(creatorId, chunks)` and `retrieveRagContext(creatorId, query, k=5)`.
- Both write/read against `creator_content_embeddings` (already exists in schema per OF-61).
- Update `artifacts/hermes/src/onboarding.ts` to import from the new package (instead of wherever it currently points).
- Wire into root `tsconfig.json` and `pnpm-workspace.yaml` (mirror how `lib/queue/` was wired in OF-102).

**Acceptance:**
- [ ] `pnpm --filter @workspace/twin-engine run typecheck` passes.
- [ ] `triggerPersonaRagIngest()` end-to-end populates `creator_content_embeddings` for a test creator.
- [ ] `retrieveRagContext()` returns ranked chunks for a sample query.
- [ ] `.migration-backup/` is not modified; only consumed as reference.

**Files:** `lib/twin-engine/` (new package), `artifacts/hermes/src/onboarding.ts`, `tsconfig.json`, `pnpm-workspace.yaml`
**Effort:** M
**Depends on:** —

---

### [RT-03] Populate persona system prompt in text-generation worker

**Why:** The worker (`artifacts/worker/src/workers/text-generation.ts:44-45`) passes empty `systemPrompt` and `ragChunks` arrays to the provider. Without a system prompt, the LLM doesn't know who the creator is. This wires the persona half.

**Scope:**
- Worker fetches `creators.config` (JSONB column already exists per OF-98) for the job's `creatorId`.
- Constructs a system prompt from the persona fields stored in config: greeting style, tone, hard-no list, signature phrases, language pref. (Field shape per `artifacts/hermes/src/consent.ts` / persona builder OF-62.)
- Optionally pulls `creator_persona_responses` rows (see RT-05) if present, to grow the prompt with concrete examples.
- Returns the persona prompt as a string; passes it as `systemPrompt` arg to `registry.text.generate(...)`.

**Acceptance:**
- [ ] Worker no longer passes empty `systemPrompt` for jobs with a persona-completed creator.
- [ ] Generated responses are tonally distinguishable per creator on a smoke test (two test creators with different configs → different outputs).
- [ ] If persona config is missing, fallback prompt used (e.g. "You are a friendly AI assistant").

**Files:** `artifacts/worker/src/workers/text-generation.ts`, `artifacts/worker/src/lib/persona.ts` (new)
**Effort:** S
**Depends on:** RT-05 (only if persona_responses are used)

---

### [RT-04] Populate RAG chunks in text-generation worker

**Why:** RAG half of the same plumbing as RT-03. Currently `ragChunks` is `[]`. Without retrieved context the twin can't reference what the creator has actually said.

**Scope:**
- Worker calls `retrieveRagContext(creatorId, fanMessage, k=5)` from `lib/twin-engine/` (RT-02).
- Passes the returned chunks as `ragChunks` to `registry.text.generate(...)`.
- Empty result is fine (creator hasn't been ingested yet) — graceful no-op.

**Acceptance:**
- [ ] Worker calls `retrieveRagContext` per generation job.
- [ ] On a creator with ingested content, generated responses cite or paraphrase the content (manual eval).
- [ ] Retrieval latency logged.

**Files:** `artifacts/worker/src/workers/text-generation.ts`
**Effort:** S
**Depends on:** RT-02

---

### [RT-05] Migration — add `creator_persona_responses` table

**Why:** `artifacts/api-server/src/routes/persona.ts:76` references this table but no migration creates it. Adding it unblocks the persona-capture step of onboarding.

**Scope:**
- New migration under `lib/db/src/migrations/` (or `supabase/migrations/` — match the existing pattern from OF-98 / OF-29).
- Schema: `(id PK, creator_id FK creators.id, scenario_key TEXT, response_text TEXT, created_at)`. RLS policy mirroring `creator_assets` per OF-99.
- Drizzle TS types added so `lib/db/src/schema/` exports the new table.

**Acceptance:**
- [ ] Migration applies cleanly to a fresh DB.
- [ ] `persona.ts` route can insert + read rows.
- [ ] RLS policies pass `pnpm --filter @workspace/db run test` (if a test exists) or manual `SET app.current_creator_id` verification.

**Files:** `lib/db/src/migrations/[next-number]_creator_persona_responses.sql`, `lib/db/src/schema/`
**Effort:** S
**Depends on:** —

---

## Track B — Lala Intake (Telegram)

### [RT-06] Persist Lala's conversation state in Redis

**Why:** Lala's consent-flow state lives in an in-memory `Map` (`artifacts/hermes/src/consent.ts:87`) with a `// TODO Slice 2` flag. Restarts wipe every in-progress consent session. Required for both reliability and multi-replica scale.

**Scope:**
- New module `artifacts/hermes/src/state-redis.ts` wrapping `ioredis` (already in repo per OF-102).
- API mirrors current in-memory functions: `startConsentSession`, `getConsentSession`, `clearConsentSession`.
- Key shape: `lala:consent:{telegramUserId}` with TTL (e.g. 24h).
- Falls back to in-memory if `REDIS_URL` not set (dev-friendly).
- Replace consumers in `consent.ts` to use the new module.

**Acceptance:**
- [ ] In-progress consent session survives a Lala bot restart.
- [ ] No regression in `/consent` flow (run through the 5-item flow end-to-end).
- [ ] `REDIS_URL` unset → in-memory fallback works for dev.

**Files:** `artifacts/hermes/src/state-redis.ts` (new), `artifacts/hermes/src/consent.ts`
**Effort:** S
**Depends on:** —

---

### [RT-07] Lala accepts forwarded creator material from Telegram

**Why:** "Send us 10 pages of DMs + voice notes + photos" is the actual intake model. Lala currently has no handlers for non-command messages with media attached.

**Scope:**
- New module `artifacts/hermes/src/intake.ts` with three handlers: `onPhotoMessage`, `onVoiceMessage`, `onDocumentMessage`.
- Each downloads the Telegram file (using Telegraf's file API), uploads to storage (Supabase storage bucket `creator-assets-pending`), and inserts a row in `creator_assets` (already exists per OF-98) with `consent_status = 'pending'`.
- All material lands in the pending bucket; nothing leaves pending until the creator's consent flow has been committed (RT-09).
- Lala replies with a quick "Got it ✨" acknowledgement and a running "you've sent N items so far" counter.

**Acceptance:**
- [ ] Forward a photo to Lala → row in `creator_assets`, file in pending bucket.
- [ ] Same for voice note and forwarded chat screenshot.
- [ ] Lala's acknowledgement reply works.
- [ ] No assets are processed by twin-production until consent committed (RT-09).

**Files:** `artifacts/hermes/src/intake.ts` (new), `artifacts/hermes/src/index.ts` (wire `bot.on('photo')`, `bot.on('voice')`, `bot.on('document')`)
**Effort:** M
**Depends on:** —

---

### [RT-08] Fan-name masking on uploaded chat screenshots

**Why:** When the creator forwards a DM screenshot, it contains *fans'* messages too — fans who never consented to having their text used as training data. APPI / PDPA say her consent doesn't extend to theirs. Hard requirement: mask fan identifying info before storage, not after.

**Scope:**
- Server-side OCR + blur pass on every uploaded screenshot before the file lands in the `creator-assets-pending` bucket.
- Use Google Cloud Vision API (or equivalent — Tesseract local + heuristics is a cheaper fallback).
- Detect: fan handles (`@username`), names in chat-bubble headers, profile pictures.
- Blur or black-out detected regions on the image; store the masked version.
- Log a per-upload audit row in `audit_log` (`event_type='intake_masked'`, payload: `{assetId, regionsBlurred}`).
- Apple VisionKit / on-device masking is a future enhancement; not blocking.

**Acceptance:**
- [ ] Forward a chat screenshot with visible fan name → stored file has the name blurred.
- [ ] Multi-fan screenshots blur each fan's identifier independently.
- [ ] Audit row logged per masked upload.
- [ ] False-positive rate ≤ 5% (creator's own content not over-blurred) on a hand-curated test set.

**Files:** `artifacts/hermes/src/intake.ts`, new `lib/vision/` package or `artifacts/hermes/src/masking.ts`
**Effort:** L
**Depends on:** RT-07

---

### [RT-09] Replace consent-commit stub with BullMQ twin-production enqueue

**Why:** `artifacts/hermes/src/consent.ts:262-265` logs a stub signal on consent commit but doesn't actually trigger anything. Real twin production needs to start when consent is committed.

**Scope:**
- New queue `twin-production` in `lib/queue/src/queues.ts` (next to existing queues per OF-57 / OF-105).
- Payload: `{creatorId, twinId, assetManifest: assetIds[], consentGrantId}`.
- On consent commit, enumerate the creator's `creator_assets` rows (status `pending`, modality-matched to granted consents) and enqueue.
- The worker that consumes this queue is just a logger for now (real processing is in RT-11 + Agent Backbone block later).

**Acceptance:**
- [ ] Completing `/consent` enqueues a job visible in Bull Board (OF-102).
- [ ] Job payload includes correct asset IDs for the granted modalities.
- [ ] Failures route to DLQ (already wired in OF-105).

**Files:** `lib/queue/src/queues.ts`, `artifacts/hermes/src/consent.ts`, `artifacts/worker/src/workers/twin-production.ts` (new logger stub)
**Effort:** S
**Depends on:** RT-07

---

### [RT-10] `/status` command — pipeline progress for the creator

**Why:** Once the creator commits consent, she has no way to know what's happening with her twin production. `/status` already returns trivial creator stats; extend it to surface pipeline state.

**Scope:**
- Extend the existing `/status` handler in `artifacts/hermes/src/index.ts:98-119`.
- Query `creator_assets` (counts per status), latest `twin-production` job for this creator (status + ETA), `consent_grants` (which modalities are live).
- Format as a Lala message in her voice (cheerleader, per north-star).
- Localize per creator's stored language preference (default EN).

**Acceptance:**
- [ ] `/status` returns: assets count, consent state, twin production phase ("we're working on her voice now ✨"), ETA if known.
- [ ] Reads correctly when nothing's started yet ("haven't received your stuff yet — when you have a sec, send me a few photos!").
- [ ] Tone matches Lala's voice (north-star).

**Files:** `artifacts/hermes/src/index.ts`
**Effort:** S
**Depends on:** RT-09 (for job query)

---

## Where the tracks meet

### [RT-11] `lib/agents/` package — interfaces + human-in-the-loop stubs

**Why:** The 5 background agents (Intake, Content Producer, Distribution, Attribution, Supervisor) become real in the Agent Backbone block. Real Twin needs the *interfaces* and *stub implementations* now so the orchestration shape is fixed and Lala has something to delegate to. The stubs just enqueue manual work for the founder, visible in Bull Board.

**Scope:**
- New workspace package `@workspace/agents` at `lib/agents/`.
- Module per agent: `intake/`, `content/`, `distribution/`, `attribution/`, `supervisor/`.
- Each module exports a TypeScript interface (input → output) and a `humanStub` implementation that enqueues a task on a per-agent BullMQ queue with `[manual: agent=intake creatorId=X]` label.
- A founder picks up the task in Bull Board, does the work manually, marks complete.
- Phase-marker comment in each file: `// AI implementation lives in Agent Backbone block (next).`

**Acceptance:**
- [ ] `pnpm --filter @workspace/agents run typecheck` passes.
- [ ] All 5 agents have an interface + a humanStub implementation.
- [ ] Bull Board shows distinct queues per agent.
- [ ] RT-09's twin-production job triggers an Intake stub task visible in Bull Board.

**Files:** `lib/agents/` (new package), root `tsconfig.json`, `pnpm-workspace.yaml`
**Effort:** M
**Depends on:** RT-09

---

## Summary

| Ticket | Track | Effort | Depends on |
|---|---|---|---|
| RT-01 Wire twin/chat to GMI | A | S | — |
| RT-02 Restore RAG pipeline | A | M | — |
| RT-03 Populate persona prompt | A | S | RT-05 (soft) |
| RT-04 Populate RAG chunks | A | S | RT-02 |
| RT-05 creator_persona_responses migration | A | S | — |
| RT-06 Redis state for Lala | B | S | — |
| RT-07 Lala accepts forwarded media | B | M | — |
| RT-08 Fan-name masking | B | L | RT-07 |
| RT-09 Consent commit → twin-production queue | B | S | RT-07 |
| RT-10 `/status` command upgrade | B | S | RT-09 |
| RT-11 lib/agents/ skeleton + stubs | both | M | RT-09 |

**Total:** 11 tickets. Sequencing-friendly first cuts: **RT-01, RT-05, RT-06** (all S, no deps). Then RT-02 + RT-07 in parallel. Then everything else.
