import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import {
  getSupabase,
  getSupabaseAnon,
  getUserFromToken,
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  sessionCookieOptions,
} from "../lib/supabase.js";
import { TRIAL_COOKIE, parseTrialCookie } from "../lib/auth.js";

const router: IRouter = Router();

// ─── Session ──────────────────────────────────────────────────────────────────

// GET /api/auth/session
// Returns current user from the Supabase JWT stored in httpOnly cookie.
router.get("/auth/session", async (req: Request, res: Response) => {
  const token: string | undefined =
    req.cookies?.[COOKIE_ACCESS_TOKEN] ??
    req.headers.authorization?.replace(/^Bearer\s+/i, "");

  const user = await getUserFromToken(token);
  if (!user) {
    res.status(401).json({ authenticated: false });
    return;
  }
  res.json({ authenticated: true, user: { id: user.id, email: user.email } });
});

// POST /api/auth/signout
router.post("/auth/signout", (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_ACCESS_TOKEN, { path: "/" });
  res.clearCookie(COOKIE_REFRESH_TOKEN, { path: "/" });
  res.json({ success: true });
});

// ─── Fan auth (email OTP — webview-safe, no OAuth popups) ────────────────────

// POST /api/auth/fan/send-otp
// Body: { email: string }
router.post("/auth/fan/send-otp", async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }

  let supabaseAnon: ReturnType<typeof getSupabaseAnon>;
  try {
    supabaseAnon = getSupabaseAnon();
  } catch {
    res.status(503).json({ error: "Auth service not configured" });
    return;
  }

  const { error } = await supabaseAnon.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    res.status(502).json({ error: "Failed to send OTP" });
    return;
  }

  res.json({ sent: true });
});

// POST /api/auth/fan/verify-otp
// Body: { email: string, token: string, creatorId?: string, handle?: string }
// Verifies OTP, upserts fan_accounts row, sets httpOnly auth cookies.
router.post("/auth/fan/verify-otp", async (req: Request, res: Response) => {
  const { email, token: otp, creatorId: rawCreatorId, handle } = req.body as {
    email?: string;
    token?: string;
    creatorId?: string;
    handle?: string;
  };

  if (!email || !otp || (!rawCreatorId && !handle)) {
    res.status(400).json({ error: "email, token, and creatorId or handle are required" });
    return;
  }

  let supabaseAnon: ReturnType<typeof getSupabaseAnon>;
  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabaseAnon = getSupabaseAnon();
    supabase = getSupabase();
  } catch {
    res.status(503).json({ error: "Auth service not configured" });
    return;
  }

  const { data: authData, error: authError } = await supabaseAnon.auth.verifyOtp({
    email,
    token: otp,
    type: "email",
  });

  if (authError || !authData.session || !authData.user) {
    res.status(401).json({ error: "Invalid or expired OTP" });
    return;
  }

  const { access_token, refresh_token, expires_in } = authData.session;
  const authUserId = authData.user.id;

  // Resolve creator by ID or handle
  let creatorId: string | null = rawCreatorId ?? null;
  if (!creatorId && handle) {
    const { data: row } = await supabase
      .from("creator_config")
      .select("creator_id")
      .eq("handle", handle)
      .maybeSingle();
    creatorId = (row as { creator_id?: string } | null)?.creator_id ?? null;
  }

  if (!creatorId) {
    res.status(404).json({ error: "Creator not found" });
    return;
  }

  // Upsert fan_accounts: idempotent on (auth_user_id, creator_id)
  const { data: existing } = await supabase
    .from("fan_accounts")
    .select("fan_id")
    .eq("auth_user_id", authUserId)
    .eq("creator_id", creatorId)
    .maybeSingle();

  let fanId: string;
  if (existing) {
    fanId = existing.fan_id;
  } else {
    const trialCount = parseTrialCookie(req.cookies?.[TRIAL_COOKIE]);
    fanId = crypto.randomUUID();

    const { error: insertErr } = await supabase.from("fan_accounts").insert({
      fan_id: fanId,
      creator_id: creatorId,
      auth_user_id: authUserId,
      trial_count: trialCount,
    });

    if (insertErr) {
      res.status(500).json({ error: "Failed to create fan account" });
      return;
    }
  }

  res.cookie(COOKIE_ACCESS_TOKEN, access_token, sessionCookieOptions(expires_in ?? 3600));
  res.cookie(COOKIE_REFRESH_TOKEN, refresh_token, sessionCookieOptions(60 * 60 * 24 * 30));

  res.json({ authenticated: true, fanId, creatorId });
});

// ─── Creator auth (email OTP) ─────────────────────────────────────────────────

// POST /api/auth/creator/send-otp
// Body: { email: string }
router.post("/auth/creator/send-otp", async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }

  let supabaseAnon: ReturnType<typeof getSupabaseAnon>;
  try {
    supabaseAnon = getSupabaseAnon();
  } catch {
    res.status(503).json({ error: "Auth service not configured" });
    return;
  }

  const { error } = await supabaseAnon.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    res.status(502).json({ error: "Failed to send OTP" });
    return;
  }

  res.json({ sent: true });
});

// POST /api/auth/creator/verify-otp
// Body: { email: string, token: string }
// Verifies OTP, links auth_user_id to creator record (matched by email),
// sets auth cookies. Returns needsOnboarding=true if no creator record found.
router.post("/auth/creator/verify-otp", async (req: Request, res: Response) => {
  const { email, token: otp } = req.body as { email?: string; token?: string };
  if (!email || !otp) {
    res.status(400).json({ error: "email and token are required" });
    return;
  }

  let supabaseAnon: ReturnType<typeof getSupabaseAnon>;
  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabaseAnon = getSupabaseAnon();
    supabase = getSupabase();
  } catch {
    res.status(503).json({ error: "Auth service not configured" });
    return;
  }

  const { data: authData, error: authError } = await supabaseAnon.auth.verifyOtp({
    email,
    token: otp,
    type: "email",
  });

  if (authError || !authData.session || !authData.user) {
    res.status(401).json({ error: "Invalid or expired OTP" });
    return;
  }

  const { access_token, refresh_token, expires_in } = authData.session;
  const authUserId = authData.user.id;

  // Find creator by auth_user_id or email
  const { data: existing } = await supabase
    .from("creators")
    .select("id, auth_user_id, email")
    .or(`auth_user_id.eq.${authUserId},email.eq.${email}`)
    .maybeSingle();

  let creatorId: string | null = null;
  let needsOnboarding = false;

  if (existing) {
    if (!existing.auth_user_id) {
      await supabase
        .from("creators")
        .update({ auth_user_id: authUserId, email })
        .eq("id", existing.id);
    }
    creatorId = existing.id;
  } else {
    needsOnboarding = true;
  }

  res.cookie(COOKIE_ACCESS_TOKEN, access_token, sessionCookieOptions(expires_in ?? 3600));
  res.cookie(COOKIE_REFRESH_TOKEN, refresh_token, sessionCookieOptions(60 * 60 * 24 * 30));

  res.json({ authenticated: true, creatorId, needsOnboarding });
});

// POST /api/auth/creator/telegram-connect
// Called by Hermes bot when creator sends /connect in @7of1_bot.
// Body: { telegramUserId: string, creatorId: string }
// Protected by HERMES_SERVICE_KEY header.
router.post("/auth/creator/telegram-connect", async (req: Request, res: Response) => {
  const { telegramUserId, creatorId } = req.body as {
    telegramUserId?: string;
    creatorId?: string;
  };

  if (!telegramUserId || !creatorId) {
    res.status(400).json({ error: "telegramUserId and creatorId are required" });
    return;
  }

  const hermesKey = req.headers["x-hermes-service-key"];
  const expectedKey = process.env.HERMES_SERVICE_KEY;
  if (!expectedKey || hermesKey !== expectedKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const { data: creator, error: lookupErr } = await supabase
    .from("creators")
    .select("id, telegram_user_id")
    .eq("id", creatorId)
    .maybeSingle();

  if (lookupErr || !creator) {
    res.status(404).json({ error: "Creator not found" });
    return;
  }

  if (creator.telegram_user_id && creator.telegram_user_id !== telegramUserId) {
    res.status(409).json({
      error: "Creator already linked to a different Telegram account",
    });
    return;
  }

  const { error: updateErr } = await supabase
    .from("creators")
    .update({ telegram_user_id: telegramUserId })
    .eq("id", creatorId);

  if (updateErr) {
    res.status(500).json({ error: "Failed to link Telegram account" });
    return;
  }

  res.json({ linked: true, creatorId, telegramUserId });
});

export default router;
