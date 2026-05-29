---
phase: 01-baseline-repair
plan: "01"
subsystem: lib/db
tags: [schema, drizzle, supabase-removal, env-vars, database]
dependency_graph:
  requires: []
  provides:
    - "@workspace/db: 9 typed pgTable exports + 7 pgEnums + insertXxxSchema + types"
    - ".env.example: Supabase-free env contract with all Phase 1 required vars"
    - "lib/db/drizzle.config.ts: non-pooled URL preference + pgbouncer warning"
  affects:
    - "lib/db importers: can now use creatorsTable, twinsTable, creatorKycTable, etc."
    - "Plans 01-02 to 01-06: all depend on these table exports compiling"
tech_stack:
  added: []
  patterns:
    - "pgEnum before pgTable (forward-reference order)"
    - "$onUpdateFn(() => new Date()) for updatedAt columns"
    - "createInsertSchema(table).omit({ id, createdAt, updatedAt }) per table"
    - "DATABASE_URL_DIRECT ?? DATABASE_URL for non-pooled DDL"
key_files:
  created:
    - .planning/phases/01-baseline-repair/notes/pgvector-check.txt
    - .planning/phases/01-baseline-repair/notes/push-verification.txt
  modified:
    - .env.example
    - lib/db/src/schema/index.ts
    - lib/db/drizzle.config.ts
decisions:
  - "D-11 env-vars-first: SUPABASE_* removed from .env.example before any code migration"
  - "D-05 kyc_status enum: 3-value (pending/signed/rejected), NOT NULL DEFAULT 'pending'"
  - "D-02 safety_audit_log: hash-only columns (fan_id_hash, message_hash), no raw PII"
  - "D-04 generation_jobs.consent_grant_id: FK to consent_grants table"
  - "D-14 retention_category: all fan-interaction tables have retentionCategoryEnum column"
  - "DATABASE_URL_DIRECT preferred over DATABASE_URL for drizzle-kit DDL (Pitfall #6)"
  - "drizzle-kit push deferred: DATABASE_URL not available in local worktree — must run in Replit"
metrics:
  duration: "8 minutes"
  completed: "2026-05-28T01:46:34Z"
  tasks_completed: 3
  tasks_deferred: 2
  files_modified: 3
  files_created: 2
---

# Phase 01 Plan 01: Drizzle Schema + Env Cleanup Summary

**One-liner:** Supabase-free `.env.example` + complete 9-table Drizzle schema (7 pgEnums, 9 pgTables, all insert schemas/types) with non-pooled DDL config ready for `drizzle-kit push` in Replit.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 0 | Remove SUPABASE_* env vars from .env.example | `5d749ca` | `.env.example` |
| 1 | Write complete Drizzle schema for all 9 tables | `71d5e4f` | `lib/db/src/schema/index.ts` |
| 2 | Update drizzle.config.ts for non-pooled URL | `2d7ab8a` | `lib/db/drizzle.config.ts`, `notes/pgvector-check.txt` |

## Tasks Deferred

| Task | Name | Reason |
|------|------|--------|
| 3 | Backfill KYC status rows (checkpoint) | DATABASE_URL not available in local env — auto-approved as "fresh-db" per execution instructions |
| 4 | Run drizzle-kit push | DATABASE_URL not available in local env — must run manually in Replit |

**Action required:** In Replit, run `pnpm --filter @workspace/db run push` with DATABASE_URL set. Verification queries documented in `.planning/phases/01-baseline-repair/notes/push-verification.txt`.

## Schema Delivered

### pgEnums (7)

| Enum | Values |
|------|--------|
| `kyc_status` | pending, signed, rejected |
| `twin_visibility` | public, private |
| `message_role` | user, assistant |
| `retention_category` | operational, transcript, audit |
| `consent_grant_modality` | persona_text, voice, image, talking_video, fullbody_video |
| `generation_job_status` | queued, processing, complete, failed, cancelled, dlq |
| `crisis_level` | none, low, medium, high |

### pgTables (9)

| Table | Key Constraints |
|-------|----------------|
| `creators` | replitUserId + telegramUserId both unique (api-server + hermes) |
| `twins` | visibility enum default 'private' (PERSONA-03) |
| `creator_kyc` | status NOT NULL DEFAULT 'pending'; voiceSynthesisConsentGranted (D-07) |
| `creator_config` | creatorId PK; paused, timezone, hermesLanguage |
| `consent_grants` | unique(creatorId, modality, version); retentionCategory |
| `conversation_messages` | content plaintext (D-03); retentionCategory default 'transcript' |
| `generation_jobs` | consentGrantId FK (D-04); generationJobStatus enum; retentionCategory |
| `safety_audit_log` | fanIdHash + messageHash ONLY — no raw PII (COMPLY-03/D-02); retentionCategory default 'audit' |
| `creator_totp` | creatorId PK; recoveryCodes text[]; inferred from hermes/db.ts lines 84–132 |

## Deviations from Plan

### Auto-fixed Issues

None.

### Auto-approved Checkpoint (Task 3)

**Task 3:** Backfill KYC status checkpoint — auto-approved as "fresh-db" because DATABASE_URL is not set in the local worktree environment. If the Replit PG database has existing `creator_kyc` rows with legacy status values (`complete`, `id_submitted`, etc.), run the backfill SQL documented in Plan 01-01 Task 3 before running `drizzle-kit push`.

### Graceful Skips

**Task 4:** `drizzle-kit push` — skipped because DATABASE_URL is unavailable locally. The schema code is correct and typechecks cleanly. The push must be run in the Replit environment where DATABASE_URL is set.

**pgvector check** (Task 2 action) — could not run `psql` command locally. Documented in `notes/pgvector-check.txt` with instructions for Replit environment check.

### Rule 2 Addition: Missing env vars added to .env.example

The original `.env.example` was missing several env vars required by downstream plans:
- `SESSION_SECRET`, `HMAC_CONVERSATION_SECRET` (conversation security)
- `TELEGRAM_BOT_TOKEN_LALA`, `TELEGRAM_BOT_TOKEN_FAN_TWIN` (Telegram bots)
- `OPENAI_API_KEY` (moderation pipeline)
- `SIGNWELL_API_KEY`, `SIGNWELL_TEMPLATE_ID` (KYC onboarding)
- `DATABASE_URL_DIRECT` (non-pooled DDL URL for Pitfall #6 mitigation)

These are required for correct/secure operation — added per Rule 2 (auto-add missing critical functionality).

## Verification Status

- [x] `.env.example` contains zero `SUPABASE_*` keys
- [x] `pnpm --filter @workspace/db exec tsc --noEmit` exits 0
- [x] Schema file has 9 `pgTable(` and 7 `pgEnum(` declarations
- [x] No out-of-scope table names in schema
- [x] `safety_audit_log` has no `fan_id`, `message_text`, or `content` columns
- [x] `creator_kyc.status` is `kycStatusEnum.notNull().default("pending")`
- [x] `lib/db/drizzle.config.ts` reads `DATABASE_URL_DIRECT ?? DATABASE_URL`
- [x] `lib/db/drizzle.config.ts` warns on pgbouncer/6543 URLs
- [ ] `drizzle-kit push` exits 0 — PENDING (requires Replit DATABASE_URL)
- [ ] All 9 tables present in `pg_tables` — PENDING
- [ ] pgvector availability checked — PENDING

## Known Stubs

None — all schema definitions are complete. The `drizzle-kit push` has not yet materialized the schema on the live database (DATABASE_URL unavailable locally), but the schema code itself is fully written and typechecks.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced in this plan. Schema changes are additive (new tables + columns).

## Self-Check: PASSED

- `lib/db/src/schema/index.ts`: exists and has 391+ lines ✓
- `lib/db/drizzle.config.ts`: updated with DATABASE_URL_DIRECT logic ✓
- `.env.example`: SUPABASE_* removed, DATABASE_URL + Phase 1 vars present ✓
- Commits 5d749ca, 71d5e4f, 2d7ab8a: all exist in git log ✓
- `.planning/phases/01-baseline-repair/notes/pgvector-check.txt`: exists ✓
- `.planning/phases/01-baseline-repair/notes/push-verification.txt`: exists ✓
