---
phase: 03-voice-hardening
plan: 03-04
type: summary
status: complete
---

# 03-04 DSAR Wizard + Deletion Worker — Summary

## What Was Implemented

### Task 1: DB helpers + i18n

**`artifacts/hermes/src/db.ts`** — 2 new exports:
- `setKillSwitchActive(creatorId, active)` — updates `creators.kill_switch_active`, warn-logs at >4s
- `recordDsarRequest(creatorId)` — inserts `creator_deletion_log` row with sha256 auditId (16 chars) and creatorIdHash (32 chars), returns auditId

**`artifacts/hermes/src/i18n.ts`** — 6 new keys in all 3 locales (EN/JA/ZH-TW):
`dsarHeader`, `dsarWarning`, `dsarConfirmPrompt`, `dsarCancelled`, `dsarConfirmedTemplate`, `dsarError`

### Task 2: Hermes /dsar wizard scene + registration

**`artifacts/hermes/src/scenes/dsar.scene.ts`** — 2-step WizardScene `"dsar-wizard"`:
- Step 0: presents locale-appropriate warning + CONFIRM prompt
- Step 1: validates CONFIRM text; W3 REDIS_URL guard before any side effects; `setKillSwitchActive` before `dsarDeletion.add` (Pitfall 8); 24h delay (DSAR_TEST_DELAY_MS override for 03-08 E2E); replies with auditId receipt

**`artifacts/hermes/src/index.ts`** — dsarWizard added to Stage; `bot.command("dsar")` resolves lang from `getCreatorPreferences`

### Task 3: DSAR deletion worker

**`artifacts/worker/src/workers/dsar-deletion.ts`** — `createDsarDeletionWorker`, concurrency 1:
1. Cross-check `creator_deletion_log.auditId` (rejects forged jobs)
2. `db.delete(conversationMessagesTable)` by creatorId
3. `db.delete(safetyAuditLogTable)` by creatorId
4. `db.delete(generationJobsTable)` by creatorId
5. `db.delete(consentGrantsTable)` by creatorId
6. `db.update(twinsTable)` → characterCard=null, voiceReferenceUrl=null, status="deleted"
7. `sweepObjectStorage(creatorId)` — HTTP REST, best-effort (no @replit/object-storage SDK; graceful skip if bucket env unset)
8. `db.update(creatorsTable)` → displayName="DELETED", PII columns=null (NEVER delete row — Pitfall 4)
9. `db.update(creatorDeletionLogTable)` → completedAt + sweepLatencyMs (LAST)

**`artifacts/worker/src/index.ts`** — registered with `createDsarDeletionWorker({}, REDIS_URL)`; closed in shutdown

## Idempotency

`jobId: auditId` in BullMQ deduplicates re-enqueues. Worker auditId cross-check tolerates re-runs. `completedAt` remains NULL on failure to trigger retry.

## i18n Key Count

18 total (6 keys × 3 locales). All locales include all 6 keys.

## Commit

`3fa1b87` on `rio-de-janeiro`
