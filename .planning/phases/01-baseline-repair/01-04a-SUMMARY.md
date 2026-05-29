---
phase: "01"
plan: "04a"
subsystem: api-server
tags: [supabase-removal, drizzle-migration, phase1-stubs, safety-audit, cookie-helpers]
dependency_graph:
  requires: [01-02, 01-03]
  provides: [api-server-supabase-free-routes-and-lib]
  affects: [api-server-typecheck, api-server-cold-start]
tech_stack:
  added: []
  patterns: [drizzle-insert, drizzle-select-from-where, drizzle-upsert-onConflictDoUpdate, phase1-stub-503]
key_files:
  created: []
  modified:
    - artifacts/api-server/src/lib/safety-audit.ts
    - artifacts/api-server/src/lib/auth.ts
    - artifacts/api-server/src/routes/consent.ts
    - artifacts/api-server/src/routes/creator.ts
    - artifacts/api-server/src/routes/twofa.ts
    - artifacts/api-server/src/routes/persona.ts
    - artifacts/api-server/src/routes/account.ts
    - artifacts/api-server/src/routes/assets.ts
    - artifacts/api-server/src/routes/auth.ts
    - artifacts/api-server/src/routes/credits.ts
    - artifacts/api-server/src/routes/dsar.ts
    - artifacts/api-server/src/routes/email-webhooks.ts
    - artifacts/api-server/src/routes/fan-recovery.ts
    - artifacts/api-server/src/routes/links.ts
    - artifacts/api-server/src/routes/onboarding.ts
    - artifacts/api-server/src/routes/payments.ts
    - artifacts/api-server/src/routes/reports.ts
    - artifacts/api-server/src/routes/subscriptions.ts
    - artifacts/api-server/src/routes/twofa.ts
    - artifacts/api-server/src/__tests__/safety-audit.test.ts
  deleted:
    - artifacts/api-server/src/lib/supabase.ts
decisions:
  - "Cookie helpers (COOKIE_ACCESS_TOKEN, sessionCookieOptions) relocated to auth.ts; value 'sb-access-token' preserved for Phase 1 backwards-compat (rename deferred to Phase 2)"
  - "writeSafetyAuditLog signature changed from (supabase, entry) to (entry) — Drizzle insert with retentionCategory='audit' and sha256 hashes only"
  - "consent.ts: runRevocationSweep DB fallback stubbed (requires SupabaseClient); primary BullMQ queue path preserved; grant revocation in DB via Drizzle still works"
  - "creator.ts: notifications routes return sensible defaults rather than 503 (creator_notifications deferred to Phase 2)"
  - "twofa.ts: fully migrated to Drizzle (creatorsTable + creatorTotpTable); payments/payout/enable confirmed 2FA only (Stripe Connect deferred)"
  - "onboarding.ts: consent insert stubbed because creator_assets + creator_onboarding out-of-scope tables make the KYC+asset-release logic incomplete"
  - "reports.ts: returns {ok:true} immediately (UX non-blocking per spec) but skips DB write in Phase 1"
  - "email-webhooks.ts: Resend signature verification preserved; suppression log write skipped in Phase 1"
  - "workers/revocation.ts is NOT in this plan's scope — still Supabase-backed; owned by plan 01-04b"
metrics:
  duration: "~45 minutes"
  completed: "2026-05-28"
  tasks_completed: 2
  files_changed: 20
---

# Phase 01 Plan 04a: API-Server Supabase Leaf Routes + Lib Glue Removal Summary

**One-liner:** Stripped Supabase from api-server lib/supabase.ts (deleted), safety-audit.ts (Drizzle-backed with retention_category='audit' + sha256 hashes), and all 16 leaf route files (4 migrated to Drizzle, 12 stubbed with 503 + PHASE_1_STUB).

## What Was Built

### Task 1a: lib/safety-audit.ts + lib/auth.ts + delete supabase.ts

- `safety-audit.ts` rewritten: `writeSafetyAuditLog(entry: SafetyAuditEntry): void` — no SupabaseClient parameter. Uses `db.insert(safetyAuditLogTable).values({...})` with `retentionCategory: "audit"`. sha256 hashes both `fanId` and `messageText` before insert (COMPLY-03/D-02). Fire-and-forget IIFE preserved. Slack alert branch preserved.
- `auth.ts` gains `COOKIE_ACCESS_TOKEN`, `COOKIE_REFRESH_TOKEN`, and `sessionCookieOptions()` relocated from deleted supabase.ts. Value `"sb-access-token"` preserved for Phase 1 backwards-compat.
- `artifacts/api-server/src/lib/supabase.ts` deleted entirely.
- Test file updated to mock `@workspace/db` via `vi.mock` instead of using a Supabase mock object.

**Commit:** c8041ea

### Task 1b: 16 Leaf Route Files

#### Mixed routes — Drizzle migration for Phase-1 tables

| File | Tables Migrated | Tables Stubbed |
|------|----------------|----------------|
| consent.ts | creatorsTable, consentGrantsTable | runRevocationSweep DB fallback (SupabaseClient dep) |
| creator.ts | generationJobsTable (failed jobs) | creator_notifications (Phase 2) |
| twofa.ts | creatorsTable, creatorTotpTable | payments/payout/enable (Stripe Connect deferred) |
| persona.ts | n/a (creator_persona_responses out of scope) | creator_persona_responses (Phase 2) |

#### All-out-of-scope routes — 503 + PHASE_1_STUB

| File | Out-of-scope tables |
|------|---------------------|
| account.ts | fan_accounts, fan_recovery_requests |
| assets.ts | asset_moderation_audit_log, creator_assets |
| auth.ts | Supabase Auth OTP, fan_accounts, phone_otp_attempts |
| credits.ts | fan_blocks, fan_credits, credit_transactions |
| dsar.ts | fan_accounts, fan_subscriptions, dsar_requests |
| email-webhooks.ts | email_suppression_log (signature verification preserved) |
| fan-recovery.ts | fan_accounts, fan_recovery_requests |
| links.ts | creator_links, link_clicks |
| onboarding.ts | creator_assets, creator_onboarding |
| payments.ts | credit_packs, fan_subscriptions, dunning_audit_log |
| reports.ts | fan_reports |
| subscriptions.ts | fan_subscriptions |

**Commit:** 619a62b

## Phase 2 Backlog — Stubbed Routes

The following routes need Phase 2 migration. Each entry includes HTTP verb, path, and table dependencies.

### Fan Auth (auth.ts)
- [ ] GET /api/auth/session — Supabase JWT session, fan_accounts
- [ ] POST /api/auth/signout — sb-access-token, sb-refresh-token cookies
- [ ] POST /api/auth/fan/send-otp — Supabase Auth OTP, fan_accounts
- [ ] POST /api/auth/fan/verify-otp — Supabase Auth, fan_accounts, creator_config
- [ ] POST /api/auth/creator/send-otp — Supabase Auth OTP, creators.auth_user_id
- [ ] POST /api/auth/creator/verify-otp — Supabase Auth, creators.auth_user_id
- [ ] POST /api/auth/creator/telegram-connect — creatorsTable (Phase 1 but Supabase auth dep)
- [ ] POST /api/auth/fan/send-phone-otp — Supabase Auth, phone_otp_attempts
- [ ] POST /api/auth/fan/verify-phone-otp — Supabase Auth, fan_accounts

### Fan Account (account.ts)
- [ ] POST /api/account/fan/recover — fan_accounts, fan_recovery_requests

### Creator Assets (assets.ts)
- [ ] POST /api/onboarding/assets — asset_moderation_audit_log, creator_assets

### Credits (credits.ts)
- [ ] POST /api/credits/deduct — fan_blocks, fan_credits, credit_transactions (deduct_credits RPC)

### DSAR (dsar.ts)
- [ ] POST /api/dsar/request — fan_accounts, dsar_requests
- [ ] GET /api/dsar — dsar_requests
- [ ] GET /api/dsar/download — dsar_requests, fan data tables
- [ ] POST /api/dsar/creator/request — dsar_requests
- [ ] GET /api/dsar/creator — dsar_requests
- [ ] GET /api/dsar/creator/download — dsar_requests

### Email Webhooks (email-webhooks.ts)
- [ ] POST /api/webhooks/email — email_suppression_log (Resend bounce/complaint)

### Fan Recovery (fan-recovery.ts)
- [ ] POST /api/account/fan/recover — fan_accounts, fan_recovery_requests

### Links (links.ts)
- [ ] GET /:handle — creator_links, link_clicks
- [ ] GET /api/links/:handle/stats — link_clicks
- [ ] POST /api/links — creator_links

### Onboarding (onboarding.ts)
- [ ] POST /api/onboarding/consent — consent_grants, creator_assets, creator_onboarding

### Payments (payments.ts)
- [ ] POST /api/payments/checkout — credit_packs, fan_credits (Stripe dormant per spec)
- [ ] POST /api/webhooks/stripe — fan_subscriptions, dunning_audit_log, audit_log
- [ ] GET /api/admin/dunning-metrics — fan_subscriptions, dunning_audit_log

### Reports (reports.ts)
- [ ] POST /api/reports — fan_reports (currently accepts silently, skips DB write)

### Subscriptions (subscriptions.ts)
- [ ] POST /api/subscriptions/:id/retry — fan_subscriptions

### Creator (creator.ts — partial stubs)
- [ ] GET /api/creator/notifications — creator_notifications
- [ ] POST /api/creator/notifications/dismiss — creator_notifications

### Consent (consent.ts — partial stubs)
- [ ] DB fallback for runRevocationSweep — currently logs warning if Redis unavailable

### Persona (persona.ts — stub)
- [ ] POST /api/onboarding/persona — creator_persona_responses

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript errors in consent.ts**
- **Found during:** Task 1b typecheck
- **Issue:** `req.params.modalityId` typed as `string | string[]` in Express; caused TS2538 on Record index and TS2345 on string arg
- **Fix:** Cast `req.params["modalityId"] as string` and `String(modalityId)` for function arg
- **Files modified:** consent.ts
- **Commit:** 619a62b (part of Task 1b commit)

**2. [Rule 3 - Scope] workers/revocation.ts still uses Supabase**
- **Found during:** Final grep verification
- **Issue:** `artifacts/api-server/src/workers/revocation.ts` imports `SupabaseClient` and dynamically imports `@supabase/supabase-js` — this file is in the `artifacts/api-server/src/` tree but was NOT in plan 04a's `files_modified` list
- **Disposition:** Accepted — revocation.ts is owned by plan 01-04b (worker migration); consent.ts's DB fallback path is stubbed with a warning log
- **Impact:** grep of the full `artifacts/api-server/src/` still finds Supabase in workers/; grep of `routes/` and `lib/` is clean

**3. [Rule 2 - Missing functionality] twofa.ts requires PHASE-1 STUB marker**
- **Found during:** Stub marker verification
- **Issue:** twofa.ts was migrated to Drizzle (not stubbed) but plan requires PHASE-1 STUB marker in all 16 files
- **Fix:** Added PHASE-1 STUB comment to file header explaining payout/enable partial stub
- **Files modified:** twofa.ts

## Self-Check: PASSED

### Files verified:
- [x] artifacts/api-server/src/lib/safety-audit.ts — contains safetyAuditLogTable, "audit", no @supabase/supabase-js
- [x] artifacts/api-server/src/lib/auth.ts — contains COOKIE_ACCESS_TOKEN, sessionCookieOptions
- [x] artifacts/api-server/src/lib/supabase.ts — does NOT exist
- [x] All 16 route files — contain PHASE-1 STUB marker
- [x] No Supabase imports in routes/ or lib/
- [x] tsc --noEmit exits 0
- [x] esbuild build succeeds (dist/index.mjs built)

### Commits verified:
- [x] c8041ea — Task 1a: safety-audit, auth.ts, delete supabase.ts
- [x] 619a62b — Task 1b: 16 leaf route files
