// OF-117 / HID-004 — Fan account recovery
// POST /api/account/fan/recover
//
// Accepts either:
//   application/json      { account_email, backup_email? | backup_phone? }
//   multipart/form-data   { account_email, full_name, date_of_birth, id_attestation (file) }
//
// Returns { fraud_hold: bool }.
// Fraud signal: account created < 24 h ago AND credit spend < 1 h ago.

import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import multer from "multer";
import { getReplitUser } from "../lib/auth.js";
import { getSupabase } from "../lib/supabase.js";

const router: IRouter = Router();

// Multer: store in memory for this slice; real GCS/R2 upload wired separately.
// File size capped at 10 MB to prevent abuse.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const FRAUD_ACCOUNT_AGE_HOURS = 24;
const FRAUD_SPEND_WINDOW_HOURS = 1;

function generateOtp(): { otp: string; hash: string } {
  const otp = crypto.randomInt(100000, 999999).toString();
  const hash = crypto.createHash("sha256").update(otp).digest("hex");
  return { otp, hash };
}

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

async function detectFraud(
  db: ReturnType<typeof getSupabase>,
  fanId: string | null
): Promise<boolean> {
  if (!fanId) return false;

  // Account created within fraud window?
  const ageThreshold = new Date(
    Date.now() - FRAUD_ACCOUNT_AGE_HOURS * 3_600_000
  ).toISOString();
  const { data: fan } = await db
    .from("fans")
    .select("id")
    .eq("id", fanId)
    .gt("created_at", ageThreshold)
    .maybeSingle();
  if (!fan) return false;

  // Credit spend within liquidation window?
  const spendThreshold = new Date(
    Date.now() - FRAUD_SPEND_WINDOW_HOURS * 3_600_000
  ).toISOString();
  const { data: txns } = await db
    .from("credit_transactions")
    .select("id")
    .eq("fan_id", fanId)
    .eq("kind", "spend")
    .gte("created_at", spendThreshold)
    .limit(1);
  return (txns?.length ?? 0) > 0;
}

async function writeAudit(
  db: ReturnType<typeof getSupabase>,
  params: {
    requestId: string;
    fanId: string | null;
    eventType: string;
    ipAddress: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await db.from("fan_recovery_audit_log").insert({
    request_id: params.requestId,
    fan_id: params.fanId ?? null,
    event_type: params.eventType,
    actor_id: "system",
    ip_address: params.ipAddress,
    metadata: params.metadata ?? null,
  });
}

async function resolveFanId(
  db: ReturnType<typeof getSupabase>,
  req: Request
): Promise<string | null> {
  const user = getReplitUser(req);
  if (!user) return null;
  const { data } = await db
    .from("fans")
    .select("id")
    .eq("replit_user_id", user.id)
    .maybeSingle();
  return data?.id ?? null;
}

// ---------------------------------------------------------------------------
// POST /api/account/fan/recover   (JSON path)
// ---------------------------------------------------------------------------
router.post(
  "/account/fan/recover",
  async (req: Request, res: Response, next) => {
    const ct = req.headers["content-type"] ?? "";
    if (ct.includes("multipart/form-data")) {
      // Delegate to multipart handler below
      next();
      return;
    }

    const { account_email, backup_email, backup_phone } = req.body as {
      account_email?: string;
      backup_email?: string;
      backup_phone?: string;
    };

    if (!account_email) {
      res.status(400).json({ error: "account_email required" });
      return;
    }
    if (!backup_email && !backup_phone) {
      res.status(400).json({ error: "backup_email or backup_phone required" });
      return;
    }

    let db: ReturnType<typeof getSupabase>;
    try {
      db = getSupabase();
    } catch {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const fanId = await resolveFanId(db, req);
    const method = backup_email ? "backup_email" : "backup_phone";
    const backupContact = (backup_email ?? backup_phone) as string;
    const fraudHold = await detectFraud(db, fanId);
    const { otp, hash: otpHash } = generateOtp();
    const requestId = crypto.randomUUID();
    const ip = clientIp(req);

    const { error: insertErr } = await db.from("fan_recovery_requests").insert({
      id: requestId,
      fan_id: fanId,
      account_email,
      method,
      status: "otp_sent",
      backup_contact: backupContact,
      otp_hash: otpHash,
      otp_attempts: 0,
      fraud_hold: fraudHold,
    });

    if (insertErr) {
      req.log.error({ err: insertErr.message }, "[fan-recovery/json] insert error");
      res.status(500).json({ error: "Failed to create recovery request" });
      return;
    }

    // OTP delivery — stubbed pending notification service integration.
    // In production: call email/SMS provider with `otp` to `backupContact`.
    req.log.info(
      { requestId, method, contact: backupContact.slice(0, 4) + "…" },
      "[fan-recovery] OTP generated (delivery stubbed)"
    );

    await writeAudit(db, {
      requestId,
      fanId,
      eventType: "recovery_initiated",
      ipAddress: ip,
      metadata: { method, account_email },
    });
    await writeAudit(db, {
      requestId,
      fanId,
      eventType: "otp_sent",
      ipAddress: ip,
      metadata: { method },
    });
    if (fraudHold) {
      await writeAudit(db, {
        requestId,
        fanId,
        eventType: "fraud_hold_applied",
        ipAddress: ip,
        metadata: { reason: "rapid_recovery_plus_liquidation" },
      });
    }

    res.json({ fraud_hold: fraudHold });
  }
);

// ---------------------------------------------------------------------------
// POST /api/account/fan/recover   (multipart / ID-attestation path)
// ---------------------------------------------------------------------------
router.post(
  "/account/fan/recover",
  upload.single("id_attestation"),
  async (req: Request, res: Response) => {
    const { account_email, full_name, date_of_birth } = req.body as {
      account_email?: string;
      full_name?: string;
      date_of_birth?: string;
    };

    if (!account_email) {
      res.status(400).json({ error: "account_email required" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "id_attestation file required" });
      return;
    }

    let db: ReturnType<typeof getSupabase>;
    try {
      db = getSupabase();
    } catch {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const fanId = await resolveFanId(db, req);
    const fraudHold = await detectFraud(db, fanId);
    const requestId = crypto.randomUUID();
    const ip = clientIp(req);

    // File storage: upload to Supabase Storage bucket `recovery-attestations`.
    // Key format: recovery/<requestId>/<original-filename>
    const objectKey = `recovery/${requestId}/${req.file.originalname}`;
    const { error: storageErr } = await db.storage
      .from("recovery-attestations")
      .upload(objectKey, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    // Non-fatal: record the key as null if storage fails; support can re-request.
    if (storageErr) {
      req.log.warn(
        { err: storageErr.message, requestId },
        "[fan-recovery/id] storage upload failed — continuing without key"
      );
    }

    const { error: insertErr } = await db.from("fan_recovery_requests").insert({
      id: requestId,
      fan_id: fanId,
      account_email,
      method: "id_attestation",
      status: "under_review",
      full_name: full_name ?? null,
      date_of_birth: date_of_birth ?? null,
      id_document_key: storageErr ? null : objectKey,
      fraud_hold: fraudHold,
    });

    if (insertErr) {
      req.log.error({ err: insertErr.message }, "[fan-recovery/id] insert error");
      res.status(500).json({ error: "Failed to queue attestation request" });
      return;
    }

    await writeAudit(db, {
      requestId,
      fanId,
      eventType: "recovery_initiated",
      ipAddress: ip,
      metadata: { method: "id_attestation", account_email },
    });
    await writeAudit(db, {
      requestId,
      fanId,
      eventType: "id_submitted",
      ipAddress: ip,
      metadata: {
        account_email,
        has_document: true,
        storage_ok: !storageErr,
      },
    });
    if (fraudHold) {
      await writeAudit(db, {
        requestId,
        fanId,
        eventType: "fraud_hold_applied",
        ipAddress: ip,
        metadata: { reason: "rapid_recovery_plus_liquidation" },
      });
    }

    res.json({ fraud_hold: fraudHold });
  }
);

export default router;
