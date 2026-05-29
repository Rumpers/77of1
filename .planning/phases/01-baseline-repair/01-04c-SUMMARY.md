---
phase: 01-baseline-repair
plan: 04c
subsystem: infra
tags: [supabase-removal, dependency-cleanup, apps-web-deletion, typecheck, phase-1-close]
dependency_graph:
  requires: [01-04a, 01-04b]
  provides: [phase-1-complete, supabase-free-api-server-worker, lockfile-clean]
  affects: [pnpm-lock.yaml, artifacts/api-server/package.json, apps/web]
tech_stack:
  added: []
  patterns:
    - "Drizzle ORM replaces SupabaseClient in revocation.ts sweep"
    - "pino structured audit log replaces Supabase audit_log table insert (no Drizzle table for audit_log yet)"
    - "Vitest vi.mock() pattern for Drizzle module mocking in unit tests"
key_files:
  created:
    - .planning/phases/01-baseline-repair/notes/replit-secrets-cleanup.md
    - .planning/phases/01-baseline-repair/notes/cold-start-verification.md
  modified:
    - artifacts/api-server/package.json
    - artifacts/api-server/src/workers/revocation.ts
    - artifacts/api-server/src/__tests__/revocation-sweep.test.ts
    - pnpm-lock.yaml
  deleted:
    - apps/web/ (27 files, D-08 decision)
decisions:
  - "audit_log Drizzle table does not exist — writeAuditLog replaced with structured pino log (best-effort, Phase 2 will add Drizzle audit table)"
  - "Replit Secrets cleanup (Task 4) auto-approved as deferred-local-run per parallel execution instructions — founder must manually delete SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY from Replit panel before first production deploy"
  - "Runtime cold-start probes (ports 8080/22333) deferred — DATABASE_URL not available in worktree executor environment"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-28"
  tasks: 4
  files_changed: 31
---

# Phase 01 Plan 04c: Supabase Dep Scrub + apps/web Deletion + Phase 1 Close Summary

**One-liner:** Remove @supabase/supabase-js from api-server package.json, rewrite revocation.ts on Drizzle, delete apps/web/ (D-08), regenerate lockfile, and write Replit Secrets cleanup checklist — closing Phase 1.

## What Was Built

This is the final Wave-4 plan of Phase 1, running after 01-04a (api-server source Supabase removal) and 01-04b (worker Supabase removal). It completes the mechanical cleanup:

1. **@supabase/supabase-js removed from api-server package.json** — the last in-scope package still listing the dep after 01-04b cleaned worker.

2. **revocation.ts rewritten on Drizzle** — the only remaining Supabase import in `artifacts/api-server/src/`. `runRevocationSweep()` now takes a Drizzle `db` instance instead of `SupabaseClient`; uses `generationJobsTable` + Drizzle `eq`/`inArray`/`and` operators. The `writeAuditLog` Supabase insert was replaced with a structured pino log entry (no `audit_log` Drizzle table exists yet — see Deferred Items). `startRevocationWorker` no longer reads SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY env vars.

3. **revocation-sweep.test.ts converted to Vitest** — hand-rolled `run()` script converted to proper `describe/it/expect` suite with `vi.mock("@workspace/db")` and `vi.mock("drizzle-orm")` for Drizzle module isolation.

4. **apps/web/ deleted** — 27 files removed (D-08 decision: creator dashboard deferred; directory was untracked and not listed in pnpm-workspace.yaml so deletion has no workspace impact).

5. **pnpm-lock.yaml regenerated** — `pnpm install --frozen-lockfile=false` succeeds; `@supabase/supabase-js` no longer appears in api-server or worker dep trees.

6. **Replit Secrets cleanup checklist** written at `.planning/phases/01-baseline-repair/notes/replit-secrets-cleanup.md`.

7. **Cold-start verification record** written at `.planning/phases/01-baseline-repair/notes/cold-start-verification.md`.

## Verification Results

### Supabase Import Scan (PASS)
```
grep -r "@supabase/supabase-js" artifacts/api-server/src artifacts/hermes/src artifacts/worker/src
(zero results)
```

### Typecheck (PASS for in-scope artifacts)
- `pnpm run typecheck:libs` — **PASS** (exit 0)
- `@workspace/api-server` tsc — **PASS** (zero errors)
- `@workspace/worker` tsc — **PASS** (zero errors)
- `@workspace/hermes` tsc — **PASS** (zero errors)
- `@workspace/admin` tsc — **FAIL** (expected, deferred per CONTEXT.md)
- `@workspace/web` tsc — **FAIL** (pre-existing fan-dsar.tsx i18n key errors, out of scope)

### apps/web/ Deletion
```
test -d apps/web && echo "EXISTS" || echo "DELETED"
→ DELETED
```

### pnpm install
```
pnpm install --frozen-lockfile=false
→ Done in 11.7s (exit 0)
```

## Deviations from Plan

### Auto-approved Checkpoints

**Task 4 — Founder Replit Secrets Deletion:** Auto-approved as `deferred-local-run` per parallel execution instructions. The checklist at `notes/replit-secrets-cleanup.md` tracks the three keys to delete (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) before first production deploy.

### Rule 1 — Auto-fixed: revocation.ts Drizzle Rewrite

**Found during:** Task 1 (pre-work assessment)
**Issue:** `artifacts/api-server/src/workers/revocation.ts` still imported `SupabaseClient` from `@supabase/supabase-js`, but 01-04a/01-04b landing left it as the last Supabase file in api-server/src/. Removing the package dep without fixing the source would break the build.
**Fix:** Rewrote `runRevocationSweep` to accept `DrizzleDb` (typeof `db`); `writeAuditLog` replaced with structured pino log (no Drizzle `audit_log` table exists); `startRevocationWorker` no longer requires SUPABASE_* env vars.
**Files modified:** `artifacts/api-server/src/workers/revocation.ts`, `artifacts/api-server/src/__tests__/revocation-sweep.test.ts`

### Rule 3 — Auto-fixed: Worktree Base Reset

**Found during:** Initial setup
**Issue:** The worktree was cut from commit `ef4abc3` (pre-01-04a/01-04b), not from the `rio-de-janeiro` HEAD (`5e76859`) that contains all Wave-3 plan work. Without the reset, worker source would have still contained Supabase code and the plan's preconditions would be false.
**Fix:** Executed `git reset --hard 5e768594d2401135a3a1f60fc0880451417c55ac` as specified in the `<worktree_branch_check>` protocol.

### Deferred (Out of Scope)

**runtime cold-start probes (ports 8080/22333):** DATABASE_URL not available in worktree executor environment. Founder must run these manually at first deploy — procedure documented in `notes/cold-start-verification.md`.

**artifacts/admin typecheck failures:** Pre-existing, explicitly deferred per CONTEXT.md (Phase 2 backlog).

**artifacts/web fan-dsar.tsx i18n errors:** Pre-existing, not caused by Phase 1 changes. Logged to `notes/cold-start-verification.md` deferred items.

## Phase 2 Backlog (from This Plan)

The following items remain carrying Supabase or are incomplete as of Phase 1 close:

- [ ] **artifacts/admin** — still depends on `@supabase/supabase-js` (CONTEXT.md deferred; no timeline set)
- [ ] **`audit_log` Drizzle table** — `revocation.ts` now logs audit entries via pino only; a proper `audit_log` table (distinct from `safety_audit_log`) needs to be added to the Drizzle schema in Phase 2
- [ ] **`creator_assets`, `creator_onboarding`, `creator_content_embeddings` tables** — referenced in Supabase migrations but not yet in Drizzle schema (deferred per 01-04a SUMMARY)
- [ ] **Replit Secrets panel cleanup** — founder must delete SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY before first production deploy (checklist at `notes/replit-secrets-cleanup.md`)
- [ ] **Runtime cold-start verification** — ports 8080 + 22333 must be verified at deploy time (procedure in `notes/cold-start-verification.md`)

## Task 4 Checkpoint Status

**Type:** checkpoint:human-verify (auto-approved as deferred-local-run)
**Signal:** `deferred-local-run` — Phase 1 is being executed from a local dev environment / parallel worktree without a live Replit deploy. The Replit Secrets cleanup is tracked and ready for founder action at deploy time.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (supabase removal + apps/web deletion) | `42f5138` | chore(01-04c): scrub @supabase/supabase-js from api-server; rewrite revocation.ts on Drizzle; delete apps/web/ |
| 2+3+4 (planning notes) | `fbeb8fa` | docs(01-04c): add Replit Secrets cleanup checklist and cold-start verification record |

## Self-Check: PASSED

- [x] `artifacts/api-server/src/workers/revocation.ts` — zero Supabase imports
- [x] `artifacts/api-server/src/__tests__/revocation-sweep.test.ts` — converted to Vitest, zero Supabase references
- [x] `artifacts/api-server/package.json` — @supabase/supabase-js removed
- [x] `artifacts/worker/package.json` — already clean (01-04b)
- [x] `apps/web/` — deleted (confirmed via `test -d apps/web`)
- [x] `pnpm-lock.yaml` — regenerated (pnpm install exit 0)
- [x] Typecheck: api-server, worker, hermes PASS
- [x] `notes/replit-secrets-cleanup.md` — exists with all three SUPABASE_* keys + DATABASE_URL_DIRECT note
- [x] `notes/cold-start-verification.md` — exists with port 8080 + 22333 entries (deferred)
- [x] Commits `42f5138` and `fbeb8fa` exist in git log
