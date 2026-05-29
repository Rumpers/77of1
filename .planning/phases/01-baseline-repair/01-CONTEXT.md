# Phase 1: Baseline Repair - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove all Supabase client dependencies from every artifact; establish the Drizzle schema for all core tables from scratch; enforce a legally correct KYC gate that returns 423 for any non-`signed` creator status; and bake data-minimization guarantees (hashed IDs only, no raw PII in logs or audit records) into the schema from day one.

Does NOT include: twin chat, moderation pipeline, any user-facing feature, voice, or i18n. This phase is infrastructure-only.

</domain>

<decisions>
## Implementation Decisions

### Drizzle Schema Scope

- **D-01:** Phase 1 Drizzle schema includes exactly these tables: `creators`, `twins`, `creator_kyc`, `creator_config`, `consent_grants`, `conversation_messages`, `generation_jobs`, `safety_audit_log`. Fan-payment-adjacent tables (`fan_credits`, `credit_transactions`, `fan_blocks`) are NOT added — they are permanently out of scope per the locked north-star decision. Hermes functions that referenced those tables (`blockFan`, `listFansForCreator`) are removed or stubbed without replacement.
- **D-02:** `safety_audit_log` includes `retention_category` column from day one (data-minimization — per PITFALLS.md). Raw message content is never written to any table. Only `sha256(fan_id)` and `sha256(message)` hash columns.
- **D-03:** `conversation_messages` stores the conversation history needed for context loading in Phase 2. Schema: `id`, `conversation_id` (HMAC-validated in Phase 2), `creator_id`, `twin_id`, `role` (`user` | `assistant`), `content_hash` (sha256 of content), `created_at`. No raw message content column.

  Wait — Phase 2 needs actual message content to pass to the LLM. Storing only hashes won't work for context loading. Resolution: store content encrypted (AES-256-GCM, key from env `CONVERSATION_KEY`) or store plaintext but classify as `retention_category = 'transcript'` with a defined retention window. Recommended: store plaintext with `retention_category` column, apply 90-day TTL via a cleanup cron added in Phase 4. This satisfies COMPLY-03 (data minimization = defined retention, not no-storage).

- **D-04:** `generation_jobs` carries `consent_grant_id` FK to `consent_grants` — every async job references the consent that authorized it. Required for the consent-revocation sweep in Phase 2.

### KYC Gate Status

- **D-05:** The KYC status enum is simplified to: `pending | signed | rejected`. The status `'signed'` means "creator has signed the personality-rights agreement (with voice synthesis scope explicitly named)". The gate check is: `status === 'signed'` — any other value returns HTTP 423 with a locale-appropriate error. Null/undefined/missing row also returns 423 (strict positive assertion, never a permissive default).
- **D-06:** The existing `kyc.ts` `isKycComplete()` function is renamed `isKycSigned()` and updated to check `status === 'signed'`. All callers updated.
- **D-07:** The KYC agreement template must include voice synthesis scope as an explicit line item: "Creator grants a non-exclusive, revocable license to generate AI voice content using creator's voice reference sample, for use in lala.la fan-twin interactions only." Revocability and duration (terminable at any time) must appear in the signed document.

### apps/web/ Fate

- **D-08:** `apps/web/` is deleted in Phase 1 per the north-star Week 1 clean-slate plan. The untracked files in `apps/web/src/app/api/continue-token/`, `apps/web/src/components/open-in-browser-sheet.tsx`, and `apps/web/src/lib/webview/` are discarded — they represent a creator dashboard that is deferred and will be rebuilt correctly later. The fan-facing SPA lives in `artifacts/web/`.

### Hermes Migration Path

- **D-09:** `artifacts/hermes/src/db.ts` is rewritten to use `@workspace/db` (Drizzle + Replit PG) instead of the Supabase client. Hermes adds `@workspace/db` as a workspace dependency. The `@supabase/supabase-js` dep is removed from `artifacts/hermes/package.json`.
- **D-10:** Functions in hermes/db.ts that used fan-payment tables (`blockFan`, `getCreatorStats` fan count, `listFansForCreator`) are removed. The remaining functions (`findCreatorByTelegramId`, `setPaused`, `getCreatorPreferences`, `setTimezone`, `setHermesLanguage`, TOTP functions) are rewritten against Drizzle.

### Supabase Removal Order

- **D-11:** Removal sequence: (1) Remove Supabase env vars from `.env.example`, `.env.local` if present, and Replit secrets documentation. (2) Search codebase for any remaining Supabase import that wasn't caught by the initial grep. (3) Remove all `@supabase/supabase-js` imports and client code. (4) Remove `@supabase/supabase-js` from all `package.json` files. (5) Run typecheck to confirm no remaining references. This is the env-vars-first order recommended in PITFALLS.md to surface hidden deps.
- **D-12:** The `supabase/` directory (migrations + rollbacks) is preserved in git history but not deleted — it serves as historical reference. No new Supabase migration files are added after Phase 1.

### BullMQ / Redis

- **D-13:** INFRA-04 (BullMQ + Redis for async jobs) is wired in Phase 1 at the queue-definition level only. The actual workers (voice generation, consent revocation) are stubs that will be filled in Phase 2/3. `lib/queue` already has the queue definitions — confirm they reference Drizzle-compatible job payloads (no Supabase-specific fields).

### Data Minimization Schema Pattern

- **D-14:** Every table that touches fan interactions must include `retention_category VARCHAR NOT NULL DEFAULT 'operational'` with values: `operational` (infrastructure, kept indefinitely), `transcript` (fan messages, 90-day TTL), `audit` (safety log, 1-year TTL). The cleanup cron is a Phase 4 task but the column ships in Phase 1.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Strategic Decisions (locked — do not contradict)
- `docs/north-star.md` — 11 locked decisions; Week 1 plan including apps/web deletion; stack choices
- `.planning/PROJECT.md` — Key Decisions table; Out of Scope list
- `.planning/REQUIREMENTS.md` — INFRA-01–04, KYC-01–02, PERSONA-03, COMPLY-03 (Phase 1 requirements)

### Architecture
- `.planning/research/ARCHITECTURE.md` — Component boundaries, data flow, 8 architecture gaps including Supabase coupling depth
- `.planning/research/PITFALLS.md` — Pitfall #10 (Supabase removal order), Pitfall #4 (KYC null-status bypass), Pitfall #5 (privacy schema)
- `.planning/research/STACK.md` — Technology choices with versions; Drizzle + pg pool pattern confirmed for Replit PG

### Existing Code (read before writing replacements)
- `artifacts/hermes/src/db.ts` — All Supabase DB helpers being replaced; understand the functions before rewriting
- `artifacts/api-server/src/lib/kyc.ts` — KYC helpers; `isKycComplete()` → `isKycSigned()`; SignWell integration (keep but update DB writes to Drizzle)
- `lib/db/src/index.ts` — Drizzle connection pattern (already correct; schema is empty placeholder)
- `lib/db/src/schema/index.ts` — Empty placeholder — all tables written here in Phase 1

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/db/src/index.ts`: Drizzle + pg Pool connection is correctly set up using `DATABASE_URL`. Schema slot is empty — just add table exports.
- `artifacts/api-server/src/lib/kyc.ts`: KYC helper structure is solid; only the Supabase client calls and status value need updating. SignWell integration code is reusable.
- `artifacts/hermes/src/db.ts`: Function signatures are the right interface — rewrite implementations against Drizzle, remove fan-payment functions.

### Established Patterns
- `lib/db`: Drizzle schema files use `pgTable` + `createInsertSchema` from `drizzle-zod`. Follow the existing template comments in `schema/index.ts`.
- Kill-switch SLA logging pattern in `hermes/db.ts` (`setPaused`): logs elapsed ms against ≤5s SLA. Preserve this pattern in the Drizzle rewrite.
- `creator_config` table is used by hermes for `paused`, `timezone`, `hermes_language` — include it in Phase 1 schema.

### Integration Points
- All artifacts that import from `@supabase/supabase-js` need their `package.json` updated to remove it after code migration
- `artifacts/admin/` has its own Supabase usage (`src/lib/supabase.ts`, `src/lib/audit.ts`, `src/lib/db.ts`) — admin is lower priority but Supabase must be removed from it too (or admin is left broken until Phase 2 explicitly addresses it)
- Post-merge hook (`scripts/post-merge.sh`) runs `pnpm --filter db push` — this will become the migration mechanism

</code_context>

<specifics>
## Specific Ideas

- The `creator_kyc` table should carry the simplified `pending|signed|rejected` enum as a Postgres `pgEnum` (not free-text) so invalid values are caught at the DB layer.
- SignWell webhook (`/api/kyc/signwell-webhook`) should write `status = 'signed'` on successful completion event — update the webhook handler in Phase 1 to use the new status value.
- `apps/hermes/` and `apps/worker/` directories (if they exist beyond `artifacts/`) should also be deleted — north-star mentions both alongside `apps/web/`.

</specifics>

<deferred>
## Deferred Ideas

- **Admin Supabase removal**: `artifacts/admin/` still uses Supabase in 3 files. Admin is low-traffic internal tooling. Fully migrating admin to Drizzle is deferred to Phase 2 or handled as a parallel sub-task, not a Phase 1 blocker.
- **`@telegraf/session/pg` migration**: Hermes consent sessions are in-memory. Acceptable at N=1 but noted for future hardening. Not a Phase 1 blocker.
- **pgvector verification**: The north-star flags "verify pgvector availability on Replit PG — Week 1 Day 1". This is a quick check (not a blocker) — the planner should include it as a day-1 verification task.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Baseline Repair*
*Context gathered: 2026-05-27*
