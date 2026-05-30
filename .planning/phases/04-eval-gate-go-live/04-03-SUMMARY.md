---
phase: 04
plan: "03"
subsystem: api-server
tags: [eval-gate, go-live, admin-auth, runtime-gate, tdd-green]
dependency_graph:
  requires: [04-02]
  provides: [EVAL-01-runtime-gate, EVAL-01-activate-endpoint, founder-auth-middleware]
  affects: [04-04]
tech_stack:
  added:
    - "@workspace/eval as dependency of api-server (isGoLiveEligible)"
  patterns:
    - lazy-db-import (getDb pattern for admin-twin-activate.ts)
    - per-route-auth-middleware (founderAuth applied per-route, not globally)
    - constant-time-token-compare (crypto.timingSafeEqual in founderAuth)
    - tdd-red-green (all three tasks driven test-first)
key_files:
  created:
    - artifacts/api-server/src/middleware/founder-auth.ts
    - artifacts/api-server/src/routes/admin-twin-activate.ts
    - artifacts/api-server/src/__tests__/admin-twin-activate.test.ts
  modified:
    - artifacts/api-server/src/routes/twin.ts
    - artifacts/api-server/src/routes/index.ts
    - artifacts/api-server/src/__tests__/twin-chat.e2e.test.ts
    - artifacts/api-server/package.json
    - pnpm-lock.yaml
decisions:
  - "founderAuth applied per-route (not globally) to avoid intercepting fan routes"
  - "timingSafeEqual on equal-length buffers; mismatched length -> 401 without leaking token length"
  - "Admin route uses lazy import for @workspace/eval to avoid any potential circular dep"
  - "Pre-existing test failures (scoreEscalation using real db in test) fixed by mocking @workspace/twin-runtime/escalation — vi.mock of safetyAuditLogTable also added as belt-and-braces fix"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-30"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 5
---

# Phase 04 Plan 03: Go-Live Gate (Runtime + Admin Activate) Summary

**One-liner:** runtime twins.status gate in the fan chat route (503 twin_inactive before credit/LLM) + founderAuth ADMIN_API_TOKEN middleware (timingSafeEqual, fail-closed) + POST /api/admin/twin/:creatorId/activate that calls isGoLiveEligible and only flips status to "active" on 100% eval pass.

## What Was Built

### Task 1: Runtime twins.status gate in routes/twin.ts

Added a `twins.status` select immediately after the `creator_config.paused` check (the 3rd gate block), BEFORE the credit gate and LLM pipeline:

```typescript
const twinStatusRow = await db
  .select({ status: twinsTable.status })
  .from(twinsTable)
  .where(eq(twinsTable.creatorId, creatorId))
  .limit(1)
  .then((r: Array<{ status: string }>) => r[0] ?? null);

if (twinStatusRow && twinStatusRow.status !== "active") {
  res.status(503).json({ code: "twin_inactive" });
  return;
}
```

- New twins default to `status: "inactive"` (schema default, no migration needed)
- Gate is BEFORE credit deduction and LLM call — inactive twins never consume credits
- Response body does not mention eval cases (ASVS V13 leak prevention, T-04-03-03)

### Task 2: founderAuth middleware (artifacts/api-server/src/middleware/founder-auth.ts)

- Reads `ADMIN_API_TOKEN` from `process.env`
- Fails CLOSED when unset or empty (logs warning, returns 401 to all)
- Parses `Authorization: Bearer <token>`, requires `Bearer ` prefix
- Uses `crypto.timingSafeEqual` on equal-length buffers — mismatched length → 401 without leaking
- Error responses never echo the supplied token (T-04-03-02, T-04-03-03)

### Task 3: POST /api/admin/twin/:creatorId/activate

Route at `artifacts/api-server/src/routes/admin-twin-activate.ts`:

- Requires `founderAuth` middleware (ADMIN_API_TOKEN bearer)
- Validates `:creatorId` as UUID (400 if malformed, T-04-03-05)
- Calls `isGoLiveEligible(creatorId)` from `@workspace/eval` (lazy import)
- 422 `eval_gate_failed` if not eligible — generic message, no case-level detail
- 200 `{status:"active"}` + `db.update(twinsTable).set({status:"active"})` when eligible

Wired in `routes/index.ts` BEFORE the linksRouter catch-all (`/:handle`).

Tests in `admin-twin-activate.test.ts` cover:
- 401 no Authorization header
- 401 wrong bearer token
- 422 when `isGoLiveEligible` returns false (db.update NOT called)
- 200 when `isGoLiveEligible` returns true (db.update called with correct creatorId)
- 400 for non-UUID `:creatorId`

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm --filter @workspace/api-server exec vitest run src/__tests__/twin-chat.e2e.test.ts` | PASS (16/16) |
| `pnpm --filter @workspace/api-server exec vitest run src/__tests__/admin-twin-activate.test.ts` | PASS (5/5) |
| `pnpm --filter @workspace/api-server run typecheck` | PASS (exit 0) |
| `grep -Eic "status.*active|active.*status" routes/twin.ts` | 4 (>= 1) |
| `grep -c "twin_inactive" routes/twin.ts` | 1 |
| `grep -c "twin_inactive" twin-chat.e2e.test.ts` | 2 (>= 1) |
| `grep -c "export function founderAuth" founder-auth.ts` | 1 |
| `grep -c "timingSafeEqual" founder-auth.ts` | 3 (>= 1) |
| `grep -c "ADMIN_API_TOKEN" founder-auth.ts` | 4 (>= 1) |
| `grep -Eic "unset|empty|fail.closed" founder-auth.ts` | 5 (>= 1) |
| `grep -c "isGoLiveEligible" admin-twin-activate.ts` | 3 (>= 1) |
| `grep -c "eval_gate_failed" admin-twin-activate.ts` | 1 |
| `grep -c "founderAuth" admin-twin-activate.ts` | 3 (>= 1) |
| `grep -c "adminTwinActivate" routes/index.ts` | 2 (>= 1) |
| `grep -Ec "401|422|200" admin-twin-activate.test.ts` | 12 (>= 3) |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| a81f11d | feat | twins.status=active runtime gate + test fix |
| 6d766c8 | feat | founderAuth middleware |
| 2ad56d3 | feat | admin-twin-activate route + wiring + tests |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing test failures: scoreEscalation using real @workspace/db in twin-chat.e2e.test.ts**
- **Found during:** Task 1 — running `twin-chat.e2e.test.ts` to verify the twin_inactive gate
- **Issue:** `escalation.ts` statically imports `{ db, safetyAuditLogTable }` from `@workspace/db`. The existing test mock for `@workspace/db` did not export `safetyAuditLogTable`. When `scoreEscalation` ran, it tried to use the unmocked db → exception thrown → Express caught → 500. This caused 5 tests to fail (the ones that complete the full LLM pipeline). Confirmed pre-existing by verifying with `git stash`.
- **Fix:** Added `vi.mock("@workspace/twin-runtime/escalation", ...)` stub that always returns `{ flagged: false, cumulativeScore: 0, windowSize: 0 }`. Also added `safetyAuditLogTable` to the `@workspace/db` mock export as belt-and-braces.
- **Files modified:** `artifacts/api-server/src/__tests__/twin-chat.e2e.test.ts`
- **Commit:** a81f11d

**2. [Rule 1 - Bug] TypeScript error on `req.params.creatorId` typed as `string | string[]`**
- **Found during:** Task 3 typecheck
- **Issue:** Express's `req.params` dictionary types values as `string | string[]`. UUID regex `.test(creatorId)` and `eq(twinsTable.creatorId, creatorId)` both require `string`, causing TS2345 errors.
- **Fix:** Cast path param via `const creatorId = req.params["creatorId"] as string` (safe: Express path params are always strings at runtime).
- **Files modified:** `artifacts/api-server/src/routes/admin-twin-activate.ts`
- **Commit:** 2ad56d3

## Known Stubs

None. The runtime gate, middleware, and activate route are fully implemented. No hardcoded values or placeholder data. `isGoLiveEligible` is wired to the real `eval_runs` table (via `@workspace/eval` built in 04-02).

## Threat Flags

None beyond what was documented in the plan's threat model. No new network endpoints, auth paths, or fan-accessible routes beyond what was planned. All STRIDE threats from T-04-03-00 through T-04-03-05 were addressed:
- T-04-03-00: routes/twin.ts gates on `twins.status === "active"` (503 twin_inactive) before credit/LLM
- T-04-03-01: founderAuth middleware on all admin activate requests
- T-04-03-02: timingSafeEqual defeats timing oracles; fail-closed on missing secret
- T-04-03-03: 422/503 bodies state policy generically, no eval case enumeration
- T-04-03-04: accepted (DB-direct ops are N=1 operational risk; audit trail via eval_runs)
- T-04-03-05: UUID validation on :creatorId; Drizzle parameterizes the update

## Self-Check: PASSED

Files exist:
- `artifacts/api-server/src/middleware/founder-auth.ts` FOUND
- `artifacts/api-server/src/routes/admin-twin-activate.ts` FOUND
- `artifacts/api-server/src/__tests__/admin-twin-activate.test.ts` FOUND

Commits exist:
- a81f11d FOUND (`git log --oneline | grep a81f11d`)
- 6d766c8 FOUND
- 2ad56d3 FOUND
