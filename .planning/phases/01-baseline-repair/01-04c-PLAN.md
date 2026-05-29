---
phase: 01-baseline-repair
plan: 04c
type: execute
wave: 4
depends_on: [01-04a, 01-04b]
files_modified:
  - artifacts/api-server/package.json
  - artifacts/worker/package.json
  - apps/web
  - .planning/phases/01-baseline-repair/notes/replit-secrets-cleanup.md
  - .planning/phases/01-baseline-repair/notes/cold-start-verification.md
autonomous: false
requirements: [INFRA-01, INFRA-02]
must_haves:
  truths:
    - "apps/web/ directory is removed from the working tree (D-08)"
    - "@supabase/supabase-js dependency is removed from api-server, worker package.json (hermes was done in Plan 03; admin deferred per CONTEXT.md)"
    - "pnpm run typecheck:libs exits 0 across the entire workspace except artifacts/admin (deferred)"
    - "All three Replit ports (8080 api-server, 22333 artifacts/web, 3001 admin) still appear in artifact.toml and the cold-start of api-server + artifacts/web does not require SUPABASE_* envs"
    - "Founder has a tracked checklist for deleting SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY from the Replit Secrets panel"
    - "Founder has confirmed (or explicitly deferred for a local-only run) the live Replit Secrets cleanup"
  artifacts:
    - path: ".planning/phases/01-baseline-repair/notes/replit-secrets-cleanup.md"
      provides: "Founder-facing checklist of Replit Secrets keys to delete post-deploy"
    - path: ".planning/phases/01-baseline-repair/notes/cold-start-verification.md"
      provides: "Recorded outputs of typecheck + cold-start probes on ports 8080/22333"
  key_links:
    - from: "deleted apps/web/"
      to: "pnpm-workspace.yaml"
      via: "no entry — workspace already excludes apps/"
      pattern: "apps/web does not exist"
    - from: "scrubbed package.json files"
      to: "pnpm-lock.yaml"
      via: "pnpm install regenerates lockfile without @supabase/supabase-js"
      pattern: "no supabase-js in api-server/worker dep trees"
---

<objective>
Close out Phase 1: scrub the `@supabase/supabase-js` dependency from api-server and worker package.json, delete apps/web/, document the Replit Secrets cleanup checklist, run full-workspace typecheck + cold-start smoke probes on ports 8080 and 22333, and gate Phase 1 completion behind a founder checkpoint that confirms the SUPABASE_* keys are deleted from the live Replit Secrets panel.

Purpose: This is the final Wave-4 plan in Phase 1, sequenced after the parallel Wave-3 plans 01-04a (api-server leaf routes) and 01-04b (worker migration) both land. Together with 01-01, 01-02, 01-03, 01-04a, and 01-04b, this plan completes ROADMAP.md Phase 1 success criteria 1-5 and demonstrates INFRA-01 + INFRA-02 + INFRA-04 are live.

This plan was split out of an original 01-04 that bundled 7 tasks across 37 files into a single plan. The cleanup + verification + founder checkpoint are now isolated in this Wave-4 plan with a clean dependency edge on the two Wave-3 source-level migrations.

Output: Supabase dependency scrubbed from api-server/worker; apps/web/ deleted; lockfile regenerated; full-workspace typecheck + build smoke pass (minus deferred admin); cold-start probes recorded; Replit Secrets cleanup checklist written; founder has signed off on the live Secrets deletion (or explicitly deferred for a local-only run).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/01-baseline-repair/01-CONTEXT.md
@.planning/phases/01-baseline-repair/01-RESEARCH.md
@.planning/phases/01-baseline-repair/01-PATTERNS.md
@.planning/phases/01-baseline-repair/01-01-SUMMARY.md
@.planning/phases/01-baseline-repair/01-02-SUMMARY.md
@.planning/phases/01-baseline-repair/01-03-SUMMARY.md
@.planning/phases/01-baseline-repair/01-04a-SUMMARY.md
@.planning/phases/01-baseline-repair/01-04b-SUMMARY.md
@artifacts/api-server/package.json
@artifacts/worker/package.json
@artifacts/admin/package.json
@pnpm-workspace.yaml
@artifact.toml

<interfaces>
<!-- Post-Wave-3 state (both 01-04a and 01-04b landed): -->
- artifacts/api-server: source is Supabase-free (no imports), but package.json still lists @supabase/supabase-js dep
- artifacts/worker: source is Supabase-free (no imports), but package.json still lists @supabase/supabase-js dep
- artifacts/hermes: package.json already scrubbed in Plan 01-03
- artifacts/admin: STILL has @supabase/supabase-js — explicitly DEFERRED per CONTEXT.md; do not touch
- apps/web/ directory exists with untracked files; not listed in pnpm-workspace.yaml so deletion has no workspace impact
- .env.example: SUPABASE_* keys already removed in Plan 01-01 Task 0 (env-vars-first per D-11)

<!-- Replit deploy state (the founder's runtime concern): -->
- Replit Secrets panel STILL carries SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY from prior phases; founder must delete via the dashboard (no API)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scrub @supabase/supabase-js from api-server + worker package.json; update lockfile; delete apps/web/</name>
  <files>artifacts/api-server/package.json, artifacts/worker/package.json, apps/web</files>
  <read_first>
    - artifacts/api-server/package.json (find @supabase/supabase-js entry under dependencies; identify its current version pin)
    - artifacts/worker/package.json (same)
    - artifacts/admin/package.json (CONFIRM the admin still keeps @supabase/supabase-js — admin migration is DEFERRED per CONTEXT.md)
    - pnpm-workspace.yaml (confirm apps/ is NOT listed in packages so deletion has no workspace impact)
    - apps/web/ (ls -la to confirm the directory exists and capture untracked files: src/app/api/continue-token/, src/components/open-in-browser-sheet.tsx, src/lib/webview/)
  </read_first>
  <action>Step 1: Remove the line `"@supabase/supabase-js": "^2.106.1"` (or whatever version pin is present) from `dependencies` in artifacts/api-server/package.json and artifacts/worker/package.json. Do NOT touch artifacts/admin/package.json or artifacts/hermes/package.json (hermes already done in Plan 03). Step 2: Run `pnpm install --frozen-lockfile=false` from the repo root to update pnpm-lock.yaml. Step 3: Verify with `pnpm ls @supabase/supabase-js -r 2>&1` that only artifacts/admin still depends on it. Step 4: Delete apps/web/ directory entirely via `rm -rf apps/web`. Step 5: Confirm pnpm-workspace.yaml still does NOT mention apps/web and that `pnpm install --frozen-lockfile=false` runs clean post-deletion.</action>
  <acceptance_criteria>
    - `grep -E 'supabase-js' artifacts/api-server/package.json artifacts/worker/package.json` returns nothing
    - `grep -E 'supabase-js' artifacts/admin/package.json` STILL returns a match (admin deferred — D-deferred from CONTEXT.md)
    - `test -d apps/web` exits non-zero (directory removed)
    - `pnpm ls @supabase/supabase-js -r 2>&1 | grep -E 'api-server|worker|hermes'` returns nothing
    - `pnpm install --frozen-lockfile=false` exits 0
  </acceptance_criteria>
  <verify>
    <automated>! grep -qE 'supabase-js' artifacts/api-server/package.json && ! grep -qE 'supabase-js' artifacts/worker/package.json && grep -qE 'supabase-js' artifacts/admin/package.json && ! test -d apps/web && pnpm install --frozen-lockfile=false && ! pnpm ls @supabase/supabase-js -r 2>&1 | grep -qE '(api-server|worker|hermes)\s'</automated>
  </verify>
  <done>@supabase/supabase-js gone from api-server/worker/hermes; admin retains it (deferred); apps/web/ deleted; lockfile updated.</done>
</task>

<task type="auto">
  <name>Task 2: Document Replit Secrets cleanup checklist (founder-facing note — .env.example was already scrubbed in Plan 01-01 Task 0)</name>
  <files>.planning/phases/01-baseline-repair/notes/replit-secrets-cleanup.md</files>
  <read_first>
    - .env.example (confirm Plan 01-01 Task 0 already removed SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY — this task does NOT modify .env.example)
    - .planning/phases/01-baseline-repair/01-CONTEXT.md decision D-11 (env-vars-first removal order)
    - .planning/phases/01-baseline-repair/01-RESEARCH.md "Runtime State Inventory" (Secrets/env vars row)
  </read_first>
  <action>Create a developer-facing note at `.planning/phases/01-baseline-repair/notes/replit-secrets-cleanup.md`. The note lists the exact Replit Secrets keys the founder must delete from the Replit panel after deploy: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. The note also documents that `DATABASE_URL_DIRECT` may be required if `DATABASE_URL` is pooled (Pitfall #6). Include a short paragraph linking back to D-11 explaining why `.env.example` was scrubbed in Plan 01-01 Task 0 (env-vars-first) and the live-secret deletion happens here (live deploy is required). Do NOT modify .env.example — it was already cleaned in Plan 01-01.</action>
  <acceptance_criteria>
    - `.planning/phases/01-baseline-repair/notes/replit-secrets-cleanup.md` exists
    - The note contains all three Supabase secret keys (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
    - The note references `DATABASE_URL_DIRECT` (Pitfall #6)
    - `.env.example` is NOT modified in this task (was already scrubbed in Plan 01-01 Task 0)
  </acceptance_criteria>
  <verify>
    <automated>test -f .planning/phases/01-baseline-repair/notes/replit-secrets-cleanup.md && grep -q 'SUPABASE_URL' .planning/phases/01-baseline-repair/notes/replit-secrets-cleanup.md && grep -q 'SUPABASE_SERVICE_ROLE_KEY' .planning/phases/01-baseline-repair/notes/replit-secrets-cleanup.md && grep -q 'SUPABASE_ANON_KEY' .planning/phases/01-baseline-repair/notes/replit-secrets-cleanup.md && grep -q 'DATABASE_URL_DIRECT' .planning/phases/01-baseline-repair/notes/replit-secrets-cleanup.md && ! grep -qE '^SUPABASE_(URL|ANON_KEY|SERVICE_ROLE_KEY)=' .env.example</automated>
  </verify>
  <done>Founder has a tracked checklist for deleting the matching Replit Secrets at the live-deploy step (Task 4); .env.example remains Supabase-free per Plan 01-01 Task 0.</done>
</task>

<task type="auto">
  <name>Task 3: Full-workspace typecheck + build smoke; cold-start health probes for ports 8080, 22333, 3001 (admin allowed to fail)</name>
  <files>.planning/phases/01-baseline-repair/notes/cold-start-verification.md</files>
  <read_first>
    - artifact.toml (confirm three ports 8080, 22333, 3001 mapped)
    - artifacts/api-server/src/routes/health.ts (now Drizzle-backed per Plan 02)
    - .planning/phases/01-baseline-repair/01-RESEARCH.md "Port Healthcheck Verification (INFRA-01)"
  </read_first>
  <action>Run `pnpm run typecheck:libs` from the repo root and confirm it exits 0. Run `pnpm run typecheck` from the repo root and capture failures — artifacts/admin failures are EXPECTED (deferred); any other failure is a stop-the-line bug. Run `pnpm run build` and treat the same exception. Start api-server in the background (`pnpm --filter @workspace/api-server run dev &`), wait 5 seconds, then `curl -fsS http://localhost:8080/api/health` — expect `{"status":"ok"}`. Start artifacts/web (`pnpm --filter @workspace/web run dev &`), wait 5 seconds, then `curl -fsS http://localhost:22333` — expect HTML 200. Do NOT start artifacts/admin (it is intentionally broken in Phase 1). Kill background processes. Record results in `.planning/phases/01-baseline-repair/notes/cold-start-verification.md`: ports tested, response codes, response excerpts, list of artifacts/admin errors observed (for Phase 2 backlog).</action>
  <acceptance_criteria>
    - `pnpm run typecheck:libs` exits 0
    - `pnpm run typecheck` succeeds for @workspace/api-server, @workspace/hermes, @workspace/worker, @workspace/web, @workspace/db (admin failure is acceptable and noted)
    - api-server `GET /api/health` returns HTTP 200 with `"status":"ok"` body
    - artifacts/web returns HTTP 200 (HTML) on port 22333
    - `.planning/phases/01-baseline-repair/notes/cold-start-verification.md` exists with port test outputs
  </acceptance_criteria>
  <verify>
    <automated>pnpm run typecheck:libs && test -f .planning/phases/01-baseline-repair/notes/cold-start-verification.md && grep -q '8080' .planning/phases/01-baseline-repair/notes/cold-start-verification.md && grep -q '22333' .planning/phases/01-baseline-repair/notes/cold-start-verification.md</automated>
  </verify>
  <done>Typecheck and build pass across all non-deferred packages; api-server and artifacts/web cold-start cleanly on their assigned ports without Supabase env vars; verification record committed.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: [BLOCKING] Founder deletes SUPABASE_* keys from Replit Secrets panel</name>
  <what-built>.env.example was scrubbed in Plan 01-01 Task 0 (env-vars-first per D-11). The runtime Replit Secrets panel still carries the values from prior phases. Per D-11 and the RESEARCH.md "Runtime State Inventory" section, the founder must delete these secrets manually — there is no Replit API for secret deletion that we have credentials for.</what-built>
  <how-to-verify>
    1. Open the Replit project Secrets panel for this Repl.
    2. Delete the three keys: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
    3. Trigger a Repl restart and observe that api-server boots without error (no missing-env crash).
    4. Run `curl -fsS https://<your-repl>.replit.app/api/health` from outside the Repl and confirm HTTP 200.
    5. Reply with: `approved — secrets deleted, cold start passed` and paste the curl output.
  </how-to-verify>
  <files>(no repo files modified — Replit Secrets panel configuration; reuses `.planning/phases/01-baseline-repair/notes/replit-secrets-cleanup.md` from Task 2)</files>
  <action>This is a manual founder action: open the Replit project Secrets panel, delete the three keys SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY, restart the Repl, and curl the deployed /api/health endpoint to confirm api-server boots cleanly without the Supabase secrets. Reply with the curl output and the approval signal. If Phase 1 is being run locally (no Replit deploy yet), reply with the `not-applicable` variant — the cleanup-note file already records the action for the eventual deploy.</action>
  <verify>
    <automated>echo "Awaiting founder approval: SUPABASE_* keys removed from Replit Secrets AND /api/health returns 200 on restart"</automated>
  </verify>
  <done>Founder has confirmed Replit Secrets cleanup (or explicitly recorded the deferral for a local-only run); api-server cold-starts cleanly without Supabase env vars.</done>
  <resume-signal>Reply `approved — secrets deleted, cold start passed` to mark Phase 1 done. Reply `not-applicable: local-only run` to record that Phase 1 is being driven from a local dev environment without a Replit deploy; in that case the cleanup is deferred but `.planning/phases/01-baseline-repair/notes/replit-secrets-cleanup.md` from Task 2 remains the founder tracked TODO.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Replit Secrets panel -> all artifacts at boot | Stale SUPABASE_* secrets are dead weight but not a security risk on their own; leaving them encourages future drift |
| apps/web/ deletion -> rest of monorepo | Removing a directory could break a cross-artifact import or workspace resolution; mitigated by pre-deletion grep + post-deletion pnpm install |
| package.json edits -> pnpm-lock.yaml | Removing a dep regenerates the lockfile; if a transitive dep silently depended on it we'd see the lockfile resolution fail |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04c-01 | Tampering | apps/web/ deletion accidentally removes a file referenced by another artifact | mitigate | Task 1 reads pnpm-workspace.yaml to confirm apps/* is excluded; RESEARCH.md "apps/web/ Deletion" already confirmed no cross-artifact import; `pnpm install --frozen-lockfile=false` after deletion catches any residual reference via lockfile resolution failure |
| T-04c-02 | Repudiation | SUPABASE_* secrets left in Replit panel after migration, allowing a rogue code path to silently rebind to old DB | mitigate | Task 4 founder checkpoint deletes the three secrets; the cleanup-note artifact (Task 2) records the action so audit trail exists; .env.example was already cleaned in Plan 01-01 Task 0 |
| T-04c-03 | Denial of Service | Removing @supabase/supabase-js from package.json triggers a transitive resolution failure | mitigate | Task 1 runs `pnpm install --frozen-lockfile=false` immediately after the package.json edits and surfaces any failure as a stop-the-line bug |
| T-04c-04 | Information Disclosure | cold-start-verification.md captures verbose api-server logs that may leak DB connection strings | mitigate | Task 3 action records only port + status codes + response excerpts (not full logs); the note is committed to the planning directory which already excludes secrets via .gitignore for env files |
| T-04c-SC | Tampering | npm/pnpm installs | mitigate | Only changes are REMOVALS of @supabase/supabase-js from api-server and worker; no new packages installed; pnpm catalog discipline preserved; `minimumReleaseAge: 1440` workspace setting still in effect |
</threat_model>

<verification>
- `pnpm run typecheck:libs` exits 0
- `pnpm run typecheck` succeeds for all packages except @workspace/admin (deferred per CONTEXT.md)
- apps/web/ does NOT exist (deleted in Task 1)
- artifacts/api-server, hermes, worker package.json contain zero @supabase/supabase-js entries
- artifacts/admin still has @supabase/supabase-js (deferred)
- .env.example has zero SUPABASE_* keys (Plan 01-01 Task 0 deliverable; re-verified by Task 2)
- api-server `GET /api/health` returns 200 on cold start with no Supabase env vars set
- artifacts/web returns 200 on port 22333 on cold start
- Founder Replit Secrets cleanup tracked in notes/replit-secrets-cleanup.md (Task 2) and confirmed in Task 4
</verification>

<success_criteria>
Phase 1 is closed: the platform cold-starts on Replit PostgreSQL with zero Supabase client imports across api-server, hermes, and worker; the @supabase/supabase-js dependency is gone from all in-scope package.json files; apps/web/ is deleted; the founder has either deleted the SUPABASE_* keys from the Replit Secrets panel or explicitly deferred the action for a local-only run; ports 8080 and 22333 respond healthy without SUPABASE_* env vars. ROADMAP.md Phase 1 success criteria 1-5 are all demonstrable.
</success_criteria>

<output>
Create `.planning/phases/01-baseline-repair/01-04c-SUMMARY.md` when done. The summary MUST enumerate, as a checklist for Phase 2 backlog:
  - The deferred items still carrying Supabase: artifacts/admin/ (per CONTEXT.md deferred) and creator_assets/creator_onboarding/creator_content_embeddings tables not yet in Drizzle schema
  - The founder Replit Secrets deletion status (approved | deferred-for-local-only)
  - The cold-start verification results (port 8080 + port 22333 status codes + admin failure mode)
</output>
</content>
</invoke>