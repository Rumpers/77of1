---
phase: 01-baseline-repair
verified: 2026-05-28T12:00:00Z
status: human_needed
score: 8/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run `pnpm --filter @workspace/db run push` in Replit (DATABASE_URL set) and confirm all 9 tables + 7 enums land on Replit PG"
    expected: "All 9 tables (creators, twins, creator_kyc, creator_config, consent_grants, conversation_messages, generation_jobs, safety_audit_log, creator_totp) and 7 enums (kyc_status, twin_visibility, message_role, retention_category, consent_grant_modality, generation_job_status, crisis_level) present in public schema"
    why_human: "DATABASE_URL is unavailable locally; push-verification.txt records the command to run but explicitly states 'NOT YET RUN'"
  - test: "Delete apps/web/ directory — run `rm -rf apps/web` from repo root, then `pnpm install --frozen-lockfile=false`"
    expected: "`test -d apps/web` exits non-zero; pnpm install exits 0"
    why_human: "apps/web/ exists as an untracked directory (never committed to git, so git clean did not remove it). Plan 01-04c Task 1 required `rm -rf apps/web` but the directory is still present."
  - test: "Update SignWell template body with VOICE SYNTHESIS AUTHORIZATION section (KYC-02 / D-07)"
    expected: "SignWell template (SIGNWELL_TEMPLATE_ID) includes voice synthesis scope, duration, revocability section; respond 'approved — template body verified, version: <id>'"
    why_human: "No SignWell account provisioned yet. signwell-template-status.md records the deferral. This is a legal compliance requirement (KYC-02)."
  - test: "Delete SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY from Replit Secrets panel, then restart and confirm api-server cold-starts at /api/health returning HTTP 200"
    expected: "api-server boots without crash; curl https://<repl>.replit.app/api/health returns {status:'ok'}"
    why_human: "Replit Secrets panel has no programmatic delete API. Plan 01-04c Task 4 blocking founder checkpoint — replit-secrets-cleanup.md checklist created but founder sign-off not confirmed."
gaps:
  - truth: "apps/web/ directory is deleted (D-08)"
    status: failed
    reason: "apps/web/ still exists in the working tree as an untracked directory. Plan 01-04c Task 1 (`rm -rf apps/web`) was not executed. The directory contains src/app/api/continue-token/, src/components/, src/lib/webview/ and is visible via `ls apps/web/src`."
    artifacts:
      - path: "apps/web/"
        issue: "Directory present — should have been deleted in Plan 01-04c Task 1"
    missing:
      - "Run `rm -rf apps/web` from the repo root"
      - "Run `pnpm install --frozen-lockfile=false` to update lockfile"
      - "Verify `pnpm run typecheck:libs` still exits 0 after deletion"
  - truth: "POST /api/twin/chat enforces KYC gate for ALL requests — null/pending/rejected/missing-row all blocked"
    status: partial
    reason: "The KYC gate in twin.ts is wrapped in `if (handle) { ... }` — requests without a handle skip the gate entirely and receive a canned 200 response. KYC-01 requires the gate for any creator whose status is not 'signed'; if the API caller simply omits `handle`, the gate is bypassed. This is a semantic gap: the check exists but is conditional on the caller providing a handle."
    artifacts:
      - path: "artifacts/api-server/src/routes/twin.ts"
        issue: "Lines 57-77: `if (handle) { ... }` wraps the entire KYC check. A request with no `handle` field falls through to the stub response without any KYC gate."
    missing:
      - "Either require `handle` as a mandatory field (return 400 if absent) and enforce the gate unconditionally, OR document this as an intentional design decision (anonymous fans always get a stub, handle-associated requests are gated)"
      - "Note: The E2E test (kyc-gate.e2e.test.ts) always sends a handle, so this bypass is not covered by existing tests"
---

# Phase 1: Baseline Repair — Verification Report

**Phase Goal:** Complete Supabase removal from all artifacts (api-server, hermes, worker); establish Drizzle schema on Replit PG; implement KYC gate vertical slice; delete apps/web/ per D-08.
**Verified:** 2026-05-28T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Zero @supabase/supabase-js imports in api-server/src/, worker/src/, hermes/src/ | VERIFIED | `grep -rE '@supabase/supabase-js' artifacts/api-server/src/ artifacts/worker/src/ artifacts/hermes/src/` — no output; cold-start-verification.md confirms zero imports |
| 2 | lib/db/src/schema/index.ts exports ≥9 pgTable and ≥7 pgEnum definitions | VERIFIED | grep count: 9 pgTable, 7 pgEnum; all 9 tables (creators, twins, creator_kyc, creator_config, consent_grants, conversation_messages, generation_jobs, safety_audit_log, creator_totp) and 7 enums present in file |
| 3 | .env.example has DATABASE_URL but no SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY | VERIFIED | `grep 'SUPABASE' .env.example` — no output; DATABASE_URL line 26 confirmed present |
| 4 | POST /api/twin/chat enforces KYC gate — returns 423 for unsigned creators | PARTIAL | Gate exists (`isKycSigned` called at line 71) but is wrapped in `if (handle)` — requests without a handle bypass the gate entirely and get 200 |
| 5 | GET /api/health/db uses Drizzle pool (no Supabase) | VERIFIED | health.ts line 34-35: `const { pool } = await import("@workspace/db"); await pool.query("SELECT 1")` — no Supabase dynamic import |
| 6 | apps/web/ directory is deleted (D-08) | FAILED | Directory exists at `apps/web/` as untracked files (git status shows it). Plan 01-04c Task 1 `rm -rf apps/web` was not executed. |
| 7 | safety_audit_log schema has no raw fan_id/message_text columns (sha256 hashes only) | VERIFIED | Schema inspection: `fanIdHash text("fan_id_hash")` and `messageHash text("message_hash")` only; schema comment line 327 explicitly confirms "NO raw fan_id or message_text column"; push-verification.txt records the expected verification query |
| 8 | creator_kyc.status uses kycStatusEnum (pending/signed/rejected only) | VERIFIED | Schema line 137: `kycStatusEnum("status").notNull().default("pending")` — 3-value enum, NOT NULL |
| 9 | Kill-switch SLA pattern preserved in hermes/src/db.ts (setPaused function) | VERIFIED | db.ts lines 44-51: `db_write_ms=` logging and `approaching ≤5s SLA` warning at >4000ms — verbatim preservation confirmed |
| 10 | drizzle-kit push deferred — human must run in Replit with DATABASE_URL set | VERIFIED (as deferred) | push-verification.txt documents the required commands; explicitly deferred per prompt instructions; source-level schema is correct |

**Score:** 8/10 truths verified (1 FAILED, 1 PARTIAL — with 2 gaps to resolve)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/db/src/schema/index.ts` | 9 pgTable + 7 pgEnum, all insert schemas + types | VERIFIED | 9 pgTable, 7 pgEnum, all insertXxxSchema + type exports present |
| `.env.example` | DATABASE_URL present; SUPABASE_* absent | VERIFIED | Confirmed clean |
| `artifacts/api-server/src/routes/twin.ts` | KYC gate with isKycSigned | PARTIAL | Gate present but conditional on `if (handle)` — bypass exists |
| `artifacts/api-server/src/routes/health.ts` | Drizzle pool.query | VERIFIED | pool.query("SELECT 1") confirmed |
| `artifacts/hermes/src/db.ts` | Drizzle-backed, SLA logging, no Supabase | VERIFIED | All functions use @workspace/db; db_write_ms logging present |
| `artifacts/hermes/package.json` | @workspace/db: workspace:*; no @supabase/supabase-js | VERIFIED | Confirmed via grep |
| `artifacts/api-server/src/lib/supabase.ts` | Deleted | VERIFIED | File does not exist |
| `apps/web/` | Deleted (D-08) | FAILED | Directory still present (untracked) |
| `.planning/phases/01-baseline-repair/notes/replit-secrets-cleanup.md` | Founder checklist for secrets deletion | VERIFIED | File exists with all 3 SUPABASE_* keys and DATABASE_URL_DIRECT reference |
| `artifacts/api-server/src/__tests__/kyc-gate.e2e.test.ts` | E2E test pinning 423 behavior | VERIFIED | File exists |
| `artifacts/api-server/src/lib/kyc.ts` | isKycSigned, Drizzle-backed, 3-value KycStatus | VERIFIED | isKycSigned with strict `=== "signed"` predicate; KycStatus type = "pending"\|"signed"\|"rejected" |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| twin.ts | kyc.ts | `import { isKycSigned }` | WIRED | Line 2 import confirmed; called at line 71 |
| kyc.ts | @workspace/db | `import { db, creatorKycTable }` | WIRED | Drizzle query on creatorKycTable confirmed |
| health.ts | lib/db pool | `import { pool }` | WIRED | Lazy dynamic import; pool.query("SELECT 1") confirmed |
| hermes/db.ts | @workspace/db | `import { db, creatorsTable, creatorConfigTable, creatorTotpTable }` | WIRED | All tables imported, used in all functions |
| hermes/consent.ts | @workspace/db | `import { db, consentGrantsTable }` | WIRED (per cold-start-verification.md) | Typecheck passes |
| worker/index.ts | @workspace/db | `import { db, generationJobsTable }` | WIRED | Lines 14, 58, 72, 92, 142, 188 confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| twin.ts KYC gate | `creator.id` | `db.select().from(creatorsTable).where(eq(handle))` | Yes (Drizzle query) | FLOWING |
| twin.ts KYC gate | `signed` | `isKycSigned(creator.id)` → `db.select().from(creatorKycTable)` | Yes (Drizzle query) | FLOWING |
| health.ts /health/db | `latencyMs` | `pool.query("SELECT 1")` | Yes (live DB round-trip) | FLOWING |
| hermes/db.ts setPaused | `elapsed` | `db.update(creatorConfigTable).set({paused})` | Yes (Drizzle update) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Result | Status |
|----------|--------|--------|
| `grep -c 'pgTable(' lib/db/src/schema/index.ts` | 9 | PASS |
| `grep -c 'pgEnum(' lib/db/src/schema/index.ts` | 7 | PASS |
| `test -f artifacts/api-server/src/lib/supabase.ts` | Does not exist | PASS |
| `test -d apps/web` | Directory exists | FAIL |
| `grep 'SUPABASE' .env.example` | No output | PASS |
| `grep -rE '@supabase/supabase-js' artifacts/api-server/src/ artifacts/worker/src/ artifacts/hermes/src/` | No output | PASS |
| `grep 'pool.query' artifacts/api-server/src/routes/health.ts` | Line 35 found | PASS |
| `grep 'isKycSigned' artifacts/api-server/src/routes/twin.ts` | Line 71 found | PASS |
| `grep 'db_write_ms' artifacts/hermes/src/db.ts` | Line 45 found | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| INFRA-01 | 01-02, 01-04c | api-server health probe via live data layer | VERIFIED | health.ts uses Drizzle Pool SELECT 1; cold-start-verification.md records PASS |
| INFRA-02 | 01-02, 01-03, 01-04a, 01-04b | Supabase fully removed from api-server, hermes, worker | VERIFIED | Zero @supabase/supabase-js imports; supabase.ts deleted; package.json deps removed from api-server/worker/hermes |
| INFRA-03 | 01-01 | Drizzle schema on Replit PG | VERIFIED (source) / HUMAN NEEDED (live push) | Schema file correct; push deferred to Replit environment |
| INFRA-04 | 01-04b | BullMQ queue scaffolding Drizzle-backed | VERIFIED | worker/index.ts: `new Worker(` and `new QueueEvents(` confirmed; generationJobsTable used for status updates |
| KYC-01 | 01-02 | Twin chat returns 423 until creator_kyc.status='signed' | PARTIAL | Gate exists but bypass possible when `handle` is absent from request body |
| KYC-02 | 01-02 | KYC agreement names voice synthesis scope as signed line item | HUMAN NEEDED | SignWell account not provisioned; deferral documented in signwell-template-status.md |
| PERSONA-03 | 01-01 | twins.visibility uses twin_visibility enum default 'private' | VERIFIED | Schema line 106: `twinVisibilityEnum("visibility").notNull().default("private")` |
| COMPLY-03 | 01-01, 01-04a | safety_audit_log stores only sha256 hashes (no raw PII) | VERIFIED | Schema has `fan_id_hash` and `message_hash` only; push-verification.txt records zero-row PII check to run in Replit |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `artifacts/api-server/src/routes/twin.ts` line 57 | `if (handle) { ... }` wraps entire KYC gate — handle-absent requests bypass gate | Warning | Reduces KYC-01 enforcement to "when handle is supplied" — not a raw TODO/FIXME but a security logic gap |
| `artifacts/api-server/src/routes/kyc.ts` | OBJECT_STORAGE_PENDING 503 stub for /api/kyc/upload-url | Info | Expected Phase 1 stub — documented |
| Multiple route files (account.ts, assets.ts, etc.) | PHASE-1 STUB 503 handlers | Info | Expected — documented in 01-04a PLAN, correctly deferred to Phase 2 |

No `TBD`, `FIXME`, or `XXX` debt markers found in Phase 1 key files.

### Human Verification Required

#### 1. Drizzle Schema Push to Replit PG (INFRA-03 live materialization)

**Test:** In the Replit environment with DATABASE_URL set, run: `pnpm --filter @workspace/db run push`
**Expected:** Exit 0; all 9 tables (creators, twins, creator_kyc, creator_config, consent_grants, conversation_messages, generation_jobs, safety_audit_log, creator_totp) and 7 enums visible via `SELECT tablename FROM pg_tables WHERE schemaname='public'`; `safety_audit_log` has zero rows for columns `fan_id`, `message_text`, `content`; `creator_kyc.status` column default is `'pending'::kyc_status` with NOT NULL.
**Why human:** DATABASE_URL is not available in the local dev environment. push-verification.txt documents the exact commands to run and expected output — the file explicitly states "NOT YET RUN."

#### 2. Delete apps/web/ Directory (D-08)

**Test:** Run `rm -rf apps/web` from the repo root, then `pnpm install --frozen-lockfile=false`, then `pnpm run typecheck:libs`
**Expected:** `test -d apps/web` exits non-zero; `pnpm install` exits 0; `typecheck:libs` still exits 0
**Why human:** apps/web/ exists as an untracked directory (never committed). Plan 01-04c Task 1 was supposed to execute this but the directory remains. This is a BLOCKER for D-08 compliance.

#### 3. KYC-02 — SignWell Template Voice Synthesis Authorization (Legal Compliance)

**Test:** Open SignWell dashboard → template referenced by SIGNWELL_TEMPLATE_ID → add VOICE SYNTHESIS AUTHORIZATION section (scope, duration, revocability per 01-RESEARCH.md "KYC Agreement Template")
**Expected:** Template body confirmed to include the VOICE SYNTHESIS AUTHORIZATION section; reply with version ID
**Why human:** No SignWell account provisioned yet. signwell-template-status.md records the deferral with a "not yet applicable" note. This is a legal requirement for KYC-02 before going live.

#### 4. Replit Secrets Panel Cleanup

**Test:** Open Replit Secrets panel → delete SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY → restart Repl → `curl /api/health` returns 200
**Expected:** api-server boots without any Supabase-related error; health endpoint returns `{"status":"ok"}`
**Why human:** Replit Secrets panel has no programmatic delete API. replit-secrets-cleanup.md checklist was created in Plan 01-04c Task 2 but founder sign-off has not been recorded.

### Gaps Summary

Two source-level gaps block goal achievement:

**GAP 1 — apps/web/ not deleted (BLOCKER for D-08):** The directory exists as untracked files in the working tree. Plan 01-04c Task 1 intended `rm -rf apps/web` but it was not executed. This is straightforward to fix: delete the directory, update the lockfile, and re-verify typecheck.

**GAP 2 — KYC gate conditional on handle presence (WARNING for KYC-01):** The KYC gate in `twin.ts` is wrapped in `if (handle)`. A request to `POST /api/twin/chat` without a `handle` field bypasses the gate entirely and receives a 200 canned response. The E2E test always sends a handle, so this bypass was not caught. The fix is either (a) require `handle` as mandatory (return 400 if absent), or (b) document this as an intentional design decision and accept it via override if the product intent is that handleless requests are always anonymous/ungated.

Four additional items require human action (not source-level failures): drizzle-kit push, apps/web deletion, SignWell template, and Replit Secrets cleanup.

---

_Verified: 2026-05-28T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
