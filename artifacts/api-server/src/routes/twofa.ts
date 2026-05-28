// 2FA status + web setup + payout enable gate (OF-119)
// TOTP implemented using Node.js built-in crypto (RFC 6238 / RFC 4226).
// No external dependencies — QR is generated client-side from otpauth URI.
import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import { getReplitUser } from "../lib/auth.js";
import { getSupabase } from "../lib/supabase.js";

const router: IRouter = Router();

// ── TOTP helpers (RFC 6238 / RFC 4226) ────────────────────────────────────────

function generateTotpSecret(): string {
  // 20-byte base32 secret (matches otplib default)
  const bytes = crypto.randomBytes(20);
  const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let result = "";
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) result += BASE32[(value << (5 - bits)) & 0x1f];
  return result;
}

function base32Decode(secret: string): Buffer {
  const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = secret.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const idx = BASE32.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function hotp(secret: string, counter: bigint): string {
  const key = base32Decode(secret);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(counter);
  const hmac = crypto.createHmac("sha1", key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1_000_000;
  return code.toString().padStart(6, "0");
}

function verifyTotpCode(secret: string, token: string, windowSteps = 1): boolean {
  const normalized = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const counter = BigInt(Math.floor(Date.now() / 1000 / 30));
  for (let delta = -windowSteps; delta <= windowSteps; delta++) {
    if (hotp(secret, counter + BigInt(delta)) === normalized) return true;
  }
  return false;
}

function buildOtpAuthUri(secret: string, account: string): string {
  return `otpauth://totp/${encodeURIComponent("7of1")}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent("7of1")}&algorithm=SHA1&digits=6&period=30`;
}

function generateRecoveryCodes(): string[] {
  return Array.from({ length: 8 }, () => {
    const a = crypto.randomBytes(3).toString("hex").toUpperCase();
    const b = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `${a}-${b}`;
  });
}

function hashRecoveryCode(code: string): string {
  return crypto
    .createHash("sha256")
    .update(code.toUpperCase().replace(/[\s-]/g, ""))
    .digest("hex");
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/auth/2fa/status
router.get("/auth/2fa/status", async (req: Request, res: Response) => {
  const user = getReplitUser(req);
  if (!user) { res.status(401).json({ error: "Replit Auth required" }); return; }

  let db: ReturnType<typeof getSupabase>;
  try { db = getSupabase(); } catch {
    res.status(503).json({ error: "Database not configured" }); return;
  }

  const { data: creator, error: creatorErr } = await db
    .from("creators").select("id").eq("replit_user_id", user.id).maybeSingle();
  if (creatorErr || !creator) { res.status(404).json({ error: "Creator not found" }); return; }

  const { data: totp } = await db
    .from("creator_totp")
    .select("totp_enabled, recovery_codes, enabled_at")
    .eq("creator_id", creator.id)
    .maybeSingle();

  res.json({
    enabled: totp?.totp_enabled ?? false,
    recoveryCodesRemaining: (totp?.recovery_codes ?? []).length,
    enabledAt: totp?.enabled_at ?? null,
  });
});

// POST /api/auth/2fa/setup/begin — generate secret, store pending, return otpauth URI + key
router.post("/auth/2fa/setup/begin", async (req: Request, res: Response) => {
  const user = getReplitUser(req);
  if (!user) { res.status(401).json({ error: "Replit Auth required" }); return; }

  let db: ReturnType<typeof getSupabase>;
  try { db = getSupabase(); } catch {
    res.status(503).json({ error: "Database not configured" }); return;
  }

  const { data: creator, error: creatorErr } = await db
    .from("creators").select("id, display_name").eq("replit_user_id", user.id).maybeSingle();
  if (creatorErr || !creator) { res.status(404).json({ error: "Creator not found" }); return; }

  const { data: existing } = await db
    .from("creator_totp").select("totp_enabled").eq("creator_id", creator.id).maybeSingle();
  if (existing?.totp_enabled) { res.status(409).json({ error: "2FA is already enabled" }); return; }

  const secret = generateTotpSecret();
  const otpauthUri = buildOtpAuthUri(secret, creator.display_name);

  // Store pending secret (totp_enabled=false until verify confirms it)
  const { error: upsertErr } = await db.from("creator_totp").upsert({
    creator_id: creator.id,
    totp_secret: secret,
    totp_enabled: false,
    recovery_codes: [],
    updated_at: new Date().toISOString(),
  });
  if (upsertErr) { res.status(500).json({ error: "Failed to store setup state" }); return; }

  res.json({ secretKey: secret, otpauthUri });
});

// POST /api/auth/2fa/setup/verify — confirm code, enable 2FA, return recovery codes
router.post("/auth/2fa/setup/verify", async (req: Request, res: Response) => {
  const user = getReplitUser(req);
  if (!user) { res.status(401).json({ error: "Replit Auth required" }); return; }

  const { code } = req.body as { code?: string };
  if (!code || !/^\d{6}$/.test(code.replace(/\s/g, ""))) {
    res.status(400).json({ error: "6-digit code required" }); return;
  }

  let db: ReturnType<typeof getSupabase>;
  try { db = getSupabase(); } catch {
    res.status(503).json({ error: "Database not configured" }); return;
  }

  const { data: creator, error: creatorErr } = await db
    .from("creators").select("id").eq("replit_user_id", user.id).maybeSingle();
  if (creatorErr || !creator) { res.status(404).json({ error: "Creator not found" }); return; }

  const { data: totp } = await db
    .from("creator_totp").select("totp_secret, totp_enabled").eq("creator_id", creator.id).maybeSingle();
  if (!totp?.totp_secret) {
    res.status(400).json({ error: "No pending 2FA setup. Call /setup/begin first." }); return;
  }
  if (totp.totp_enabled) { res.status(409).json({ error: "2FA is already enabled" }); return; }

  if (!verifyTotpCode(totp.totp_secret, code)) {
    res.status(422).json({ error: "Invalid code. Check your authenticator and try again." }); return;
  }

  const rawCodes = generateRecoveryCodes();
  const hashedCodes = rawCodes.map(hashRecoveryCode);

  const { error: updateErr } = await db.from("creator_totp").update({
    totp_enabled: true,
    recovery_codes: hashedCodes,
    enabled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("creator_id", creator.id);
  if (updateErr) { res.status(500).json({ error: "Failed to enable 2FA" }); return; }

  console.log(`[api] 2FA enabled via dashboard creator_id=${creator.id}`);
  res.json({ ok: true, recoveryCodes: rawCodes });
});

// POST /api/auth/2fa/disable — accept TOTP code or recovery code, disable 2FA
router.post("/auth/2fa/disable", async (req: Request, res: Response) => {
  const user = getReplitUser(req);
  if (!user) { res.status(401).json({ error: "Replit Auth required" }); return; }

  const { code } = req.body as { code?: string };
  if (!code) { res.status(400).json({ error: "code required" }); return; }

  let db: ReturnType<typeof getSupabase>;
  try { db = getSupabase(); } catch {
    res.status(503).json({ error: "Database not configured" }); return;
  }

  const { data: creator, error: creatorErr } = await db
    .from("creators").select("id").eq("replit_user_id", user.id).maybeSingle();
  if (creatorErr || !creator) { res.status(404).json({ error: "Creator not found" }); return; }

  const { data: totp } = await db
    .from("creator_totp")
    .select("totp_secret, totp_enabled, recovery_codes")
    .eq("creator_id", creator.id)
    .maybeSingle();
  if (!totp?.totp_enabled) { res.status(400).json({ error: "2FA is not enabled" }); return; }

  const normalized = code.replace(/\s/g, "");
  let valid = verifyTotpCode(totp.totp_secret, normalized);
  let updatedCodes: string[] | undefined;

  if (!valid) {
    // Try as recovery code (strip dashes, uppercase)
    const hash = hashRecoveryCode(normalized.replace(/-/g, ""));
    const codes = totp.recovery_codes as string[];
    const idx = codes.indexOf(hash);
    if (idx !== -1) {
      valid = true;
      const remaining = [...codes];
      remaining.splice(idx, 1);
      updatedCodes = remaining;
    }
  }

  if (!valid) { res.status(422).json({ error: "Invalid code" }); return; }

  const { error: updateErr } = await db.from("creator_totp").update({
    totp_enabled: false,
    recovery_codes: updatedCodes ?? [],
    updated_at: new Date().toISOString(),
  }).eq("creator_id", creator.id);
  if (updateErr) { res.status(500).json({ error: "Failed to disable 2FA" }); return; }

  console.log(`[api] 2FA disabled via dashboard creator_id=${creator.id}`);
  res.json({ ok: true });
});

// POST /api/payments/payout/enable — 2FA gate before payout activation
router.post("/payments/payout/enable", async (req: Request, res: Response) => {
  const user = getReplitUser(req);
  if (!user) { res.status(401).json({ error: "Replit Auth required" }); return; }

  let db: ReturnType<typeof getSupabase>;
  try { db = getSupabase(); } catch {
    res.status(503).json({ error: "Database not configured" }); return;
  }

  const { data: creator, error: creatorErr } = await db
    .from("creators").select("id, display_name").eq("replit_user_id", user.id).maybeSingle();
  if (creatorErr || !creator) { res.status(404).json({ error: "Creator not found" }); return; }

  const { data: totp } = await db
    .from("creator_totp").select("totp_enabled").eq("creator_id", creator.id).maybeSingle();

  if (!totp?.totp_enabled) {
    res.status(403).json({
      error: "2FA required",
      message:
        "Enable two-factor authentication before activating payouts. " +
        "Go to Dashboard → Security or use /setup_2fa in Hermes.",
      setupVia: "dashboard:/dashboard/security",
    });
    return;
  }

  // 2FA confirmed — Stripe Connect onboarding link generated in Slice 3.
  res.json({ ok: true, creatorId: creator.id, message: "2FA verified. Payout setup ready." });
});

export default router;
