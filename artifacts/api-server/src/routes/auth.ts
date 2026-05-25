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

// ─── Phone OTP (HID-002) ──────────────────────────────────────────────────────
//
// Twilio-backed via Supabase phone auth. JP/TW/SG deliverability telemetry
// is recorded in phone_otp_attempts for provider evaluation.

const PHONE_E164_RE = /^\+[1-9]\d{6,14}$/;

// Infer a 2-letter region code from E.164 prefix for deliverability tracking.
function phoneRegionCode(phone: string): string {
  if (phone.startsWith("+81")) return "JP";
  if (phone.startsWith("+886")) return "TW";
  if (phone.startsWith("+65")) return "SG";
  if (phone.startsWith("+852")) return "HK";
  if (phone.startsWith("+1")) return "US";
  return "OTHER";
}

// POST /api/auth/fan/send-phone-otp
// Body: { phone: string, email?: string }
//   phone — E.164 format (e.g. +818012345678)
//   email — optional; used as fallback if Twilio SMS fails
//
// Rate limits (enforced via phone_otp_attempts):
//   5 sends per phone per hour
//   3 sends per IP per 15 minutes
//
// Falls back to email OTP when Twilio is unavailable and email is supplied.
router.post("/auth/fan/send-phone-otp", async (req: Request, res: Response) => {
  const { phone, email } = req.body as { phone?: string; email?: string };

  if (!phone || typeof phone !== "string" || !PHONE_E164_RE.test(phone.trim())) {
    res.status(400).json({ error: "Valid E.164 phone number required (e.g. +818012345678)" });
    return;
  }

  const phoneTrimmed = phone.trim();
  const regionCode = phoneRegionCode(phoneTrimmed);
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    null;

  let supabase: ReturnType<typeof getSupabase>;
  let supabaseAnon: ReturnType<typeof getSupabaseAnon>;
  try {
    supabase = getSupabase();
    supabaseAnon = getSupabaseAnon();
  } catch {
    res.status(503).json({ error: "Auth service not configured" });
    return;
  }

  // ── Rate limits ────────────────────────────────────────────────────────────
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { count: phoneSends } = await supabase
    .from("phone_otp_attempts")
    .select("id", { count: "exact", head: true })
    .eq("phone_e164", phoneTrimmed)
    .eq("kind", "send")
    .gte("created_at", hourAgo);

  if ((phoneSends ?? 0) >= 5) {
    res.status(429).json({ error: "Too many OTP requests for this number. Try again in 1 hour." });
    return;
  }

  if (ip) {
    const { count: ipSends } = await supabase
      .from("phone_otp_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ip)
      .eq("kind", "send")
      .gte("created_at", fifteenMinAgo);

    if ((ipSends ?? 0) >= 3) {
      res.status(429).json({ error: "Too many OTP requests from this IP. Try again shortly." });
      return;
    }
  }

  // ── Send SMS OTP via Supabase/Twilio ───────────────────────────────────────
  const { error: smsErr } = await supabaseAnon.auth.signInWithOtp({
    phone: phoneTrimmed,
  });

  if (!smsErr) {
    await supabase.from("phone_otp_attempts").insert({
      phone_e164: phoneTrimmed,
      ip_address: ip,
      kind: "send",
      success: true,
      region_code: regionCode,
      fallback_used: false,
    });
    res.json({ sent: true, via: "sms" });
    return;
  }

  req.log.warn(
    { err: smsErr.message, phone: phoneTrimmed.slice(0, 6) + "***", region: regionCode },
    "[auth/send-phone-otp] Twilio send failed",
  );

  // ── Fallback: email OTP ────────────────────────────────────────────────────
  if (email && typeof email === "string" && email.includes("@")) {
    const { error: emailErr } = await supabaseAnon.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    const fallbackOk = !emailErr;
    await supabase.from("phone_otp_attempts").insert({
      phone_e164: phoneTrimmed,
      ip_address: ip,
      kind: "send",
      success: fallbackOk,
      region_code: regionCode,
      fallback_used: true,
    });

    if (!fallbackOk) {
      res.status(502).json({ error: "Failed to deliver OTP by SMS or email" });
      return;
    }

    const [user, domain] = email.split("@");
    const masked = `${user.slice(0, 2)}***@${domain}`;
    res.json({ sent: true, via: "email_fallback", email: masked });
    return;
  }

  // No fallback available
  await supabase.from("phone_otp_attempts").insert({
    phone_e164: phoneTrimmed,
    ip_address: ip,
    kind: "send",
    success: false,
    region_code: regionCode,
    fallback_used: false,
  });

  res.status(502).json({ error: "SMS delivery failed. Provide an email to enable fallback." });
});

// POST /api/auth/fan/verify-phone-otp
// Body: { phone: string, token: string, creatorId?: string, handle?: string }
// Verifies the Twilio/Supabase phone OTP, upserts fan_accounts, sets auth cookies.
//
// Brute-force limit: 10 failed verifies per phone per hour → 429.
router.post("/auth/fan/verify-phone-otp", async (req: Request, res: Response) => {
  const { phone, token: otp, creatorId: rawCreatorId, handle } = req.body as {
    phone?: string;
    token?: string;
    creatorId?: string;
    handle?: string;
  };

  if (!phone || typeof phone !== "string" || !PHONE_E164_RE.test(phone.trim())) {
    res.status(400).json({ error: "Valid E.164 phone number required" });
    return;
  }
  if (!otp) {
    res.status(400).json({ error: "token is required" });
    return;
  }
  if (!rawCreatorId && !handle) {
    res.status(400).json({ error: "creatorId or handle is required" });
    return;
  }

  const phoneTrimmed = phone.trim();
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    null;

  let supabase: ReturnType<typeof getSupabase>;
  let supabaseAnon: ReturnType<typeof getSupabaseAnon>;
  try {
    supabase = getSupabase();
    supabaseAnon = getSupabaseAnon();
  } catch {
    res.status(503).json({ error: "Auth service not configured" });
    return;
  }

  // Brute-force guard: 10 failed verifies per phone per hour
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: failedVerifies } = await supabase
    .from("phone_otp_attempts")
    .select("id", { count: "exact", head: true })
    .eq("phone_e164", phoneTrimmed)
    .eq("kind", "verify")
    .eq("success", false)
    .gte("created_at", hourAgo);

  if ((failedVerifies ?? 0) >= 10) {
    res.status(429).json({ error: "Too many failed attempts. Try again in 1 hour." });
    return;
  }

  const { data: authData, error: authError } = await supabaseAnon.auth.verifyOtp({
    phone: phoneTrimmed,
    token: otp,
    type: "sms",
  });

  if (authError || !authData.session || !authData.user) {
    await supabase.from("phone_otp_attempts").insert({
      phone_e164: phoneTrimmed,
      ip_address: ip,
      kind: "verify",
      success: false,
      region_code: phoneRegionCode(phoneTrimmed),
    });
    res.status(401).json({ error: "Invalid or expired OTP" });
    return;
  }

  await supabase.from("phone_otp_attempts").insert({
    phone_e164: phoneTrimmed,
    ip_address: ip,
    kind: "verify",
    success: true,
    region_code: phoneRegionCode(phoneTrimmed),
  });

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

  // Upsert fan_accounts (idempotent on auth_user_id + creator_id)
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

export default router;

