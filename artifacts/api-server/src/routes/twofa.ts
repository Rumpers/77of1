// 2FA status + web setup + payout enable gate (OF-119)
// TOTP implemented using Node.js built-in crypto (RFC 6238 / RFC 4226).
// No external dependencies — QR is generated client-side from otpauth URI.
// PHASE-1 STUB: /payments/payout/enable is a Phase-1 check-only stub (Stripe Connect deferred).
// Core TOTP routes are fully migrated to Drizzle (creatorsTable, creatorTotpTable in Phase 1).
import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import { getReplitUser } from "../lib/auth.js";
import { db } from "@workspace/db";
import { creatorsTable, creatorTotpTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

  // Drizzle — creatorsTable is Phase 1
  const [creator] = await db
    .select({ id: creatorsTable.id })
    .from(creatorsTable)
    .where(eq(creatorsTable.replitUserId, user.id))
    .limit(1);

  if (!creator) { res.status(404).json({ error: "Creator not found" }); return; }

  // Drizzle — creatorTotpTable is Phase 1
  const [totp] = await db
    .select({
      totpEnabled: creatorTotpTable.totpEnabled,
      recoveryCodes: creatorTotpTable.recoveryCodes,
      enabledAt: creatorTotpTable.enabledAt,
    })
    .from(creatorTotpTable)
    .where(eq(creatorTotpTable.creatorId, creator.id))
    .limit(1);

  res.json({
    enabled: totp?.totpEnabled ?? false,
    recoveryCodesRemaining: (totp?.recoveryCodes ?? []).length,
    enabledAt: totp?.enabledAt ?? null,
  });
});

// POST /api/auth/2fa/setup/begin — generate secret, store pending, return otpauth URI + key
router.post("/auth/2fa/setup/begin", async (req: Request, res: Response) => {
  const user = getReplitUser(req);
  if (!user) { res.status(401).json({ error: "Replit Auth required" }); return; }

  // Drizzle — creatorsTable is Phase 1
  const [creator] = await db
    .select({ id: creatorsTable.id, displayName: creatorsTable.displayName })
    .from(creatorsTable)
    .where(eq(creatorsTable.replitUserId, user.id))
    .limit(1);

  if (!creator) { res.status(404).json({ error: "Creator not found" }); return; }

  // Drizzle — creatorTotpTable is Phase 1
  const [existing] = await db
    .select({ totpEnabled: creatorTotpTable.totpEnabled })
    .from(creatorTotpTable)
    .where(eq(creatorTotpTable.creatorId, creator.id))
    .limit(1);

  if (existing?.totpEnabled) { res.status(409).json({ error: "2FA is already enabled" }); return; }

  const secret = generateTotpSecret();
  const otpauthUri = buildOtpAuthUri(secret, creator.displayName);

  // Store pending secret (totp_enabled=false until verify confirms it) — upsert pattern
  await db
    .insert(creatorTotpTable)
    .values({
      creatorId: creator.id,
      totpSecret: secret,
      totpEnabled: false,
      recoveryCodes: [],
    })
    .onConflictDoUpdate({
      target: creatorTotpTable.creatorId,
      set: {
        totpSecret: secret,
        totpEnabled: false,
        recoveryCodes: [],
      },
    });

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

  // Drizzle — creatorsTable is Phase 1
  const [creator] = await db
    .select({ id: creatorsTable.id })
    .from(creatorsTable)
    .where(eq(creatorsTable.replitUserId, user.id))
    .limit(1);

  if (!creator) { res.status(404).json({ error: "Creator not found" }); return; }

  // Drizzle — creatorTotpTable is Phase 1
  const [totp] = await db
    .select({ totpSecret: creatorTotpTable.totpSecret, totpEnabled: creatorTotpTable.totpEnabled })
    .from(creatorTotpTable)
    .where(eq(creatorTotpTable.creatorId, creator.id))
    .limit(1);

  if (!totp?.totpSecret) {
    res.status(400).json({ error: "No pending 2FA setup. Call /setup/begin first." }); return;
  }
  if (totp.totpEnabled) { res.status(409).json({ error: "2FA is already enabled" }); return; }

  if (!verifyTotpCode(totp.totpSecret, code)) {
    res.status(422).json({ error: "Invalid code. Check your authenticator and try again." }); return;
  }

  const rawCodes = generateRecoveryCodes();
  const hashedCodes = rawCodes.map(hashRecoveryCode);

  await db
    .update(creatorTotpTable)
    .set({
      totpEnabled: true,
      recoveryCodes: hashedCodes,
      enabledAt: new Date(),
    })
    .where(eq(creatorTotpTable.creatorId, creator.id));

  console.log(`[api] 2FA enabled via dashboard creator_id=${creator.id}`);
  res.json({ ok: true, recoveryCodes: rawCodes });
});

// POST /api/auth/2fa/disable — accept TOTP code or recovery code, disable 2FA
router.post("/auth/2fa/disable", async (req: Request, res: Response) => {
  const user = getReplitUser(req);
  if (!user) { res.status(401).json({ error: "Replit Auth required" }); return; }

  const { code } = req.body as { code?: string };
  if (!code) { res.status(400).json({ error: "code required" }); return; }

  // Drizzle — creatorsTable is Phase 1
  const [creator] = await db
    .select({ id: creatorsTable.id })
    .from(creatorsTable)
    .where(eq(creatorsTable.replitUserId, user.id))
    .limit(1);

  if (!creator) { res.status(404).json({ error: "Creator not found" }); return; }

  // Drizzle — creatorTotpTable is Phase 1
  const [totp] = await db
    .select({
      totpSecret: creatorTotpTable.totpSecret,
      totpEnabled: creatorTotpTable.totpEnabled,
      recoveryCodes: creatorTotpTable.recoveryCodes,
    })
    .from(creatorTotpTable)
    .where(eq(creatorTotpTable.creatorId, creator.id))
    .limit(1);

  if (!totp?.totpEnabled) { res.status(400).json({ error: "2FA is not enabled" }); return; }

  const normalized = code.replace(/\s/g, "");
  let valid = verifyTotpCode(totp.totpSecret, normalized);
  let updatedCodes: string[] | undefined;

  if (!valid) {
    // Try as recovery code (strip dashes, uppercase)
    const hash = hashRecoveryCode(normalized.replace(/-/g, ""));
    const codes = totp.recoveryCodes;
    const idx = codes.indexOf(hash);
    if (idx !== -1) {
      valid = true;
      const remaining = [...codes];
      remaining.splice(idx, 1);
      updatedCodes = remaining;
    }
  }

  if (!valid) { res.status(422).json({ error: "Invalid code" }); return; }

  await db
    .update(creatorTotpTable)
    .set({
      totpEnabled: false,
      recoveryCodes: updatedCodes ?? [],
    })
    .where(eq(creatorTotpTable.creatorId, creator.id));

  console.log(`[api] 2FA disabled via dashboard creator_id=${creator.id}`);
  res.json({ ok: true });
});

// POST /api/payments/payout/enable — 2FA gate before payout activation
router.post("/payments/payout/enable", async (req: Request, res: Response) => {
  const user = getReplitUser(req);
  if (!user) { res.status(401).json({ error: "Replit Auth required" }); return; }

  // Drizzle — creatorsTable is Phase 1
  const [creator] = await db
    .select({ id: creatorsTable.id, displayName: creatorsTable.displayName })
    .from(creatorsTable)
    .where(eq(creatorsTable.replitUserId, user.id))
    .limit(1);

  if (!creator) { res.status(404).json({ error: "Creator not found" }); return; }

  // Drizzle — creatorTotpTable is Phase 1
  const [totp] = await db
    .select({ totpEnabled: creatorTotpTable.totpEnabled })
    .from(creatorTotpTable)
    .where(eq(creatorTotpTable.creatorId, creator.id))
    .limit(1);

  if (!totp?.totpEnabled) {
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
