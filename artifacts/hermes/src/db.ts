// Hermes DB helpers — all use service-role client to bypass RLS
import { createClient } from "@supabase/supabase-js";

function getDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(url, key);
}

export type CreatorRow = { id: string; display_name: string };

export async function findCreatorByTelegramId(
  telegramUserId: number
): Promise<CreatorRow | null> {
  const { data } = await getDb()
    .from("creators")
    .select("id, display_name")
    .eq("telegram_user_id", String(telegramUserId))
    .maybeSingle();
  return data ?? null;
}

export interface PauseResult {
  elapsed: number;
}

// Kill-switch write. Logs elapsed ms so SLA (≤5s) is auditable.
export async function setPaused(
  creatorId: string,
  paused: boolean
): Promise<PauseResult> {
  const t0 = Date.now();
  const { error } = await getDb()
    .from("creator_config")
    .update({ paused, updated_at: new Date().toISOString() })
    .eq("creator_id", creatorId);
  const elapsed = Date.now() - t0;
  console.log(
    `[hermes] kill-switch creator_id=${creatorId} paused=${paused} db_write_ms=${elapsed}`
  );
  if (error) throw error;
  if (elapsed > 4000) {
    console.error(
      `[hermes] WARN kill-switch db write took ${elapsed}ms — approaching ≤5s SLA`
    );
  }
  return { elapsed };
}

export interface CreatorStats {
  paused: boolean;
  activeFanCount: number;
}

export async function getCreatorStats(
  creatorId: string
): Promise<CreatorStats> {
  const db = getDb();
  const [fansResult, configResult] = await Promise.all([
    db
      .from("fan_accounts")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", creatorId),
    db
      .from("creator_config")
      .select("paused")
      .eq("creator_id", creatorId)
      .maybeSingle(),
  ]);
  return {
    paused: configResult.data?.paused ?? false,
    activeFanCount: fansResult.count ?? 0,
  };
}

export interface TotpRecord {
  creator_id: string;
  totp_secret: string;
  totp_enabled: boolean;
  recovery_codes: string[];
}

export async function getTotpRecord(creatorId: string): Promise<TotpRecord | null> {
  const { data } = await getDb()
    .from("creator_totp")
    .select("creator_id, totp_secret, totp_enabled, recovery_codes")
    .eq("creator_id", creatorId)
    .maybeSingle();
  return data ?? null;
}

export async function saveTotpEnabled(
  creatorId: string,
  secret: string,
  hashedRecoveryCodes: string[]
): Promise<void> {
  const { error } = await getDb()
    .from("creator_totp")
    .upsert({
      creator_id: creatorId,
      totp_secret: secret,
      totp_enabled: true,
      recovery_codes: hashedRecoveryCodes,
      enabled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
}

export async function disableTotpRecord(creatorId: string): Promise<void> {
  const { error } = await getDb()
    .from("creator_totp")
    .update({
      totp_enabled: false,
      recovery_codes: [],
      updated_at: new Date().toISOString(),
    })
    .eq("creator_id", creatorId);
  if (error) throw error;
}

export async function updateRecoveryCodes(
  creatorId: string,
  hashedCodes: string[]
): Promise<void> {
  const { error } = await getDb()
    .from("creator_totp")
    .update({ recovery_codes: hashedCodes, updated_at: new Date().toISOString() })
    .eq("creator_id", creatorId);
  if (error) throw error;
}

// ─── Creator preferences (HID-056) ───────────────────────────────────────────

export interface CreatorPreferences {
  timezone: string;
  hermesLanguage: string;
}

export async function getCreatorPreferences(
  creatorId: string
): Promise<CreatorPreferences> {
  const { data } = await getDb()
    .from("creator_config")
    .select("timezone, hermes_language")
    .eq("creator_id", creatorId)
    .maybeSingle();
  return {
    timezone: data?.timezone ?? "UTC",
    hermesLanguage: data?.hermes_language ?? "en",
  };
}

export async function setTimezone(
  creatorId: string,
  timezone: string
): Promise<void> {
  const { error } = await getDb()
    .from("creator_config")
    .update({ timezone, updated_at: new Date().toISOString() })
    .eq("creator_id", creatorId);
  if (error) throw error;
}

export async function setHermesLanguage(
  creatorId: string,
  language: string
): Promise<void> {
  const { error } = await getDb()
    .from("creator_config")
    .update({ hermes_language: language, updated_at: new Date().toISOString() })
    .eq("creator_id", creatorId);
  if (error) throw error;
}

// ─── Fan rows ─────────────────────────────────────────────────────────────────

export type FanRow = {
  id: string;
  created_at: string;
  replit_user_id: string | null;
  tier: string;
};

export async function listFansForCreator(creatorId: string): Promise<FanRow[]> {
  const { data } = await getDb()
    .from("fans")
    .select("id, created_at, replit_user_id, tier")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export interface BlockFanResult {
  elapsed: number;
  creditsRefunded: number;
}

// Block a fan and refund their remaining credits.
// SLA: total write must complete ≤5s (same contract as kill-switch).
export async function blockFan(
  creatorId: string,
  fanId: string,
  reason?: string
): Promise<BlockFanResult> {
  const t0 = Date.now();
  const db = getDb();

  // 1. Upsert block record (idempotent: safe to call twice)
  const { error: blockError } = await db
    .from("fan_blocks")
    .upsert(
      { creator_id: creatorId, fan_id: fanId, blocked_by: "creator", reason: reason ?? null },
      { onConflict: "creator_id,fan_id" }
    );
  if (blockError) throw blockError;

  // 2. Read current credit balance
  const { data: creditsRow } = await db
    .from("fan_credits")
    .select("balance")
    .eq("fan_id", fanId)
    .eq("creator_id", creatorId)
    .maybeSingle();

  const balance = creditsRow?.balance ?? 0;

  // 3. Refund remaining credits if any
  if (balance > 0) {
    const { error: balanceError } = await db
      .from("fan_credits")
      .update({ balance: 0, updated_at: new Date().toISOString() })
      .eq("fan_id", fanId)
      .eq("creator_id", creatorId);
    if (balanceError) throw balanceError;

    const idempotencyKey = `block_refund:${creatorId}:${fanId}:${Date.now()}`;
    const { error: txError } = await db.from("credit_transactions").insert({
      fan_id: fanId,
      creator_id: creatorId,
      kind: "refund",
      amount: balance,
      idempotency_key: idempotencyKey,
    });
    if (txError) throw txError;
  }

  // 4. Append-only audit log
  await db.from("audit_log").insert({
    creator_id: creatorId,
    fan_id: fanId,
    event_type: "fan_blocked",
    payload: { reason: reason ?? null, credits_refunded: balance, blocked_by: "creator" },
  });

  const elapsed = Date.now() - t0;
  console.log(
    `[hermes] fan_blocked creator_id=${creatorId} fan_id=${fanId} credits_refunded=${balance} total_ms=${elapsed}`
  );
  if (elapsed > 4000) {
    console.error(
      `[hermes] WARN fan_block write took ${elapsed}ms — approaching ≤5s SLA`
    );
  }
  return { elapsed, creditsRefunded: balance };
}

// Fast check used by twin-engine and credits API before serving any fan request.
export async function isFanBlocked(
  creatorId: string,
  fanId: string
): Promise<boolean> {
  const { data } = await getDb()
    .from("fan_blocks")
    .select("fan_id")
    .eq("creator_id", creatorId)
    .eq("fan_id", fanId)
    .maybeSingle();
  return data !== null;
}
