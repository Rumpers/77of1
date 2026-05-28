// Hermes DB helpers — Drizzle + Replit PG (migrated from Supabase, Phase 1)
import { db } from "@workspace/db";
import {
  creatorsTable,
  creatorConfigTable,
  creatorKycTable,
  creatorTotpTable,
  twinsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";

// ─── Creator lookup ───────────────────────────────────────────────────────────

// Return type uses snake_case keys to match existing callers in index.ts
// (creator.display_name, creator.id). Do not rename.
export type CreatorRow = { id: string; display_name: string };

export async function findCreatorByTelegramId(
  telegramUserId: number
): Promise<CreatorRow | null> {
  const rows = await db
    .select({ id: creatorsTable.id, display_name: creatorsTable.displayName })
    .from(creatorsTable)
    .where(eq(creatorsTable.telegramUserId, String(telegramUserId)))
    .limit(1);
  return rows[0] ?? null;
}

// ─── Kill-switch ──────────────────────────────────────────────────────────────

export interface PauseResult {
  elapsed: number;
}

// Kill-switch write. Logs elapsed ms so SLA (≤5s) is auditable.
export async function setPaused(
  creatorId: string,
  paused: boolean
): Promise<PauseResult> {
  const t0 = Date.now();
  await db
    .update(creatorConfigTable)
    .set({ paused, updatedAt: new Date() })
    .where(eq(creatorConfigTable.creatorId, creatorId));
  const elapsed = Date.now() - t0;
  console.log(
    `[hermes] kill-switch creator_id=${creatorId} paused=${paused} db_write_ms=${elapsed}`
  );
  if (elapsed > 4000) {
    console.error(
      `[hermes] WARN kill-switch db write took ${elapsed}ms — approaching ≤5s SLA`
    );
  }
  return { elapsed };
}

// ─── Creator stats (partial — fan count is out-of-scope in Phase 1) ──────────
//
// D-10: fan_accounts / fan_blocks / fan_credits tables are not in @workspace/db.
// activeFanCount is stubbed at 0 until Phase 2 wires the fan tables.
// The paused flag is read from creator_config (in Phase 1 schema).

export interface CreatorStats {
  paused: boolean;
  activeFanCount: number;
}

export async function getCreatorStats(
  creatorId: string
): Promise<CreatorStats> {
  const rows = await db
    .select({ paused: creatorConfigTable.paused })
    .from(creatorConfigTable)
    .where(eq(creatorConfigTable.creatorId, creatorId))
    .limit(1);
  return {
    paused: rows[0]?.paused ?? false,
    activeFanCount: 0, // PHASE-1 STUB: fan_accounts not in @workspace/db — wired in Phase 2
  };
}

// ─── TOTP helpers ─────────────────────────────────────────────────────────────

export interface TotpRecord {
  creator_id: string;
  totp_secret: string;
  totp_enabled: boolean;
  recovery_codes: string[];
}

export async function getTotpRecord(
  creatorId: string
): Promise<TotpRecord | null> {
  const rows = await db
    .select({
      creator_id: creatorTotpTable.creatorId,
      totp_secret: creatorTotpTable.totpSecret,
      totp_enabled: creatorTotpTable.totpEnabled,
      recovery_codes: creatorTotpTable.recoveryCodes,
    })
    .from(creatorTotpTable)
    .where(eq(creatorTotpTable.creatorId, creatorId))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveTotpEnabled(
  creatorId: string,
  secret: string,
  hashedRecoveryCodes: string[]
): Promise<void> {
  await db
    .insert(creatorTotpTable)
    .values({
      creatorId,
      totpSecret: secret,
      totpEnabled: true,
      recoveryCodes: hashedRecoveryCodes,
      enabledAt: new Date(),
    })
    .onConflictDoUpdate({
      target: creatorTotpTable.creatorId,
      set: {
        totpSecret: secret,
        totpEnabled: true,
        recoveryCodes: hashedRecoveryCodes,
        enabledAt: new Date(),
        updatedAt: new Date(),
      },
    });
}

export async function disableTotpRecord(creatorId: string): Promise<void> {
  await db
    .update(creatorTotpTable)
    .set({
      totpEnabled: false,
      recoveryCodes: [],
      updatedAt: new Date(),
    })
    .where(eq(creatorTotpTable.creatorId, creatorId));
}

export async function updateRecoveryCodes(
  creatorId: string,
  hashedCodes: string[]
): Promise<void> {
  await db
    .update(creatorTotpTable)
    .set({ recoveryCodes: hashedCodes, updatedAt: new Date() })
    .where(eq(creatorTotpTable.creatorId, creatorId));
}

// ─── Creator preferences ──────────────────────────────────────────────────────

export interface CreatorPreferences {
  paused: boolean;
  timezone: string;
  hermes_language: string;
}

export async function getCreatorPreferences(
  creatorId: string
): Promise<CreatorPreferences | null> {
  const rows = await db
    .select({
      paused: creatorConfigTable.paused,
      timezone: creatorConfigTable.timezone,
      hermes_language: creatorConfigTable.hermesLanguage,
    })
    .from(creatorConfigTable)
    .where(eq(creatorConfigTable.creatorId, creatorId))
    .limit(1);
  return rows[0] ?? null;
}

export async function setTimezone(
  creatorId: string,
  timezone: string
): Promise<void> {
  await db
    .insert(creatorConfigTable)
    .values({ creatorId, timezone })
    .onConflictDoUpdate({
      target: creatorConfigTable.creatorId,
      set: { timezone, updatedAt: new Date() },
    });
}

export async function setHermesLanguage(
  creatorId: string,
  language: string
): Promise<void> {
  await db
    .insert(creatorConfigTable)
    .values({ creatorId, hermesLanguage: language })
    .onConflictDoUpdate({
      target: creatorConfigTable.creatorId,
      set: { hermesLanguage: language, updatedAt: new Date() },
    });
}

// ─── KYC lookup (KYC-03 — /status command surfaces this) ─────────────────────
//
// Returns null when no creator_kyc row exists (creator hasn't been routed
// through the signing flow yet). status is one of the kycStatusEnum literals:
// 'pending' | 'signed' | 'rejected' per lib/db/src/schema/index.ts.

export interface KycRow {
  status: string;
  signingUrl: string | null;
}

export async function getKycRow(creatorId: string): Promise<KycRow | null> {
  const rows = await db
    .select({
      status: creatorKycTable.status,
      signingUrl: creatorKycTable.signwellSigningUrl,
    })
    .from(creatorKycTable)
    .where(eq(creatorKycTable.creatorId, creatorId))
    .limit(1);
  return rows[0] ?? null;
}

// ─── Persona-wizard writers (plan 02-07) ─────────────────────────────────────
//
// writeCharacterCard: replace the row's character_card JSONB. PERSONA-01.
// upsertTwinCharacterCard: same but creates the twins row if absent (first
//   /persona run for a brand-new creator).
// writeMonetization: merge platform fields into creators.config JSONB AND
//   mirror platform_url into creators.monetizationUrl (D-02-10 sync). Both
//   writes share a transaction so the two never drift.

import type { CharacterCardV2 } from "@workspace/db";

export async function upsertTwinCharacterCard(
  creatorId: string,
  characterCard: CharacterCardV2,
  handle: string,
): Promise<void> {
  // Try update first; if no row, insert. twinsTable.handle is unique so we
  // generate a fallback handle from the creator's display handle.
  const updated = await db
    .update(twinsTable)
    .set({ characterCard })
    .where(eq(twinsTable.creatorId, creatorId))
    .returning({ id: twinsTable.id });
  if (updated.length === 0) {
    await db.insert(twinsTable).values({
      creatorId,
      handle,
      characterCard,
    });
  }
}

export async function writeMonetization(
  creatorId: string,
  platformName: string,
  platformUrl: string,
): Promise<void> {
  // Merge platform_name + platform_url into existing config JSONB (preserves
  // any keys downstream plans may have written). Postgres jsonb concat (||).
  await db
    .update(creatorsTable)
    .set({
      config: sql`COALESCE(${creatorsTable.config}, '{}'::jsonb) || ${JSON.stringify({
        platform_name: platformName,
        platform_url: platformUrl,
      })}::jsonb`,
      monetizationUrl: platformUrl,
      updatedAt: new Date(),
    })
    .where(eq(creatorsTable.id, creatorId));
}
