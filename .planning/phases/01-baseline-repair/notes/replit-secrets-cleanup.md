# Replit Secrets Cleanup — Post-Deploy Checklist

**Context:** Phase 1 (baseline-repair) removed all Supabase client code from api-server, hermes, and
worker. The `.env.example` file was scrubbed in Plan 01-01 Task 0 (per D-11 env-vars-first ordering).
The live Replit Secrets panel must be manually cleaned after the first production deploy — there is no
Replit API for secret deletion, so this step requires founder action in the Replit dashboard.

## Why This Exists (D-11)

D-11 mandates removing Supabase env vars from `.env.example` first (completed in Plan 01-01 Task 0),
then deleting the live Replit Secrets as the final Phase 1 gate — because the live-secret deletion
requires a running Replit deployment to verify. Deleting secrets before the code is deployed would
break the running instance.

## Keys to Delete from Replit Secrets Panel

Open the Replit project → Secrets panel → delete the following three keys:

- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`

**None of these keys are referenced by any in-scope artifact after Phase 1:**
- `artifacts/api-server` — all Supabase imports removed (01-04a + 01-04c)
- `artifacts/hermes` — all Supabase imports removed (01-03)
- `artifacts/worker` — all Supabase imports removed (01-04b)
- `artifacts/admin` — DEFERRED: still uses `@supabase/supabase-js` (Phase 2 backlog)

If you have not yet deployed Phase 1 code, do NOT delete these keys yet — the running Replit instance
may still reference them. Deploy first, verify cold-start, then delete.

## Additional Note: DATABASE_URL vs DATABASE_URL_DIRECT

**Pitfall #6 (from RESEARCH.md):** Replit PostgreSQL may provision a pooled connection string as
`DATABASE_URL`. Drizzle's `drizzle-kit push` and some migration workflows require a direct (non-pooled)
connection. If schema push or migrations fail with connection-related errors after deploy:

- Check if Replit has provisioned a separate `DATABASE_URL_DIRECT` secret (direct connection, no PgBouncer).
- Set `DATABASE_URL_DIRECT` to the direct connection string and update `drizzle.config.ts` to use it
  for `push` operations.
- The `artifacts/api-server` runtime uses `DATABASE_URL` (pooled is fine for queries).

## Verification Steps After Deleting Secrets

1. Trigger a Repl restart from the Replit dashboard.
2. Wait for api-server to boot (check the console for startup logs).
3. Confirm api-server boots without any "missing SUPABASE_* env var" crash.
4. Run: `curl -fsS https://<your-repl>.replit.app/api/health`
   - Expected: `{"status":"ok"}` with HTTP 200
5. If any artifact crashes on restart, check for any remaining Supabase import with:
   `grep -r "@supabase/supabase-js" artifacts/api-server/src artifacts/hermes/src artifacts/worker/src`
   (should return zero results after Phase 1).

## Status

- [ ] Phase 1 code deployed to Replit
- [ ] SUPABASE_URL deleted from Replit Secrets
- [ ] SUPABASE_ANON_KEY deleted from Replit Secrets
- [ ] SUPABASE_SERVICE_ROLE_KEY deleted from Replit Secrets
- [ ] api-server cold-start verified: HTTP 200 on /api/health
- [ ] Founder sign-off: __________ Date: __________

_This checklist is tracked in `.planning/phases/01-baseline-repair/01-04c-SUMMARY.md` as Task 4 (auto-approved with status "deferred-local-run" per parallel execution instructions)._
