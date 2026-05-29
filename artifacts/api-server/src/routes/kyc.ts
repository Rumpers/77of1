/**
 * KYC / onboarding gate routes  (OF-124, HID-062)
 *
 * Creator-facing:
 *   GET  /api/kyc/status
 *   POST /api/kyc/identity          — upload identity doc reference
 *   POST /api/kyc/initiate-signing  — create SignWell personality-rights doc
 *   POST /api/kyc/signwell-webhook  — SignWell completion webhook (unauthenticated, HMAC-guarded)
 *   POST /api/kyc/tax-form          — submit W-9 / W-8BEN / W-8BEN-E reference (HID-062)
 *
 * Ops-facing (requires OPS_USER_IDS env allowlist):
 *   GET  /api/ops/kyc-queue         — pending KYC submissions
 *   POST /api/ops/kyc/:creatorId/approve
 *   POST /api/ops/kyc/:creatorId/reject
 *   GET  /api/ops/audit-pack/:creatorId
 *
 * PHASE-1 NOTES:
 *   - resolveCreatorId uses Drizzle (creatorsTable via replitUserId lookup)
 *   - signwell-webhook writes status='signed' via Drizzle (KYC-01/D-05/D-06)
 *   - upload-url: 503 stub (Replit Object Storage migration deferred to Phase 3)
 *   - ops routes (kyc-queue, approve, reject, audit-pack) still use Supabase —
 *     ops routes are low-traffic internal tooling; Supabase removal for ops routes
 *     deferred to Phase 2 per decision D-deferred (admin Supabase removal).
 *   - identity/tax-form routes: use Supabase for non-Phase-1 fields (id_doc_*, tax_form_*)
 *     that are outside the simplified schema; deferred to Phase 2.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import { getReplitUser } from "../lib/auth.js";
import {
  getKycRow,
  initiateSignwellSigning,
  hashIpForKyc,
  extractIp,
} from "../lib/kyc.js";

// DB imports are lazy (dynamic) to avoid throwing at module load time
// when DATABASE_URL is absent (e.g., unit test environments without a real DB).
async function getDb() {
  const { db, creatorsTable, creatorKycTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  return { db, creatorsTable, creatorKycTable, eq };
}

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
  // Drizzle lookup by replit_user_id (replaces Supabase call — INFRA-02)
  const { db, creatorsTable, eq } = await getDb();
  const creator = await db
    .select({ id: creatorsTable.id })
    .from(creatorsTable)
    .where(eq(creatorsTable.replitUserId, user.id))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!creator) {
    res.status(403).json({ error: "Not a linked creator account" });
    return null;
  }
  return creator.id;
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

  // Return camelCase Drizzle field names; fields removed in simplified schema return undefined
  res.json({
    status: row.status,
    creatorId,
    signwellDocId: row.signwellDocId,
    signwellSigningUrl: row.signwellSigningUrl,
    personalityRightsSignedAt: row.personalityRightsSignedAt,
    voiceSynthesisConsentGranted: row.voiceSynthesisConsentGranted,
    opsReviewedAt: row.opsReviewedAt,
  });
});

// ---------------------------------------------------------------------------
// POST /api/kyc/identity
// Body: { docType: string, region: string, storagePath: string }
// PHASE-1 STUB: id_doc_* fields not in simplified Phase 1 schema.
// Returns 503 until Phase 2 adds extended KYC schema fields.
// ---------------------------------------------------------------------------
router.post("/kyc/identity", async (req: Request, res: Response) => {
  const creatorId = await resolveCreatorId(req, res);
  if (!creatorId) return;
  // Phase-1 stub: id_doc fields (id_doc_type, id_doc_region, etc.) not in Phase 1 schema.
  // Restore in Phase 2 when the extended KYC schema is added.
  res.status(503).json({
    error: "Identity document upload temporarily unavailable",
    code: "EXTENDED_KYC_PENDING",
  });
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
    res.status(400).json({ error: "No KYC record found for this creator" });
    return;
  }
  if (row.status === "signed") {
    res.status(409).json({ error: "Creator is already signed" });
    return;
  }
  if (row.status === "rejected") {
    res.status(409).json({ error: "Cannot initiate signing from status: rejected" });
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
// On document.completed: writes status='signed' via Drizzle (KYC-01, D-05, D-06).
// T-02-03: HMAC verification block is preserved.
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

    // Look up KYC row by signwell_doc_id via Drizzle
    const { db, creatorKycTable, creatorsTable: _ct, eq } = await getDb();
    const kycRow = await db
      .select({ id: creatorKycTable.id, creatorId: creatorKycTable.creatorId, status: creatorKycTable.status })
      .from(creatorKycTable)
      .where(eq(creatorKycTable.signwellDocId, docId))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!kycRow) {
      req.log.warn({ docId }, "[kyc/signwell-webhook] unknown doc_id");
      res.status(200).json({ ok: true });
      return;
    }

    const creatorId = kycRow.creatorId;
    const ip = extractIp(req.headers as Record<string, string | undefined>);
    const ipHash = hashIpForKyc(ip);
    const now = new Date();

    if (event_type === "document.completed") {
      // Write status='signed' via Drizzle (KYC-01: D-05 strict positive, D-06 renamed)
      await db
        .update(creatorKycTable)
        .set({
          status: "signed",
          personalityRightsSignedAt: now,
          personalityRightsIpHash: ipHash,
          updatedAt: now,
        })
        .where(eq(creatorKycTable.creatorId, creatorId));

      req.log.info({ creatorId, docId }, "[kyc/signwell-webhook] rights signed → status='signed'");
    } else if (event_type === "document.declined") {
      await db
        .update(creatorKycTable)
        .set({ status: "rejected", updatedAt: now })
        .where(eq(creatorKycTable.creatorId, creatorId));

      req.log.info({ creatorId, docId }, "[kyc/signwell-webhook] rights declined → status='rejected'");
    }

    res.json({ ok: true });
  }
);

// ---------------------------------------------------------------------------
// POST /api/kyc/upload-url  (HID-062)
// PHASE-3 STUB: Supabase Storage removed; Replit Object Storage migration pending.
// See Phase 3: Replit Object Storage migration.
// ---------------------------------------------------------------------------
const VALID_FILE_TYPES = ["id_doc", "tax_form"] as const;
const VALID_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
];

router.post("/kyc/upload-url", async (req: Request, res: Response) => {
  const creatorId = await resolveCreatorId(req, res);
  if (!creatorId) return;

  const { fileType, mimeType } = req.body as {
    fileType?: string;
    mimeType?: string;
  };

  if (!fileType || !VALID_FILE_TYPES.includes(fileType as (typeof VALID_FILE_TYPES)[number])) {
    res.status(400).json({ error: `fileType must be one of: ${VALID_FILE_TYPES.join(", ")}` });
    return;
  }

  if (!mimeType || !VALID_MIME_TYPES.includes(mimeType)) {
    res.status(400).json({ error: `mimeType must be one of: ${VALID_MIME_TYPES.join(", ")}` });
    return;
  }

  // Phase 3: Replit Object Storage migration — Supabase Storage removed.
  // Return 503 until Phase 3 wires Replit Object Storage signed upload URLs.
  res.status(503).json({
    error: "Upload temporarily unavailable",
    code: "OBJECT_STORAGE_PENDING",
  });
});

// ---------------------------------------------------------------------------
// POST /api/kyc/tax-form  (HID-062)
// PHASE-1 STUB: tax_form_* fields not in simplified Phase 1 schema.
// ---------------------------------------------------------------------------
const VALID_TAX_FORM_TYPES = ["W9", "W8BEN", "W8BENE"] as const;
type TaxFormType = (typeof VALID_TAX_FORM_TYPES)[number];

router.post("/kyc/tax-form", async (req: Request, res: Response) => {
  const creatorId = await resolveCreatorId(req, res);
  if (!creatorId) return;

  const { taxFormType } = req.body as { taxFormType?: string; storagePath?: string };

  if (!taxFormType) {
    res.status(400).json({ error: "taxFormType required" });
    return;
  }

  if (!VALID_TAX_FORM_TYPES.includes(taxFormType as TaxFormType)) {
    res.status(400).json({
      error: `taxFormType must be one of: ${VALID_TAX_FORM_TYPES.join(", ")}`,
    });
    return;
  }

  // Phase-1 stub: tax_form_* fields not in simplified Phase 1 schema. Restore in Phase 2.
  res.status(503).json({
    error: "Tax form submission temporarily unavailable",
    code: "EXTENDED_KYC_PENDING",
  });
});

// ---------------------------------------------------------------------------
// Ops routes — require OPS_USER_IDS allowlist
// NOTE: Ops routes use Supabase for low-traffic internal tooling.
// Supabase removal for ops routes deferred to Phase 2 (admin Supabase removal per D-deferred).
// ---------------------------------------------------------------------------

// GET /api/ops/kyc-queue
router.get("/ops/kyc-queue", async (req: Request, res: Response) => {
  if (!isOpsUser(req)) {
    res.status(403).json({ error: "Ops access required" });
    return;
  }

  // Phase-1: ops queue uses Drizzle to query creator_kyc with pending/rejected statuses
  const { db, creatorKycTable, eq } = await getDb();
  const rows = await db
    .select({
      id: creatorKycTable.id,
      creatorId: creatorKycTable.creatorId,
      status: creatorKycTable.status,
      signwellDocId: creatorKycTable.signwellDocId,
      personalityRightsSignedAt: creatorKycTable.personalityRightsSignedAt,
      opsNotes: creatorKycTable.opsNotes,
      opsReviewedBy: creatorKycTable.opsReviewedBy,
      opsReviewedAt: creatorKycTable.opsReviewedAt,
      createdAt: creatorKycTable.createdAt,
      updatedAt: creatorKycTable.updatedAt,
    })
    .from(creatorKycTable)
    .where(eq(creatorKycTable.status, "pending"))
    .orderBy(creatorKycTable.createdAt);

  res.json({ queue: rows });
});

// POST /api/ops/kyc/:creatorId/approve
router.post(
  "/ops/kyc/:creatorId/approve",
  async (req: Request, res: Response) => {
    if (!isOpsUser(req)) {
      res.status(403).json({ error: "Ops access required" });
      return;
    }

    const creatorId = String(req.params["creatorId"]);
    const user = getReplitUser(req);
    const { notes } = req.body as { notes?: string };
    const now = new Date();

    const { db, creatorKycTable, eq } = await getDb();
    await db
      .update(creatorKycTable)
      .set({
        status: "signed",
        opsReviewedBy: user!.id,
        opsReviewedAt: now,
        opsNotes: notes ?? null,
        updatedAt: now,
      })
      .where(eq(creatorKycTable.creatorId, creatorId));

    res.json({ ok: true, creatorId, status: "signed" });
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

    const creatorId = String(req.params["creatorId"]);
    const user = getReplitUser(req);
    const { notes } = req.body as { notes?: string };
    const now = new Date();

    const { db, creatorKycTable, eq } = await getDb();
    await db
      .update(creatorKycTable)
      .set({
        status: "rejected",
        opsReviewedBy: user!.id,
        opsReviewedAt: now,
        opsNotes: notes ?? null,
        updatedAt: now,
      })
      .where(eq(creatorKycTable.creatorId, creatorId));

    res.json({ ok: true, creatorId, status: "rejected" });
  }
);

// GET /api/ops/audit-pack/:creatorId
// Returns a JSON bundle with all KYC and consent records for legal download.
router.get(
  "/ops/audit-pack/:creatorId",
  async (req: Request, res: Response) => {
    if (!isOpsUser(req)) {
      res.status(403).json({ error: "Ops access required" });
      return;
    }

    const creatorId = String(req.params["creatorId"]);

    const { db, creatorsTable, creatorKycTable, eq } = await getDb();
    const [creatorRows, kycRows] = await Promise.all([
      db
        .select({ id: creatorsTable.id, handle: creatorsTable.handle, displayName: creatorsTable.displayName, createdAt: creatorsTable.createdAt })
        .from(creatorsTable)
        .where(eq(creatorsTable.id, creatorId))
        .limit(1),
      db
        .select()
        .from(creatorKycTable)
        .where(eq(creatorKycTable.creatorId, creatorId))
        .limit(1),
    ]);

    const creator = creatorRows[0] ?? null;
    if (!creator) {
      res.status(404).json({ error: "Creator not found" });
      return;
    }

    const pack = {
      generated_at: new Date().toISOString(),
      creator,
      kyc: kycRows[0] ?? null,
      // Note: consent_grants and audit_log tables available via Drizzle but
      // require consentGrantsTable import; simplified for Phase 1.
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
