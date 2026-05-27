# Phase 1: Baseline Repair - Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 12 new/modified files (plus `apps/web/` deletion)
**Analogs found:** 11 / 12 (1 file has no direct analog — see No Analog Found section)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/db/src/schema/index.ts` | model | CRUD | `supabase/migrations/20260524000001_schema_v1.sql` + `lib/db/src/schema/index.ts` template comments | role-match (SQL→Drizzle port) |
| `artifacts/hermes/src/db.ts` | service | CRUD | `artifacts/hermes/src/db.ts` (existing — rewrite in place) | exact (same file, Supabase→Drizzle) |
| `artifacts/hermes/src/consent.ts` | service | event-driven | `artifacts/hermes/src/consent.ts` (existing — partial rewrite) | exact (same file) |
| `artifacts/api-server/src/lib/kyc.ts` | service | CRUD | `artifacts/api-server/src/lib/kyc.ts` (existing — rewrite in place) | exact (same file) |
| `artifacts/api-server/src/lib/safety-audit.ts` | service | CRUD | `artifacts/api-server/src/lib/safety-audit.ts` (existing — rewrite in place) | exact (same file) |
| `artifacts/api-server/src/lib/supabase.ts` | utility | request-response | `artifacts/api-server/src/lib/auth.ts` | role-match (auth utility) |
| `artifacts/api-server/src/middlewares/require-creator-auth.ts` | middleware | request-response | `artifacts/api-server/src/middlewares/require-creator-auth.ts` (existing) + `artifacts/api-server/src/routes/kyc.ts` `resolveCreatorId` | exact (same file + pattern) |
| `artifacts/api-server/src/routes/twin.ts` | route | request-response | `artifacts/api-server/src/routes/twin.ts` (existing — add KYC gate) | exact (same file) |
| `artifacts/api-server/src/routes/health.ts` | route | request-response | `artifacts/api-server/src/routes/health.ts` (existing — replace Supabase ping) | exact (same file) |
| `artifacts/worker/src/index.ts` | service | event-driven | `artifacts/worker/src/index.ts` (existing — replace Supabase client) | exact (same file) |
| `artifacts/hermes/package.json` | config | — | `artifacts/api-server/package.json` | role-match (workspace dep pattern) |
| `apps/web/` (deletion) | — | — | — | deletion only — no pattern needed |

---

## Pattern Assignments

### `lib/db/src/schema/index.ts` (model, CRUD)

**Analog:** `lib/db/src/schema/index.ts` template comments + `supabase/migrations/20260524000001_schema_v1.sql`

**Template pattern from existing schema/index.ts** (lines 1–19):
```typescript
// Each model/table should define a Drizzle table, insert schema, and types:

import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
});

export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
```

**Full imports block to use:**
```typescript
import {
  pgTable, pgEnum, uuid, text, boolean, jsonb, integer,
  timestamp, real, index, unique
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
```

**pgEnum pattern** (from RESEARCH.md Pattern 1):
```typescript
export const kycStatusEnum = pgEnum("kyc_status", ["pending", "signed", "rejected"]);
// Use pgEnum for all status/type columns — DB-level constraint catches invalid values
// Place enum definitions BEFORE the table that uses them (forward-reference issue)
```

**`$onUpdateFn` for updated_at** (from RESEARCH.md "Don't Hand-Roll" table):
```typescript
updatedAt: timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdateFn(() => new Date()),
```

**Type export pattern** (standard for every table):
```typescript
export const insertCreatorSchema = createInsertSchema(creatorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Creator = typeof creatorsTable.$inferSelect;
export type InsertCreator = z.infer<typeof insertCreatorSchema>;
```

**Index pattern** (from schema_v1.sql, translated to Drizzle):
```typescript
// Inline index as table option (third argument to pgTable):
}, (t) => ({
  conversationIdx: index("conversation_messages_conversation_idx").on(t.conversationId),
  creatorCreatedIdx: index("conversation_messages_creator_created_idx").on(t.creatorId, t.createdAt),
}));
```

**Critical constraint:** `creator_totp` table is NOT in any Supabase migration file (confirmed: grep found zero results). The hermes TOTP functions reference a `creator_totp` table that does not exist in migrations. Include a verification task: check if table exists at runtime via `drizzle-kit push --dry-run`. If it does not exist, the TOTP functions must either be stubbed or the table must be created fresh.

---

### `artifacts/hermes/src/db.ts` (service, CRUD)

**Analog:** `artifacts/hermes/src/db.ts` (existing file — full rewrite replacing Supabase with Drizzle)

**Current Supabase import pattern** (lines 1–9 — REPLACE this):
```typescript
// REMOVE:
import { createClient } from "@supabase/supabase-js";
function getDb() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}
```

**Replacement Drizzle import pattern** (from `lib/db/src/index.ts`):
```typescript
// ADD:
import { db } from "@workspace/db";
import { creatorsTable, creatorConfigTable, creatorKycTable } from "@workspace/db";
import { eq } from "drizzle-orm";
```

**Supabase select → Drizzle select** (pattern from RESEARCH.md Pattern 3):
```typescript
// Was: supabase.from("creators").select("id, display_name").eq("telegram_user_id", id).maybeSingle()
// Becomes:
export async function findCreatorByTelegramId(
  telegramUserId: number
): Promise<CreatorRow | null> {
  return db
    .select({ id: creatorsTable.id, displayName: creatorsTable.displayName })
    .from(creatorsTable)
    .where(eq(creatorsTable.telegramUserId, String(telegramUserId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}
```

**Kill-switch SLA pattern to PRESERVE** (lines 28–48 of existing db.ts — keep elapsed logging):
```typescript
export async function setPaused(creatorId: string, paused: boolean): Promise<PauseResult> {
  const t0 = Date.now();
  await db
    .update(creatorConfigTable)
    .set({ paused, updatedAt: new Date() })
    .where(eq(creatorConfigTable.creatorId, creatorId));
  const elapsed = Date.now() - t0;
  console.log(`[hermes] kill-switch creator_id=${creatorId} paused=${paused} db_write_ms=${elapsed}`);
  if (elapsed > 4000) {
    console.error(`[hermes] WARN kill-switch db write took ${elapsed}ms — approaching ≤5s SLA`);
  }
  return { elapsed };
}
```

**Supabase upsert → Drizzle upsert** (pattern from RESEARCH.md Pattern 3):
```typescript
// Was: supabase.from("creator_totp").upsert({...})
// Becomes:
await db
  .insert(creatorTotpTable)
  .values({ creatorId, totpSecret: secret, totpEnabled: true, ... })
  .onConflictDoUpdate({
    target: creatorTotpTable.creatorId,
    set: { totpSecret: secret, totpEnabled: true, updatedAt: new Date() },
  });
```

**Functions to REMOVE** (D-10): `blockFan` (lines 203–268), `listFansForCreator` (lines 186–195), `getCreatorStats` (lines 56–75), `isFanBlocked` (lines 271–282). These reference out-of-scope tables (`fan_blocks`, `fan_credits`, `fan_accounts`, `fans`).

**Functions to KEEP and rewrite**: `findCreatorByTelegramId`, `setPaused`, `getTotpRecord`, `saveTotpEnabled`, `disableTotpRecord`, `updateRecoveryCodes`, `getCreatorPreferences`, `setTimezone`, `setHermesLanguage`.

---

### `artifacts/hermes/src/consent.ts` (service, event-driven)

**Analog:** `artifacts/hermes/src/consent.ts` (existing — replace `commitConsent` Supabase calls only)

**Current Supabase import** (lines 7–14 — REMOVE):
```typescript
// REMOVE:
import { createClient } from '@supabase/supabase-js';
function getDb() { return createClient(...) }
```

**Replace with:**
```typescript
import { db } from "@workspace/db";
import { consentGrantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
```

**`commitConsent` Drizzle rewrite pattern** (lines 224–265 of existing):
```typescript
// Was: await db.from('consent_grants').insert(rows)
// Becomes:
await db.insert(consentGrantsTable).values(
  CONSENT_ITEMS.map((item) => ({
    creatorId,
    modality: item.grantType as ConsentGrantModality,
    granted: answers[item.grantType] ?? false,
    grantedAt: new Date(),
    consentVersion: CONSENT_VERSION,
    channel: "telegram",
    ipHash,
    retentionCategory: "operational",  // D-14
  }))
);
```

**`telegramIpHash` pattern to PRESERVE** (lines 151–154 — no change needed):
```typescript
export function telegramIpHash(tgUserId: number): string {
  return crypto.createHash('sha256').update(String(tgUserId)).digest('hex');
}
```

**Note:** `creator_assets` and `creator_onboarding` table updates in `commitConsent` (lines 247–261) reference tables not in Phase 1 Drizzle schema. Stub those two calls with `console.log` for Phase 1; they will be wired in Phase 2.

---

### `artifacts/api-server/src/lib/kyc.ts` (service, CRUD)

**Analog:** `artifacts/api-server/src/lib/kyc.ts` (existing — rename function + replace Supabase calls)

**Current import** (line 2 — REMOVE):
```typescript
// REMOVE:
import { getSupabase } from "./supabase.js";
```

**Replace with:**
```typescript
import { db } from "@workspace/db";
import { creatorKycTable } from "@workspace/db";
import { eq } from "drizzle-orm";
```

**`KycStatus` type to SIMPLIFY** (lines 4–13 — collapse 8 states to 3):
```typescript
// REPLACE the existing 9-value union with:
export type KycStatus = "pending" | "signed" | "rejected";
```

**`isKycComplete` → `isKycSigned` rename + rewrite** (lines 64–68):
```typescript
// WAS:
export async function isKycComplete(creatorId: string): Promise<boolean> {
  const row = await getKycRow(creatorId);
  return row?.status === "complete";  // OLD check
}

// BECOMES (D-05, D-06):
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

**`getKycRow` Drizzle rewrite** (lines 38–47):
```typescript
// WAS: supabase.from("creator_kyc").select("*").eq(...).maybeSingle()
export async function getKycRow(creatorId: string): Promise<KycRow | null> {
  return db
    .select()
    .from(creatorKycTable)
    .where(eq(creatorKycTable.creatorId, creatorId))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}
```

**`initiateSignwellSigning` — keep the SignWell fetch logic** (lines 71–133); only replace the final Supabase `.update()` call (lines 122–132):
```typescript
// WAS: await sb.from("creator_kyc").update({...}).eq("creator_id", creatorId)
// BECOMES:
await db
  .update(creatorKycTable)
  .set({
    signwellDocId: json.id,
    signwellSigningUrl: signingUrl,
    status: "pending",  // stays pending until webhook fires 'signed'
    updatedAt: new Date(),
  })
  .where(eq(creatorKycTable.creatorId, creatorId));
```

**`hashIpForKyc` and `extractIp` utility functions** (lines 136–145): no changes needed — no Supabase dependency.

---

### `artifacts/api-server/src/lib/safety-audit.ts` (service, CRUD)

**Analog:** `artifacts/api-server/src/lib/safety-audit.ts` (existing — replace Supabase param + add `retentionCategory`)

**Current signature** (lines 64–67 — REPLACE):
```typescript
// WAS: takes SupabaseClient as first arg
export function writeSafetyAuditLog(supabase: SupabaseClient, entry: SafetyAuditEntry): void {

// BECOMES: no supabase param — uses singleton db
export function writeSafetyAuditLog(entry: SafetyAuditEntry): void {
```

**Import change**:
```typescript
// REMOVE:
import type { SupabaseClient } from "@supabase/supabase-js";
// ADD:
import { db } from "@workspace/db";
import { safetyAuditLogTable } from "@workspace/db";
```

**Core fire-and-forget Drizzle write** (lines 69–97 — the void IIFE pattern is CORRECT, preserve it):
```typescript
export function writeSafetyAuditLog(entry: SafetyAuditEntry): void {
  void (async () => {
    const fanIdHash = sha256(entry.fanId);
    const messageHash = sha256(entry.messageText);
    let alerted = false;
    if (entry.crisisLevel === "high") {
      await fireSlackAlert(entry);
      alerted = true;
    }
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
      alerted,
      retentionCategory: "audit",  // D-14 new column
    });
  })();
}
```

**sha256 helper** (lines 23–25): no changes — Node.js built-in `createHash`, keep as-is.

**Callers:** All callers that pass `supabase` as the first argument must be updated to remove that argument.

---

### `artifacts/api-server/src/lib/supabase.ts` (utility — REPLACED)

**This file is deleted entirely.** It is replaced by two things:

1. **DB access**: all callers switch to `import { db } from "@workspace/db"`
2. **Auth**: callers switch to `getReplitUser()` from `artifacts/api-server/src/lib/auth.ts`

**`getReplitUser` pattern to propagate** (from `lib/auth.ts` lines 27–39):
```typescript
// Source: artifacts/api-server/src/lib/auth.ts lines 27-39
export function getReplitUser(req: Request): ReplitUser | null {
  const userId = req.headers["x-replit-user-id"] as string | undefined;
  if (!userId) return null;
  return {
    id: userId,
    name: (req.headers["x-replit-user-name"] as string) ?? "",
    roles: (req.headers["x-replit-user-roles"] as string) ?? "",
    // ...
  };
}
```

**Cookie constants that must be re-exported somewhere** (currently in `supabase.ts` lines 31–44):
```typescript
// Move to lib/auth.ts or a new lib/cookies.ts:
export const COOKIE_ACCESS_TOKEN = "sb-access-token";   // rename in Phase 2; Phase 1 keep name
export function sessionCookieOptions(maxAge: number) { ... }
```

---

### `artifacts/api-server/src/middlewares/require-creator-auth.ts` (middleware, request-response)

**Analog:** `artifacts/api-server/src/middlewares/require-creator-auth.ts` (existing) + `resolveCreatorId` from `artifacts/api-server/src/routes/kyc.ts` lines 36–56

**Current Supabase JWT pattern** (lines 1–58 — REPLACE entire auth strategy):
```typescript
// WAS: reads Supabase JWT cookie → getUserFromToken() → supabase.from("creators").select
// BECOMES: reads Replit identity headers → getReplitUser() → db.select from creators
```

**New implementation pattern** (from `kyc.ts` `resolveCreatorId` lines 36–56):
```typescript
import type { Request, Response, NextFunction } from "express";
import { getReplitUser } from "../lib/auth.js";
import { db } from "@workspace/db";
import { creatorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireCreatorAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = getReplitUser(req);
  if (!user) {
    res.status(401).json({ error: "Creator auth required" });
    return;
  }

  const creator = await db
    .select({ id: creatorsTable.id })
    .from(creatorsTable)
    .where(eq(creatorsTable.replitUserId, user.id))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!creator) {
    res.status(403).json({ error: "No creator account linked to this user" });
    return;
  }

  res.locals.authUserId = user.id;
  res.locals.creatorId = creator.id;
  next();
}
```

**`Express.Locals` declaration to PRESERVE** (lines 9–16 — no change):
```typescript
declare global {
  namespace Express {
    interface Locals {
      authUserId?: string;
      creatorId?: string;
    }
  }
}
```

---

### `artifacts/api-server/src/routes/twin.ts` (route, request-response)

**Analog:** `artifacts/api-server/src/routes/twin.ts` (existing — add KYC gate, no other changes)

**Current handler** (lines 33–54 — no KYC gate at all): the stub response logic is correct and stays unchanged. Only ADD the KYC gate at the top of the handler.

**KYC gate insertion pattern** (from RESEARCH.md Pattern 5):
```typescript
// Insert BEFORE the existing stub response logic (after message validation):
router.post("/twin/chat", async (req: Request, res: Response) => {
  const { message, handle, locale } = req.body as { ... };

  if (!message || ...) { res.status(400)...; return; }

  // ── KYC gate (D-05: strict positive assertion) ─────────────────────────
  if (handle) {
    const creator = await db
      .select({ id: creatorsTable.id })
      .from(creatorsTable)
      .where(eq(creatorsTable.handle, String(handle)))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!creator) {
      res.status(404).json({ error: "Creator not found" });
      return;
    }

    const signed = await isKycSigned(creator.id);
    if (!signed) {
      res.status(423).json({ error: "Creator onboarding not complete", code: "KYC_UNSIGNED" });
      return;
    }
  }
  // ── existing stub response logic continues ─────────────────────────────
  ...
});
```

**Imports to add** (at top of `twin.ts`):
```typescript
import { db } from "@workspace/db";
import { creatorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isKycSigned } from "../lib/kyc.js";
```

---

### `artifacts/api-server/src/routes/health.ts` (route, request-response)

**Analog:** `artifacts/api-server/src/routes/health.ts` (existing — replace Supabase ping in `GET /api/health/db`)

**Current Supabase dynamic import** (lines 27–65 — REPLACE entire handler body):
```typescript
// WAS: dynamically imports @supabase/supabase-js, calls supabase.rpc("pg_sleep")
```

**Replacement Drizzle Pool ping pattern**:
```typescript
// Source: lib/db/src/index.ts — pool is exported
import { pool } from "@workspace/db";

router.get("/health/db", async (req: Request, res: Response) => {
  if (!requireHealthSecret(req, res)) return;
  const start = Date.now();
  try {
    await pool.query("SELECT 1");
    const latencyMs = Date.now() - start;
    res.json({ status: "ok", latencyMs });
  } catch (err) {
    const latencyMs = Date.now() - start;
    res.status(503).json({
      status: "error",
      latencyMs,
      error: err instanceof Error ? err.message : "unknown error",
    });
  }
});
```

**All other health routes** (lines 17–26, 68–142): no changes — they test Redis and GMI, no Supabase.

---

### `artifacts/worker/src/index.ts` (service, event-driven)

**Analog:** `artifacts/worker/src/index.ts` (existing — replace Supabase startup block + all DB calls)

**Current Supabase startup** (lines 14, 21–31 — REMOVE):
```typescript
// REMOVE:
import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) { process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
```

**Replacement Drizzle startup** (mirroring `lib/db/src/index.ts` — DATABASE_URL guard already there):
```typescript
// ADD:
import { db } from "@workspace/db";
// Note: lib/db/src/index.ts already throws if DATABASE_URL is missing — no extra guard needed
```

**`supabase.from("generation_jobs").update(...)` → Drizzle** (lines 67–69, 91–94, 142–148):
```typescript
// WAS: await supabase.from("generation_jobs").update({status: "processing"}).eq("id", jobId)
// BECOMES:
import { generationJobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

await db
  .update(generationJobsTable)
  .set({ status: "processing", attemptCount: job.attemptsMade + 1 })
  .where(eq(generationJobsTable.id, jobId));
```

**`handleDlqEvent(supabase, ...)` call** (line 131): update `dlq-handler.ts` to accept `typeof db` instead of `SupabaseClient`. Pattern: replace `SupabaseClient` type with `typeof db` imported from `@workspace/db`.

**BullMQ Worker/QueueEvents setup** (lines 20, 56–85): no changes — Redis URL, concurrency, retry config all unchanged.

**Graceful shutdown pattern** (lines 160–168): no changes needed — no Supabase in shutdown path.

---

### `artifacts/hermes/package.json` + `artifacts/api-server/package.json` + `artifacts/worker/package.json` (config)

**Analog:** `artifacts/api-server/package.json` (already has `@workspace/db` — use as reference)

**Pattern: add `@workspace/db` to hermes** (D-09):
```json
// In artifacts/hermes/package.json "dependencies":
"@workspace/db": "workspace:*"
```

**Pattern: remove `@supabase/supabase-js`** from dependencies in api-server, hermes, worker:
```json
// REMOVE from each package.json "dependencies":
"@supabase/supabase-js": "^2.106.1"
```

---

## Shared Patterns

### Drizzle Singleton Import (applies to all files)

**Source:** `lib/db/src/index.ts` lines 1–16
**Apply to:** All files currently calling `getSupabase()` or `createClient()`

```typescript
// Single canonical import — use in every file replacing Supabase:
import { db, pool } from "@workspace/db";
// Also import the specific tables you need:
import { creatorsTable, creatorKycTable, creatorConfigTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
```

**Anti-pattern to avoid:** Do NOT create a new `Pool` or call `drizzle()` in individual files. The singleton in `lib/db/src/index.ts` is the only pool — import `db` from `@workspace/db`.

### Replit Auth (replaces Supabase JWT)

**Source:** `artifacts/api-server/src/lib/auth.ts` lines 27–39
**Apply to:** `require-creator-auth.ts`, `kyc.ts` routes (already using this — confirm all callers consistent)

```typescript
import { getReplitUser } from "../lib/auth.js";

const user = getReplitUser(req);
if (!user) {
  res.status(401).json({ error: "Creator auth required" });
  return;
}
```

### SHA-256 Hashing (no raw PII — COMPLY-03)

**Source:** `artifacts/api-server/src/lib/safety-audit.ts` lines 23–25 + `artifacts/hermes/src/consent.ts` lines 151–154
**Apply to:** `safety_audit_log` writes, any fan ID or message content that touches DB

```typescript
import { createHash } from "crypto";
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
```

### KYC Strict Positive Gate (Pitfall #4)

**Source:** RESEARCH.md Pattern 4 (derived from D-05)
**Apply to:** `artifacts/api-server/src/routes/twin.ts` + any future route serving fan content

```typescript
// ALWAYS check === "signed", never !== "rejected"
const signed = await isKycSigned(creator.id);
if (!signed) {
  res.status(423).json({ error: "Creator onboarding not complete", code: "KYC_UNSIGNED" });
  return;
}
```

### Fire-and-Forget Async Write Pattern

**Source:** `artifacts/api-server/src/lib/safety-audit.ts` lines 69–97
**Apply to:** All audit log writes and any non-blocking DB writes in the response path

```typescript
// Never await audit writes — they must not slow the response path
export function writeSafetyAuditLog(entry: SafetyAuditEntry): void {
  void (async () => {
    // ... db.insert() here
  })();
}
```

### SLA Elapsed Logging (kill-switch / block operations)

**Source:** `artifacts/hermes/src/db.ts` lines 28–48
**Apply to:** `setPaused` in the rewritten `hermes/src/db.ts` (preserve exactly)

```typescript
const t0 = Date.now();
// ... db operation ...
const elapsed = Date.now() - t0;
console.log(`[hermes] kill-switch creator_id=${creatorId} paused=${paused} db_write_ms=${elapsed}`);
if (elapsed > 4000) {
  console.error(`[hermes] WARN kill-switch db write took ${elapsed}ms — approaching ≤5s SLA`);
}
```

### `retention_category` Column (D-14)

**Apply to:** Every Drizzle insert that touches `conversation_messages`, `consent_grants`, `generation_jobs`, `safety_audit_log`

```typescript
// Three valid values:
retentionCategory: "operational"  // infrastructure records, kept indefinitely
retentionCategory: "transcript"   // fan messages, 90-day TTL (Phase 4 cron)
retentionCategory: "audit"        // safety log, 1-year TTL
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/` (deletion) | — | — | Deletion task only; no analog needed; confirmed `apps/web/` is not listed in `pnpm-workspace.yaml` packages — safe `rm -rf apps/web/` with no workspace reconfiguration |

---

## Supplemental: `creator_totp` Table

**Finding:** Zero results from `grep -r "creator_totp" supabase/migrations/` — the `creator_totp` table has NO Supabase migration file. It is referenced by 4 functions in `hermes/src/db.ts` and by `artifacts/api-server/src/routes/twofa.ts`.

**Recommendation for planner:** Add a task to check if the table exists in the live DB (`SELECT to_regclass('public.creator_totp');`). If it does not exist, the planner must either:
1. Add a `creatorTotpTable` Drizzle definition to the Phase 1 schema (using columns inferred from hermes usage: `creator_id`, `totp_secret`, `totp_enabled`, `recovery_codes`, `enabled_at`, `updated_at`), or
2. Stub all TOTP functions to throw `Error("TOTP not yet available")` until the schema is confirmed.

**Inferred columns from hermes/db.ts usage** (lines 84–132):
- `creator_id` — primary key (text or uuid)
- `totp_secret` — text
- `totp_enabled` — boolean
- `recovery_codes` — text[] (array)
- `enabled_at` — timestamptz
- `updated_at` — timestamptz

---

## Metadata

**Analog search scope:** `lib/db/`, `artifacts/api-server/src/`, `artifacts/hermes/src/`, `artifacts/worker/src/`, `supabase/migrations/`
**Files scanned:** 15 source files read directly; SQL migrations consulted for schema ground truth
**Pattern extraction date:** 2026-05-27
