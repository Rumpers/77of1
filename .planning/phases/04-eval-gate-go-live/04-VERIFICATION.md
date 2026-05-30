---
phase: 04-eval-gate-go-live
verified: 2026-05-30T05:20:38Z
status: passed
score: 2/2 must-haves verified
overrides_applied: 0
---

# Phase 4: Eval Gate + Go-Live — Verification Report

**Phase Goal:** The creator's twin must pass a 30-case evaluation suite (100% on hard-limit and prompt-injection categories) before the twin is made live; a weekly regression cron ensures the standard holds post-launch
**Verified:** 2026-05-30T05:20:38Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running the eval suite produces a pass/fail report across all 30 cases (10/10/5/5); the twin cannot go live unless hard-limit and injection scores are both 100% | VERIFIED | 30 cases confirmed (10 IC, 10 BP, 5 HL, 5 PI); `EvalReport.goLiveEligible = passedHardLimit100 && passedInjection100`; activate route returns 422 unless `isGoLiveEligible` returns true |
| 2 | A deliberate regression causes the weekly cron to fire a Sentry alert within the next scheduled run | VERIFIED | `processEvalRegression` calls `captureMessageFn` when `passedHardLimit100 === false`; regression test asserts exactly once; negative test asserts silence on clean run |

**Score:** 2/2 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Evidence |
|----------|----------|--------|----------|
| `lib/eval/src/types.ts` | EvalCase, EvalReport, EvalCriterion types | VERIFIED | Exports all required types including `EvalReport.goLiveEligible`, `passedHardLimit100`, `byCategory` |
| `lib/eval/src/cases/index.ts` | ALL_CASES re-export of 30 cases | VERIFIED | Aggregates 4 category arrays; test asserts length=30 and 10/10/5/5 split — passes |
| `lib/eval/src/cases/in-character.ts` | 10 IC cases | VERIFIED | 10 IC-01..IC-10 case objects confirmed by grep |
| `lib/eval/src/cases/boundary-push.ts` | 10 BP cases | VERIFIED | 10 BP-01..BP-10 case objects confirmed by grep |
| `lib/eval/src/cases/hard-limit.ts` | 5 HL cases, all `moderation_fires` | VERIFIED | 5 HL-01..HL-05; grader test asserts `moderation_fires` criterion on all |
| `lib/eval/src/cases/prompt-injection.ts` | 5 PI cases | VERIFIED | 5 PI-01..PI-05 confirmed by grep |
| `lib/eval/src/grader.ts` | `gradeCase()` pure pass/fail function | VERIFIED | Exports `gradeCase`; handles `moderation_fires` and `llm_output_rule`; all 6 criterion tests pass |
| `lib/eval/src/runner.ts` | `runEval(creatorId)` orchestrates 30 cases | VERIFIED | Full implementation: L1/L3 moderation, GMI at temperature=0, `gradeCase`, `computeReport`, `persistEvalRun`; `goLiveEligible` derived correctly |
| `lib/eval/src/live-gate.ts` | `isGoLiveEligible()` queries eval_runs | VERIFIED | Drizzle query excludes `isRegressionRun=true` rows; returns `goLiveEligible` of latest non-regression run |
| `lib/eval/src/regression-processor.ts` | `processEvalRegression()` injectable for testing | VERIFIED | Exported from `@workspace/eval`; reads `EVAL_CREATOR_ID` from env; calls `captureMessageFn` when `passedHardLimit100 === false`; gracefully skips when env var absent |
| `lib/eval/src/__tests__/grader.test.ts` | Unit tests for gradeCase (6 behavioral tests) | VERIFIED | 9 tests pass covering all criterion paths and ALL_CASES count/split |
| `lib/eval/src/__tests__/runner.e2e.test.ts` | E2E runner contract test (GREEN in 04-02) | VERIFIED | 1 test passes; asserts `totalCases=30`, all 4 category keys, `goLiveEligible` derivation |
| `lib/eval/src/__tests__/runner.regression.test.ts` | Deliberate-regression test (EVAL-02 SC2) | VERIFIED | 3 tests pass: captureMessage fires once on regression, silent on clean run, null return on missing env |
| `lib/db/src/schema/index.ts` | `evalRunsTable` Drizzle schema | VERIFIED | All required columns: `goLiveEligible`, `passedHardLimit100`, `passedInjection100`, `isRegressionRun`, `report` JSONB |
| `lib/db/src/migrations/013_phase4_eval_runs.sql` | DB migration for eval_runs | VERIFIED | `CREATE TABLE IF NOT EXISTS eval_runs` with all columns and index |
| `artifacts/api-server/src/routes/admin-twin-activate.ts` | POST /api/admin/twin/:creatorId/activate | VERIFIED | `founderAuth` middleware applied; `isGoLiveEligible` checked; 422 on not-eligible; status='active' set only on pass; UUID validation |
| `artifacts/api-server/src/middleware/founder-auth.ts` | Bearer token gate with `timingSafeEqual` | VERIFIED | Uses `crypto.timingSafeEqual`; fails closed when `ADMIN_API_TOKEN` unset; constant-time length check |
| `artifacts/api-server/src/__tests__/admin-twin-activate.test.ts` | 401/422/200 tests | VERIFIED | 5 tests pass: 401 (no auth), 401 (wrong token), 422 (eval gate fail), 200 (eligible + status update), 400 (invalid UUID) |
| `artifacts/worker/src/workers/eval-regression.ts` | BullMQ worker factory (concurrency 1) | VERIFIED | `createEvalRegressionWorker` exports; calls `processEvalRegression` with live `runEval` + `Sentry.captureMessage` |
| `artifacts/worker/src/crons/eval-regression-scheduler.ts` | Weekly `upsertJobScheduler` registration | VERIFIED | Uses `upsertJobScheduler` (not deprecated repeat API); pattern `"0 2 * * 1"` (Monday 02:00 UTC); closes queue after registration |
| `artifacts/worker/src/index.ts` | Worker startup wires eval worker + scheduler | VERIFIED | `createEvalRegressionWorker` constructed; `registerEvalRegressionScheduler` called with `.catch()` fallback; `evalRegressionWorker.close()` in shutdown |
| `lib/queue/src/names.ts` | `evalRegression: "eval-regression"` in QUEUE_NAMES | VERIFIED | `grep` returns 1 match |
| `lib/queue/src/types.ts` | `EvalRegressionPayload` interface | VERIFIED | `type: "eval-regression"; triggeredBy: "weekly-cron" | "manual"` |
| `lib/queue/src/queues.ts` | `evalRegression` queue in `createAllQueues` | VERIFIED | Queue constructed with `JOB_OPTIONS.evalRegression` defaults |

---

## Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `lib/eval/src/cases/index.ts` | `cases/*.ts` | `ALL_CASES = [...inCharacterCases, ...boundaryPushCases, ...hardLimitCases, ...promptInjectionCases]` | WIRED | Direct array spread; grader test asserts 30 cases |
| `lib/eval/src/runner.ts` | `lib/eval/src/grader.ts` | `gradeCase(c, outcome)` | WIRED | Import confirmed; called inside `for (const c of ALL_CASES)` loop |
| `lib/eval/src/runner.ts` | `lib/eval/src/live-gate.ts` | Published from same package; both exported from `index.ts` | WIRED | Separate modules; both re-exported from barrel |
| `lib/eval/src/runner.ts` | `@workspace/twin-runtime/moderation` | `runL1Moderation`, `runL3Moderation`, `setModeratorProviderFactory` | WIRED | Imported at top of `runner.ts`; called per eval case |
| `artifacts/api-server/src/routes/admin-twin-activate.ts` | `@workspace/eval` | `isGoLiveEligible(creatorId)` via lazy import | WIRED | `const { isGoLiveEligible } = await import("@workspace/eval")` at line 52 |
| `artifacts/api-server/src/routes/index.ts` | `admin-twin-activate.ts` | `router.use(adminTwinActivateRouter)` | WIRED | Line 18 import + line 41 mount confirmed |
| `artifacts/api-server/src/routes/twin.ts` | `twins.status` gate | Returns 503 `twin_inactive` when status !== 'active' | WIRED | Line 174-175 confirmed |
| `artifacts/worker/src/workers/eval-regression.ts` | `lib/eval/src/regression-processor.ts` | `processEvalRegression` (re-exported via `@workspace/eval`) | WIRED | Worker calls `processEvalRegression` with `Sentry.captureMessage.bind(Sentry)` |
| `artifacts/worker/src/crons/eval-regression-scheduler.ts` | BullMQ Queue | `queue.upsertJobScheduler("eval-regression-weekly", { pattern: "0 2 * * 1" }, ...)` | WIRED | Confirmed; deprecated repeat API absent (grep returns 0) |
| `artifacts/worker/src/index.ts` | eval-regression worker + scheduler | `createEvalRegressionWorker` + `registerEvalRegressionScheduler` at startup | WIRED | Both imported and called; `.catch()` fallback for Redis-absent degradation |
| `lib/eval/src/regression-processor.ts` | Sentry (injected) | `deps.captureMessageFn(msg, { level: "error", extra: {...} })` | WIRED | Confirmed; regression test asserts call with level="error" and REGRESSION in message |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `runner.ts` | `results: EvalCaseResult[]` | `runSingleCase()` → L1/L3 moderation + GMI completions (temperature=0) | Yes — real pipeline calls per case; mocked in tests via `vi.mock` | FLOWING |
| `live-gate.ts` | `latest.goLiveEligible` | Drizzle `db.select().from(evalRunsTable).where(isRegressionRun=false).orderBy(ranAt desc).limit(1)` | Yes — real DB query | FLOWING |
| `regression-processor.ts` | `report.passedHardLimit100` | `deps.runEvalFn(creatorId, { isRegressionRun: true })` injected at call site | Yes — injection pattern ensures real `runEval` in production, mock in tests | FLOWING |
| `admin-twin-activate.ts` | `eligible: boolean` | `isGoLiveEligible(creatorId)` → DB query via `live-gate.ts` | Yes — lazily imported; real DB path in production, mocked in tests | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 30-case suite exists with 10/10/5/5 split | `pnpm --filter @workspace/eval exec vitest run` grader.test.ts Test 6 | PASS — asserts `ALL_CASES.length === 30`, per-category counts verified | PASS |
| `gradeCase` deterministic for `moderation_fires` | grader.test.ts Tests 1-2 | PASS — `l1Flagged=true` → passed=true; both false → passed=false with reason | PASS |
| `goLiveEligible = passedHardLimit100 && passedInjection100` | runner.e2e.test.ts | PASS — asserts derivation consistency | PASS |
| Activate route returns 422 when eval gate fails | admin-twin-activate.test.ts | PASS — 422 `eval_gate_failed`; no DB update | PASS |
| Activate route sets status='active' on eligible | admin-twin-activate.test.ts | PASS — 200; `dbUpdateCalls[0].set.status === 'active'` | PASS |
| Sentry fires exactly once on regression | runner.regression.test.ts | PASS — `captureMessage` called once with level="error", REGRESSION in message | PASS |
| Sentry silent on clean run | runner.regression.test.ts | PASS — `captureMessage` not called | PASS |
| Scheduler uses `upsertJobScheduler`, not deprecated repeat | grep in scheduler file | PASS — 1 `upsertJobScheduler` call, 0 `repeat:` matches | PASS |
| Worker startup degrades gracefully without Redis | `registerEvalRegressionScheduler` wrapped in `.catch()` | PASS — warning logged, process continues | PASS |
| All Phase 4 packages typecheck clean | `pnpm --filter @workspace/{eval,worker,queue,api-server} run typecheck` | PASS — all 4 exit 0 | PASS |

**Full test run:** `pnpm --filter @workspace/eval exec vitest run` → **17 tests pass (3 files)**
**Full test run:** `pnpm --filter @workspace/api-server exec vitest run src/__tests__/admin-twin-activate.test.ts src/__tests__/twin-chat.e2e.test.ts` → **21 tests pass (2 files)**

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EVAL-01 | 04-01, 04-02, 04-03 | 30-case eval suite; 100% hard-limit + injection required for go-live | SATISFIED | Cases exist 10/10/5/5; `gradeCase` grades deterministically; `isGoLiveEligible` gates activate route; `founderAuth` secures the endpoint |
| EVAL-02 | 04-04 | Weekly cron re-runs eval; Sentry alert on regression below 100% hard-limit | SATISFIED | `registerEvalRegressionScheduler` registers Monday 02:00 UTC via `upsertJobScheduler`; `createEvalRegressionWorker` processes; `processEvalRegression` fires Sentry on `!passedHardLimit100`; regression test proves alert path |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `artifacts/web/src/pages/fan-dsar.tsx` | 3 | Stale i18n key references (pre-Phase-4, commit 93429ed) | INFO | Out of scope for Phase 4 — pre-existing tech debt from Phase 3 i18n work; does not affect eval gate or go-live gate |

No debt markers (TBD/FIXME/XXX) found in any Phase 4 modified file.

---

## Human Verification Required

No automated gaps were found. The following items require human action at actual deployment time — they are not blockers for the phase verification, but are prerequisites for Claire going live:

### 1. eval_runs table migration applied to Replit PostgreSQL

**Test:** Run `pnpm --filter @workspace/db run push` (or `supabase db push`) on Replit with live `DATABASE_URL`
**Expected:** `eval_runs` table created; `pnpm --filter @workspace/eval exec vitest run` continues to pass (mocked DB, so unaffected by migration status)
**Why human:** No live `DATABASE_URL` in this environment — schema push requires Replit Secrets configured

### 2. Eval suite run against Claire's real twin

**Test:** With `EVAL_CREATOR_ID`, `ADMIN_API_TOKEN`, `GMI_API_KEY`, and `OPENAI_API_KEY` set in Replit Secrets, and Claire fully onboarded (character card in `twins` table), run `pnpm --filter @workspace/eval eval <claire-creator-id>`
**Expected:** 30-case report; both `passedHardLimit100` and `passedInjection100` = true; `goLiveEligible` = true
**Why human:** Requires live GMI + OpenAI moderation calls against Claire's real character card; no live credentials in this environment

### 3. POST /api/admin/twin/:creatorId/activate end-to-end on Replit

**Test:** After eval suite passes, call `POST /api/admin/twin/<claire-id>/activate` with `Authorization: Bearer <ADMIN_API_TOKEN>`
**Expected:** 200 `{"status":"active"}`; Claire's twin is reachable at the fan chat endpoint
**Why human:** Requires Replit with live DB, live eval run persisted, and `ADMIN_API_TOKEN` secret

### 4. Weekly cron fires on Replit Redis

**Test:** After deploying worker on Replit with `REDIS_URL` set, confirm the `eval-regression-weekly` scheduler appears in bull-board at `/admin/queues`
**Expected:** Scheduler visible; next-run time shows upcoming Monday 02:00 UTC
**Why human:** Requires live Redis; bull-board dashboard inspection is visual

---

## Go-Live Caveats / Remaining Manual Steps

These are known deployment/runtime items that do not block the phase verification (code is complete and tested) but must be completed before Claire actually goes live:

1. **Replit Secrets** — `EVAL_CREATOR_ID` (Claire's `creators.id` UUID), `ADMIN_API_TOKEN`, `GMI_API_KEY`, `OPENAI_API_KEY` must all be set
2. **DB migration** — `pnpm --filter @workspace/db run push` must be run on Replit to create the `eval_runs` table (migration `013_phase4_eval_runs.sql` is ready)
3. **Claire onboarding** — Full Hermes onboarding (character card, consent) must be complete before `runEval` can load a twin card; partial onboarding causes eval to fail with a clear "twin card missing" error
4. **Run eval CLI** — `pnpm --filter @workspace/eval eval <claire-creator-id>` must produce a passing report (both hard-limit + injection at 100%) before calling the activate endpoint
5. **Activate endpoint** — `POST /api/admin/twin/<claire-id>/activate` flips `twins.status` to `active`; confirm the fan chat endpoint returns 200 (not 503 `twin_inactive`) after this call
6. **Pre-existing tech debt** — `artifacts/web/src/pages/fan-dsar.tsx` has stale i18n key references from Phase 3 (commit 93429ed); tracked separately, does not affect eval gate or go-live gate

---

## Gaps Summary

None. All must-haves are verified. The phase goal is fully achieved in the codebase.

The complete mechanical evidence:
- 30 eval cases exist with the exact 10/10/5/5 category split (grader test asserts this deterministically)
- `gradeCase()` is pure and deterministic; `moderation_fires` criterion grades on `l1Flagged || l3Flagged`; `llm_output_rule` criterion grades on keyword presence/absence/deflection
- `EvalReport.goLiveEligible` is `passedHardLimit100 && passedInjection100` — computed in `runner.ts`, persisted to DB, queried by `isGoLiveEligible`
- The activate route enforces founder auth (constant-time bearer token) and returns 422 unless `isGoLiveEligible` returns true
- The twin route (`routes/twin.ts`) gates all chat on `twins.status === 'active'` — a twin never reaches fans until the activate endpoint succeeds
- The weekly scheduler uses `upsertJobScheduler` (not deprecated repeat API), pattern `"0 2 * * 1"`, and is wired at worker startup with Redis-absent fallback
- `processEvalRegression` fires `Sentry.captureMessage` with level="error" exactly once when `passedHardLimit100 === false`; deliberate-regression test proves this path; negative test proves silence on clean runs
- All four Phase 4 packages typecheck clean with zero errors

---

_Verified: 2026-05-30T05:20:38Z_
_Verifier: Claude (gsd-verifier)_
