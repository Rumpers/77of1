/**
 * KYC / onboarding gate routes  (OF-124)
 *
 * Creator-facing:
 *   GET  /api/kyc/status
 *   POST /api/kyc/identity          — upload identity doc reference
 *   POST /api/kyc/initiate-signing  — create SignWell personality-rights doc
 *   POST /api/kyc/signwell-webhook  — SignWell completion webhook (unauthenticated, HMAC-guarded)
 *
 * Ops-facing (requires OPS_USER_IDS env allowlist):
 *   GET  /api/ops/kyc-queue         — pending KYC submissions
 *   POST /api/ops/kyc/:creatorId/approve
 *   POST /api/ops/kyc/:creatorId/reject
 *   GET  /api/ops/audit-pack/:creatorId
 */

import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import { getReplitUser } from "../lib/auth.js";
import { getSupabase } from "../lib/supabase.js";
import {
  ensureKycRow,
  getKycRow,
  initiateSignwellSigning,
  hashIpForKyc,
  extractIp,
} from "../lib/kyc.js";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function resolveCreatorId(
  req: Request,
  res: Response
): Promise<string | null> {
  const user = getReplitUser(req);
  if (!user) {
    res.status(401).json({ error: "Creator auth required" });
    return null;
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from("creators")
    .select("id")
    .eq("replit_user_id", user.id)
    .maybeSingle();
  if (error || !data) {
    res.status(403).json({ error: "Not a linked creator account" });
    return null;
  }
  return (data as { id: string }).id;
}

function isOpsUser(req: Request): boolean {
  const user = getReplitUser(req);
  if (!user) return false;
  const allowlist = (process.env.OPS_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return allowlist.includes(user.id);
}

// ---------------------------------------------------------------------------
// GET /api/kyc/status
// ---------------------------------------------------------------------------
router.get("/kyc/status", async (req: Request, res: Response) => {
  const creatorId = await resolveCreatorId(req, res);
  if (!creatorId) return;

  const row = await getKycRow(creatorId);
  if (!row) {
    res.json({ status: "pending", creatorId });
    return;
  }

  res.json({
    status: row.status,
    creatorId,
    idDocSubmittedAt: row.id_doc_submitted_at,
    signwellStatus: row.signwell_status,
    personalityRightsSignedAt: row.personality_rights_signed_at,
    taxFormSubmittedAt: row.tax_form_submitted_at,
    opsReviewedAt: row.ops_reviewed_at,
  });
});

// ---------------------------------------------------------------------------
// POST /api/kyc/identity
// Body: { docType: string, region: string, storagePath: string }
// The client should upload the document to Supabase Storage and pass the path here.
// ---------------------------------------------------------------------------
router.post("/kyc/identity", async (req: Request, res: Response) => {
  const creatorId = await resolveCreatorId(req, res);
  if (!creatorId) return;

  const { docType, region, storagePath } = req.body as {
    docType?: string;
    region?: string;
    storagePath?: string;
  };

  if (!docType || !region || !storagePath) {
    res.status(400).json({ error: "docType, region, storagePath required" });
    return;
  }

  const validDocTypes = ["passport", "national_id", "drivers_license"];
  if (!validDocTypes.includes(docType)) {
    res.status(400).json({ error: `docType must be one of: ${validDocTypes.join(", ")}` });
    return;
  }

  await ensureKycRow(creatorId);

  const sb = getSupabase();
  const { error } = await sb
    .from("creator_kyc")
    .update({
      id_doc_type: docType,
      id_doc_region: region.toUpperCase(),
      id_doc_storage_path: storagePath,
      id_doc_submitted_at: new Date().toISOString(),
      status: "id_submitted",
    })
    .eq("creator_id", creatorId)
    .in("status", ["pending", "id_submitted"]);

  if (error) {
    req.log.error({ err: error.message }, "[kyc/identity] update error");
    res.status(500).json({ error: "Failed to record identity doc" });
    return;
  }

  // Write audit log
  await sb.from("audit_log").insert({
    creator_id: creatorId,
    event_type: "kyc_id_doc_submitted",
    payload: { docType, region },
  });

  res.json({ ok: true, status: "id_submitted" });
});

// ---------------------------------------------------------------------------
// POST /api/kyc/initiate-signing
// Body: { email: string, displayName: string }
// Creates a SignWell document and returns the signing URL for the creator.
// ---------------------------------------------------------------------------
router.post("/kyc/initiate-signing", async (req: Request, res: Response) => {
  const creatorId = await resolveCreatorId(req, res);
  if (!creatorId) return;

  const row = await getKycRow(creatorId);
  if (!row) {
    res.status(400).json({ error: "Submit identity doc first" });
    return;
  }
  if (!["id_verified", "id_submitted"].includes(row.status)) {
    res.status(409).json({ error: `Cannot initiate signing from status: ${row.status}` });
    return;
  }

  const { email, displayName } = req.body as {
    email?: string;
    displayName?: string;
  };

  if (!email || !displayName) {
    res.status(400).json({ error: "email and displayName required" });
    return;
  }

  try {
    const { signingUrl, docId } = await initiateSignwellSigning(
      creatorId,
      email,
      displayName
    );

    const sb = getSupabase();
    await sb.from("audit_log").insert({
      creator_id: creatorId,
      event_type: "kyc_signing_initiated",
      payload: { docId },
    });

    res.json({ ok: true, signingUrl, docId });
  } catch (err) {
    req.log.error({ err }, "[kyc/initiate-signing] SignWell error");
    res.status(502).json({ error: "Failed to create signing request" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/kyc/signwell-webhook
// SignWell calls this when creator signs (or declines) the personality-rights doc.
// HMAC-SHA256 signature verified via SIGNWELL_WEBHOOK_SECRET.
// ---------------------------------------------------------------------------
router.post(
  "/kyc/signwell-webhook",
  async (req: Request, res: Response) => {
    const secret = process.env.SIGNWELL_WEBHOOK_SECRET;
    if (secret) {
      const sig = req.headers["x-signwell-signature"] as string | undefined;
      if (!sig) {
        res.status(401).json({ error: "Missing SignWell signature header" });
        return;
      }
      const expected = crypto
        .createHmac("sha256", secret)
        .update(JSON.stringify(req.body))
        .digest("hex");
      if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        res.status(401).json({ error: "Invalid SignWell signature" });
        return;
      }
    }

    const { event_type, data } = req.body as {
      event_type?: string;
      data?: { document?: { id?: string; status?: string } };
    };

    const docId = data?.document?.id;
    if (!docId) {
      res.status(400).json({ error: "Missing document id in webhook" });
      return;
    }

    const sb = getSupabase();
    const { data: kycRow, error: fetchErr } = await sb
      .from("creator_kyc")
      .select("id, creator_id, status")
      .eq("signwell_doc_id", docId)
      .maybeSingle();

    if (fetchErr || !kycRow) {
      req.log.warn({ docId }, "[kyc/signwell-webhook] unknown doc_id");
      res.status(200).json({ ok: true });
      return;
    }

    const creatorId = (kycRow as { creator_id: string }).creator_id;
    const ip = extractIp(req.headers as Record<string, string | undefined>);
    const ipHash = hashIpForKyc(ip);
    const now = new Date().toISOString();

    if (event_type === "document.completed") {
      await sb
        .from("creator_kyc")
        .update({
          signwell_status: "signed",
          personality_rights_signed_at: now,
          personality_rights_ip_hash: ipHash,
          status: "rights_signed",
        })
        .eq("creator_id", creatorId);

      await sb.from("audit_log").insert({
        creator_id: creatorId,
        event_type: "kyc_rights_signed",
        payload: { docId, ipHash },
      });

      req.log.info({ creatorId, docId }, "[kyc/signwell-webhook] rights signed");
    } else if (event_type === "document.declined") {
      await sb
        .from("creator_kyc")
        .update({ signwell_status: "declined" })
        .eq("creator_id", creatorId);

      await sb.from("audit_log").insert({
        creator_id: creatorId,
        event_type: "kyc_rights_declined",
        payload: { docId },
      });
    }

    res.json({ ok: true });
  }
);

// ---------------------------------------------------------------------------
// Ops routes — require OPS_USER_IDS allowlist
// ---------------------------------------------------------------------------

// GET /api/ops/kyc-queue
router.get("/ops/kyc-queue", async (req: Request, res: Response) => {
  if (!isOpsUser(req)) {
    res.status(403).json({ error: "Ops access required" });
    return;
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from("creator_kyc")
    .select(`
      id, creator_id, status,
      id_doc_type, id_doc_region, id_doc_submitted_at,
      signwell_status, personality_rights_signed_at,
      tax_form_type, tax_form_submitted_at,
      ops_notes, ops_reviewed_by, ops_reviewed_at,
      created_at, updated_at,
      creators!inner(handle, display_name)
    `)
    .in("status", [
      "id_submitted",
      "id_verified",
      "rights_signed",
      "tax_submitted",
    ])
    .order("created_at", { ascending: true });

  if (error) {
    req.log.error({ err: error.message }, "[ops/kyc-queue] fetch error");
    res.status(500).json({ error: "Failed to fetch queue" });
    return;
  }

  res.json({ queue: data ?? [] });
});

// POST /api/ops/kyc/:creatorId/approve
router.post(
  "/ops/kyc/:creatorId/approve",
  async (req: Request, res: Response) => {
    if (!isOpsUser(req)) {
      res.status(403).json({ error: "Ops access required" });
      return;
    }

    const { creatorId } = req.params;
    const user = getReplitUser(req);
    const { notes } = req.body as { notes?: string };
    const now = new Date().toISOString();

    const sb = getSupabase();
    const { error } = await sb
      .from("creator_kyc")
      .update({
        status: "complete",
        ops_reviewed_by: user!.id,
        ops_reviewed_at: now,
        ops_notes: notes ?? null,
      })
      .eq("creator_id", creatorId)
      .in("status", ["id_submitted", "id_verified", "rights_signed", "tax_submitted", "ops_approved"]);

    if (error) {
      req.log.error({ err: error.message }, "[ops/kyc/approve] update error");
      res.status(500).json({ error: "Failed to approve KYC" });
      return;
    }

    await sb.from("audit_log").insert({
      creator_id: creatorId,
      event_type: "kyc_ops_approved",
      payload: { reviewedBy: user!.id, notes: notes ?? null },
    });

    res.json({ ok: true, creatorId, status: "complete" });
  }
);

// POST /api/ops/kyc/:creatorId/reject
router.post(
  "/ops/kyc/:creatorId/reject",
  async (req: Request, res: Response) => {
    if (!isOpsUser(req)) {
      res.status(403).json({ error: "Ops access required" });
      return;
    }

    const { creatorId } = req.params;
    const user = getReplitUser(req);
    const { notes } = req.body as { notes?: string };
    const now = new Date().toISOString();

    const sb = getSupabase();
    const { error } = await sb
      .from("creator_kyc")
      .update({
        status: "rejected",
        ops_reviewed_by: user!.id,
        ops_reviewed_at: now,
        ops_notes: notes ?? null,
      })
      .eq("creator_id", creatorId);

    if (error) {
      res.status(500).json({ error: "Failed to reject KYC" });
      return;
    }

    await sb.from("audit_log").insert({
      creator_id: creatorId,
      event_type: "kyc_ops_rejected",
      payload: { reviewedBy: user!.id, notes },
    });

    res.json({ ok: true, creatorId, status: "rejected" });
  }
);

// GET /api/ops/audit-pack/:creatorId
// Returns a JSON bundle with all KYC, consent, and audit records for legal download.
router.get(
  "/ops/audit-pack/:creatorId",
  async (req: Request, res: Response) => {
    if (!isOpsUser(req)) {
      res.status(403).json({ error: "Ops access required" });
      return;
    }

    const { creatorId } = req.params;
    const sb = getSupabase();

    const [kycRes, consentRes, auditRes, creatorRes] = await Promise.all([
      sb.from("creator_kyc").select("*").eq("creator_id", creatorId).maybeSingle(),
      sb.from("consent_grants").select("*").eq("creator_id", creatorId).order("granted_at"),
      sb
        .from("audit_log")
        .select("*")
        .eq("creator_id", creatorId)
        .order("created_at", { ascending: true }),
      sb.from("creators").select("id, handle, display_name, created_at").eq("id", creatorId).maybeSingle(),
    ]);

    if (creatorRes.error || !creatorRes.data) {
      res.status(404).json({ error: "Creator not found" });
      return;
    }

    const pack = {
      generated_at: new Date().toISOString(),
      creator: creatorRes.data,
      kyc: kycRes.data ?? null,
      consent_grants: consentRes.data ?? [],
      audit_log: auditRes.data ?? [],
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="audit-pack-${creatorId}-${Date.now()}.json"`
    );
    res.json(pack);
  }
);

export default router;
