// OF-172: Fan account recovery — POST /api/account/fan/recover
//
// Handles three recovery methods:
//   backup_email / backup_phone  — sends OTP to previously-registered backup contact
//   id_attestation               — accepts multipart ID doc for manual KYC review (202)
//
// Fraud guard: if rapid-recovery + recent credit liquidation detected within
// FRAUD_WINDOW_MS, the response includes { fraud_hold: true } and an audit log
// entry is created.

import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import multer from "multer";
import {
  getSupabase,
  getSupabaseAnon,
  sessionCookieOptions,
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
} from "../lib/supabase.js";

const router: IRouter = Router();

// ID documents are held in memory then pushed straight to Supabase Storage.
// Limit to 10 MB — large enough for a passport scan, small enough to prevent abuse.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Recent activity windows for fraud detection
const FRAUD_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
const ID_DOC_TTL_DAYS = 30;

// POST /api/account/fan/recover
//
// JSON body (backup_email / backup_phone):
//   { method: "backup_email"|"backup_phone", contact: string,
//     creatorId?: string, handle?: string }
//
// Multipart body (id_attestation):
//   method="id_attestation", full_name, dob, id_document (file),
//   contact? (claimed email for fan lookup), creatorId?, handle?
router.post(
  "/account/fan/recover",
  upload.single("id_document"),
  async (req: Request, res: Response) => {
    const method =
      (req.body as Record<string, string | undefined>)["method"];

    if (
      method !== "backup_email" &&
      method !== "backup_phone" &&
      method !== "id_attestation"
    ) {
      res.status(400).json({
        error: "method must be backup_email, backup_phone, or id_attestation",
      });
      return;
    }

    let supabase: ReturnType<typeof getSupabase>;
    let supabaseAnon: ReturnType<typeof getSupabaseAnon>;
    try {
      supabase = getSupabase();
      supabaseAnon = getSupabaseAnon();
    } catch {
      res.status(503).json({ error: "Auth service not configured" });
      return;
    }

    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
      req.socket.remoteAddress ??
      null;
    const ua = (req.headers["user-agent"] as string | undefined) ?? null;

    if (method === "id_attestation") {
      await handleIdAttestation(req, res, supabase, ip, ua);
      return;
    }

    await handleContactOtp(
      req,
      res,
      supabase,
      supabaseAnon,
      method as "backup_email" | "backup_phone",
      ip,
      ua,
    );
  },
);

// ── Backup email / phone OTP ──────────────────────────────────────────────────

async function handleContactOtp(
  req: Request,
  res: Response,
  supabase: ReturnType<typeof getSupabase>,
  supabaseAnon: ReturnType<typeof getSupabaseAnon>,
  method: "backup_email" | "backup_phone",
  ip: string | null,
  ua: string | null,
) {
  const body = req.body as Record<string, string | undefined>;
  const contact = body["contact"]?.trim();
  const rawCreatorId = body["creatorId"];
  const handle = body["handle"];

  if (!contact) {
    res.status(400).json({ error: "contact is required" });
    return;
  }
  if (!rawCreatorId && !handle) {
    res.status(400).json({ error: "creatorId or handle is required" });
    return;
  }

  // Resolve creator
  let creatorId = rawCreatorId ?? null;
  if (!creatorId && handle) {
    const { data: row } = await supabase
      .from("creator_config")
      .select("creator_id")
      .eq("handle", handle)
      .maybeSingle();
    creatorId = (row as { creator_id?: string } | null)?.creator_id ?? null;
  }
  if (!creatorId) {
    // Vague response to prevent creator enumeration
    res.json({ sent: true });
    return;
  }

  // Look up fan account by backup contact
  const contactColumn = method === "backup_email" ? "backup_email" : "backup_phone";
  const { data: account } = await supabase
    .from("fan_accounts")
    .select("fan_id, creator_id")
    .eq(contactColumn, contact)
    .eq("creator_id", creatorId)
    .maybeSingle();

  // Always return sent:true to prevent contact enumeration
  if (!account) {
    res.json({ sent: true });
    return;
  }

  const { fan_id: fanId } = account;

  // Fraud check: recent spend + prior recovery within window
  const since = new Date(Date.now() - FRAUD_WINDOW_MS).toISOString();
  const [spendResult, priorRecoveryResult] = await Promise.all([
    supabase
      .from("credit_transactions")
      .select("id", { count: "exact", head: true })
      .eq("fan_id", fanId)
      .eq("creator_id", creatorId)
      .eq("kind", "spend")
      .gte("created_at", since),
    supabase
      .from("fan_recovery_requests")
      .select("id", { count: "exact", head: true })
      .eq("fan_id", fanId)
      .gte("created_at", since),
  ]);

  const fraudHold =
    (spendResult.count ?? 0) > 0 && (priorRecoveryResult.count ?? 0) > 0;

  // Create recovery request record
  const requestId = crypto.randomUUID();
  await supabase.from("fan_recovery_requests").insert({
    id: requestId,
    fan_id: fanId,
    creator_id: creatorId,
    method,
    status: "initiated",
    contact_used: contact,
    fraud_hold: fraudHold,
    ip_address: ip,
    user_agent: ua,
  });

  if (fraudHold) {
    // Audit log entry for fraud hold
    await supabase.from("audit_log").insert({
      fan_id: fanId,
      creator_id: creatorId,
      event_type: "fan_recovery_fraud_hold",
      payload: {
        recovery_request_id: requestId,
        method,
        ip_address: ip,
      },
    });

    req.log.warn(
      { fanId, creatorId, requestId, method },
      "[account/recover] fraud hold triggered",
    );

    res.json({ sent: true, fraud_hold: true });
    return;
  }

  // Send OTP to the backup contact via Supabase
  if (method === "backup_email") {
    const { error: otpErr } = await supabaseAnon.auth.signInWithOtp({
      email: contact,
      options: { shouldCreateUser: false },
    });

    await supabase
      .from("fan_recovery_requests")
      .update({
        status: otpErr ? "otp_failed" : "otp_sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (otpErr) {
      req.log.error(
        { err: otpErr.message, requestId },
        "[account/recover] OTP send failed",
      );
    }
  } else {
    // backup_phone: send SMS OTP
    const { error: otpErr } = await supabaseAnon.auth.signInWithOtp({
      phone: contact,
    });

    await supabase
      .from("fan_recovery_requests")
      .update({
        status: otpErr ? "otp_failed" : "otp_sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (otpErr) {
      req.log.error(
        { err: otpErr.message, requestId },
        "[account/recover] SMS OTP send failed",
      );
    }
  }

  res.json({ sent: true });
}

// ── ID attestation ────────────────────────────────────────────────────────────

async function handleIdAttestation(
  req: Request,
  res: Response,
  supabase: ReturnType<typeof getSupabase>,
  ip: string | null,
  ua: string | null,
) {
  const body = req.body as Record<string, string | undefined>;
  const fullName = body["full_name"]?.trim();
  const dob = body["dob"]?.trim();
  const rawCreatorId = body["creatorId"];
  const handle = body["handle"];
  const contact = body["contact"]?.trim(); // optional claimed email for fan lookup
  const file = req.file;

  if (!fullName || !dob) {
    res.status(400).json({ error: "full_name and dob are required" });
    return;
  }
  if (!file) {
    res.status(400).json({ error: "id_document file is required" });
    return;
  }
  if (!rawCreatorId && !handle) {
    res.status(400).json({ error: "creatorId or handle is required" });
    return;
  }

  // Resolve creator
  let creatorId = rawCreatorId ?? null;
  if (!creatorId && handle) {
    const { data: row } = await supabase
      .from("creator_config")
      .select("creator_id")
      .eq("handle", handle)
      .maybeSingle();
    creatorId = (row as { creator_id?: string } | null)?.creator_id ?? null;
  }
  if (!creatorId) {
    // Accept the submission anyway — staff can triage without a creator context
    creatorId = "00000000-0000-0000-0000-000000000000";
  }

  // Optional: try to match an existing fan account via claimed contact
  let fanId: string | null = null;
  if (contact) {
    const { data: account } = await supabase
      .from("fan_accounts")
      .select("fan_id")
      .or(`backup_email.eq.${contact},backup_phone.eq.${contact}`)
      .eq("creator_id", creatorId)
      .maybeSingle();
    fanId = (account as { fan_id?: string } | null)?.fan_id ?? null;
  }

  // Upload ID document to Supabase Storage (bucket: fan-id-documents, private)
  const requestId = crypto.randomUUID();
  const ext = file.originalname.split(".").pop() ?? "bin";
  const storagePath = `fan-recovery/${requestId}/id_document.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("fan-id-documents")
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadErr) {
    req.log.error(
      { err: uploadErr.message, requestId },
      "[account/recover] ID doc upload failed",
    );
    res.status(500).json({ error: "Failed to store ID document" });
    return;
  }

  const docExpiresAt = new Date(
    Date.now() + ID_DOC_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Insert recovery request
  await supabase.from("fan_recovery_requests").insert({
    id: requestId,
    fan_id: fanId ?? crypto.randomUUID(), // ephemeral ID when fan not yet matched
    creator_id: creatorId,
    method: "id_attestation",
    status: "manual_review",
    contact_used: contact ?? null,
    full_name: fullName,
    dob,
    id_doc_path: storagePath,
    id_doc_expires_at: docExpiresAt,
    ip_address: ip,
    user_agent: ua,
  });

  // Audit log
  await supabase.from("audit_log").insert({
    fan_id: fanId,
    creator_id: creatorId,
    event_type: "fan_recovery_id_attestation_submitted",
    payload: {
      recovery_request_id: requestId,
      id_doc_path: storagePath,
      id_doc_expires_at: docExpiresAt,
      ip_address: ip,
    },
  });

  req.log.info(
    { requestId, creatorId, fanId },
    "[account/recover] ID attestation queued for review",
  );

  // 202 Accepted — credits remain accessible during review
  res.status(202).json({ queued: true, request_id: requestId });
}

export default router;
