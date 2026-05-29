// [HID-035] DSAR self-service portal — OF-135
// §16: fans get 30-day download window; creators get 72-hour self-export.
//
// POST /api/dsar/request   — submit a DSAR (rate-limited: once per 30 days)
// GET  /api/dsar            — get current request status
// GET  /api/dsar/download   — download data package (query: ?token=xxx)

import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import { getUserFromToken, getSupabase, COOKIE_ACCESS_TOKEN } from "../lib/supabase.js";

const router: IRouter = Router();

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;

function makeDownloadToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ── Auth helper ────────────────────────────────────────────────────────────────

async function resolveAuthUser(req: Request): Promise<{ id: string; email?: string } | null> {
  const token: string | undefined =
    req.cookies?.[COOKIE_ACCESS_TOKEN] ??
    req.headers.authorization?.replace(/^Bearer\s+/i, "");
  return getUserFromToken(token);
}

// ── Fan data collector ─────────────────────────────────────────────────────────
// fan_accounts maps auth_user_id → fan_id (per creator). All other fan tables
// are keyed by fan_id.

async function collectFanData(authUserId: string) {
  const db = getSupabase();

  const { data: fanAccounts } = await db
    .from("fan_accounts")
    .select("fan_id, creator_id")
    .eq("auth_user_id", authUserId);

  const fanIds = (fanAccounts ?? []).map((r: { fan_id: string }) => r.fan_id);

  let subRows = { data: [] as unknown[] };
  let creditRows = { data: [] as unknown[] };
  let txRows = { data: [] as unknown[] };
  let usageRows = { data: [] as unknown[] };

  if (fanIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbAny = db as any;
    [subRows, creditRows, txRows, usageRows] = await Promise.all([
      dbAny
        .from("fan_subscriptions")
        .select("id, creator_id, status, current_period_start, current_period_end, created_at")
        .in("fan_id", fanIds),
      dbAny.from("fan_credits").select("fan_id, creator_id, balance, updated_at").in("fan_id", fanIds),
      dbAny
        .from("credit_transactions")
        .select("id, fan_id, creator_id, kind, amount, created_at")
        .in("fan_id", fanIds)
        .order("created_at", { ascending: false })
        .limit(500),
      dbAny
        .from("usage_counters")
        .select("fan_id, creator_id, billing_period, messages, credits_used")
        .in("fan_id", fanIds),
    ]);
  }

  return {
    _meta: {
      generated_at: new Date().toISOString(),
      requester_type: "fan",
      auth_user_id: authUserId,
      note: "Data Subject Access Request export. Contains all personal data held by 7of1 for this account.",
    },
    fan_accounts: fanAccounts ?? [],
    subscriptions: subRows.data ?? [],
    credit_balances: creditRows.data ?? [],
    credit_transactions: txRows.data ?? [],
    usage_counters: usageRows.data ?? [],
  };
}

// ── Creator data collector ─────────────────────────────────────────────────────

async function collectCreatorData(authUserId: string) {
  const db = getSupabase();

  const { data: creator } = await db
    .from("creators")
    .select("id, handle, display_name, created_at")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!creator) {
    return {
      _meta: {
        generated_at: new Date().toISOString(),
        requester_type: "creator",
        auth_user_id: authUserId,
        note: "No creator account found for this user.",
      },
      creator: null,
    };
  }

  const creatorId = creator.id as string;

  const [consentRows, assetRows, onboardRow] = await Promise.all([
    db
      .from("consent_grants")
      .select("id, modality, granted_at, revoked_at, version")
      .eq("creator_id", creatorId)
      .order("granted_at", { ascending: false }),
    db
      .from("creator_assets")
      .select("id, asset_type, consent_state, created_at")
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("creator_onboarding")
      .select("status, updated_at")
      .eq("creator_id", creatorId)
      .maybeSingle(),
  ]);

  return {
    _meta: {
      generated_at: new Date().toISOString(),
      requester_type: "creator",
      auth_user_id: authUserId,
      note: "Data Subject Access Request export. Contains all personal data held by 7of1 for this account.",
    },
    creator_profile: creator,
    consent_grants: consentRows.data ?? [],
    assets_metadata: assetRows.data ?? [],
    onboarding_status: onboardRow.data ?? null,
  };
}

// ── GET /api/dsar — check status ───────────────────────────────────────────────

router.get("/dsar", async (req: Request, res: Response) => {
  const user = await resolveAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  let db: ReturnType<typeof getSupabase>;
  try {
    db = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const { data: requests, error } = await db
    .from("dsar_requests")
    .select("id, requester_type, status, requested_at, ready_at, expires_at, downloaded_at, download_token")
    .eq("auth_user_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("[dsar] fetch error", error);
    res.status(500).json({ error: "Failed to fetch DSAR status" });
    return;
  }

  const now = new Date();
  const latest = (requests ?? [])[0] ?? null;
  const isWithinCooldown =
    latest &&
    now.getTime() - new Date(latest.requested_at as string).getTime() < THIRTY_DAYS_MS;

  res.json({
    latest,
    can_request: !isWithinCooldown,
    next_eligible_at: isWithinCooldown
      ? new Date(new Date(latest.requested_at as string).getTime() + THIRTY_DAYS_MS).toISOString()
      : null,
  });
});

// ── POST /api/dsar/request — submit request ────────────────────────────────────

router.post("/dsar/request", async (req: Request, res: Response) => {
  const user = await resolveAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  let db: ReturnType<typeof getSupabase>;
  try {
    db = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  // Rate limit: one request per 30 days
  const { data: recent } = await db
    .from("dsar_requests")
    .select("id, requested_at")
    .eq("auth_user_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    const elapsed = Date.now() - new Date(recent.requested_at as string).getTime();
    if (elapsed < THIRTY_DAYS_MS) {
      const nextEligible = new Date(new Date(recent.requested_at as string).getTime() + THIRTY_DAYS_MS);
      res.status(429).json({
        error: "One DSAR per 30 days",
        next_eligible_at: nextEligible.toISOString(),
      });
      return;
    }
  }

  // Determine requester type: creator if they have a creator record
  const { data: creatorRow } = await db
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const requesterType: "creator" | "fan" = creatorRow ? "creator" : "fan";

  const downloadToken = makeDownloadToken();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + (requesterType === "creator" ? SEVENTY_TWO_HOURS_MS : THIRTY_DAYS_MS),
  );

  const { data: dsarRow, error: insertError } = await db
    .from("dsar_requests")
    .insert({
      auth_user_id: user.id,
      requester_type: requesterType,
      status: "processing",
      download_token: downloadToken,
      requested_at: now.toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !dsarRow) {
    console.error("[dsar] insert error", insertError);
    res.status(500).json({ error: "Failed to create DSAR request" });
    return;
  }

  // Collect data synchronously (Slice 1 — no async job needed for this dataset size)
  let packageData: object;
  try {
    packageData =
      requesterType === "creator"
        ? await collectCreatorData(user.id)
        : await collectFanData(user.id);
  } catch (err) {
    console.error("[dsar] data collection error", err);
    await db
      .from("dsar_requests")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", dsarRow.id as string);
    res.status(500).json({ error: "Failed to collect data" });
    return;
  }

  const packageJson = JSON.stringify(packageData, null, 2);
  const packageSize = Buffer.byteLength(packageJson, "utf8");

  await db
    .from("dsar_requests")
    .update({
      status: "ready",
      package_size: packageSize,
      ready_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", dsarRow.id as string);

  res.json({
    id: dsarRow.id,
    status: "ready",
    requester_type: requesterType,
    download_token: downloadToken,
    expires_at: expiresAt.toISOString(),
    package_size_bytes: packageSize,
  });
});

// ── GET /api/dsar/download?token=xxx ─────────────────────────────────────────

router.get("/dsar/download", async (req: Request, res: Response) => {
  const user = await resolveAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = req.query.token as string | undefined;
  if (!token || typeof token !== "string" || token.length < 10) {
    res.status(400).json({ error: "Token required" });
    return;
  }

  let db: ReturnType<typeof getSupabase>;
  try {
    db = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const { data: dsarRow, error } = await db
    .from("dsar_requests")
    .select("id, auth_user_id, requester_type, status, expires_at")
    .eq("download_token", token)
    .maybeSingle();

  if (error || !dsarRow) {
    res.status(404).json({ error: "Download token not found" });
    return;
  }

  if ((dsarRow.auth_user_id as string) !== user.id) {
    res.status(403).json({ error: "Token does not belong to this account" });
    return;
  }

  if (dsarRow.status === "expired") {
    res.status(410).json({ error: "Download link has expired" });
    return;
  }

  if (dsarRow.status === "failed") {
    res.status(500).json({ error: "DSAR package failed to generate" });
    return;
  }

  if (dsarRow.status !== "ready" && dsarRow.status !== "downloaded") {
    res.status(409).json({ error: "Data package not ready yet" });
    return;
  }

  const expiresAt = dsarRow.expires_at ? new Date(dsarRow.expires_at as string) : null;
  if (expiresAt && expiresAt < new Date()) {
    await db
      .from("dsar_requests")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", dsarRow.id as string);
    res.status(410).json({ error: "Download link has expired" });
    return;
  }

  // Re-collect data on download (Slice 1: package not stored as blob)
  let packageData: object;
  try {
    packageData =
      (dsarRow.requester_type as string) === "creator"
        ? await collectCreatorData(user.id)
        : await collectFanData(user.id);
  } catch (err) {
    console.error("[dsar/download] data collection error", err);
    res.status(500).json({ error: "Failed to generate data package" });
    return;
  }

  await db
    .from("dsar_requests")
    .update({
      status: "downloaded",
      downloaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", dsarRow.id as string);

  const filename = `7of1-data-export-${new Date().toISOString().split("T")[0]}.json`;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.json(packageData);
});

export default router;
