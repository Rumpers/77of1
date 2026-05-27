# Phase 1: Baseline Repair - Research

**Researched:** 2026-05-27
**Domain:** Database migration (Supabase → Drizzle/Replit PG), KYC middleware, data schema design
**Confidence:** HIGH — all findings derived from direct codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Phase 1 Drizzle schema tables: `creators`, `twins`, `creator_kyc`, `creator_config`, `consent_grants`, `conversation_messages`, `generation_jobs`, `safety_audit_log`. Fan-payment tables (`fan_credits`, `credit_transactions`, `fan_blocks`) are NOT added — permanently out of scope.
- **D-02:** `safety_audit_log` includes `retention_category` column from day one. Raw message content is never written to any table. Only `sha256(fan_id)` and `sha256(message)` hash columns.
- **D-03:** `conversation_messages` stores plaintext content (not hash-only) with `retention_category = 'transcript'`, 90-day TTL applied in Phase 4. Schema: `id`, `conversation_id`, `creator_id`, `twin_id`, `role`, `content`, `retention_category`, `created_at`.
- **D-04:** `generation_jobs` carries `consent_grant_id` FK to `consent_grants`.
- **D-05:** KYC status enum simplified to `pending | signed | rejected`. Gate check is `status === 'signed'`. Null/undefined/missing row → 423.
- **D-06:** `isKycComplete()` renamed `isKycSigned()`, updated to check `status === 'signed'`. All callers updated.
- **D-07:** KYC agreement template must include Voice Synthesis Authorization section with scope, duration, and revocability as explicit line items.
- **D-08:** `apps/web/` deleted in Phase 1. Fan-facing SPA lives in `artifacts/web/`.
- **D-09:** `artifacts/hermes/src/db.ts` rewritten using `@workspace/db`. Hermes adds `@workspace/db` as workspace dep. `@supabase/supabase-js` removed from hermes `package.json`.
- **D-10:** `blockFan`, `getCreatorStats` (fan count), `listFansForCreator` removed from hermes/db.ts. Remaining functions rewritten against Drizzle.
- **D-11:** Supabase removal sequence: (1) remove env vars from `.env.example`, (2) search for remaining imports, (3) remove all client code, (4) remove from all `package.json` files, (5) run typecheck.
- **D-12:** `supabase/` directory preserved in git history, no new migration files added after Phase 1.
- **D-13:** INFRA-04 (BullMQ + Redis) wired at queue-definition level only in Phase 1. Actual workers are stubs. `lib/queue` confirmed compatible — no Supabase-specific fields.
- **D-14:** Every table touching fan interactions gets `retention_category VARCHAR NOT NULL DEFAULT 'operational'` with values `operational | transcript | audit`.

### Claude's Discretion

None specified — all key decisions were locked in the context session.

### Deferred Ideas (OUT OF SCOPE)

- Admin Supabase removal: `artifacts/admin/` still uses Supabase in 3 files — deferred to Phase 2.
- `@telegraf/session/pg` migration for hermes consent sessions — not a Phase 1 blocker.
- pgvector availability check — a quick Day 1 verification task but not a blocker.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Ports 8080/22333/3001 respond without error on cold deploy | Health route already exists; `artifact.toml` port mapping verified; `apps/web/` deletion removes broken Next.js from workspace |
| INFRA-02 | Supabase client fully removed; all DB through Drizzle + Replit PG | 41 files with Supabase imports catalogued (excluding migration-backup); removal order and per-file strategy documented |
| INFRA-03 | Drizzle schema defines all core tables | `lib/db/src/schema/index.ts` is an empty placeholder; full schema from existing SQL migrations must be ported to Drizzle `pgTable` definitions |
| INFRA-04 | BullMQ queue backed by Redis for async jobs | `lib/queue` already defines 6 queues with correct Drizzle-compatible payloads; wiring is queue-definition confirmation only |
| KYC-01 | Twin chat returns 423 until `creator_kyc.status = 'signed'` | `isKycComplete()` in `kyc.ts` must be renamed and rewritten; current check is `status === 'complete'` using the old 8-state enum |
| KYC-02 | KYC agreement explicitly names voice synthesis scope | `kyc.ts` SignWell integration is reusable; template body must be updated with Voice Synthesis Authorization section |
| PERSONA-03 | `twins` table has `visibility` column (`public`/`private`) | Table does not exist in Drizzle schema yet; must be included in Phase 1 schema with the `public\|private` enum |
| COMPLY-03 | No raw fan message content in logs or audit records; hashed identifiers only | `safety_audit_log` already uses `fan_id_hash` + `message_hash` pattern; must be replicated in `conversation_messages` retention design |

</phase_requirements>

---

## Summary

Phase 1 is a brownfield infrastructure migration, not a greenfield build. The database layer is the crux: `lib/db/src/schema/index.ts` is an empty placeholder while the actual schema exists only in Supabase SQL migrations (`supabase/migrations/`). The work is to port that SQL schema into typed Drizzle `pgTable` definitions, then replace every Supabase client call across 41 files with Drizzle queries.

The Supabase coupling is deep and consistent: every artifact (api-server, hermes, worker, admin) initializes a `createClient()` instance either at startup or per-function-call. The `@supabase/supabase-js` package is in the `dependencies` of api-server, hermes, worker, and admin. Auth (Supabase JWT verification) is also Supabase-coupled via `getUserFromToken()` in the middleware layer, but Phase 1 defers auth replacement — the focus is on data writes only.

The KYC gate simplification (8 statuses → 3) is the most impactful non-schema change. Currently `isKycComplete()` checks `status === 'complete'` using the extended enum. Phase 1 collapses this to `status === 'signed'` and the gate must become a strict positive assertion in the twin route (which is currently a canned-response stub with no KYC check at all).

**Primary recommendation:** Follow the env-vars-first removal order (D-11). Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to empty strings in all envs before touching code — this surfaces hidden dependencies as runtime errors rather than silent data writes.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema definition | lib/db | — | Single source of truth for all tables; imported by all services |
| Supabase client removal | All artifact tiers | — | Each artifact has its own `@supabase/supabase-js` dep and client init |
| KYC gate enforcement | API / Backend (api-server) | — | Twin chat route and entitlement middleware live in api-server |
| Creator identity resolution (Hermes) | Hermes | lib/db | Hermes resolves creator via Telegram user ID; must use Drizzle after migration |
| Job queue wiring | lib/queue | api-server, worker | Queue definitions are in lib/queue; api-server enqueues, worker consumes |
| Env var cleanup | Project root | Each artifact | `.env.example` is in repo root; Replit Secrets are per-deployment |
| apps/web deletion | Project root | — | Directory deletion at repo root; no code dependency to untangle |
| Port healthcheck | api-server (port 8080) | artifacts/web (22333), admin (3001) | `/api/health` already exists; web and admin need no code changes |

---

## Standard Stack

No new packages need to be installed for Phase 1. The Drizzle stack is already fully in place.

### Core (already installed, no action needed)

| Library | Version (catalog) | Purpose | Why |
|---------|-------------------|---------|-----|
| drizzle-orm | ^0.45.2 | ORM + query builder | In workspace catalog; used in lib/db already |
| drizzle-zod | ^0.8.3 | Drizzle → Zod schema bridge | In lib/db `dependencies`; derives insert/select schemas from table definitions |
| drizzle-kit | ^0.31.10 | Schema push + migration generation | In lib/db `devDependencies`; `pnpm --filter db push` is the dev migration path |
| pg | ^8.20.0 | PostgreSQL Pool driver | In lib/db `dependencies`; Pool pattern already correctly initialized in `lib/db/src/index.ts` |
| zod | ^3.25.76 | Schema validation | In catalog; `zod/v4` import already used in template comments in schema/index.ts |

### Packages to REMOVE

| Package | From | Action |
|---------|------|--------|
| `@supabase/supabase-js` ^2.106.1 | `artifacts/api-server/package.json` | Remove after code migration |
| `@supabase/supabase-js` ^2.106.1 | `artifacts/hermes/package.json` | Remove after code migration |
| `@supabase/supabase-js` ^2.106.1 | `artifacts/worker/package.json` | Remove after code migration |
| `@supabase/supabase-js` ^2.106.1 | `artifacts/admin/package.json` | Deferred to Phase 2 — admin kept broken |

### New dependencies needed

None for Phase 1. `@workspace/db` is already in `api-server` deps. Hermes needs it added:

```bash
# In artifacts/hermes/package.json — add to dependencies:
"@workspace/db": "workspace:*"
```

---

## Package Legitimacy Audit

> No new packages are installed in Phase 1 — only removal of `@supabase/supabase-js` and adding `@workspace/db` (workspace-local, no registry). Package legitimacy gate is not applicable.

**Packages removed:** `@supabase/supabase-js` from api-server, hermes, worker (admin deferred)
**Packages added:** none from external registry
**Packages flagged:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Current state (Phase 0):
  hermes / api-server / worker
      → createClient(SUPABASE_URL, SERVICE_ROLE_KEY)  [per-function or at startup]
      → supabase.from("table").select/insert/update()
      → Supabase backend (external)

Target state (Phase 1):
  hermes / api-server / worker
      → import { db } from "@workspace/db"            [singleton pool, shared]
      → db.select().from(table) / db.insert(table).values(row)
      → Replit PostgreSQL (DATABASE_URL, same host)
```

### Recommended Project Structure

No structure changes needed. `lib/db/src/schema/index.ts` is the only file that gets substantial new code. Each artifact's DB helper files get their Supabase calls replaced with Drizzle equivalents.

```
lib/db/src/
├── index.ts          # Pool + drizzle() init — already correct, no changes
├── schema/
│   └── index.ts      # EMPTY → write all 8 tables here (or split into files)
└── migrations/       # Only if using drizzle-kit generate (vs push)
```

### Pattern 1: Drizzle Table Definition with pgEnum

```typescript
// Source: Drizzle ORM official docs — https://orm.drizzle.team/docs/column-types/pg
import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Use pgEnum for all status/type columns — DB-level constraint catches invalid values
export const kycStatusEnum = pgEnum("kyc_status", ["pending", "signed", "rejected"]);

export const creatorKycTable = pgTable("creator_kyc", {
  id:              uuid("id").primaryKey().defaultRandom(),
  creatorId:       uuid("creator_id").notNull().references(() => creatorsTable.id, { onDelete: "cascade" }),
  status:          kycStatusEnum("status").notNull().default("pending"),
  signwellDocId:   text("signwell_doc_id").unique(),
  signwellSigningUrl: text("signwell_signing_url"),
  personalityRightsSignedAt: timestamp("personality_rights_signed_at", { withTimezone: true }),
  personalityRightsIpHash: text("personality_rights_ip_hash"),
  opsNotes:        text("ops_notes"),
  opsReviewedBy:   text("ops_reviewed_by"),
  opsReviewedAt:   timestamp("ops_reviewed_at", { withTimezone: true }),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCreatorKycSchema = createInsertSchema(creatorKycTable).omit({ id: true, createdAt: true, updatedAt: true });
export type CreatorKyc = typeof creatorKycTable.$inferSelect;
export type InsertCreatorKyc = z.infer<typeof insertCreatorKycSchema>;
```

### Pattern 2: Drizzle Pool Connection (already correct in lib/db/src/index.ts)

```typescript
// Source: lib/db/src/index.ts (confirmed correct — no changes needed)
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
export * from "./schema";
```

### Pattern 3: Drizzle Query Equivalents for Supabase Calls

```typescript
// Source: Drizzle ORM docs — https://orm.drizzle.team/docs/select

// Supabase: supabase.from("creators").select("id, display_name").eq("telegram_user_id", id).maybeSingle()
// Drizzle:
const creator = await db
  .select({ id: creatorsTable.id, displayName: creatorsTable.displayName })
  .from(creatorsTable)
  .where(eq(creatorsTable.telegramUserId, String(telegramUserId)))
  .limit(1)
  .then((rows) => rows[0] ?? null);

// Supabase: supabase.from("creator_config").update({ paused, updated_at }).eq("creator_id", id)
// Drizzle:
await db
  .update(creatorConfigTable)
  .set({ paused, updatedAt: new Date() })
  .where(eq(creatorConfigTable.creatorId, creatorId));

// Supabase: supabase.from("creator_totp").upsert({...})
// Drizzle:
await db
  .insert(creatorTotpTable)
  .values({ creatorId, totpSecret: secret, totpEnabled: true, ... })
  .onConflictDoUpdate({
    target: creatorTotpTable.creatorId,
    set: { totpSecret: secret, totpEnabled: true, updatedAt: new Date() },
  });
```

### Pattern 4: isKycSigned() Replacement

```typescript
// REPLACES: isKycComplete() which checked status === 'complete' via Supabase
// Source: derived from D-05, D-06 decisions

export async function isKycSigned(creatorId: string): Promise<boolean> {
  const row = await db
    .select({ status: creatorKycTable.status })
    .from(creatorKycTable)
    .where(eq(creatorKycTable.creatorId, creatorId))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  // Strict positive assertion: ONLY 'signed' passes. null/pending/rejected all block.
  return row?.status === "signed";
}
```

### Pattern 5: KYC Gate Middleware in Twin Route

```typescript
// The current twin.ts (POST /api/twin/chat) has NO KYC gate at all.
// This must be added:

router.post("/twin/chat", async (req: Request, res: Response) => {
  const { handle } = req.body as { handle?: string; ... };

  // Resolve creator by handle
  const creator = await db.select()
    .from(creatorsTable)
    .where(eq(creatorsTable.handle, handle ?? ""))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!creator) {
    res.status(404).json({ error: "Creator not found" });
    return;
  }

  // KYC gate — strict positive assertion (Pitfall #4)
  const signed = await isKycSigned(creator.id);
  if (!signed) {
    res.status(423).json({
      error: "Creator onboarding not complete",
      code: "KYC_UNSIGNED",
    });
    return;
  }
  // ... rest of handler
});
```

### Pattern 6: Safety Audit Log Drizzle Write

```typescript
// Replaces: supabase.from("safety_audit_log").insert({...})
// Must maintain: no raw PII — fan_id_hash and message_hash only

export function writeSafetyAuditLog(entry: SafetyAuditEntry): void {
  void (async () => {
    const fanIdHash = sha256(entry.fanId);
    const messageHash = sha256(entry.messageText);
    await db.insert(safetyAuditLogTable).values({
      creatorId: entry.creatorId,
      fanIdHash,
      sessionId: entry.sessionId,
      messageHash,
      crisisLevel: entry.crisisLevel,
      crisisType: entry.crisisType ?? null,
      locale: entry.locale,
      confidence: entry.confidence ?? null,
      responseSent: entry.responseSent,
      twinPaused: entry.twinPaused,
      alerted: false,
      retentionCategory: "audit",  // new column per D-14
    });
  })();
}
```

### Anti-Patterns to Avoid

- **Per-function `createClient()` calls:** The existing pattern in `hermes/db.ts` and `api-server/lib/supabase.ts` creates a new Supabase client on every call. Do NOT replicate this pattern with Drizzle — the Pool in `lib/db/src/index.ts` is the singleton; import `db` from `@workspace/db` directly.
- **Nullable status columns:** Do not create the `creator_kyc.status` column as nullable. It must be `NOT NULL DEFAULT 'pending'` so the DB layer prevents null bypass (Pitfall #4).
- **Checking `status !== 'rejected'`:** The gate must be `=== 'signed'`, not `!== 'rejected'`. The negative check allows null, pending, or any future status to pass.
- **Drizzle with `neon-http` driver:** Replit PG is standard PostgreSQL. Use `drizzle-orm/node-postgres` with `pg.Pool`, not `drizzle-orm/neon-http`.
- **Drizzle-kit `push` on pooled connection:** Use a direct (non-pooled) `DATABASE_URL` for `drizzle-kit push`. PgBouncer-pooled connections break DDL transactions.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL schema column types | Raw SQL text constants | `pgEnum()`, `uuid()`, `timestamp()` from `drizzle-orm/pg-core` | Type inference, TypeScript autocomplete, migration safety |
| Zod schemas for DB rows | Hand-written `z.object({...})` | `createInsertSchema(table)` from `drizzle-zod` | Single source of truth; stays in sync with table definition |
| SHA-256 hashing of IDs/content | Custom hash library | `crypto.createHash('sha256')` (Node built-in) | Already used in `safety-audit.ts`; no dependency needed |
| Connection pooling | Custom pool logic | `pg.Pool` already in `lib/db/src/index.ts` | Already correct; do not change |
| `updated_at` trigger | Drizzle trigger | `.$onUpdateFn(() => new Date())` on the column definition | Drizzle handles this without a DB trigger |

---

## Supabase Coupling Depth — Complete File Inventory

This is the complete list of non-backup files that import `@supabase/supabase-js` and must be addressed. [VERIFIED: direct grep of codebase]

### api-server (highest priority — Phase 1 scope)

| File | Supabase Usage | Phase 1 Action |
|------|---------------|----------------|
| `src/lib/supabase.ts` | `createClient()` factory, JWT validation via `auth.getUser()`, cookie names | Replace with Drizzle query + JWT library; or stub auth (auth is Replit-based in kyc.ts but Supabase JWT in middleware — see Open Questions) |
| `src/lib/kyc.ts` | All DB queries on `creator_kyc` table via Supabase client | Rewrite with Drizzle; rename `isKycComplete` → `isKycSigned`; update status enum |
| `src/lib/safety-audit.ts` | `SupabaseClient` type + `supabase.from("safety_audit_log").insert()` | Rewrite with Drizzle; add `retention_category` column write |
| `src/middlewares/require-creator-auth.ts` | Supabase JWT `getUserFromToken()` + `creators` table query | Requires auth strategy decision (see Open Questions) |
| `src/middlewares/require-fan-access.ts` | Supabase JWT + `fan_accounts` table + `fan_subscriptions` table | `fan_accounts` / `fan_subscriptions` not in Phase 1 Drizzle schema — stub or skip for Phase 1 |
| `src/routes/kyc.ts` | All KYC routes use `getSupabase()` for DB + Supabase Storage signed URLs | Rewrite DB calls with Drizzle; Supabase Storage calls need Replit Object Storage replacement (Phase 3 work — stub for Phase 1) |
| `src/routes/account.ts`, `assets.ts`, `auth.ts`, `consent.ts`, `creator.ts`, `credits.ts`, `dsar.ts`, `email-webhooks.ts`, `fan-recovery.ts`, `onboarding.ts`, `payments.ts`, `persona.ts`, `reports.ts`, `subscriptions.ts`, `twofa.ts` | Various Supabase DB calls | Most reference fan-payment tables out of scope for Phase 1 Drizzle schema; migrate in-scope tables only |
| `src/routes/health.ts` | `GET /api/health/db` dynamically imports `@supabase/supabase-js` | Replace with Drizzle Pool ping: `await pool.query("SELECT 1")` |

### hermes (full migration in Phase 1 — D-09)

| File | Supabase Usage | Phase 1 Action |
|------|---------------|----------------|
| `src/db.ts` | All DB helpers via `createClient()` | Rewrite all functions with Drizzle; remove `blockFan`, `listFansForCreator`, `getCreatorStats` (fan count) |
| `src/consent.ts` | `commitConsent` writes to `consent_grants` via Supabase | Rewrite with Drizzle insert |
| `src/onboarding.ts` | Embedding + persona stores via Supabase | Phase 1: replace DB calls with Drizzle where they touch Phase 1 schema tables; embedding store deferred |
| `src/asset-moderator.ts` | Audit log writes via Supabase | Rewrite with Drizzle `safety_audit_log` insert |

### worker (Phase 1: remove Supabase, replace with Drizzle)

| File | Supabase Usage | Phase 1 Action |
|------|---------------|----------------|
| `src/index.ts` | `createClient()` at startup; all job state updates | Rewrite with Drizzle; import `db` from `@workspace/db` |
| `src/dlq-handler.ts` | Supabase audit_log insert + creator_notifications | Rewrite with Drizzle |
| `src/crons/sla-alert.ts` | Supabase DB query | Rewrite with Drizzle |
| `src/workers/consent-revocation.ts` | `SupabaseClient` type + audit_log write | Rewrite; `SupabaseClient` type replaced with `typeof db` |
| `src/workers/moderation.ts`, `text-generation.ts`, `video-generation.ts`, `voice-generation.ts`, `dunning-retry.ts` | Various Supabase reads/writes | Rewrite with Drizzle for Phase 1 schema tables; stub calls to out-of-scope tables |

### admin (DEFERRED to Phase 2 per D-deferred)

| File | Supabase Usage | Phase 1 Action |
|------|---------------|----------------|
| `src/lib/supabase.ts` | `getAdminSupabase()` singleton | Deferred — admin left broken in Phase 1 |
| `src/lib/audit.ts`, `src/lib/db.ts` | Supabase queries | Deferred |
| `src/app/api/admin/deletions/...` | Supabase | Deferred |
| `src/app/admin/deletions/page.tsx` | Supabase | Deferred |

---

## Drizzle Schema Design

### 8 Tables — Complete Column Mapping

Derived from: Supabase migrations in `supabase/migrations/` + CONTEXT.md decisions. [VERIFIED: direct inspection]

#### Table 1: `creators`

Supabase source: `20260524000001_schema_v1.sql`

```typescript
export const creatorsTable = pgTable("creators", {
  id:           uuid("id").primaryKey().defaultRandom(),
  handle:       text("handle").notNull().unique(),
  displayName:  text("display_name").notNull(),
  config:       jsonb("config").notNull().default({}),
  replitUserId: text("replit_user_id").unique(),
  telegramUserId: text("telegram_user_id").unique(),  // needed by hermes findCreatorByTelegramId
  killSwitchActive: boolean("kill_switch_active").notNull().default(false),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});
```

Note: The existing schema uses `replit_user_id` for creator linkage but hermes uses `telegram_user_id`. Both must be present. [VERIFIED: hermes/db.ts `findCreatorByTelegramId` + api-server kyc.ts resolveCreatorId]

#### Table 2: `twins`

No existing Supabase migration (not in schema_v1.sql). Must be created fresh.

```typescript
export const twinVisibilityEnum = pgEnum("twin_visibility", ["public", "private"]);

export const twinsTable = pgTable("twins", {
  id:          uuid("id").primaryKey().defaultRandom(),
  creatorId:   uuid("creator_id").notNull().references(() => creatorsTable.id, { onDelete: "cascade" }),
  handle:      text("handle").notNull().unique(),  // URL path segment
  status:      text("status").notNull().default("inactive"),  // inactive | active | paused
  visibility:  twinVisibilityEnum("visibility").notNull().default("private"),  // PERSONA-03
  characterCard: jsonb("character_card"),  // Character Card V2 JSON (Phase 2 populates)
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});
```

#### Table 3: `creator_kyc`

Supabase source: `20260525000001_creator_kyc.sql`. Simplified from 8-state to 3-state enum per D-05.

```typescript
export const kycStatusEnum = pgEnum("kyc_status", ["pending", "signed", "rejected"]);

export const creatorKycTable = pgTable("creator_kyc", {
  id:                         uuid("id").primaryKey().defaultRandom(),
  creatorId:                  uuid("creator_id").notNull().unique().references(() => creatorsTable.id, { onDelete: "cascade" }),
  status:                     kycStatusEnum("status").notNull().default("pending"),
  signwellDocId:              text("signwell_doc_id").unique(),
  signwellSigningUrl:         text("signwell_signing_url"),
  personalityRightsSignedAt:  timestamp("personality_rights_signed_at", { withTimezone: true }),
  personalityRightsIpHash:    text("personality_rights_ip_hash"),
  voiceSynthesisConsentGranted: boolean("voice_synthesis_consent_granted").notNull().default(false),  // D-07 explicit column
  opsNotes:                   text("ops_notes"),
  opsReviewedBy:              text("ops_reviewed_by"),
  opsReviewedAt:              timestamp("ops_reviewed_at", { withTimezone: true }),
  createdAt:                  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:                  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});
```

**Critical:** `status` is `NOT NULL DEFAULT 'pending'` — no null values possible. The old migration had this correct. [VERIFIED: 20260525000001_creator_kyc.sql]

#### Table 4: `creator_config`

Implicit from hermes usage of `creator_config` table (`paused`, `timezone`, `hermes_language`). Not in schema_v1.sql — must be created.

```typescript
export const creatorConfigTable = pgTable("creator_config", {
  creatorId:      uuid("creator_id").primaryKey().references(() => creatorsTable.id, { onDelete: "cascade" }),
  paused:         boolean("paused").notNull().default(false),
  timezone:       text("timezone").notNull().default("UTC"),
  hermesLanguage: text("hermes_language").notNull().default("en"),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
});
```

[VERIFIED: hermes/db.ts `setPaused`, `getCreatorPreferences`, `setTimezone`, `setHermesLanguage`]

#### Table 5: `consent_grants`

Supabase source: schema_v1.sql. Modified to add `retention_category` per D-14.

```typescript
export const consentGrantModalityEnum = pgEnum("consent_grant_modality", ["persona_text", "voice", "image", "talking_video", "fullbody_video"]);

export const consentGrantsTable = pgTable("consent_grants", {
  id:                uuid("id").primaryKey().defaultRandom(),
  creatorId:         uuid("creator_id").notNull().references(() => creatorsTable.id, { onDelete: "cascade" }),
  modality:          consentGrantModalityEnum("modality").notNull(),
  granted:           boolean("granted").notNull().default(false),
  grantedAt:         timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt:         timestamp("revoked_at", { withTimezone: true }),
  version:           integer("version").notNull().default(1),
  consentVersion:    text("consent_version").notNull().default("v1.0"),
  channel:           text("channel").notNull().default("telegram"),  // 'telegram' | 'web'
  ipHash:            text("ip_hash"),
  retentionCategory: text("retention_category").notNull().default("operational"),  // D-14
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueCreatorModalityVersion: unique().on(t.creatorId, t.modality, t.version),
}));
```

[VERIFIED: schema_v1.sql + hermes/consent.ts `commitConsent`]

#### Table 6: `conversation_messages`

Not in existing Supabase schema (confirmed from ARCHITECTURE.md gap #5). Created fresh per D-03.

```typescript
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);
export const retentionCategoryEnum = pgEnum("retention_category", ["operational", "transcript", "audit"]);

export const conversationMessagesTable = pgTable("conversation_messages", {
  id:                uuid("id").primaryKey().defaultRandom(),
  conversationId:    text("conversation_id").notNull(),  // HMAC-signed token, validated in Phase 2
  creatorId:         uuid("creator_id").notNull().references(() => creatorsTable.id),
  twinId:            uuid("twin_id").references(() => twinsTable.id),
  role:              messageRoleEnum("role").notNull(),
  content:           text("content").notNull(),  // plaintext per D-03; 90-day TTL via Phase 4 cron
  retentionCategory: retentionCategoryEnum("retention_category").notNull().default("transcript"),  // D-14
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  conversationIdx: index("conversation_messages_conversation_idx").on(t.conversationId),
  creatorCreatedIdx: index("conversation_messages_creator_created_idx").on(t.creatorId, t.createdAt),
}));
```

#### Table 7: `generation_jobs`

Supabase source: schema_v1.sql. Modified: added `consent_grant_id` FK per D-04.

```typescript
export const generationJobStatusEnum = pgEnum("generation_job_status", ["queued", "processing", "complete", "failed", "cancelled", "dlq"]);

export const generationJobsTable = pgTable("generation_jobs", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  creatorId:          uuid("creator_id").notNull().references(() => creatorsTable.id),
  consentGrantId:     uuid("consent_grant_id").notNull().references(() => consentGrantsTable.id),  // D-04
  bullmqJobId:        text("bullmq_job_id"),
  jobType:            text("job_type").notNull(),  // 'text' | 'voice' | 'video' | 'moderation'
  status:             generationJobStatusEnum("status").notNull().default("queued"),
  attemptCount:       integer("attempt_count").notNull().default(0),
  consentGrantVersion: integer("consent_grant_version").notNull().default(1),
  resultUrl:          text("result_url"),
  errorMessage:       text("error_message"),
  retentionCategory:  text("retention_category").notNull().default("operational"),  // D-14
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt:        timestamp("completed_at", { withTimezone: true }),
}, (t) => ({
  creatorIdx:    index("generation_jobs_creator_idx").on(t.creatorId),
  revocationIdx: index("generation_jobs_revocation_idx").on(t.creatorId, t.consentGrantId, t.status),
}));
```

[VERIFIED: schema_v1.sql + lib/queue/src/types.ts `GenerationJobPayload`]

#### Table 8: `safety_audit_log`

Supabase source: `20260525000001_safety_audit_log.sql`. Add `retention_category` per D-14.

```typescript
export const crisisLevelEnum = pgEnum("crisis_level", ["none", "low", "medium", "high"]);

export const safetyAuditLogTable = pgTable("safety_audit_log", {
  id:                uuid("id").primaryKey().defaultRandom(),
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  creatorId:         uuid("creator_id").notNull().references(() => creatorsTable.id),
  fanIdHash:         text("fan_id_hash").notNull(),     // SHA-256 of fan_id — COMPLY-03
  sessionId:         text("session_id").notNull(),
  messageHash:       text("message_hash").notNull(),    // SHA-256 of message — COMPLY-03
  crisisLevel:       crisisLevelEnum("crisis_level").notNull(),
  crisisType:        text("crisis_type"),
  locale:            text("locale").notNull().default("en"),
  confidence:        real("confidence"),
  responseSent:      boolean("response_sent").notNull().default(false),
  twinPaused:        boolean("twin_paused").notNull().default(false),
  alerted:           boolean("alerted").notNull().default(false),
  retentionCategory: text("retention_category").notNull().default("audit"),  // D-14, D-02
}, (t) => ({
  createdAtIdx:      index("safety_audit_log_created_at_idx").on(t.createdAt),
  creatorCreatedIdx: index("safety_audit_log_creator_created_idx").on(t.creatorId, t.createdAt),
}));
```

[VERIFIED: 20260525000001_safety_audit_log.sql + safety-audit.ts]

### Supplemental Tables (needed by hermes but not in 8-table list)

The hermes `db.ts` references `creator_totp` for TOTP functions (`getTotpRecord`, `saveTotpEnabled`, etc.). This table does not appear in the existing Supabase migrations provided but is used in hermes. Research finding: [ASSUMED] — `creator_totp` exists but its migration file was not found in the directory listing. The planner should add a verification task to confirm whether this table exists and include it in the schema if so.

---

## Common Pitfalls

### Pitfall 1: KYC Status Enum Migration Mismatch

**What goes wrong:** The existing Supabase `creator_kyc` table has an 8-state CHECK constraint. The Phase 1 Drizzle schema uses a 3-state `pgEnum`. If any existing rows in the (test) database have statuses other than `pending | signed | rejected`, the schema push will fail or leave data inconsistent.
**Why it happens:** `drizzle-kit push` compares Drizzle schema against the live DB schema. If the DB has `status = 'complete'` (old enum) and Drizzle defines `pgEnum("kyc_status", ["pending","signed","rejected"])`, the push will fail on the constraint.
**How to avoid:** On a fresh Replit PG database there are no existing rows — push is a clean slate. If any test data exists with old status values, back-fill or truncate before push.
**Warning signs:** `drizzle-kit push` output showing "constraint violation" or "cannot alter column type".

### Pitfall 2: Supabase Auth JWT Validation Removed with No Replacement

**What goes wrong:** `require-creator-auth.ts` calls `getUserFromToken()` which validates a Supabase JWT. When Supabase is removed, this validation disappears. If the auth middleware is left broken or bypassed, all creator routes become unauthenticated.
**Why it happens:** Supabase auth is entangled with the database client — they share `@supabase/supabase-js`. Removing the package removes JWT validation.
**How to avoid:** For Phase 1, stub `getUserFromToken()` to return a hardcoded dev user, OR wire Replit auth properly. The `getReplitUser()` helper in `lib/auth.ts` is already used in some kyc routes — use this consistently as the replacement. The fan middleware (`require-fan-access.ts`) touches `fan_accounts` + `fan_subscriptions` which are out of Phase 1 scope; stub it to `next()` for Phase 1.
**Warning signs:** Creator routes returning 401/403 unexpectedly after migration.

### Pitfall 3: `creator_totp` Table Missing from Drizzle Schema

**What goes wrong:** `hermes/db.ts` has `getTotpRecord`, `saveTotpEnabled`, `disableTotpRecord`, `updateRecoveryCodes` functions that query a `creator_totp` table. This table does not appear in the primary `schema_v1.sql` Supabase migration (only in a separate migration not found in the listing). If the Drizzle schema omits it, the TOTP functions will fail at runtime.
**How to avoid:** Search all Supabase migrations for `creator_totp` definition, include it in the Drizzle schema. The planner should include a task to verify this table's column structure.
**Warning signs:** TypeScript error "table 'creator_totp' not found in schema" or runtime query failure.

### Pitfall 4: hermes `apps/hermes/` vs `artifacts/hermes/`

**What goes wrong:** CONTEXT.md mentions checking for `apps/hermes/` and `apps/worker/` directories alongside `apps/web/`. Inspection shows `apps/` only contains `web/`. However, if a developer assumes both exist and deletes only one, the cleanup is incomplete.
**Resolution:** Verified — `ls /home/joe/Workspace/77of1/apps/` shows only `web/`. No `apps/hermes/` or `apps/worker/` exist. Delete only `apps/web/`.

### Pitfall 5: Supabase Storage signed URL removal blocks KYC upload flow

**What goes wrong:** `POST /api/kyc/upload-url` uses `supabase.storage.from("kyc-docs").createSignedUploadUrl()`. Removing Supabase removes this Supabase Storage call. If the upload route is not stubbed, it will fail with a 500 in Phase 1.
**How to avoid:** Stub the upload-url endpoint to return a 503 "Feature temporarily unavailable" in Phase 1. The proper Replit Object Storage replacement is Phase 3 work. Document this stub clearly.
**Warning signs:** KYC document upload fails; no upload-url endpoint stub causes crash.

### Pitfall 6: `drizzle-kit push` Runs on Pooled URL

**What goes wrong:** The `DATABASE_URL` in Replit may be a PgBouncer pooled URL. `drizzle-kit push` uses DDL transactions which fail on pooled connections.
**How to avoid:** Ensure `drizzle.config.ts` uses a direct database URL (not pooled). Replit provides both in some configurations. Check the `DATABASE_URL` value format — pooled URLs often contain `pgbouncer=true` or use port 6543 vs 5432.
**Warning signs:** `drizzle-kit push` errors with "cannot run inside a transaction block" or "prepared statement does not exist".

---

## Runtime State Inventory

> Rename/refactor is NOT the primary mode of this phase — the core change is Supabase → Drizzle. However, the KYC status enum simplification (8 values → 3 values) constitutes a data migration concern.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Replit PG: `creator_kyc.status` may have rows with `'id_submitted' | 'id_verified' | 'signing_initiated' | 'rights_signed' | 'tax_submitted' | 'ops_approved' | 'complete'` — all invalid in the new 3-state enum | Data migration: any row with `status = 'complete'` → `'signed'`; `status = 'rejected'` → `'rejected'`; all others → `'pending'`. Include a migration step. |
| Live service config | None — no n8n, Task Scheduler, or external registrations reference Supabase-specific strings | None |
| OS-registered state | None | None — verified by codebase inspection (no systemd, pm2, or cron references to Supabase URLs) |
| Secrets/env vars | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in Replit Secrets and `.env.example` | Remove from `.env.example`; remove from Replit Secrets panel (document in plan task). `DATABASE_URL` already present in Replit env. |
| Build artifacts | None — TypeScript build outputs are in `dist/` directories; will be rebuilt after source changes | Rebuild all artifacts after migration: `pnpm run build` per artifact |

---

## BullMQ / Redis Wiring (INFRA-04)

`lib/queue` is already correctly implemented. The Phase 1 verification task is:

1. Confirm `lib/queue/src/types.ts` job payload types use `creatorId` (not `creator_id`), `fanId`, `jobDbId` — these are Drizzle-compatible. [VERIFIED: types.ts `JobPayloadBase`]
2. Confirm `createAllQueues(redisUrl)` creates all 6 queues with correct retry options. [VERIFIED: queues.ts, options.ts]
3. Worker `src/index.ts` currently calls `createClient(SUPABASE_URL, ...)` at startup and exits if not set. Phase 1 replaces this with `import { db } from "@workspace/db"` which exits if `DATABASE_URL` not set. Behavior preserved.
4. No new queue additions needed in Phase 1 — all 6 queue names (`textGeneration`, `voiceGeneration`, `videoGeneration`, `moderation`, `consentRevocation`, `dunningRetry`) carry through.

---

## Port Healthcheck Verification (INFRA-01)

After Phase 1 changes, all three ports must respond:

| Port | Artifact | Healthcheck | Current State |
|------|----------|------------|---------------|
| 8080 | api-server | `GET /api/health` → `{"status":"ok"}` | Working; `health.ts` `GET /api/health/db` must be updated from Supabase ping to `pool.query("SELECT 1")` |
| 22333 | artifacts/web | Vite SPA returns HTML | Working; no changes in Phase 1 |
| 3001 | artifacts/admin | Next.js returns HTML | Will remain broken (Supabase deferred); `artifact.toml` port must still be present |

The `artifact.toml` currently maps these ports correctly. [VERIFIED: artifact.toml] The port 8081 mapping in `artifact.toml` is unused by any artifact — leave as-is.

---

## apps/web/ Deletion (D-08)

The `apps/web/` directory contains: `src/app/`, `src/components/`, `src/lib/`, `src/messages/`, `src/__tests__/`, `vitest.config.ts`.

The untracked files flagged in git status:
- `apps/web/src/app/api/continue-token/` — untracked
- `apps/web/src/components/open-in-browser-sheet.tsx` — untracked
- `apps/web/src/lib/webview/` — untracked

Per D-08, ALL are discarded. Safe deletion:
1. Check `pnpm-workspace.yaml` — `apps/web/` is NOT listed in `packages:` (workspace only lists `artifacts/*`, `lib/*`, `lib/integrations/*`, `scripts`). [VERIFIED: pnpm-workspace.yaml] — safe to delete without workspace reconfiguration.
2. Delete directory: `rm -rf apps/web/`
3. No other artifact imports from `apps/web/`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Replit PostgreSQL | lib/db, all artifacts | Unknown — DATABASE_URL not set locally | — | Cannot start without it; requires Replit environment |
| Redis | lib/queue, worker | Unknown — REDIS_URL not set locally | — | BullMQ gracefully disabled when REDIS_URL absent (confirmed in api-server) |
| Node.js | All artifacts | ✓ | v22.22.0 (nvm) | — |
| pnpm | Workspace | ✓ | 9+ | — |
| drizzle-kit | lib/db devDep | ✓ (in package.json) | ^0.31.10 | — |

**Missing dependencies with no fallback:**
- `DATABASE_URL` (Replit PG connection string) — must be set before `drizzle-kit push` or any DB query. Available only in Replit environment.

**Missing dependencies with fallback:**
- `REDIS_URL` — BullMQ worker gracefully skips queue initialization when absent; api-server queue health check returns 503 when absent.

---

## KYC Agreement Template (KYC-02)

The `initiateSignwellSigning()` function in `kyc.ts` uses `SIGNWELL_TEMPLATE_ID` env var pointing to a pre-existing SignWell document template. The template body is not in the codebase — it is configured in the SignWell dashboard.

Per D-07, the template must include (as a named section):

```
VOICE SYNTHESIS AUTHORIZATION

Creator grants to lala.la a non-exclusive, revocable license to:
  - Generate synthetic voice audio using Creator's voice reference sample
  - Use such audio solely in lala.la fan-twin interactions ("Service")
  - Not sublicense or use audio outside the Service

Duration: This authorization remains effective for the term of the Service Agreement
          and terminates automatically upon Creator's written withdrawal request.

Revocability: Creator may withdraw this authorization at any time via the Lala bot
              /revoke command. lala.la will delete all generated voice files within 48
              hours of receipt of a valid withdrawal request.

Scope Limitation: This authorization does NOT cover explicit, adult, or intimate content.
```

The Phase 1 plan must include a task to update the SignWell template body (non-code, manual task for the founder via SignWell dashboard), plus verify that `signwell-webhook` handler writes `status = 'signed'` (not the old `'rights_signed'`) on `document.completed` event.

---

## Open Questions

1. **Authentication strategy after Supabase JWT removal**
   - What we know: `require-creator-auth.ts` uses `getUserFromToken()` (Supabase JWT). `kyc.ts` routes use `getReplitUser()` (Replit identity headers). These are two different auth systems coexisting.
   - What's unclear: What replaces Supabase JWT auth for creator routes in Phase 1? Is the intent to use Replit auth headers exclusively?
   - Recommendation: Phase 1 should stub `requireCreatorAuth` middleware to use `getReplitUser()` exclusively (matching the pattern in `kyc.ts`). This removes the Supabase JWT dependency without requiring a new auth library. Document the stub clearly for Phase 2 hardening.

2. **`creator_totp` table existence and structure**
   - What we know: hermes/db.ts has 4 functions querying `creator_totp`. The table is not in `schema_v1.sql`.
   - What's unclear: Which migration file creates this table?
   - Recommendation: Planner should add a task: `grep -r "creator_totp" supabase/migrations/` and include the table in the Drizzle schema based on the result.

3. **pgvector availability on Replit PG**
   - What we know: `creator_content_embeddings` (in existing hermes code) uses a vector column. If pgvector is not available, embedding storage will fail.
   - What's unclear: Does Replit PG expose the `vector` extension?
   - Recommendation: Add a Day 1 verification task: `SELECT * FROM pg_extension WHERE extname = 'vector';`. If unavailable, defer embedding to a future phase (already deferred from Phase 1 scope).

4. **Existing Replit PG schema state**
   - What we know: The project is running on this branch (`rio-de-janeiro`) with untracked files suggesting active development. The Replit PG database may or may not have tables already (from Supabase migration history or fresh).
   - Recommendation: Plan task should run `drizzle-kit push --dry-run` first to show what DDL will be executed before committing.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `creator_totp` table exists in the DB but its migration file was not found in the directory listing | Drizzle Schema / Open Questions | TOTP functions break at runtime; hermes fails for any TOTP operation |
| A2 | Replit PG `DATABASE_URL` is a standard PostgreSQL connection (not PgBouncer pooled) for schema push | Pitfall 6 | `drizzle-kit push` fails with transaction errors |
| A3 | `apps/hermes/` and `apps/worker/` directories do NOT exist (only `apps/web/`) | apps/web Deletion | If they do exist, they also need deletion |
| A4 | SignWell template update is a manual founder task (no code API to update template body) | KYC Agreement | If programmatic update is possible, could be automated |
| A5 | The Replit PG database is fresh (no existing rows) or contains only test data that can be truncated before push | Runtime State Inventory | If production data with old status values exists, a data migration script must run before schema push |

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `lib/db/src/index.ts` — Drizzle connection pattern confirmed correct
- `lib/db/src/schema/index.ts` — Confirmed empty placeholder
- `artifacts/hermes/src/db.ts` — All Supabase functions, full function inventory
- `artifacts/api-server/src/lib/kyc.ts` — KYC helper structure, `isKycComplete()` location, all callers
- `artifacts/api-server/src/routes/kyc.ts` — All KYC routes, SignWell webhook handler
- `artifacts/api-server/src/routes/twin.ts` — Confirmed: no KYC gate in current twin route
- `artifacts/api-server/src/lib/safety-audit.ts` — Confirmed hash-only pattern
- `artifacts/api-server/src/lib/supabase.ts` — Full Supabase client interface
- `supabase/migrations/20260524000001_schema_v1.sql` — 10-table original schema
- `supabase/migrations/20260525000001_creator_kyc.sql` — creator_kyc table with 8-state enum
- `supabase/migrations/20260525000001_safety_audit_log.sql` — safety_audit_log columns
- `lib/queue/src/types.ts`, `queues.ts` — BullMQ payload shapes, queue creation
- `artifact.toml` — Port mapping confirmed (8080, 22333, 3001 all present)
- `pnpm-workspace.yaml` — Workspace packages list (apps/ NOT included)
- `artifacts/worker/src/index.ts` — Supabase at startup; all worker files
- Grep for all Supabase imports — 41 files listed, categorized by artifact

### Secondary (MEDIUM confidence)
- Drizzle ORM official docs — `drizzle-orm/node-postgres` Pool pattern, `pgEnum`, `createInsertSchema` API — CITED: https://orm.drizzle.team/docs
- `.planning/research/PITFALLS.md` — Pitfall #4 (KYC null bypass), #10 (Supabase residue) — validated against actual codebase

### Tertiary (LOW confidence)
- `creator_totp` table existence — referenced in hermes code but migration file not found; treated as [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Supabase coupling depth: HIGH — direct grep + file reading
- Drizzle schema design: HIGH — derived from actual SQL migrations + official Drizzle docs
- KYC gate logic: HIGH — read all KYC files directly
- Auth replacement strategy: MEDIUM — current pattern confirmed; replacement recommendation is judgment call
- creator_totp table: LOW — referenced in code, migration file not found

**Research date:** 2026-05-27
**Valid until:** 2026-06-27 (stable stack, 30-day validity)
