---
phase: 1
phase_name: "Baseline Repair"
project: "lala.la"
generated: "2026-05-29"
counts:
  decisions: 14
  lessons: 10
  patterns: 9
  surprises: 7
missing_artifacts: []
---

# Phase 1 Learnings: Baseline Repair

## Decisions

### Env-vars-first Supabase removal order (D-11)
Scrub `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from `.env.example` BEFORE any code migration begins. Subsequent code that still references `process.env.SUPABASE_URL` then surfaces as a runtime regression instead of a silent fallback during Wave 2.

**Rationale:** Removing env vars first surfaces hidden Supabase deps as immediate startup errors; code-first removal leaves dormant Supabase paths that could rebind silently if env vars are still present.
**Source:** 01-CONTEXT.md

### Collapse KYC status to a 3-value enum: pending | signed | rejected (D-05)
Replaced the legacy 8-state enum (`id_submitted`, `id_verified`, `signing_initiated`, `rights_signed`, `tax_submitted`, `ops_approved`, `complete`, `rejected`). The gate is a strict positive assertion: `status === 'signed'`; null/pending/rejected/missing-row all return HTTP 423.

**Rationale:** The legacy enum implied an ops-approval workflow that doesn't exist at N=1. The new shape matches what the gate actually checks (personality rights signed) and forecloses null-bypass class of bugs (Pitfall #4).
**Source:** 01-CONTEXT.md, 01-02-SUMMARY.md

### Rename `isKycComplete()` → `isKycSigned()` (D-06)
Function rename to match the new DB enum semantic. Strict predicate: `row?.status === "signed"` — null returns false.

**Rationale:** "Complete" implied multi-stage onboarding; "signed" matches what the column means after collapse.
**Source:** 01-CONTEXT.md, 01-02-SUMMARY.md

### `safety_audit_log` is hash-only — never store raw fan_id or message text (D-02, COMPLY-03)
Schema has `fanIdHash` and `messageHash` columns; no `fan_id`, `message_text`, or `content` column exists. Drizzle schema enforces this absence at the column level; verification queries confirm zero rows in `information_schema.columns` for those names.

**Rationale:** Data-minimization mandate baked into the schema instead of relying on application-layer discipline.
**Source:** 01-01-PLAN.md, 01-04a-SUMMARY.md

### `retention_category` column on every fan-touching table (D-14)
All four fan-interaction tables (`consent_grants`, `conversation_messages`, `generation_jobs`, `safety_audit_log`) carry a `retentionCategoryEnum('operational','transcript','audit')` column NOT NULL. The cleanup cron is Phase 4 work; the column ships in Phase 1.

**Rationale:** Adding the column later requires a migration on populated tables. Ship the schema shape now so Phase 4's TTL cron can operate without a follow-up schema change.
**Source:** 01-CONTEXT.md, 01-01-SUMMARY.md

### `generation_jobs.consent_grant_id` is a FK to consent_grants (D-04)
Every async job references the consent grant that authorized it.

**Rationale:** Required for the consent-revocation sweep in Phase 2 — when a creator revokes a modality, the sweep can join jobs to revoked grants and cancel/delete in one query.
**Source:** 01-01-PLAN.md, 01-01-SUMMARY.md

### `conversation_messages.content` stored as plaintext (not encrypted, not hashed) (D-03)
Stores plaintext with `retention_category='transcript'` and a planned 90-day TTL (cleanup cron in Phase 4). Considered AES-256-GCM encryption and hash-only alternatives.

**Rationale:** Encryption would complicate LLM context loading; hash-only would prevent context replay entirely. Plaintext + defined retention satisfies COMPLY-03's data-minimization standard.
**Source:** 01-CONTEXT.md, 01-DISCUSSION-LOG.md

### Delete `apps/web/` entirely in Phase 1 (D-08)
The directory carried untracked early creator-dashboard work (continue-token API, open-in-browser-sheet, webview lib) and was not listed in `pnpm-workspace.yaml`. Deleted clean-slate; creator dashboard will be rebuilt later. (Note: deletion actually failed in Plan 01-04c — see Surprise on apps/web.)

**Rationale:** North-star Week 1 plan explicitly calls for the deletion; preserving partial work creates drift against the clean baseline.
**Source:** 01-CONTEXT.md, 01-04c-PLAN.md

### Hermes uses `@workspace/db` (single Drizzle source of truth), not its own Drizzle instance (D-09)
Hermes adds `@workspace/db` as a `workspace:*` dependency and removes `@supabase/supabase-js`. A separate Drizzle instance in Hermes would duplicate the schema.

**Rationale:** Single schema source eliminates drift risk between api-server and bot. Shared-lib pattern was already established for `lib/queue`.
**Source:** 01-CONTEXT.md, 01-03-SUMMARY.md

### Delete Hermes fan-payment functions outright (D-10)
`blockFan`, `listFansForCreator`, `isFanBlocked`, and the fan-count branch of `getCreatorStats` are removed from `hermes/src/db.ts`. They referenced fan-payment tables that are permanently out of scope.

**Rationale:** Stubbing them would invite reintroduction; deletion + documentation in CONTEXT.md requires explicit re-planning to bring them back.
**Source:** 01-CONTEXT.md, 01-03-PLAN.md

### BullMQ worker bodies are stubs in Phase 1 — only the boot path and Drizzle status writes are real (D-13)
All six BullMQ workers (textGeneration, voiceGeneration, videoGeneration, moderation, consentRevocation, dunningRetry) have stub bodies that log + write `status='complete'` via Drizzle. The Worker/QueueEvents lifecycle scaffolding (concurrency, retry, graceful shutdown, REDIS_URL no-op) is preserved verbatim.

**Rationale:** Production fills depend on GMI XTTS (Phase 3, endpoint URL unconfirmed) and the moderation pipeline (Phase 2). Phase 1's contract is the boot path + DB layer + queue scaffolding, not the work.
**Source:** 01-CONTEXT.md, 01-04b-SUMMARY.md

### `DATABASE_URL_DIRECT` preferred over `DATABASE_URL` for drizzle-kit DDL (Pitfall #6 mitigation)
`drizzle.config.ts` reads `process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL` and emits a stderr warning when the resolved URL contains `pgbouncer` or `:6543`.

**Rationale:** drizzle-kit push on a pooled (PgBouncer) connection breaks DDL transactions; pushing against the direct URL is the safe path.
**Source:** 01-01-SUMMARY.md, 01-01-PLAN.md

### Cookie helpers (`COOKIE_ACCESS_TOKEN`, `sessionCookieOptions`) relocated from `lib/supabase.ts` to `lib/auth.ts`; literal value kept as `"sb-access-token"` for Phase 1
The Supabase utility file is deleted; the cookie helpers move to `auth.ts`. The cookie name string is left as `"sb-access-token"` (rename deferred to Phase 2) to avoid breaking any existing fan-side sessions.

**Rationale:** Delete the file, not the auth contract — renaming the cookie would invalidate existing sessions and require coordinated fan-side updates.
**Source:** 01-04a-PLAN.md, 01-04a-SUMMARY.md

### Out-of-Phase-1-schema leaf routes are stubbed to `503 { code: "PHASE_1_STUB" }`, not deleted
12 api-server route files (`account.ts`, `assets.ts`, `auth.ts`, `credits.ts`, `dsar.ts`, `email-webhooks.ts`, `fan-recovery.ts`, `links.ts`, `onboarding.ts`, `payments.ts`, `reports.ts`, `subscriptions.ts`) keep their Router/path/middleware definitions but their handler bodies return a deterministic 503 with a `PHASE-1 STUB:` comment.

**Rationale:** Preserves the import graph so api-server still mounts and cold-starts cleanly; deterministic 503 is safer than silent partial behavior and gives a clean Phase 2 backlog.
**Source:** 01-04a-PLAN.md, 01-04a-SUMMARY.md

---

## Lessons

### `lib/db/src/index.ts` throws at module load time if `DATABASE_URL` is absent — breaks vitest collection for any test that statically imports `@workspace/db`
Vitest collects modules before `beforeAll` can guard for DATABASE_URL. Static `import { db } from "@workspace/db"` at the top of any route file caused the entire test file to fail collection in environments where DATABASE_URL was unset.

**Context:** Discovered during Plan 01-02 Tasks 1 and 2; fix was to convert route-level DB imports to lazy `async function getDb() { const { db } = await import("@workspace/db"); ... }` for `kyc.ts`, `twin.ts`, `health.ts`, and `lib/kyc.ts`.
**Source:** 01-02-SUMMARY.md

### Express 5 rejects inline regex in route params
`router.get("/:handle([a-z0-9_.-]{2,40})", ...)` throws `TypeError: Unexpected ( at index 8: /:handle([a-z0-9_.-]{2,40})` on boot. The route param must be plain (`/:handle`) with validation moved into the handler.

**Context:** Found in `routes/links.ts` during Plan 01-02 Task 0 server startup.
**Source:** 01-02-SUMMARY.md

### Express 5 typing widens `req.params.x` to `string | string[]`
Direct passing of `req.params.creatorId` into `eq(col, ...)` (which expects `string`) fails strict typecheck. Cast at the access site: `String(req.params["creatorId"])`.

**Context:** Hit in `routes/kyc.ts` during Plan 01-02 Task 2 typecheck; also in `routes/consent.ts` during Plan 01-04a Task 1b.
**Source:** 01-02-SUMMARY.md, 01-04a-SUMMARY.md

### `@workspace/db` does not re-export drizzle-orm operators — Hermes (and worker) need a direct `drizzle-orm` dep
`eq`, `and`, `inArray` must be imported from `drizzle-orm` directly; adding `@workspace/db` alone leaves `eq()` unresolvable in callers.

**Context:** Surfaced during Plan 01-03 Task 1 verification; fix was to add `"drizzle-orm": "catalog:"` to `artifacts/hermes/package.json` (and later worker).
**Source:** 01-03-SUMMARY.md, 01-04b-SUMMARY.md

### Worker had a latent enum-value bug: `status: "done"` was never a valid `generationJobStatusEnum` value
Original `artifacts/worker/src/index.ts` wrote `status: "done"` in multiple places. The schema enum only accepts `"queued" | "processing" | "complete" | "failed" | "cancelled" | "dlq"`. Would have caused a runtime constraint violation as soon as a job hit the line.

**Context:** Caught during Plan 01-04b Task 1 migration; fixed by changing all occurrences to `"complete"`.
**Source:** 01-04b-SUMMARY.md

### Worker `index.ts` was missing an actual `QueueEvents` instance despite plan context describing one
The pre-migration file referenced QueueEvents in comments and graceful-shutdown code but never instantiated one. Added `new QueueEvents(QUEUE_NAME, { connection: { url: REDIS_URL } })` and a corresponding `await queueEvents.close()` in shutdown during the migration.

**Context:** Found while reviewing the index.ts Worker config in Plan 01-04b Task 1.
**Source:** 01-04b-SUMMARY.md

### Plan 01-04c's worktree was cut from a pre-Wave-3 commit, so its preconditions were false until reset
The worktree base was `ef4abc3` (pre-01-04a/01-04b) instead of `rio-de-janeiro` HEAD (`5e76859`) which contained the Wave-3 work. Without `git reset --hard 5e76859...`, worker source still contained Supabase code and the plan's "Supabase already removed from sources" precondition failed.

**Context:** Discovered during Plan 01-04c initial setup; protocol's `<worktree_branch_check>` triggered the reset.
**Source:** 01-04c-SUMMARY.md

### `apps/web/` was untracked, so the original repo cleanup hooks never removed it — the directory survived Plan 01-04c
Despite Plan 01-04c Task 1 calling for `rm -rf apps/web`, the verification report (01-VERIFICATION.md) marked the truth FAILED: the directory still existed in the working tree as untracked files. The 01-04c SUMMARY claimed deletion (27 files removed) but the live workspace state contradicted it.

**Context:** Verification gap — committed deletion in the worktree did not propagate to the host working tree, and re-verification found the directory still present.
**Source:** 01-VERIFICATION.md, 01-04c-SUMMARY.md

### KYC gate has a semantic bypass: `if (handle) { ...gate... }` lets handleless requests skip enforcement
The E2E test in Plan 01-02 always sends a `handle`, so the test passed and the gate was marked PASS. Verification (01-VERIFICATION.md) later found the gate is wrapped in `if (handle)` — a `POST /api/twin/chat` with no `handle` field bypasses the gate entirely and returns a canned 200.

**Context:** Surfaced only during retrospective verification, after the plan summary self-checks all reported PASS. Tests pinned the happy path but not the bypass.
**Source:** 01-VERIFICATION.md

### `audit_log` is a distinct table from `safety_audit_log` and was not added to the Phase 1 Drizzle schema
`revocation.ts`'s pre-migration code wrote to an `audit_log` Supabase table. The Phase 1 schema only includes `safety_audit_log`. Plan 01-04c could not port the write — instead it replaced it with a structured pino log entry and added "Drizzle audit_log table" to the Phase 2 backlog.

**Context:** Found during the 01-04c revocation.ts rewrite, which was itself a surprise (see Surprises).
**Source:** 01-04c-SUMMARY.md

---

## Patterns

### Lazy `getDb()` dynamic import in routes that may run in test environments
```ts
async function getDb() {
  const { db } = await import("@workspace/db");
  return db;
}
```
Avoids `lib/db/src/index.ts`'s top-level DATABASE_URL throw at vitest module-collection time. Applied across `kyc.ts`, `twin.ts`, `health.ts`, `lib/kyc.ts` in Plan 01-02.

**When to use:** Any api-server file imported by a test runner that may not have DATABASE_URL set in CI. Prefer over hoisting DATABASE_URL into the test runner config.
**Source:** 01-02-SUMMARY.md

### Kill-switch SLA elapsed-ms logging (preserve verbatim across DB-layer migrations)
```ts
const t0 = Date.now();
await db.update(creatorConfigTable).set({ paused, updatedAt: new Date() })
  .where(eq(creatorConfigTable.creatorId, creatorId));
const elapsed = Date.now() - t0;
console.log(`[hermes] kill-switch creator_id=${creatorId} paused=${paused} db_write_ms=${elapsed}`);
if (elapsed > 4000) console.error(`[hermes] WARN kill-switch db write took ${elapsed}ms — approaching 5s SLA`);
return { elapsed };
```

**When to use:** Any latency-sensitive write where ONBOARD-02 / a 5s SLA matters. Carried over verbatim through the Supabase→Drizzle rewrite. Verification greps `db_write_ms=` and `approaching` to confirm preservation.
**Source:** 01-03-PLAN.md, 01-03-SUMMARY.md

### `onConflictDoUpdate` upsert keyed on the natural PK
Used for `setTimezone`, `setHermesLanguage`, `saveTotpEnabled` — `db.insert(table).values(...).onConflictDoUpdate({ target: table.creatorId, set: { ..., updatedAt: new Date() } })`. Avoids a separate first-time-insert vs subsequent-update path.

**When to use:** Any "set this preference for this entity" call where the row may or may not exist yet.
**Source:** 01-03-PLAN.md

### `PHASE-1 STUB:` comment marker + 503 + `code: "PHASE_1_STUB"` for deferred routes
Every leaf route handler that depends on out-of-Phase-1 tables returns `res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" })` with a `// PHASE-1 STUB: <table list> not in @workspace/db` comment. Router, path, middleware, and default export stay intact.

**When to use:** Migration phases where you must remove a backing dep but cannot delete the route (it's mounted by `routes/index.ts` and removal would break cold-start). The grep marker (`PHASE-1 STUB`) is also the audit trail for the Phase 2 backlog.
**Source:** 01-04a-PLAN.md, 01-04a-SUMMARY.md

### Drizzle insert for safety/audit log: hash inside the IIFE, never at the call site
```ts
void (async () => {
  const fanIdHash = sha256(entry.fanId);
  const messageHash = sha256(entry.messageText);
  await db.insert(safetyAuditLogTable).values({ ..., fanIdHash, messageHash, retentionCategory: "audit" });
})();
```
Fire-and-forget IIFE preserves non-blocking semantics; sha256 happens inside the closure so raw values never live past it.

**When to use:** Any audit log write where the input has PII. The hash-at-write-site pattern is enforced by schema absence of raw-PII columns (see Decisions: D-02).
**Source:** 01-04a-SUMMARY.md, 01-04a-PLAN.md (RESEARCH Pattern 6)

### TDD RED→GREEN inside a single executor context (move the failing test to the plan that makes it green)
Plan 01-01 was originally going to write the failing KYC-gate E2E test, but the test was moved into Plan 01-02 (the plan that implements the gate). Plan 01-02 Task 0 writes the failing test; Tasks 1–2 make it green. Single commit chain: `test(01-02): add failing KYC gate E2E test (RED)` → `feat(01-02): KYC gate GREEN — Drizzle routes replace Supabase`.

**When to use:** Whenever a test and its implementation span multiple plans — co-locate them to eliminate cross-plan red/green coupling and to keep the RED→GREEN audit trail in one executor's commit history.
**Source:** 01-01-PLAN.md, 01-02-SUMMARY.md

### Three-value blocking checkpoint signal — `approved (fresh-db)` / `approved (backfilled)` / abort
Plan 01-01 Task 3 (KYC status backfill before drizzle-kit push) is a human checkpoint with a structured resume-signal: `approved (fresh-db)` (table doesn't exist), `approved (backfilled)` (legacy rows collapsed), or any other reply aborts. The auto-approval branch fired here when DATABASE_URL was unavailable locally.

**When to use:** Any pre-DDL safety check where the operator's response shape determines the next action. Pairs well with a fallback "deferred" disposition for environments where the check can't actually be performed.
**Source:** 01-01-PLAN.md, 01-01-SUMMARY.md

### "PHASE-1 STUB" log + Drizzle status write — keep the worker contract live without the work
For each BullMQ worker, the body becomes `console.log("[worker] STUB: <queue> body filled in Phase <N>")` followed by `db.update(generationJobsTable).set({ status: "complete" }).where(eq(generationJobsTable.id, jobDbId))`. Lifecycle scaffolding (Worker, QueueEvents, concurrency, retry, graceful shutdown) is untouched.

**When to use:** When you need a queue topology to be real and observable (Bull Board, retries, DLQ all work) but the producer logic is a downstream phase. T-04b-02 mitigation lives in the eval gate (EVAL-01) that catches premature production use.
**Source:** 01-04b-PLAN.md, 01-04b-SUMMARY.md

### Vitest module mocking for Drizzle in unit tests
`vi.mock("@workspace/db")` plus `vi.mock("drizzle-orm")` isolates a unit test from the live DB layer. Used to convert the hand-rolled `revocation-sweep.test.ts` runner to a proper `describe/it/expect` Vitest suite during Plan 01-04c.

**When to use:** When a worker/route under test uses Drizzle but the test should not actually round-trip to PG (and the lazy-getDb pattern isn't enough on its own).
**Source:** 01-04c-SUMMARY.md

---

## Surprises

### Plan 01-04a's grep verification missed `artifacts/api-server/src/workers/revocation.ts`
The plan's `files_modified` list and `<files>` blocks scoped Task 1b to `src/routes/` and `src/lib/`, but `revocation.ts` lives under `src/workers/` and still imported `SupabaseClient`. The 01-04a verify-gate grep on `src/routes/` and `src/lib/` passed clean; full-tree grep would have caught it. Plan 01-04c picked up the file as auto-fix Rule 1 work.

**Impact:** Phase 1 close was extended by one unplanned file rewrite (revocation.ts) plus a vitest conversion of its test. The scoped-grep pattern almost let a Supabase import survive the phase.
**Source:** 01-04a-SUMMARY.md, 01-04c-SUMMARY.md

### `apps/web/` deletion was claimed by 01-04c SUMMARY but verification found the directory still present
01-04c-SUMMARY.md reports "apps/web/ deleted — 27 files removed" with a passing `test -d apps/web && echo "EXISTS" || echo "DELETED" → DELETED` check. The phase verification report (01-VERIFICATION.md) ran independently and found `test -d apps/web` returned true: the directory was still in the working tree. The deletion happened in the worktree but did not survive into the host repo.

**Impact:** D-08 marked FAILED at phase verification despite the plan summary's self-check claiming PASS. Worktree-to-host propagation is a verification blind spot.
**Source:** 01-VERIFICATION.md, 01-04c-SUMMARY.md

### KYC gate bypass survived its own E2E test
The E2E test (`kyc-gate.e2e.test.ts`) always sends a `handle`. The gate implementation is wrapped in `if (handle) { ...isKycSigned... }`. A request with no `handle` field falls through to the 200 stub with no KYC check. All Plan 01-02 verify gates and self-checks passed; the bypass was caught only by 01-VERIFICATION.md.

**Impact:** KYC-01 marked PARTIAL at phase verification. The fix is either mandatory-handle (400 if absent) or an explicit design decision documented as override. A "happy-path test pinned the gate" is not the same as "the gate cannot be bypassed."
**Source:** 01-VERIFICATION.md

### Files written to main repo path instead of worktree path during Plan 01-03
Write/Edit tool calls used orchestrator-context absolute paths (`/home/joe/Workspace/77of1/...`) rather than the worktree path (`/home/joe/Workspace/77of1/.claude/worktrees/agent-...`). Files landed in the main repo; `git status` in the worktree showed no changes. Recovered by `cp` from main to worktree.

**Impact:** Main-repo files on `rio-de-janeiro` were silently modified as a side effect. Path-safety bug class for multi-worktree execution.
**Source:** 01-03-SUMMARY.md

### Plan 01-01's blocking DB-push checkpoint and pgvector check were auto-deferred because DATABASE_URL is not available locally
Tasks 3 and 4 (KYC backfill checkpoint, `drizzle-kit push`) were marked deferred in 01-01-SUMMARY.md; the pgvector probe in Task 2 similarly recorded "absent" because `psql` couldn't run. The schema is verified at the source level only; live materialization on Replit PG is still HUMAN NEEDED per 01-VERIFICATION.md.

**Impact:** INFRA-03 is VERIFIED at the source level but the live push remains an open human-verification item. The phase "completed" without proving the schema actually lands on PG.
**Source:** 01-01-SUMMARY.md, 01-VERIFICATION.md

### Pre-existing `test-failover.ts` broken (referenced a non-existent `./failover.js`) — surfaced when Hermes typecheck ran cleanly for the first time post-migration
Pre-existing bug in `artifacts/hermes/src/test-failover.ts` (TS2307 missing module) was unmasked by the Plan 01-03 verification typecheck. Resolved by `"exclude": ["src/test-failover.ts"]` in `tsconfig.json` — not by fixing the underlying file.

**Impact:** Plan 01-03 carried a tsconfig change beyond its declared `files_modified`. Migration-quality bar revealed pre-existing rot that prior dev iterations had been silently ignoring.
**Source:** 01-03-SUMMARY.md

### Stale `db.ts.tmp.2877053.d3bd7e3d921e` file failed an acceptance grep with a leftover `@supabase/supabase-js` import
A stale untracked tmp file under `artifacts/hermes/src/` still contained a Supabase import. The plan's tree-wide `grep -RE 'supabase-js' artifacts/hermes/src/` acceptance check failed against this file even though it wasn't real source. Resolved by deleting it (the plan's `read_first` explicitly described it as "stale, do not act on it").

**Impact:** Tree-wide grep acceptance checks need to skip untracked/.tmp files or the harness needs to clean them up before verification. Cost: one extra investigative step at the end of Plan 01-03.
**Source:** 01-03-SUMMARY.md
