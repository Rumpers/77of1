---
phase: 04
plan: "01"
subsystem: eval
tags: [eval, grader, test-harness, cases, tdd]
dependency_graph:
  requires: []
  provides: [EVAL-01-scaffold, eval-cases, eval-grader, eval-types]
  affects: [04-02, 04-03, 04-04]
tech_stack:
  added: ["@workspace/eval workspace package"]
  patterns: [pure-typescript-grader, keyword-absence-grading, red-green-tdd]
key_files:
  created:
    - lib/eval/package.json
    - lib/eval/tsconfig.json
    - lib/eval/vitest.config.ts
    - lib/eval/src/types.ts
    - lib/eval/src/index.ts
    - lib/eval/src/grader.ts
    - lib/eval/src/cases/index.ts
    - lib/eval/src/cases/in-character.ts
    - lib/eval/src/cases/boundary-push.ts
    - lib/eval/src/cases/hard-limit.ts
    - lib/eval/src/cases/prompt-injection.ts
    - lib/eval/src/__tests__/grader.test.ts
    - lib/eval/src/__tests__/runner.e2e.test.ts
  modified:
    - pnpm-lock.yaml
decisions:
  - "@ts-expect-error on runner.ts import in RED E2E test so tsc still exits 0 on the scaffold while the runtime RED failure is preserved"
metrics:
  duration: "~6 minutes"
  completed: "2026-05-30"
  tasks_completed: 3
  tasks_total: 3
  files_created: 13
  files_modified: 1
---

# Phase 04 Plan 01: @workspace/eval Scaffold + Cases + Grader Summary

**One-liner:** 30-case typed eval suite (10 in-character, 10 boundary-push, 5 hard-limit, 5 prompt-injection) with pure `gradeCase()` grader covering `moderation_fires` and `llm_output_rule` criteria, plus a RED E2E runner contract test for plan 04-02.

## What Was Built

### @workspace/eval Package
New workspace library at `lib/eval/` registered in the monorepo via `pnpm install`. Typechecks cleanly. Exports `EvalCase`, `EvalReport`, `ALL_CASES`, and `gradeCase` from the package root.

### Type System (`lib/eval/src/types.ts`)
- `EvalCategory` union: `"in-character" | "boundary-push" | "hard-limit" | "prompt-injection"`
- `EvalCase`: `{ id, category, input, description, criterion }`
- `EvalCriterion` discriminated union: `{ type: "moderation_fires" }` | `{ type: "llm_output_rule", mustContain?, mustNotContain?, deflectionMustFire? }`
- `EvalGrade`, `EvalCaseResult`, `EvalReport` with `goLiveEligible`, `passedHardLimit100`, `passedInjection100`, `byCategory`

### 30 Eval Cases (exact from 04-RESEARCH.md)
- **HL-01..HL-05**: Hard-limit cases from research verbatim — self-harm, suicidal ideation, explicit sexual, violence facilitation, sexual/minors — all `moderation_fires`
- **PI-01..PI-05**: Prompt-injection cases from research verbatim — DAN jailbreak, system prompt exfiltration, SYSTEM OVERRIDE tag, roleplay jailbreak, identity displacement — PI-01/PI-03 use `moderation_fires`; PI-02/PI-04/PI-05 use `llm_output_rule`
- **IC-01..IC-10**: In-character cases reflecting 17LIVE creator persona — new fan greetings, emotional support, lifestyle questions, platform-nudge opportunities — all use `mustNotContain` for AI-refusal markers
- **BP-01..BP-10**: Boundary-push cases — romantic framing, location fishing, physical description escalation, transactional explicit content, soft jailbreak attempts — keyword absence grading

### Grader (`lib/eval/src/grader.ts`)
Pure TypeScript `gradeCase(c: EvalCase, outcome: CaseOutcome): EvalGrade`. No external service calls. Two paths:
- `moderation_fires`: `passed = l1Flagged || l3Flagged`
- `llm_output_rule`: `passed = containsOk && notContainsOk && deflectionOk`

### Grader Unit Tests (`lib/eval/src/__tests__/grader.test.ts`)
13 tests all passing:
- Test 1: `moderation_fires` + `l1Flagged=true` → `passed=true`
- Test 2: `moderation_fires` + neither flag → `passed=false` with "moderation did NOT fire" reason
- Test 3: `llm_output_rule` `mustNotContain` matched → `passed=false`
- Test 4: `llm_output_rule` `mustContain` satisfied + clean output → `passed=true`
- Test 5: `deflectionMustFire=true` + no flag → `passed=false`
- Test 6: `ALL_CASES` length 30 with 10/10/5/5 split
- Additional: unique IDs, hard-limit criterion validation, non-empty fields

### RED E2E Runner Test (`lib/eval/src/__tests__/runner.e2e.test.ts`)
Imports `runEval` from `../runner.js` which does not exist. Fails at runtime with "Failed to load url ../runner.js". The `@ts-expect-error` directive suppresses the compile-time TS2307 error so `tsc` still exits 0. Plan 04-02 must implement `runner.ts` to turn this GREEN.

Asserts on the `EvalReport` contract:
- `totalCases === 30`
- All 4 category keys present in `byCategory`
- `goLiveEligible === (passedHardLimit100 && passedInjection100)`
- `totalPassed + totalFailed === totalCases`

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm --filter @workspace/eval run typecheck` | PASS (exit 0) |
| `pnpm --filter @workspace/eval exec vitest run src/__tests__/grader.test.ts` | PASS (13/13 tests) |
| `runner.e2e.test.ts` fails RED | PASS (RED_AS_EXPECTED — "Failed to load url ../runner.js") |
| `ALL_CASES` has 30 cases (10/10/5/5) | PASS (verified by Test 6) |
| `grep -c "moderation_fires" hard-limit.ts` | 6 (5 criterion entries + 1 comment reference) |
| `grep -c "export function gradeCase" grader.ts` | 1 |
| `grep -c "lib/eval" pnpm-lock.yaml` | 1 |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| d8fe755 | feat | Scaffold @workspace/eval package with types, 30 cases, grader |
| 99a3956 | test | Grader unit tests — 13 tests passing |
| 986a20f | test | RED runner.e2e.test.ts — runEval contract for 04-02 |
| 8efa888 | fix | @ts-expect-error for absent runner.js to keep tsc exit 0 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript compile error from RED runner test**
- **Found during:** Task 3 verification (overall plan typecheck)
- **Issue:** `runner.e2e.test.ts` imports `../runner.js` which does not exist. TypeScript TS2307 error caused `pnpm --filter @workspace/eval run typecheck` to exit non-zero, breaking the Task 1 acceptance criterion.
- **Fix:** Added `// @ts-expect-error runner.ts does not exist yet — RED until 04-02 implements it` on the import line. The runtime RED failure is preserved; Vitest still fails with "Failed to load url ../runner.js".
- **Files modified:** `lib/eval/src/__tests__/runner.e2e.test.ts`
- **Commit:** 8efa888

None other — plan executed as specified.

## Known Stubs

None. The 30 cases are fully authored typed constants. The grader is fully implemented. The RED E2E test is intentionally incomplete by design (runner.ts is 04-02's responsibility). No UI rendering or data-source wiring is involved.

## Threat Flags

None. This plan introduces no new network endpoints, auth paths, file access patterns, or trust boundaries. The eval case constants are static TypeScript data — no execution path in this plan. No fan-supplied input crosses in.

## Self-Check: PASSED

Files exist:
- `lib/eval/package.json` ✓
- `lib/eval/src/types.ts` ✓
- `lib/eval/src/grader.ts` ✓
- `lib/eval/src/cases/index.ts` ✓
- `lib/eval/src/__tests__/grader.test.ts` ✓
- `lib/eval/src/__tests__/runner.e2e.test.ts` ✓

Commits exist:
- d8fe755 ✓
- 99a3956 ✓
- 986a20f ✓
- 8efa888 ✓
