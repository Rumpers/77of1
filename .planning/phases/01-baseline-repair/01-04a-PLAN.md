---
phase: 01-baseline-repair
plan: 04a
type: execute
wave: 3
depends_on: [01-02, 01-03]
files_modified:
  - artifacts/api-server/src/lib/safety-audit.ts
  - artifacts/api-server/src/lib/auth.ts
  - artifacts/api-server/src/lib/supabase.ts
  - artifacts/api-server/src/routes/account.ts
  - artifacts/api-server/src/routes/assets.ts
  - artifacts/api-server/src/routes/auth.ts
  - artifacts/api-server/src/routes/consent.ts
  - artifacts/api-server/src/routes/creator.ts
  - artifacts/api-server/src/routes/credits.ts
  - artifacts/api-server/src/routes/dsar.ts
  - artifacts/api-server/src/routes/email-webhooks.ts
  - artifacts/api-server/src/routes/fan-recovery.ts
  - artifacts/api-server/src/routes/links.ts
  - artifacts/api-server/src/routes/onboarding.ts
  - artifacts/api-server/src/routes/payments.ts
  - artifacts/api-server/src/routes/persona.ts
  - artifacts/api-server/src/routes/reports.ts
  - artifacts/api-server/src/routes/subscriptions.ts
  - artifacts/api-server/src/routes/twofa.ts
autonomous: true
requirements: [INFRA-02, COMPLY-03]
must_haves:
  truths:
    - "writeSafetyAuditLog uses Drizzle (no SupabaseClient parameter) and stamps retention_category='audit'; only sha256 hashes are written"
    - "artifacts/api-server/src/lib/supabase.ts is deleted; its cookie/auth helpers are moved to artifacts/api-server/src/lib/auth.ts before deletion"
    - "All 15 api-server route files that previously called getSupabase()/getSupabaseAnon() or imported createClient compile cleanly — Phase-1-schema calls rewritten to Drizzle, out-of-scope calls stubbed with 503 + PHASE-1 STUB marker"
    - "Every direct caller of writeSafetyAuditLog is updated to the new 0-arg(plus-entry) signature"
    - "api-server typecheck (tsc --noEmit) exits 0 across the package after this plan lands"
    - "api-server cold-starts without crashing on import resolution"
  artifacts:
    - path: "artifacts/api-server/src/lib/safety-audit.ts"
      provides: "writeSafetyAuditLog(entry) using Drizzle insert with retention_category='audit' and sha256 hashing"
      exports: ["writeSafetyAuditLog", "SafetyAuditEntry"]
    - path: "artifacts/api-server/src/lib/auth.ts"
      provides: "Replit auth helpers + relocated COOKIE_ACCESS_TOKEN, sessionCookieOptions (moved from deleted supabase.ts)"
      exports: ["getReplitUser", "COOKIE_ACCESS_TOKEN", "sessionCookieOptions"]
  key_links:
    - from: "artifacts/api-server/src/lib/safety-audit.ts"
      to: "@workspace/db"
      via: "import { db, safetyAuditLogTable } from @workspace/db"
      pattern: "safetyAuditLogTable"
    - from: "artifacts/api-server/src/routes/*"
      to: "artifacts/api-server/src/lib/auth.ts"
      via: "import { COOKIE_ACCESS_TOKEN, sessionCookieOptions } from '../lib/auth.js'"
      pattern: "from \"\\.\\./lib/auth"
---

<objective>
Strip Supabase out of the api-server's lib/safety-audit + lib/supabase glue and the 15 leaf route files that still reference Supabase. After this plan the api-server package is fully Supabase-free at the source level: lib/supabase.ts is deleted, safety-audit.ts is Drizzle-backed with retention_category='audit', and every leaf route file either uses Drizzle directly (for Phase-1-schema tables) or returns a deterministic 503 PHASE-1 STUB (for out-of-Phase-1 tables).

Purpose: This is one of two parallel Wave-3 plans that close Phase 1's Supabase removal. Plans 02 and 03 took the api-server's KYC/twin/health/middleware surfaces and Hermes off Supabase; this plan finishes the leaf route files and the lib glue. The sibling plan 01-04b (parallel, Wave 3) does the worker migration. The cleanup + cold-start verification + founder Replit Secrets checkpoint live in 01-04c (Wave 4, after both 01-04a and 01-04b land).

This plan was split out of an original 01-04 that bundled three independent work streams (api-server leaf routes, worker migration, cleanup+verification) into a single 7-task plan. Each of the three is now its own plan with clean dependency edges and a focused file surface.

Output: safety-audit.ts Drizzle-backed; cookie helpers relocated to auth.ts; supabase.ts deleted; 15 leaf route files stubbed-or-migrated; api-server typecheck passes; api-server cold-starts cleanly.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/01-baseline-repair/01-CONTEXT.md
@.planning/phases/01-baseline-repair/01-RESEARCH.md
@.planning/phases/01-baseline-repair/01-PATTERNS.md
@.planning/phases/01-baseline-repair/01-01-SUMMARY.md
@.planning/phases/01-baseline-repair/01-02-SUMMARY.md
@.planning/phases/01-baseline-repair/01-03-SUMMARY.md
@artifacts/api-server/src/lib/safety-audit.ts
@artifacts/api-server/src/lib/supabase.ts
@artifacts/api-server/src/lib/auth.ts

<interfaces>
From @workspace/db (live):
- db, pool, schema exports
- generationJobsTable, safetyAuditLogTable, consentGrantsTable, creatorsTable, creatorTotpTable, twinsTable
- eq, and, inArray (drizzle-orm)

From artifacts/api-server/src/lib/auth.ts (after Task 1a, this is also the new home for cookie helpers):
- getReplitUser(req): ReplitUser | null
- COOKIE_ACCESS_TOKEN: string  (RELOCATED from supabase.ts in Task 1a — value stays "sb-access-token" for Phase 1 backwards-compat per PATTERNS.md; rename deferred to Phase 2)
- sessionCookieOptions(maxAge: number): CookieOptions  (RELOCATED from supabase.ts in Task 1a)

Cookie/session helpers currently in supabase.ts (to be relocated in Task 1a):
- COOKIE_ACCESS_TOKEN (string constant)
- sessionCookieOptions(maxAge): CookieOptions

Route classification (used by Task 1b):
- Routes that MAY touch Phase 1 schema tables (creators, creator_kyc, creator_config, consent_grants, conversation_messages, generation_jobs, safety_audit_log, creator_totp, twins): consent.ts (consent_grants), creator.ts (creators), twofa.ts (creator_totp), persona.ts (twins.character_card)
- Routes that ONLY touch out-of-Phase-1 tables (fan_accounts, fan_subscriptions, fan_credits, credit_transactions, fan_blocks, creator_assets, creator_onboarding, email_events, link_clicks, reports_*): account.ts, assets.ts, auth.ts, credits.ts, dsar.ts, email-webhooks.ts, fan-recovery.ts, links.ts, onboarding.ts, payments.ts, reports.ts, subscriptions.ts → STUB
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1a: Rewrite safety-audit.ts on Drizzle; relocate cookie helpers to auth.ts; delete supabase.ts; update direct callers of writeSafetyAuditLog</name>
  <files>artifacts/api-server/src/lib/safety-audit.ts, artifacts/api-server/src/lib/auth.ts, artifacts/api-server/src/lib/supabase.ts</files>
  <read_first>
    - artifacts/api-server/src/lib/safety-audit.ts (current — signature takes SupabaseClient as first arg; sha256 helper at lines 23-25; fire-and-forget IIFE pattern at lines 69-97)
    - artifacts/api-server/src/lib/supabase.ts (current — locate COOKIE_ACCESS_TOKEN constant and sessionCookieOptions function around lines 31-44; identify any other exports)
    - artifacts/api-server/src/lib/auth.ts (current — find an insertion point for the relocated cookie helpers)
    - lib/db/src/schema/index.ts (confirm safetyAuditLogTable columns including retentionCategory)
    - .planning/phases/01-baseline-repair/01-PATTERNS.md sections "artifacts/api-server/src/lib/safety-audit.ts" and "artifacts/api-server/src/lib/supabase.ts (utility — REPLACED)"
    - .planning/phases/01-baseline-repair/01-RESEARCH.md Pattern 6 (Safety Audit Log Drizzle Write)
    - All direct callers of writeSafetyAuditLog: `grep -rln "writeSafetyAuditLog(" artifacts/api-server/src/` — capture the exact call sites so the 1-arg → 0-arg(plus-entry) signature change can be propagated in this task
  </read_first>
  <behavior>
    - artifacts/api-server/src/lib/safety-audit.ts exports `writeSafetyAuditLog(entry: SafetyAuditEntry): void` — no SupabaseClient parameter.
    - The function preserves the void IIFE fire-and-forget pattern and the fireSlackAlert branch for high crisis level.
    - Inside the IIFE: `const fanIdHash = sha256(entry.fanId); const messageHash = sha256(entry.messageText);` then `db.insert(safetyAuditLogTable).values({ creatorId, fanIdHash, sessionId, messageHash, crisisLevel, crisisType, locale, confidence, responseSent, twinPaused, alerted, retentionCategory: "audit" })`.
    - No raw fan_id or message text reaches the Drizzle insert payload (COMPLY-03 / D-02).
    - The sha256 helper using crypto.createHash is preserved.
    - artifacts/api-server/src/lib/auth.ts gains the two relocated exports: `COOKIE_ACCESS_TOKEN` and `sessionCookieOptions(maxAge: number)`. The Phase-1 value of `COOKIE_ACCESS_TOKEN` stays `"sb-access-token"` (rename deferred to Phase 2 per PATTERNS.md).
    - artifacts/api-server/src/lib/supabase.ts is deleted entirely AT THE END of this task — after all of its in-this-task callers (writeSafetyAuditLog + cookie-helper importers) are updated. Other route files still importing from supabase.js will fail typecheck after deletion; those are fixed in Task 1b. To keep this task green on its own verify, deletion happens only after Task 1b is also drafted in the executor's working tree — see verify automation below which tolerates the cross-task ordering by deferring the `test ! -f supabase.ts` check to Task 1b.
    - All direct callers of `writeSafetyAuditLog(supabase, entry)` are rewritten to `writeSafetyAuditLog(entry)` IN THIS TASK (signature change is the contract that Task 1b downstream stubs depend on).
    - `pnpm --filter @workspace/api-server exec tsc --noEmit` may still report errors at the END of this task — those errors are exclusively the 15 leaf route files Task 1b owns; this task's verify is scoped to safety-audit.ts + auth.ts + writeSafetyAuditLog callers.
  </behavior>
  <action>Step 1: Move `COOKIE_ACCESS_TOKEN` and `sessionCookieOptions` verbatim from artifacts/api-server/src/lib/supabase.ts to artifacts/api-server/src/lib/auth.ts. Add the necessary type import (`CookieOptions` from `"express"`) and re-export from auth.ts. Step 2: Rewrite artifacts/api-server/src/lib/safety-audit.ts: remove the `import type { SupabaseClient } from "@supabase/supabase-js"`; add `import { db } from "@workspace/db"; import { safetyAuditLogTable } from "@workspace/db";`; change the function signature to drop the `supabase` parameter; replace the Supabase insert with the Drizzle insert per RESEARCH.md Pattern 6 verbatim, including `retentionCategory: "audit"`. Preserve the sha256 helper, the IIFE pattern, the fireSlackAlert branch. Step 3: Update all DIRECT callers of `writeSafetyAuditLog` (those that pass a `supabase` first argument). Find them with `grep -rln "writeSafetyAuditLog(" artifacts/api-server/src/`. Drop the first argument at each call site. Also update any caller in this task's files that imports `COOKIE_ACCESS_TOKEN` or `sessionCookieOptions` from `../lib/supabase.js` (or similar) to import from `../lib/auth.js` instead. Step 4: Delete `artifacts/api-server/src/lib/supabase.ts`. (The 15 leaf route files that still import from this path are Task 1b's responsibility; this task's typecheck verify scopes to the three files it owns.)</action>
  <verify>
    <automated>test -f artifacts/api-server/src/lib/auth.ts && grep -q 'COOKIE_ACCESS_TOKEN' artifacts/api-server/src/lib/auth.ts && grep -q 'sessionCookieOptions' artifacts/api-server/src/lib/auth.ts && grep -q 'safetyAuditLogTable' artifacts/api-server/src/lib/safety-audit.ts && grep -q '"audit"' artifacts/api-server/src/lib/safety-audit.ts && ! grep -qE '@supabase/supabase-js|SupabaseClient' artifacts/api-server/src/lib/safety-audit.ts && test ! -f artifacts/api-server/src/lib/supabase.ts && ! grep -RqE 'writeSafetyAuditLog\([^)]*supabase' artifacts/api-server/src/</automated>
  </verify>
  <done>safety-audit.ts is Drizzle-backed with retention_category='audit' and no SupabaseClient parameter; cookie helpers relocated to auth.ts; supabase.ts deleted; all direct callers of writeSafetyAuditLog updated to drop the first argument. Remaining api-server typecheck errors are confined to the 15 leaf route files Task 1b owns.</done>
</task>

<task type="auto">
  <name>Task 1b: Mass-stub 15 leaf api-server route files — rewrite Phase-1-schema calls to Drizzle, replace out-of-scope calls with 503 + PHASE-1 STUB marker</name>
  <files>artifacts/api-server/src/routes/account.ts, artifacts/api-server/src/routes/assets.ts, artifacts/api-server/src/routes/auth.ts, artifacts/api-server/src/routes/consent.ts, artifacts/api-server/src/routes/creator.ts, artifacts/api-server/src/routes/credits.ts, artifacts/api-server/src/routes/dsar.ts, artifacts/api-server/src/routes/email-webhooks.ts, artifacts/api-server/src/routes/fan-recovery.ts, artifacts/api-server/src/routes/links.ts, artifacts/api-server/src/routes/onboarding.ts, artifacts/api-server/src/routes/payments.ts, artifacts/api-server/src/routes/persona.ts, artifacts/api-server/src/routes/reports.ts, artifacts/api-server/src/routes/subscriptions.ts, artifacts/api-server/src/routes/twofa.ts</files>
  <read_first>
    - All 15 files in <files> above — capture every Supabase import and every getSupabase()/getSupabaseAnon()/createClient() call site
    - artifacts/api-server/src/lib/auth.ts (post-Task 1a — confirms COOKIE_ACCESS_TOKEN / sessionCookieOptions now live here)
    - lib/db/src/schema/index.ts (confirms exactly which tables are in Phase 1 — used to classify each route's calls)
    - .planning/phases/01-baseline-repair/01-CONTEXT.md decisions D-01 (in-scope tables) and D-10 (deleted fan-payment functions)
    - .planning/phases/01-baseline-repair/01-RESEARCH.md "Supabase Coupling Depth — Complete File Inventory" rows for api-server
  </read_first>
  <behavior>
    - Every file in <files> has zero imports from `./supabase.js`, `../lib/supabase.js`, `../../lib/supabase.js`, or `@supabase/supabase-js`.
    - Imports for `COOKIE_ACCESS_TOKEN` / `sessionCookieOptions` are rewritten to source from `../lib/auth.js` instead of `../lib/supabase.js`.
    - Route classification per the `<interfaces>` block:
      * **Mixed** (Phase-1-schema + out-of-scope calls): consent.ts (consent_grants in scope), creator.ts (creators in scope), twofa.ts (creator_totp in scope), persona.ts (twins in scope). For each: Phase-1-schema calls are rewritten to Drizzle (`db.select().from(...).where(eq(...))`, etc.); out-of-scope calls become 503 stubs.
      * **All-out-of-scope** (only out-of-Phase-1 tables): account.ts, assets.ts, auth.ts, credits.ts, dsar.ts, email-webhooks.ts, fan-recovery.ts, links.ts, onboarding.ts, payments.ts, reports.ts, subscriptions.ts. Each handler body is replaced with `res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;` — the route definition, path, middlewares, and exported router are preserved unchanged so api-server still mounts and starts.
    - Every stub handler body includes a comment line `// PHASE-1 STUB: <table list> not in @workspace/db` documenting which out-of-scope tables would normally be touched.
    - All `writeSafetyAuditLog(supabase, ...)` call sites in these 15 files (if any beyond Task 1a's grep) are rewritten to `writeSafetyAuditLog({...})` to match the new 0-arg(plus-entry) signature.
    - `pnpm --filter @workspace/api-server exec tsc --noEmit` exits 0 across the whole api-server package after this task lands.
    - `grep -RE '@supabase/supabase-js|getSupabase\(|getSupabaseAnon\(' artifacts/api-server/src/` returns nothing.
    - api-server still cold-starts: `pnpm --filter @workspace/api-server run dev` does not crash on import resolution.
  </behavior>
  <action>For each of the 15 files listed in <files>, apply the classification rule from the behavior block:
1. **consent.ts**: rewrite any `consent_grants` insert/select via Drizzle (`db.insert(consentGrantsTable).values(...)` / `db.select().from(consentGrantsTable).where(eq(...))`), matching the pattern in `artifacts/hermes/src/consent.ts` post-Plan-03. Any `creator_assets` or `creator_onboarding` write becomes a 503 stub with PHASE-1 STUB comment.
2. **creator.ts**: rewrite any `creators` select/update via Drizzle. Any reference to `creator_assets`, `creator_subscriptions`, or fan-payment tables becomes a 503 stub.
3. **twofa.ts**: rewrite TOTP CRUD via Drizzle against `creatorTotpTable` (use the same upsert pattern that hermes/db.ts uses post-Plan-03).
4. **persona.ts**: rewrite `twins.character_card` JSONB read/write via Drizzle. Any embedding/`creator_content_embeddings` work becomes a 503 stub.
5. **All other 11 files** (account.ts, assets.ts, auth.ts, credits.ts, dsar.ts, email-webhooks.ts, fan-recovery.ts, links.ts, onboarding.ts, payments.ts, reports.ts, subscriptions.ts): replace every handler body with the 503 stub above. Keep `Router()`, `router.get/.post/.put/.delete(...)` lines, middleware chains, and the default export intact. Remove every Supabase import line. Add a one-line `// PHASE-1 STUB: <table list> not in @workspace/db — restored in Phase 2` comment at the top of each replaced handler body.

In every file, also rewrite `import { COOKIE_ACCESS_TOKEN, sessionCookieOptions } from "../lib/supabase.js"` (or similar paths) to source from `../lib/auth.js`. Then run `pnpm --filter @workspace/api-server exec tsc --noEmit` and fix any remaining errors by widening stubs (NEVER by deleting routes — they must stay mounted so api-server cold-starts). Capture the list of stubbed routes (path + HTTP verb) for the SUMMARY's Phase 2 backlog.</action>
  <acceptance_criteria>
    - `grep -RE '@supabase/supabase-js|getSupabase\(|getSupabaseAnon\(' artifacts/api-server/src/` returns nothing
    - `grep -RE 'from "\./supabase|from "\.\./lib/supabase|from "\.\./\.\./lib/supabase' artifacts/api-server/src/` returns nothing
    - Every file in <files> contains at least one `PHASE-1 STUB:` comment marker
    - `pnpm --filter @workspace/api-server exec tsc --noEmit` exits 0
    - `pnpm --filter @workspace/api-server exec node --experimental-strip-types -e 'import("./src/index.ts")'` does NOT crash on import resolution (or equivalent cold-start smoke; if api-server uses esbuild build entry, use `pnpm --filter @workspace/api-server run build` + node dist entry)
  </acceptance_criteria>
  <verify>
    <automated>! grep -RqE '@supabase/supabase-js|getSupabase\(|getSupabaseAnon\(' artifacts/api-server/src/ && ! grep -RqE 'from "\./supabase|from "\.\./lib/supabase|from "\.\./\.\./lib/supabase' artifacts/api-server/src/ && for f in artifacts/api-server/src/routes/account.ts artifacts/api-server/src/routes/assets.ts artifacts/api-server/src/routes/auth.ts artifacts/api-server/src/routes/consent.ts artifacts/api-server/src/routes/creator.ts artifacts/api-server/src/routes/credits.ts artifacts/api-server/src/routes/dsar.ts artifacts/api-server/src/routes/email-webhooks.ts artifacts/api-server/src/routes/fan-recovery.ts artifacts/api-server/src/routes/links.ts artifacts/api-server/src/routes/onboarding.ts artifacts/api-server/src/routes/payments.ts artifacts/api-server/src/routes/persona.ts artifacts/api-server/src/routes/reports.ts artifacts/api-server/src/routes/subscriptions.ts artifacts/api-server/src/routes/twofa.ts; do grep -q 'PHASE-1 STUB' "$f" || { echo "MISSING STUB MARKER: $f"; exit 1; }; done && pnpm --filter @workspace/api-server exec tsc --noEmit</automated>
  </verify>
  <done>All 15 leaf api-server route files are Supabase-free; Phase-1-schema calls (consent.ts/creator.ts/twofa.ts/persona.ts) rewritten to Drizzle; out-of-scope handlers return 503 with PHASE-1 STUB markers; api-server typecheck passes; api-server cold-starts cleanly; the full list of stubbed routes is captured for the Phase 2 backlog (recorded in SUMMARY).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| stubbed leaf route handlers (Task 1b) -> external fan/admin callers | Any caller hitting account/assets/auth/credits/dsar/email-webhooks/fan-recovery/links/onboarding/payments/reports/subscriptions in Phase 1 gets a deterministic 503 — no silent half-implemented writes |
| writeSafetyAuditLog (Task 1a) -> safety_audit_log table | Sensitive audit data must reach DB with only hashed identifiers; signature change must propagate to every caller |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04a-01 | Information Disclosure | safety-audit.ts could insert raw fan_id or message text into the safety_audit_log row | mitigate | Task 1a hashes both via sha256 helper before the Drizzle insert; pattern enforced verbatim per RESEARCH.md Pattern 6; verify gate greps for `"audit"` retention category presence |
| T-04a-02 | Tampering | A stubbed leaf route (Task 1b) silently returns 200 instead of 503, letting a caller assume work happened | mitigate | Task 1b mandates a 503 + `code: "PHASE_1_STUB"` response in every stubbed handler body and a `PHASE-1 STUB:` comment marker; the verify gate greps for the marker in all 15 files |
| T-04a-03 | Elevation of Privilege | A leaf route's middleware chain is dropped during stubbing, allowing unauthenticated callers to hit a now-503 endpoint that previously required auth | accept | A 503 with no body data leaks nothing of substance; the middleware-chain preservation rule in Task 1b's action mitigates the larger risk |
| T-04a-04 | Repudiation | Direct caller of writeSafetyAuditLog is missed during signature update, silently dropping audit rows | mitigate | Task 1a verify gate runs `! grep -RqE 'writeSafetyAuditLog\([^)]*supabase' artifacts/api-server/src/` to confirm no caller still passes a SupabaseClient first arg |
| T-04a-SC | Tampering | npm/pnpm installs | mitigate | No new packages installed in this plan; only file rewrites; pnpm catalog discipline preserved |
</threat_model>

<verification>
- `pnpm --filter @workspace/api-server exec tsc --noEmit` exits 0
- artifacts/api-server/src/lib/supabase.ts does NOT exist (deleted in Task 1a)
- `grep -RE 'supabase-js|getSupabase\(|getSupabaseAnon\(' artifacts/api-server/src/` returns nothing
- Every leaf route file Task 1b stubs has a `PHASE-1 STUB:` marker
- safety_audit_log writes via Drizzle with retention_category='audit' and hashed identifiers only (COMPLY-03)
- api-server cold-starts cleanly with no Supabase import resolution failures
</verification>

<success_criteria>
api-server source is fully Supabase-free: lib/supabase.ts deleted, safety-audit.ts Drizzle-backed with retention_category='audit' and hashed identifiers, and every leaf route file either uses Drizzle directly (Phase-1-schema tables) or returns a deterministic 503 PHASE-1 STUB (out-of-Phase-1 tables). The api-server's package-level typecheck exits 0 and the cold-start smoke succeeds.
</success_criteria>

<output>
Create `.planning/phases/01-baseline-repair/01-04a-SUMMARY.md` when done. The summary MUST enumerate, as a checklist for Phase 2 backlog, every leaf route file from Task 1b with the list of (HTTP verb, path, table dependencies) for the stubbed handlers.
</output>
</content>
</invoke>