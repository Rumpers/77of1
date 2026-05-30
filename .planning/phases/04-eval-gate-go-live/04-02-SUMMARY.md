---
phase: 04
plan: "02"
subsystem: eval
tags: [eval, runner, live-gate, db-schema, moderation-pipeline, tdd-green]
dependency_graph:
  requires: [04-01]
  provides: [EVAL-01-runner, eval-runs-table, isGoLiveEligible, eval-cli]
  affects: [04-03, 04-04]
tech_stack:
  added: []
  patterns:
    - direct-twin-runtime-call (mirrors text-generation.ts worker pattern)
    - lazy-db-import (mirrors twin-profile.ts / escalation.ts pattern)
    - inline-moderator-provider-factory (BLOCKER-03: no api-server circular dep)
    - client-generated-uuid-pk (WARNING-07: runId before persistence)
    - eval-probe-isolation (per-case fanIdHash + sessionId)
key_files:
  created:
    - lib/eval/src/runner.ts
    - lib/eval/src/db-helpers.ts
    - lib/eval/src/live-gate.ts
    - lib/eval/src/cli.ts
    - lib/db/src/migrations/013_phase4_eval_runs.sql
  modified:
    - lib/db/src/schema/index.ts
    - lib/eval/src/index.ts
    - lib/eval/src/__tests__/runner.e2e.test.ts
    - CLAUDE.md
decisions:
  - "Inline moderator provider factory in runner.ts (InlineOpenAiModeratorProvider / InlineMockModeratorProvider) rather than importing from @workspace/providers or artifacts/api-server — @workspace/providers has no getModeratorProvider; api-server import would create BLOCKER-03 circular dep. Test mocks the entire @workspace/twin-runtime/moderation module so registration is a no-op in tests."
  - "MODERATOR_PROVIDER env var gates mock vs OpenAI in the inline factory — same pattern as api-server registry"
  - "pnpm --filter @workspace/db run push blocked (no DATABASE_URL in dev environment) — surface as deployment prerequisite, not a code failure"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-30"
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 4
---

# Phase 04 Plan 02: Eval Runner + Live Gate Summary

**One-liner:** runEval() drives all 30 eval cases through the direct twin-runtime moderation pipeline (L1 → LLM at temperature:0 → L3), persists per-category pass/fail counts to `eval_runs`, and exposes `isGoLiveEligible` + an `EVAL_CREATOR_ID`-validated CLI — runner.e2e.test.ts GREEN.

## What Was Built

### eval_runs DB Table (`lib/db/src/schema/index.ts` + `013_phase4_eval_runs.sql`)
- Drizzle `evalRunsTable` with UUID PK, `creator_id` FK cascade, per-category counts (`hard_limit_passed/total`, `injection_passed/total`), `passed_hard_limit_100`, `passed_injection_100`, `go_live_eligible`, `report` JSONB, `is_regression_run`, `triggered_sentry_alert`
- `eval_runs_creator_ran_idx` index on `(creator_id, ran_at)`
- Hand-written SQL at `lib/db/src/migrations/013_phase4_eval_runs.sql` — correct live migration path
- `insertEvalRunSchema` (with `id` kept for client-supplied PK per WARNING-07) + `EvalRun` type

### CLAUDE.md Migration Docs Correction (BLOCKER-02 fix)
- Architecture bullet: `supabase/migrations/` → `lib/db/src/migrations/` as canonical path
- Migrations section: rewrote to document `lib/db/src/migrations/NNN_name.sql` as sole active migration system; `supabase/migrations/` is retired/empty after Phase 1

### runner.ts (`lib/eval/src/runner.ts`)
- `runEval(creatorId, opts?)`: loads twin card + constitution → `buildSystemPrompt` → iterates all 30 `ALL_CASES` sequentially
- Per case: unique `fanIdHash = eval-probe-{caseId}-{creatorId[0:8]}` + `sessionId = eval-session-{caseId}` → `runL1Moderation` → if L1 fires, skip LLM → else `gmiChatCompletion(temperature:0)` → `runL3Moderation` → `gradeCase`
- `gmiChatCompletion`: mirrors `text-generation.ts` inline pattern; sets `temperature: 0` in request body (resolves 04-RESEARCH Open Question 1 — no GmiClient change needed)
- `computeReport`: generates `runId = crypto.randomUUID()` client-side BEFORE `persistEvalRun` (WARNING-07)
- Moderator factory: `setModeratorProviderFactory` called at module init with inline `InlineOpenAiModeratorProvider` / `InlineMockModeratorProvider` (BLOCKER-03 fix — zero imports from api-server or any artifact)
- Zero calls to `writeNonFlaggedScores` or `scoreEscalation` — MOD-07 escalation scorer not contaminated

### db-helpers.ts (`lib/eval/src/db-helpers.ts`)
- `persistEvalRun(report, opts)`: lazy import `@workspace/db` + `drizzle-orm`, inserts row with `id: report.runId` (client PK override)
- `loadTwinCard(creatorId)`: lazy import, selects `characterCard` from `twinsTable`

### live-gate.ts (`lib/eval/src/live-gate.ts`)
- `isGoLiveEligible(creatorId)`: lazy DB import, selects `goLiveEligible` from `evalRunsTable` where `isRegressionRun = false`, ordered by `ranAt DESC`, limit 1 — returns `latest?.goLiveEligible === true`
- Regression runs (weekly cron) excluded from live gate

### cli.ts (`lib/eval/src/cli.ts`)
- Reads `EVAL_CREATOR_ID`, validates UUID format (ASVS V5 — T-04-02-03), exits 1 with clear error on missing/malformed
- Calls `runEval(creatorId)`, prints per-category pass/fail table + full JSON report to stdout
- Exits 0 on `goLiveEligible = true`, exits 1 otherwise

### index.ts Update
- Exports `runEval` from `runner.ts` and `isGoLiveEligible` from `live-gate.ts`

### runner.e2e.test.ts (04-01 RED → 04-02 GREEN)
- Removed `@ts-expect-error` directive (runner.ts now exists)
- Updated describe name to remove "RED" designation
- Test passes GREEN with all mocks in place

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm --filter @workspace/eval exec vitest run src/__tests__/runner.e2e.test.ts` | PASS GREEN (1/1 test) |
| `pnpm --filter @workspace/eval run typecheck` | PASS (exit 0) |
| `grep -c "evalRunsTable" lib/db/src/schema/index.ts` | 3 (>= 1) |
| `grep -c "CREATE TABLE IF NOT EXISTS eval_runs" 013_phase4_eval_runs.sql` | 1 |
| `grep -c "go_live_eligible" 013_phase4_eval_runs.sql` | 2 (>= 1) |
| CLAUDE.md migration path corrected | PASS |
| `grep -c "api-server" lib/eval/src/runner.ts` | 0 |
| `grep -c "scoreEscalation" lib/eval/src/runner.ts` | 0 |
| `grep -c "writeNonFlaggedScores" lib/eval/src/runner.ts` | 0 |
| `grep -c "temperature: 0" lib/eval/src/runner.ts` | 2 (>= 1) |
| `grep -Ec "eval-probe\|eval-session" lib/eval/src/runner.ts` | 4 (>= 2) |
| `grep -c "evalRunsTable" lib/eval/src/db-helpers.ts` | 2 (>= 1) |
| `grep -c "export async function isGoLiveEligible" live-gate.ts` | 1 |
| `grep -Ec "isRegressionRun" live-gate.ts` | 1 (>= 1) |
| `pnpm --filter @workspace/db run push` | BLOCKED (no DATABASE_URL — see Blockers) |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 505beed | feat | eval_runs Drizzle table + migration + CLAUDE.md correction |
| 0257b75 | feat | runner.ts + db-helpers.ts — RED test turned GREEN |
| 166ae34 | feat | isGoLiveEligible live-gate + eval CLI entry point |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @workspace/providers has no `getModeratorProvider`**
- **Found during:** Task 2, researching the plan's `import { registry } from "@workspace/providers"` instruction
- **Issue:** `lib/providers/src/providers/registry.ts` (the `@workspace/providers` registry) does NOT export `getModeratorProvider`. That function lives only in `artifacts/api-server/src/providers/registry.ts`, which cannot be imported from `@workspace/eval` (BLOCKER-03 circular dep).
- **Fix:** Implemented inline `InlineOpenAiModeratorProvider` and `InlineMockModeratorProvider` classes directly in `runner.ts`, reading `MODERATOR_PROVIDER` env var. This achieves identical runtime behavior with zero artifact imports. In tests, `@workspace/twin-runtime/moderation` is fully vi.mock'd, so `setModeratorProviderFactory` is a no-op stub regardless of what factory is registered.
- **Files modified:** `lib/eval/src/runner.ts`
- **Impact:** No behavioral difference; grep gate `grep -c "api-server" lib/eval/src/runner.ts == 0` passes.

**2. [Rule 1 - Bug] @ts-expect-error in runner.e2e.test.ts was now stale**
- **Found during:** Task 2 typecheck (`tsc --noEmit` reported TS2578 Unused '@ts-expect-error' directive)
- **Fix:** Removed `@ts-expect-error` directive and updated describe name from "RED" to indicate GREEN state
- **Files modified:** `lib/eval/src/__tests__/runner.e2e.test.ts`

### Blockers Surfaced

**BLOCKER: `pnpm --filter @workspace/db run push` requires live DATABASE_URL**
- The plan marks the DB push as `[BLOCKING]` and states "if the push needs a live DATABASE_URL not present in this environment, surface it as a BLOCKING checkpoint in the SUMMARY rather than faking success."
- This environment has no `DATABASE_URL` — the push throws immediately with "DATABASE_URL (or DATABASE_URL_DIRECT) must be set."
- **Action required before first eval run:** Run `pnpm --filter @workspace/db run push` on Replit (where `DATABASE_URL` is auto-injected) to apply `013_phase4_eval_runs.sql` and create the `eval_runs` table.
- All other acceptance criteria pass; the schema is correct in Drizzle and the SQL file is ready.

## Known Stubs

None. `runEval` is fully implemented and wired to the twin-runtime pipeline. `isGoLiveEligible` reads from `eval_runs`. `cli.ts` is wired to call `runEval`. No placeholder data flows to any output.

The only pending item is the DB push (see Blocker above), which is an environment prerequisite, not a code stub.

## Threat Flags

None. No new network endpoints, auth paths, or fan-accessible routes were added. The eval runner is a founder-only CLI/worker tool. All STRIDE threats from the threat register were addressed in the implementation:
- T-04-02-01: per-case `eval-probe-{id}` fanIdHash + `eval-session-{id}` sessionId isolation; no escalation scorer calls
- T-04-02-02: eval audit rows filterable by `eval-probe` fanIdHash prefix
- T-04-02-03: UUID validation in `cli.ts` before `runEval` call
- T-04-02-04: eval sessions distinct from HMAC-signed fan conversation IDs
- T-04-02-05: zero api-server imports in `lib/eval`

## Self-Check: PASSED

Files exist:
- `lib/eval/src/runner.ts` FOUND
- `lib/eval/src/db-helpers.ts` FOUND
- `lib/eval/src/live-gate.ts` FOUND
- `lib/eval/src/cli.ts` FOUND
- `lib/db/src/migrations/013_phase4_eval_runs.sql` FOUND

Commits exist:
- 505beed FOUND
- 0257b75 FOUND
- 166ae34 FOUND
