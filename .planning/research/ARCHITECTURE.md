# Architecture Patterns

**Domain:** AI digital-twin creator monetization service (lala.la)
**Researched:** 2026-05-27
**Confidence:** HIGH — derived from direct codebase inspection, not inference

---

## Recommended Architecture

The system is a five-process monorepo on a single Replit deployment. Each process is a separate artifact with a shared library layer underneath. Processes communicate through a PostgreSQL database (authoritative state) and a Redis-backed BullMQ queue (async job dispatch). There is no internal service mesh; processes share the same host and communicate via shared DB + queue.

```
Fan surfaces          Creator surfaces         Ops
─────────────         ────────────────         ───
Telegram fan-twin     Telegram Lala bot         Admin dashboard
bot (TBD artifact)    (hermes, port 3001)       (artifacts/admin)
lala.la/[handle]
(artifacts/web,             │                       │
 port 22333)                │                       │
        │                   │                       │
        └───────────────────┴───────────────────────┘
                            │
                   ┌────────▼────────┐
                   │   api-server    │  Express, port 8080
                   │  (artifacts/    │  All REST routes
                   │   api-server)   │  Twin chat, KYC, consent,
                   └────────┬────────┘  persona, assets, moderation
                            │
               ┌────────────┴────────────┐
               │                         │
        ┌──────▼──────┐           ┌──────▼──────┐
        │  PostgreSQL  │           │    Redis     │
        │ (Replit PG)  │           │  (BullMQ)    │
        │ authoritative│           │ job dispatch │
        │    state     │           │  + retries   │
        └─────────────┘           └──────┬───────┘
                                         │
                                  ┌──────▼───────┐
                                  │    worker    │
                                  │ (artifacts/  │
                                  │   worker)    │
                                  │ text/voice/  │
                                  │ video/mod/   │
                                  │ revocation   │
                                  └──────┬───────┘
                                         │
                               ┌─────────▼─────────┐
                               │  GMI Cloud (LLM +  │
                               │  XTTS voice)       │
                               │  OpenAI Moderation │
                               │  GMI Embeddings    │
                               └───────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `artifacts/hermes` | Creator management Telegram bot (Lala). Onboarding steps 1-3, asset upload with inline moderation, consent collection state machine, pause/resume kill-switch. Single bot token, multi-tenant by `creator_id`. | PostgreSQL directly; Telegraf webhook/long-poll for Telegram API. |
| `artifacts/api-server` | All REST API routes on port 8080. Twin chat (stub→real), KYC intake + ops review queue, persona storage, asset management, consent recording, DSAR, link tracking. Entitlement middleware (KYC gate, fan dunning gate). | PostgreSQL via Supabase client (being replaced with Drizzle); enqueues jobs to Redis/BullMQ. |
| `artifacts/worker` | Async job processor. Workers: text-generation, voice-generation, video-generation, moderation, consent-revocation, dunning-retry. DLQ handler writes to audit log and creator_notifications. | PostgreSQL for job state; Redis/BullMQ for queue; GMI Cloud + OpenAI for AI calls. |
| `artifacts/web` | Fan-facing web funnel `lala.la/[handle]`. Chat interface, CTA to creator's platforms, locale detection, SB 243 AI disclosure footer. Port 22333. | api-server REST API. |
| `artifacts/admin` | Founder/ops dashboard. KYC review queue, audit pack export, DLQ job monitoring, creator_notifications display. Port 3001. | api-server REST API (ops routes behind OPS_USER_IDS allowlist). |
| `lib/db` | Drizzle schema definitions and migration config. Shared type source of truth. Currently a placeholder — schema lives in Supabase migrations; full Drizzle schema is Week 1 work. | Imported by api-server, worker, hermes. |
| `lib/providers` | Provider registry: text, voice, video, moderator adapters. `createRegistry()` selects mock vs GMI by env var. GmiClient handles auth, Helicone proxy routing, 5xx retry. | Injected into worker `createWorker()` calls. |
| `lib/queue` | BullMQ queue definitions, job payload types, job options (retry policy, backoff). `createAllQueues()` returns all six queues. | Imported by api-server (enqueue) and worker (consume). |
| `lib/api-spec` | OpenAPI YAML. Source of truth for API contract. | Generates `lib/api-zod/` and `lib/api-client-react/` via orval — do not hand-edit generated files. |
| `lib/api-zod` | Generated Zod validators from openapi.yaml. | Imported by api-server for request validation. |
| `lib/api-client-react` | Generated React Query hooks from openapi.yaml. | Imported by artifacts/web and artifacts/admin. |
| `lib/admin-sdk` | Admin audit client shared between admin dashboard and api-server ops routes. | Imported by artifacts/admin. |

---

## Data Flow: Six-Layer Moderation Pipeline

This is the critical request-response path for every fan chat turn. Based on the north-star spec and existing code shape.

```
Fan → POST /api/twin/[handle]/chat
       │
       ├─ [Gate 0] creator_kyc.status = 'signed' check
       │    └─ NOT signed → 423 Locked
       │
       ├─ [Gate 1] creator.paused check (hermes /pause writes this)
       │    └─ paused → 503
       │
       ├─ L1: OpenAI Moderation API — input fan message
       │    └─ flagged (hard categories) → safe deflection response, log L6
       │
       ├─ Persona resolution
       │    └─ load Character Card V2 JSONB from creators.config (or character_cards table)
       │    └─ build system prompt: system_prompt + post_history_instructions fields
       │
       ├─ Conversation history assembly
       │    └─ load last N turns from conversation_messages (keyed by HMAC-signed conversation_id)
       │
       ├─ [RAG, N=1 plain context] append persona embeddings as context chunks
       │
       ├─ LLM call → GMI Cloud (text completion)
       │    └─ provider registry .text.generate(prompt, { systemPrompt, ragChunks })
       │
       ├─ L3: OpenAI Moderation API — output LLM response
       │    └─ flagged → substitute pre-canned safe deflection (per locale), log L6
       │
       ├─ L4: Self-harm / crisis detection
       │    └─ crisis_level=high → inject crisis helpline (locale-aware), write safety_audit_log
       │    └─ fires Slack webhook (SAFETY_ALERT_WEBHOOK_URL) for founder, does NOT block response
       │
       ├─ L5: Sentry alert + Lala bot notify for any high-risk event
       │    └─ fire-and-forget, never blocks fan response path
       │
       ├─ L6: audit_log append for every flagged turn
       │    └─ stores fan_id_hash + message_hash (no raw PII), creator_id, session_id
       │
       ├─ SB 243 AI disclosure footer appended to every response
       │    └─ "[AI twin] · @{handle}_ai" (localized)
       │
       └─ Fan receives: { text, disclosure_footer }
```

Voice path (async, triggered after text response delivered):

```
api-server → enqueue VoiceGenerationPayload to BullMQ voiceGeneration queue
               │
               └─ worker picks up job (concurrency: 5)
                    ├─ mark generation_jobs.status = 'processing'
                    ├─ call ProviderRegistry.voice.generate(transcript, creatorId, language)
                    │    └─ GMI Cloud XTTS zero-shot (reference audio per creator)
                    ├─ mark generation_jobs.status = 'complete', store audioUrl
                    └─ on exhausted retries → DLQ handler
                         ├─ mark generation_jobs.status = 'dlq'
                         ├─ audit_log insert
                         ├─ upsert creator_notifications.has_dlq_jobs = true
                         └─ Sentry capture (PII-stripped)
```

---

## Data Flow: Creator Onboarding

Multi-step, split across Hermes (Telegram) and web dashboard. Both paths write to the same DB tables.

```
Step 0: KYC gate
  Creator → api-server POST /api/kyc/identity (doc upload via signed URL)
  Creator → api-server POST /api/kyc/initiate-signing (SignWell personality-rights doc)
  SignWell → api-server POST /api/kyc/signwell-webhook (HMAC-verified)
  Founder → api-server POST /api/ops/kyc/:id/approve (ops review queue)
  creator_kyc.status = 'complete' unlocks twin routes

Step 1: Asset upload (via Hermes)
  Creator sends photo/video to Hermes bot
  Hermes downloads bytes from Telegram
  → inline moderation: moderateImageBytes / moderateVideoWithThumbnail (GMI vision)
  → passed: insert creator_assets (consent_state='pending_consent'), writeAssetModerationAudit
  → rejected: reply with category reason, write audit

Step 2: Persona exercise (via Hermes or web)
  Creator answers persona prompts
  → api-server POST /api/onboarding/persona stores to creator_persona_responses
  → Hermes /persona_complete → triggerPersonaRagIngest
       → loads creator_personas fields
       → chunks text, embeds via GmiEmbeddingAdapter (or OpenAI fallback)
       → stores to creator_content_embeddings

Step 3: Consent collection (via Hermes or web)
  Hermes /consent → multi-turn state machine (in-memory Map, Slice 2 moves to Redis)
  → collects YES/NO for: persona_text, voice, image, talking_video, fullbody_video
  → commitConsent writes consent_grants rows
  → if persona_text granted + KYC complete → creator_assets transition to consent_state='released'
  → creator_onboarding.status = 'STEP_3_COMPLETE'
  → twin production signal (wired in Week 2)
```

---

## Data Flow: Consent Revocation

High-priority path. Must cancel all in-flight jobs within 60s SLA.

```
Creator /pause (Hermes) OR consent revoke UI (web)
  → api-server enqueues ConsentRevocationPayload (priority: 1)
     → worker/consent-revocation picks up within ≤10s
          → DB query: generation_jobs WHERE creator_id AND status IN ('queued','processing')
          → cancelBullMQJobs: removes waiting/delayed jobs; flags active jobs as cancelled=true
          → DB update: generation_jobs.status = 'cancelled'
          → audit_log insert: event_type = 'kill_switch' | 'consent_revoke'
```

---

## Data Flow: Multi-Tenant Creator Isolation

Multi-tenancy is achieved by scoping every DB table to `creator_id`. There is no separate schema per creator.

```
Database row isolation:
  - fans, generation_jobs, consent_grants, creator_assets, usage_counters,
    fan_subscriptions, fan_credits all have creator_id FK
  - RLS policy on each table: creator_id = current_setting('app.current_creator_id')
  - Service role bypasses RLS (used in workers and hermes); api-server sets app.current_creator_id per request

Hermes (Telegram):
  - Single bot token, multi-tenant: every command resolves creator via findCreatorByTelegramId()
  - Creator identity keyed by telegram_user_id → creator_id

Fan-twin Telegram bot (TBD):
  - Per-creator bot token (one bot per creator twin)
  - OR: single bot with routing by handle/username (to be decided in Week 2)

API-server:
  - Creator routes: requireCreatorAuth middleware resolves creator_id from auth token
  - Fan routes: requireFanAccess resolves fan_id + creator_id from auth token
  - Twin chat: anonymous fans — creator_id derived from :handle URL param

Persona storage:
  - Character Card V2 JSONB stored in creators.config (or dedicated character_cards table)
  - Per-creator voice reference audio path in creator_assets (asset_type='audio')
```

---

## Component Build Order (Dependencies)

This is the dependency-safe build sequence. Each level can be built in parallel within it, but depends on the level above.

```
Level 0 (blockers — Week 1):
  lib/db          Drizzle schema from scratch (replaces Supabase migrations)
  PostgreSQL      Replit PG init, pgvector availability check

Level 1 (depends on Level 0 — Week 1):
  lib/providers   GmiClient, ProviderRegistry (text, voice, moderator)
  lib/queue       Queue definitions, job payload types, retry options

Level 2 (depends on Level 1 — Week 2):
  api-server      KYC gate middleware (entitlement check)
                  Character Card V2 persona loading
                  HMAC-signed conversation_id session management
                  POST /api/twin/[handle]/chat — sync chat (text only)
                  Conversation history storage

Level 3 (depends on Level 2 — Week 2/3):
  worker          text-generation worker (real LLM call replacing stub)
                  moderation worker (L1+L3 OpenAI moderation)
                  consent-revocation worker

Level 4 (depends on Level 3 — Week 3):
  worker          voice-generation worker (GMI XTTS)
  hermes          asset upload + inline moderation handlers
                  character card builder from persona responses
  artifacts/web   fan funnel page /[handle] with chat + CTA
  fan-twin bot    new artifact: Telegram fan-twin bot per creator

Level 5 (depends on Level 4 — Week 3/4):
  api-server      L4 crisis detection + helpline injection
                  L5 Sentry + Lala notify integration
                  L6 safety_audit_log on every flagged turn
                  SB 243 disclosure footer on every response

Level 6 (eval gate — Week 4):
  eval suite      30 cases per creator (10 in-character + 10 boundary + 10 hard-limit)
                  100% hard-limit pass before twin goes live
                  Weekly regression cron in worker
```

---

## How Existing Artifacts Map to Standard Patterns

| Artifact | Standard Pattern | Notes |
|----------|-----------------|-------|
| `artifacts/hermes` | Creator management bot / back-office agent | Handles onboarding, asset ingest, consent collection, kill-switch. Webhook mode (production), long-poll (dev). In-memory consent sessions (Slice 1) — must move to Redis for multi-replica. |
| `artifacts/api-server` | REST API gateway | Express + Zod validation. All fan and creator REST routes. Also hosts BullBoard dev dashboard. Source of truth for request → job enqueue. Still references Supabase client — must be replaced with Drizzle in Week 1. |
| `artifacts/worker` | Background job processor | BullMQ workers. One worker process runs all job types via `createWorker()` factory per queue. `ProviderRegistry` injected at startup. DLQ handler is a first-class concern, not an afterthought. |
| `artifacts/web` | Fan-facing SPA / funnel | React + Vite, port 22333. Currently has a mix of old fan-payment UI (dormant) and new funnel scaffolding. `/[locale]/` routing already in place. |
| `artifacts/admin` | Ops dashboard | Next.js, port 3001. KYC queue, audit pack export. Still references Supabase client — must migrate. |
| `lib/providers` | Provider abstraction layer | Clean interface. GmiClient already has Helicone proxy support for per-creator cost attribution. GmiVoiceProvider and GmiTextProvider not yet implemented (throw on construction) — Week 2/3 work. |
| `lib/queue` | Job queue contract | Well-defined payload types with `creatorId + fanId + jobDbId + consentGrantVersion` on every job — enables full audit trail. Consent revocation has priority:1 — picks up before any generation job. |

---

## Persona / Character Card Storage

Character Card V2 (SillyTavern standard) is the target persona format. Current state and target:

```
Current (pre-Week 2):
  creators.config JSONB — freeform config blob
  creator_personas table — flat fields (greeting_style, fan_endearment, etc.)
  creator_persona_responses — raw Q&A answers from onboarding exercise
  creator_content_embeddings — chunked + embedded persona text for RAG

Target (Week 2):
  character_cards table (or creators.config['character_card'] JSONB key)
  Schema: CharacterCardV2 {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name, description, personality, scenario,
      first_mes, mes_example, system_prompt,
      post_history_instructions,   // injected after every context window
      creator_notes,               // internal only, never sent to LLM
      tags,
      extensions: { lala_compliance: { sfw_only, kyc_signed_at, locale } }
    }
  }
  Validated with Zod at write time.
  creator_config_versions table already exists — snapshots config JSONB on save, 
  retains last 30 versions for rollback.
```

---

## Session Management

```
conversation_id:
  HMAC-SHA256 of (creator_id + fan_identifier + timestamp_bucket)
  Signed with HMAC_SECRET env var
  Included in every request/response, validated server-side
  Buckets by time window (1hr default) — new bucket = new session
  Enables: audit trail, context window scoping, per-session rate limits

Fan identity (anonymous):
  No fan account required for trial (up to 3 messages)
  After trial: redirect to creator's monetization platform (not a fan account here)
  Fan identifier derived from: Telegram user ID (bot surface) or cookie (web surface)

Conversation history storage:
  Table: conversation_messages (fan_id or fan_token, creator_id, conversation_id, role, content, created_at)
  Not yet in schema v1 — Week 2 addition
  Context window: last N turns loaded synchronously (no async RAG for N=1)
```

---

## Async Job Processing Architecture

```
Enqueue path (api-server):
  POST /api/twin/[handle]/chat
    1. Validate request + KYC gate
    2. Insert generation_jobs row (status='queued')
    3. Return job_id to client immediately (or for voice: enqueue after text delivered)
    4. createAllQueues(REDIS_URL) → queue.add(payload)

Consume path (worker):
  createWorker(registry, redisUrl, supabaseClient)
    Concurrency: text=10, voice=5, video=2, moderation=10, revocation=10
    On start: UPDATE generation_jobs SET status='processing', bullmq_job_id=job.id
    On complete: UPDATE generation_jobs SET status='complete', output=result
    On fail (non-final): UPDATE attempt_count
    On fail (final): handleDlqEvent() — mark 'dlq', audit_log, creator_notifications, Sentry

Retry policy (lib/queue/options.ts):
  textGeneration:    attempts=3, exponential backoff 1s
  voiceGeneration:   attempts=3, exponential backoff 2s
  videoGeneration:   attempts=2, exponential backoff 5s
  moderation:        attempts=3, exponential backoff 1s
  consentRevocation: attempts=5, exponential backoff 500ms, priority=1
  dunningRetry:      attempts=1 (state machine schedules follow-up jobs explicitly)

DLQ visibility:
  creator_notifications.has_dlq_jobs = true (polled by dashboard)
  audit_log entry with sanitized error (no fan PII)
  Sentry capture with structured context
```

---

## Scalability Considerations

At N=1 creator (week 4 launch target), the single-Replit architecture is appropriate. Pressure points as N grows:

| Concern | At N=1 (now) | At N=10 | At N=50+ |
|---------|-------------|---------|---------|
| Persona loading | In-memory per request | PostgreSQL cache with index | Dedicated persona service or Redis cache |
| Conversation history | PostgreSQL query per turn | Row-level index on (creator_id, fan_id) | Partition by creator_id |
| Voice generation queue | BullMQ concurrency=5 | Same, backpressure acceptable | Add worker replicas |
| Hermes consent sessions | In-memory Map (comment says "move to Redis Slice 2") | MUST move to Redis before second Hermes replica | Redis sessions, stateless hermes |
| Moderation cost | OpenAI ~$0.30/day warm lead | $3/day at 10x | Evaluate GMI moderation as alternative |
| RLS isolation | Set `app.current_creator_id` per request | Same pattern | Row-count partitioning per creator may be needed |

---

## Key Architecture Decisions Already Locked

| Decision | Implementation | Where |
|----------|---------------|-------|
| Character Card V2 persona format | Target JSONB schema with Zod validation | Week 2 build |
| HMAC-signed conversation_id | Crypto.createHmac per session | api-server twin route |
| Sync text, async voice | Text: request-response; Voice: enqueue + poll | twin route + worker |
| Moderation in-pipeline (L1+L3) | OpenAI moderation API wrapping every LLM call | api-server (not worker) |
| Consent-gated generation | consent_grant_id on every generation_jobs row | DB schema + revocation worker |
| Kill-switch SLA ≤5s for pause, ≤60s for full revocation | Hermes /pause writes DB directly; revocation is priority-1 queue job | hermes/db.ts + worker/consent-revocation |
| Audit log is append-only | No update/delete on audit_log | DB schema + DLQ handler |
| Safety PII stripping | fan_id_hash + message_hash only in safety_audit_log | safety-audit.ts + migration |
| Creator isolation via creator_id | RLS policies on all tables | schema_v1.sql |
| Provider registry injection | `createWorker(registry, ...)` pattern | lib/providers + worker |

---

## Gaps / Open Architecture Questions

1. **Fan-twin Telegram bot artifact does not yet exist.** The twin chat route is stubbed at `/api/twin/chat` (returns random canned responses). The fan-facing Telegram bot needs a new `artifacts/fan-twin-bot` (or similar) in Week 2/3.

2. **Hermes consent sessions are in-memory.** Explicitly noted as "TODO Slice 2: move to Redis." Until then, a Hermes restart loses all in-progress consent sessions. Risk is low at N=1 but must be fixed before any HA or multi-process deployment.

3. **Drizzle schema does not exist yet.** `lib/db/src/schema/index.ts` exports nothing. Supabase migrations are the schema source of truth. Week 1 Lane A is a blocker for all Week 2+ work.

4. **GmiVoiceProvider and GmiTextProvider are not implemented.** `lib/providers` throws on `gmi` mode for voice and video. Week 2/3 work. Currently `TEXT_PROVIDER=mock` and `VOICE_PROVIDER=mock` must be set in all envs.

5. **Conversation history table absent from schema v1.** `conversation_messages` does not appear in migration `20260524000001_schema_v1.sql`. Must be added in Week 2 alongside the twin chat route.

6. **Character card table not in schema v1.** Persona data lives in `creator_personas` and `creator_content_embeddings` but the target Character Card V2 JSONB table is not yet defined. Week 2 addition.

7. **pgvector availability on Replit PG is unverified.** `creator_content_embeddings` uses a vector column. If Replit PG does not expose pgvector, embedding storage will fail silently or require a workaround (JSON array fallback). Must be verified Week 1 Day 1.

8. **`apps/web/` (Next.js, creator dashboard)** is in active development on this branch and is separate from `artifacts/web/` (fan funnel, React+Vite). The north-star Week 1 plan says to delete `apps/web/` but new files have been added to it this branch. Clarify which web artifact serves which role before Week 1 work begins.
