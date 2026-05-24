// Hermes DB helpers — all use service-role client to bypass RLS
import { createClient, getSupabaseUrl, getSupabaseServiceKey } from "@7of1/db";

const getDb = () => createClient(getSupabaseUrl(), getSupabaseServiceKey());

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
