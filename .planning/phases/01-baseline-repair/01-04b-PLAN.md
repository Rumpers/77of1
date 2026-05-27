---
phase: 01-baseline-repair
plan: 04b
type: execute
wave: 3
depends_on: [01-02, 01-03]
files_modified:
  - artifacts/worker/src/index.ts
  - artifacts/worker/src/dlq-handler.ts
  - artifacts/worker/src/crons/sla-alert.ts
  - artifacts/worker/src/workers/consent-revocation.ts
  - artifacts/worker/src/workers/moderation.ts
  - artifacts/worker/src/workers/text-generation.ts
  - artifacts/worker/src/workers/video-generation.ts
  - artifacts/worker/src/workers/voice-generation.ts
  - artifacts/worker/src/workers/dunning-retry.ts
autonomous: true
requirements: [INFRA-02, INFRA-04, COMPLY-03]
must_haves:
  truths:
    - "artifacts/worker starts on Replit using @workspace/db (DATABASE_URL guard) — no SUPABASE_URL env var required"
    - "BullMQ 6 queues (textGeneration, voiceGeneration, videoGeneration, moderation, consentRevocation, dunningRetry) initialize successfully when REDIS_URL is set; gracefully no-op when absent (INFRA-04 wired)"
    - "Worker BullMQ Worker/QueueEvents scaffolding (concurrency, retry, graceful shutdown) is preserved verbatim from pre-migration state"
    - "All generation_jobs status writes from the worker use Drizzle (db.update(generationJobsTable))"
    - "handleDlqEvent in dlq-handler.ts no longer accepts a SupabaseClient parameter and writes only hashed identifiers to safety_audit_log (COMPLY-03)"
    - "No @supabase/supabase-js or createClient references remain anywhere under artifacts/worker/src/"
    - "worker package typecheck (pnpm --filter @workspace/worker exec tsc --noEmit) exits 0"
  artifacts:
    - path: "artifacts/worker/src/index.ts"
      provides: "Worker boot path: imports db from @workspace/db; spawns 6 BullMQ Workers + QueueEvents; graceful shutdown preserved"
    - path: "artifacts/worker/src/dlq-handler.ts"
      provides: "DLQ event handler with no SupabaseClient parameter; writes hashed identifiers only to safety_audit_log"
  key_links:
    - from: "artifacts/worker/src/index.ts"
      to: "@workspace/db"
      via: "import { db, generationJobsTable } from @workspace/db"
      pattern: "from .@workspace/db."
    - from: "artifacts/worker/src/workers/*"
      to: "@workspace/db"
      via: "import { db, generationJobsTable } from @workspace/db"
      pattern: "generationJobsTable"
---

<objective>
Migrate the entire artifacts/worker package off Supabase: index.ts now imports `db` from @workspace/db, generation_jobs status updates use Drizzle, dlq-handler.ts drops its SupabaseClient parameter, and the six BullMQ worker bodies are stubbed per D-13 with `db.update(generationJobsTable)` status writes. The BullMQ Worker/QueueEvents lifecycle scaffolding (concurrency, retry, graceful shutdown, REDIS_URL no-op) is preserved verbatim. After this plan the worker artifact cold-starts on Replit without any Supabase env var.

Purpose: This is one of two parallel Wave-3 plans that close Phase 1's Supabase removal. The sibling plan 01-04a (parallel, Wave 3) handles api-server leaf routes and the lib glue. The cleanup + cold-start verification + founder Replit Secrets checkpoint live in 01-04c (Wave 4, after both 01-04a and 01-04b land).

Per D-13 the worker job bodies remain STUBS in Phase 1 — production fills come in Phase 2/3 when GMI XTTS endpoint and moderation pipelines are wired. This plan's contract is exclusively about the boot path, the DB layer, and the queue scaffolding — not about delivering working voice/video/text/moderation work.

Output: artifacts/worker fully Drizzle-backed; BullMQ scaffolding preserved; worker bodies stubbed per D-13; worker typecheck passes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/01-baseline-repair/01-CONTEXT.md
@.planning/phases/01-baseline-repair/01-RESEARCH.md
@.planning/phases/01-baseline-repair/01-PATTERNS.md
@.planning/phases/01-baseline-repair/01-01-SUMMARY.md
@.planning/phases/01-baseline-repair/01-02-SUMMARY.md
@.planning/phases/01-baseline-repair/01-03-SUMMARY.md
@artifacts/worker/src/index.ts
@artifacts/worker/src/dlq-handler.ts
@artifacts/worker/src/crons/sla-alert.ts
@artifacts/worker/src/workers/consent-revocation.ts
@lib/queue/src/types.ts
@lib/queue/src/queues.ts

<interfaces>
From @workspace/db (live):
- db, pool, schema exports
- generationJobsTable, safetyAuditLogTable, consentGrantsTable, creatorsTable
- eq, and, inArray (drizzle-orm)

From lib/queue (already correct — do NOT modify):
- createAllQueues(redisUrl): { textGeneration, voiceGeneration, videoGeneration, moderation, consentRevocation, dunningRetry }
- JobPayloadBase, GenerationJobPayload — already Drizzle-compatible per RESEARCH.md "BullMQ / Redis Wiring"
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Migrate artifacts/worker to @workspace/db; preserve BullMQ + graceful shutdown; remove Supabase imports across all worker files</name>
  <files>artifacts/worker/src/index.ts, artifacts/worker/src/dlq-handler.ts, artifacts/worker/src/crons/sla-alert.ts, artifacts/worker/src/workers/consent-revocation.ts, artifacts/worker/src/workers/moderation.ts, artifacts/worker/src/workers/text-generation.ts, artifacts/worker/src/workers/video-generation.ts, artifacts/worker/src/workers/voice-generation.ts, artifacts/worker/src/workers/dunning-retry.ts</files>
  <read_first>
    - artifacts/worker/src/index.ts (current — Supabase startup at lines 14, 21-31; BullMQ Worker/QueueEvents config at lines 20, 56-85; graceful shutdown at 160-168; generation_jobs updates at 67-69, 91-94, 142-148)
    - artifacts/worker/src/dlq-handler.ts (handleDlqEvent signature takes SupabaseClient — replace with typeof db)
    - artifacts/worker/src/crons/sla-alert.ts, src/workers/consent-revocation.ts, src/workers/moderation.ts, src/workers/text-generation.ts, src/workers/video-generation.ts, src/workers/voice-generation.ts, src/workers/dunning-retry.ts (find all Supabase calls; classify Phase-1-schema vs out-of-scope)
    - lib/queue/src/types.ts, src/queues.ts (confirm payload shapes are Drizzle-compatible — RESEARCH.md "BullMQ / Redis Wiring" — no changes needed)
    - .planning/phases/01-baseline-repair/01-PATTERNS.md section "artifacts/worker/src/index.ts"
  </read_first>
  <behavior>
    - artifacts/worker/src/index.ts: removes SUPABASE_URL / SUPABASE_SERVICE_KEY env-var guards and createClient call. Imports `import { db } from "@workspace/db"` instead. The "fail fast if DATABASE_URL missing" guard is already in lib/db/src/index.ts, so no extra guard is needed.
    - All `supabase.from("generation_jobs").update(...)` calls in index.ts and worker files become `db.update(generationJobsTable).set({ ... }).where(eq(generationJobsTable.id, jobId))`.
    - handleDlqEvent in dlq-handler.ts: signature changes from `(supabase: SupabaseClient, ...)` to `(...)` (drops the parameter); internal usage switches to the singleton db; the type SupabaseClient is removed from imports.
    - Per D-13: actual worker bodies in workers/voice-generation.ts, video-generation.ts, text-generation.ts, moderation.ts, consent-revocation.ts, dunning-retry.ts are STUBS in Phase 1. Each worker function body, where it currently performs work that depends on out-of-Phase-1 tables or external providers (GMI XTTS endpoint not yet confirmed), is replaced with a one-line `console.log("[worker] STUB: <queue> body filled in Phase <N>");` plus a status update `db.update(generationJobsTable).set({ status: "complete" }).where(eq(generationJobsTable.id, jobDbId))` (or `failed` if the test policy prefers no-op completion). The Worker/QueueEvents lifecycle scaffolding remains intact.
    - BullMQ Worker/QueueEvents setup at lines 20, 56-85 of index.ts is unchanged (Redis URL, concurrency, retry config preserved).
    - Graceful shutdown at lines 160-168 is unchanged.
    - When REDIS_URL is absent the worker logs a single line and exits 0 (or stays alive without Workers — match the existing api-server queue behavior described in RESEARCH.md Environment Availability).
    - No @supabase/supabase-js or createClient references remain anywhere under artifacts/worker/src/.
  </behavior>
  <action>For each file listed in <files>, replace Supabase imports with Drizzle/@workspace/db imports. In index.ts, delete the SUPABASE_URL/SUPABASE_SERVICE_KEY env-var read block and the createClient call; add `import { db, generationJobsTable } from "@workspace/db"; import { eq } from "drizzle-orm";`. For each generation_jobs update, rewrite to Drizzle per PATTERNS.md "artifacts/worker/src/index.ts" verbatim. In dlq-handler.ts, change the SupabaseClient parameter to no parameter and rewrite the audit_log + creator_notifications writes — audit_log via safetyAuditLogTable (note: creator_notifications is NOT a Phase 1 table; that branch becomes a logged stub). For each worker file, replace the Supabase calls per the classification rule from 01-04a Task 1b (Phase-1 schema -> Drizzle; out-of-scope -> logged stub that still updates generation_jobs status). Do not touch lib/queue. Do not change BullMQ config.</action>
  <acceptance_criteria>
    - `grep -RE 'supabase-js|createClient\(' artifacts/worker/src/` returns nothing
    - `grep -RE 'from "@workspace/db"' artifacts/worker/src/` returns at least 3 matches (index.ts, dlq-handler.ts, and at least one worker file)
    - artifacts/worker/src/index.ts contains `generationJobsTable` and the BullMQ Worker/QueueEvents class names (`new Worker(`, `new QueueEvents(`)
    - artifacts/worker/src/dlq-handler.ts no longer imports SupabaseClient type
    - `pnpm --filter @workspace/worker exec tsc --noEmit` exits 0
  </acceptance_criteria>
  <verify>
    <automated>! grep -RqE 'supabase-js|createClient\(' artifacts/worker/src/ && grep -RqE 'from "@workspace/db"' artifacts/worker/src/ && grep -q 'generationJobsTable' artifacts/worker/src/index.ts && grep -q 'new Worker(' artifacts/worker/src/index.ts && grep -q 'new QueueEvents(' artifacts/worker/src/index.ts && ! grep -q 'SupabaseClient' artifacts/worker/src/dlq-handler.ts && pnpm --filter @workspace/worker exec tsc --noEmit</automated>
  </verify>
  <done>artifacts/worker is fully Drizzle-backed; BullMQ scaffolding preserved; worker bodies stubbed per D-13; worker typecheck passes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| worker process -> Replit PG | Job status updates write to generation_jobs; consent-revocation worker can mass-delete rows on a creator |
| dlq-handler -> safety_audit_log | DLQ events get persisted; must not leak raw payloads |
| BullMQ queue (Redis) -> worker process | Untrusted job payloads cross here; payload shapes are pinned by lib/queue Zod types |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04b-01 | Information Disclosure | DLQ handler logs raw job payload including PII | mitigate | Task 1 rewrites handleDlqEvent to write only hashed identifiers to safety_audit_log; raw payloads are NOT inserted into any DB column (COMPLY-03) |
| T-04b-02 | Elevation of Privilege | A worker stub auto-completes a generation_jobs row as success without doing the work, causing dependent flows in Phase 2 to assume audio/text exists | mitigate | Task 1 stub policy: set status='complete' only for STUB markers; production fill in Phase 2/3 must replace the stub before any fan-visible reply path consumes the result. The phase 4 eval gate (EVAL-01) will catch any premature production use |
| T-04b-03 | Denial of Service | Worker boots without REDIS_URL and exits, taking down the artifact | mitigate | Task 1 preserves the existing graceful no-op behavior when REDIS_URL is absent (per RESEARCH "Environment Availability"); worker stays alive but processes no jobs |
| T-04b-04 | Tampering | BullMQ Worker config (concurrency, retry, backoff) gets silently changed during migration | mitigate | Task 1's action and behavior blocks explicitly forbid touching Worker/QueueEvents config; verify gate greps for `new Worker(` and `new QueueEvents(` presence in index.ts |
| T-04b-SC | Tampering | npm/pnpm installs | accept | No new packages installed in this plan; only file rewrites; pnpm catalog discipline preserved |
</threat_model>

<verification>
- `pnpm --filter @workspace/worker exec tsc --noEmit` exits 0
- `grep -RE 'supabase-js|createClient\(' artifacts/worker/src/` returns nothing
- generation_jobs status updates from worker use Drizzle
- BullMQ Worker + QueueEvents lifecycle scaffolding preserved (INFRA-04 wired)
- safety_audit_log writes from DLQ handler use Drizzle with hashed identifiers only (COMPLY-03)
</verification>

<success_criteria>
artifacts/worker is fully Supabase-free at the source level: index.ts boots through @workspace/db, every generation_jobs update flows through Drizzle, dlq-handler.ts drops its SupabaseClient parameter, and the six BullMQ workers are stubbed per D-13 with status writes. The BullMQ scaffolding (concurrency, retry, graceful shutdown, REDIS_URL no-op) is preserved. The worker package typecheck exits 0.
</success_criteria>

<output>
Create `.planning/phases/01-baseline-repair/01-04b-SUMMARY.md` when done. The summary MUST enumerate the worker queues whose bodies are stubs and the Phase 2/3 backlog items needed to replace each stub with production logic.
</output>
</content>
</invoke>