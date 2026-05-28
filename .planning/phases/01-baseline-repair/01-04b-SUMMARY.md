---
phase: "01"
plan: "04b"
subsystem: worker
tags: [supabase-removal, drizzle, bullmq, generation-jobs, stubs]
dependency_graph:
  requires: [01-02, 01-03]
  provides: [worker-db-layer, drizzle-generation-jobs, dlq-drizzle]
  affects: [artifacts/worker]
tech_stack:
  added: ["@workspace/db (worker dependency)", "drizzle-orm (worker direct dep)"]
  removed: ["@supabase/supabase-js (worker)"]
  patterns: ["Drizzle db.update() for generation_jobs status writes", "D-13 stub pattern for all worker bodies"]
key_files:
  created: []
  modified:
    - artifacts/worker/src/index.ts
    - artifacts/worker/src/dlq-handler.ts
    - artifacts/worker/src/crons/sla-alert.ts
    - artifacts/worker/src/workers/consent-revocation.ts
    - artifacts/worker/src/workers/moderation.ts
    - artifacts/worker/src/workers/text-generation.ts
    - artifacts/worker/src/workers/video-generation.ts
    - artifacts/worker/src/workers/voice-generation.ts
    - artifacts/worker/src/workers/dunning-retry.ts
    - artifacts/worker/package.json
    - artifacts/worker/tsconfig.json
    - pnpm-lock.yaml
decisions:
  - "Out-of-scope tables (audit_log, creator_notifications, refund_requests, fan_subscriptions, feature_flags, dunning_audit_log) stubbed with console.log per D-13 — not schema items in Phase 1"
  - "generationJobsTable status values use enum ('complete' not 'done') — fixed original index.ts bug during migration"
  - "QueueEvents added to index.ts for observability (was missing from original); graceful shutdown closes it"
  - "consent-revocation worker signature simplified (drops SupabaseClient, keeps _registry and redisUrl)"
  - "dunning-retry createWorker signature simplified (drops SupabaseClient); full stub per D-13"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-28"
  tasks_completed: 1
  files_modified: 12
---

# Phase 01 Plan 04b: Worker Supabase Removal Summary

**One-liner:** Migrated artifacts/worker off @supabase/supabase-js onto @workspace/db (Drizzle); all generation_jobs status writes now use db.update(generationJobsTable); six BullMQ worker bodies stubbed per D-13; typecheck passes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate artifacts/worker to @workspace/db; remove all Supabase imports | ab89a65 | 12 files |

## What Was Built

### Core Migration

**artifacts/worker/src/index.ts:**
- Removed `createClient(@supabase/supabase-js)`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` env-var guards
- Added `import { db, generationJobsTable } from "@workspace/db"` and `import { eq } from "drizzle-orm"`
- All `supabase.from("generation_jobs").update(...)` → `db.update(generationJobsTable).set({...}).where(eq(...))`
- Added `QueueEvents` instance for observability (was missing from original)
- Fixed status value bug: `"done"` → `"complete"` (correct enum value per schema)
- Graceful shutdown now also closes `queueEvents`
- BullMQ Worker/QueueEvents lifecycle (concurrency: 5, retry config, REDIS_URL) preserved verbatim

**artifacts/worker/src/dlq-handler.ts:**
- Dropped `SupabaseClient` parameter from `handleDlqEvent` signature entirely
- Uses `db.update(generationJobsTable)` for DLQ status write
- `audit_log` insert stubbed (table out-of-scope Phase 1) — writes hashed identifiers to stdout only (COMPLY-03 compliant)
- `creator_notifications` upsert stubbed (table out-of-scope Phase 1) — logged to console
- Sentry capture logic preserved verbatim

**artifacts/worker/src/crons/sla-alert.ts:**
- Removed `SupabaseClient` parameter from `runSlaAlert` and `startSlaAlertCron`
- `refund_requests` query stubbed — table is out-of-scope (Stripe/dunning dormant per CLAUDE.md)
- Redis dedup logic preserved for Phase 2 reactivation

### Worker Bodies (Stubbed Per D-13)

All six workers migrated from Supabase to Drizzle for `generation_jobs` updates; all bodies stubbed:

| Worker | Queue | Body Status | Production Fill |
|--------|-------|-------------|----------------|
| text-generation.ts | textGeneration | STUB | Phase 2: GMI DeepSeek-V3.2 via registry.text.generate() |
| voice-generation.ts | voiceGeneration | STUB | Phase 3: GMI XTTS once endpoint URL confirmed |
| video-generation.ts | videoGeneration | STUB | Phase 3: Video provider once GMI endpoint confirmed |
| moderation.ts | moderation | STUB | Phase 2: OpenAI omni-moderation-latest via registry.moderator |
| consent-revocation.ts | consentRevocation | Drizzle query (generation_jobs) + audit_log stub | Phase 2: audit_log table added to schema |
| dunning-retry.ts | dunningRetry | Full STUB | Phase 2: Restore when fan_subscriptions/feature_flags in schema |

### Package Changes

- `artifacts/worker/package.json`: Added `@workspace/db: workspace:*` and `drizzle-orm: catalog:`; removed `@supabase/supabase-js`
- `artifacts/worker/tsconfig.json`: Added `{ "path": "../../lib/db" }` to references
- `pnpm-lock.yaml`: Updated

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect status value `"done"` → `"complete"`**
- **Found during:** Task 1 — migrating index.ts
- **Issue:** Original `index.ts` used `status: "done"` in multiple places, but `generationJobStatusEnum` only accepts `"queued" | "processing" | "complete" | "failed" | "cancelled" | "dlq"`. Value `"done"` is not in the enum; would cause a runtime type error and likely a DB constraint violation.
- **Fix:** Changed all occurrences to `"complete"` (the correct enum value)
- **Files modified:** `artifacts/worker/src/index.ts`
- **Commit:** ab89a65

**2. [Rule 2 - Missing functionality] Added QueueEvents lifecycle to index.ts**
- **Found during:** Task 1 — reviewing index.ts Worker config
- **Issue:** Original had `const queueEvents = ...` comment referenced in plan context but no actual QueueEvents instance; graceful shutdown didn't close QueueEvents. Plan's `must_haves.truths` states "BullMQ Worker/QueueEvents scaffolding" is required.
- **Fix:** Added `new QueueEvents(QUEUE_NAME, { connection: { url: REDIS_URL } })` and `await queueEvents.close()` in shutdown
- **Files modified:** `artifacts/worker/src/index.ts`
- **Commit:** ab89a65

**3. [Rule 1 - Minor] Verification grep pattern mismatch (`new Worker(` vs `new Worker<T>(`)** 
- **Note:** The plan's automated verify check `grep -q 'new Worker(' artifacts/worker/src/index.ts` does not match TypeScript generic syntax `new Worker<GenerationJobPayload>(`. This was a pre-existing issue with the plan's grep (the original file also used generics). The Worker IS present; the spirit of the check is met. The `new Worker<GenerationJobPayload>(` pattern confirms BullMQ Worker lifecycle is intact.

**4. [Rule 1 - Out-of-scope table stubs]** `audit_log`, `creator_notifications`, `refund_requests`, `fan_subscriptions`, `feature_flags`, `dunning_audit_log` tables do not exist in the Phase 1 Drizzle schema. All references replaced with `console.log` stubs documenting Phase 2 backlog. This is correct per D-13.

## Phase 2/3 Backlog Items (Stub Replacements Required)

| Stub Location | Table/Provider | Phase | Description |
|--------------|----------------|-------|-------------|
| dlq-handler.ts: audit_log insert | `audit_log` table | Phase 2 | Add Drizzle insert when audit_log table added to schema |
| dlq-handler.ts: creator_notifications upsert | `creator_notifications` table | Phase 2 | Dashboard poll notification for DLQ events |
| crons/sla-alert.ts: refund_requests query | `refund_requests` table | Phase 2 | Full SLA alert cron when Stripe/dunning activated |
| workers/text-generation.ts: body | `registry.text.generate()` | Phase 2 | GMI DeepSeek-V3.2 persona/RAG/LLM pipeline |
| workers/moderation.ts: body | `registry.moderator.moderate()` | Phase 2 | OpenAI omni-moderation-latest L1/L3 pipeline |
| workers/voice-generation.ts: body | `registry.voice.generate()` | Phase 3 | GMI XTTS endpoint (URL unconfirmed — Phase 3 blocker) |
| workers/video-generation.ts: body | `registry.video.generate()` | Phase 3 | Video provider (TBD) |
| workers/dunning-retry.ts: body | `fan_subscriptions`, `feature_flags`, `dunning_audit_log` | Phase 2 | Full dunning ladder when Stripe tables in schema |
| workers/consent-revocation.ts: writeAuditLog | `audit_log` table | Phase 2 | Drizzle audit entry for consent revocation events |

## Verification Results

- `grep -RE 'supabase-js|createClient' artifacts/worker/src/` → CLEAN (0 results)
- `grep -RE 'from "@workspace/db"' artifacts/worker/src/` → 7 files match
- `generationJobsTable` present in `artifacts/worker/src/index.ts` → PASS
- `new QueueEvents(` present in `artifacts/worker/src/index.ts` → PASS
- `SupabaseClient` absent from `artifacts/worker/src/dlq-handler.ts` → PASS
- `pnpm --filter @workspace/worker exec tsc --noEmit` → exit 0 (PASS)

## Known Stubs

Per D-13 these are intentional Phase 1 stubs — none prevent the plan's goal (worker boots without Supabase, DB layer is Drizzle, scaffolding preserved):

| Stub | File | Reason |
|------|------|--------|
| Text generation body | workers/text-generation.ts | GMI pipeline deferred Phase 2 |
| Voice generation body | workers/voice-generation.ts | GMI XTTS endpoint unconfirmed Phase 3 |
| Video generation body | workers/video-generation.ts | Video provider unconfirmed Phase 3 |
| Moderation body | workers/moderation.ts | OpenAI moderation pipeline deferred Phase 2 |
| Dunning retry body | workers/dunning-retry.ts | Stripe tables out-of-scope Phase 1 |
| SLA alert refund query | crons/sla-alert.ts | refund_requests table out-of-scope Phase 1 |
| DLQ audit_log insert | dlq-handler.ts | audit_log table out-of-scope Phase 1 |
| DLQ creator_notifications | dlq-handler.ts | creator_notifications table out-of-scope Phase 1 |
| Revocation audit_log | workers/consent-revocation.ts | audit_log table out-of-scope Phase 1 |

## Threat Surface Scan

No new network endpoints introduced. No new auth paths. All threat mitigations from plan executed:

- **T-04b-01 (PII in DLQ):** dlq-handler.ts writes only hashed/sanitized identifiers to stdout; no raw fan payload in DB — MITIGATED
- **T-04b-02 (Stub auto-complete):** Stubs set `status='complete'` only; production Phase 2/3 must replace before fan-visible reply path consumes result — MITIGATED (EVAL-01 catch)
- **T-04b-03 (REDIS_URL absent):** Worker boots without REDIS_URL (no env-var guard crash); existing graceful no-op behavior preserved — MITIGATED
- **T-04b-04 (BullMQ config tampered):** Worker/QueueEvents concurrency, retry, shutdown preserved verbatim — MITIGATED

## Self-Check: PASSED

- All 9 worker source files exist
- Commit ab89a65 verified in git log
- No Supabase references in artifacts/worker/src/
- Typecheck passes (tsc --noEmit exit 0)
