# Cold-Start Verification — Phase 1 Baseline Repair

**Date:** 2026-05-28
**Executor:** Parallel agent (worktree-agent-ab6a7e646af36a2a9)
**Branch:** worktree-agent-ab6a7e646af36a2a9

## Typecheck Results

### pnpm run typecheck:libs
**Status: PASS (exit 0)**

All shared libraries typecheck cleanly:
- `lib/db` — PASS
- `lib/api-spec` — PASS
- `lib/api-zod` — PASS
- `lib/api-client-react` — PASS
- `lib/providers` — PASS
- `lib/queue` — PASS
- `lib/admin-sdk` — PASS

### Per-Artifact Typecheck

| Artifact | Command | Status | Notes |
|----------|---------|--------|-------|
| @workspace/api-server | `tsc -p tsconfig.json --noEmit` | **PASS** | Zero errors after Drizzle rewrite |
| @workspace/worker | `tsc --noEmit` | **PASS** | Already Drizzle-clean from 01-04b |
| @workspace/hermes | `tsc -p tsconfig.json --noEmit` | **PASS** | Already Drizzle-clean from 01-03 |
| @workspace/admin | `tsc --noEmit` | **FAIL (expected, deferred)** | ~15 TS errors in stub-data-provider + deletions routes — Phase 2 backlog per CONTEXT.md |
| @workspace/web (artifacts/web) | `tsc -p tsconfig.json --noEmit` | **FAIL (pre-existing)** | fan-dsar.tsx i18n key mismatches (Property 'fan_submit', 'done_title', etc.); not caused by Phase 1 changes; logged to deferred-items |

### Supabase Import Scan

Zero Supabase imports remain in in-scope artifacts after Phase 1:
```
grep -r "@supabase/supabase-js" artifacts/api-server/src artifacts/hermes/src artifacts/worker/src
(no output)
```

`artifacts/admin` still contains `@supabase/supabase-js` — explicitly deferred per CONTEXT.md.

## Runtime Cold-Start Probes

**Status: DEFERRED — DATABASE_URL not available in parallel agent worktree environment**

The parallel executor context does not have access to a live `DATABASE_URL` (Replit PostgreSQL
injection only happens in the deployed Replit environment). Runtime probes on ports 8080 and 22333
require DATABASE_URL for `lib/db` initialization.

**Required verification at deploy time (founder action):**

```bash
# Port 8080 — api-server health
curl -fsS http://localhost:8080/api/health
# Expected: {"status":"ok"} HTTP 200

# Port 22333 — artifacts/web fan SPA
curl -fsS http://localhost:22333
# Expected: HTML 200
```

Or on Replit after deploy:
```bash
curl -fsS https://<your-repl>.replit.app/api/health
```

## Deferred Items Logged

Pre-existing failures NOT caused by Phase 1 changes (do not fix here):

1. `artifacts/web/src/pages/fan-dsar.tsx` — i18n key mismatches (`fan_submit`, `creator_submit`, `done_title`, `done_body_fan`, `done_body_creator`, `done_support_hint`, `powered_by` missing from i18n type). Phase 2 i18n work will resolve.

2. `artifacts/admin` — Multiple TS errors in `stub-data-provider.ts` and deletion route handler. Admin migration is explicitly deferred to Phase 2 per CONTEXT.md.

## Phase 1 Success Criteria Verification

| Criterion | Status |
|-----------|--------|
| Zero Supabase client imports in api-server/src | VERIFIED |
| Zero Supabase client imports in hermes/src | VERIFIED |
| Zero Supabase client imports in worker/src | VERIFIED |
| @supabase/supabase-js removed from api-server package.json | VERIFIED |
| @supabase/supabase-js removed from hermes package.json (01-03) | VERIFIED |
| @supabase/supabase-js removed from worker package.json (01-04b) | VERIFIED |
| @supabase/supabase-js retained in admin package.json (deferred) | VERIFIED |
| apps/web/ deleted (D-08) | VERIFIED |
| pnpm install --frozen-lockfile=false exits 0 | VERIFIED |
| api-server typecheck PASS | VERIFIED |
| worker typecheck PASS | VERIFIED |
| hermes typecheck PASS | VERIFIED |
| runtime cold-start on port 8080 | DEFERRED (no DATABASE_URL in worktree env) |
| runtime cold-start on port 22333 | DEFERRED (no DATABASE_URL in worktree env) |
