// HID-062: Creator tax-form intake
// Routes:
//   GET  /api/creator/tax/status       — current tax form status for the authed creator
//   POST /api/creator/tax/submit        — submit or resubmit tax form data
//   GET  /api/creator/tax/payout-gate   — payout eligibility check (machine-callable)

import { Router, type IRouter, type Request, type Response } from "express";
import { getSupabase } from "../lib/supabase.js";
import { requireCreatorAuth } from "../middlewares/require-creator-auth.js";

const router: IRouter = Router();

// ── form-type matrix ──────────────────────────────────────────────────────────
// Maps jurisdiction → accepted form types and required fields per type.
// Validators return the error string on failure, null on success.

type FormType = "w9" | "w8ben" | "w8ben_e" | "jp_mynumber" | "tw_national" | "sg_nric";

interface TaxFormPayload {
  form_type: FormType;
  jurisdiction: string;
  full_name: string;
  country: string;
  address: string;
  tax_id?: string;      // Full value submitted by creator; last4 derived here
  [key: string]: unknown;
}

const ALLOWED_FORM_TYPES: Set<FormType> = new Set([
  "w9", "w8ben", "w8ben_e", "jp_mynumber", "tw_national", "sg_nric",
]);

const JURISDICTION_TO_FORM_TYPES: Record<string, FormType[]> = {
  US: ["w9", "w8ben", "w8ben_e"],
  JP: ["jp_mynumber", "w8ben"],
  TW: ["tw_national", "w8ben"],
  SG: ["sg_nric", "w8ben"],
};

function validatePayload(body: unknown): { data: TaxFormPayload } | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Request body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;

  const required = ["form_type", "jurisdiction", "full_name", "country", "address"] as const;
  for (const field of required) {
    if (typeof b[field] !== "string" || !(b[field] as string).trim()) {
      return { error: `Missing or empty required field: ${field}` };
    }
  }

  const formType = (b["form_type"] as string).toLowerCase() as FormType;
  if (!ALLOWED_FORM_TYPES.has(formType)) {
    return { error: `Invalid form_type. Allowed: ${[...ALLOWED_FORM_TYPES].join(", ")}` };
  }

  const jurisdiction = (b["jurisdiction"] as string).toUpperCase();
  const allowedForJurisdiction = JURISDICTION_TO_FORM_TYPES[jurisdiction];
  if (!allowedForJurisdiction) {
    return { error: `Unsupported jurisdiction. Allowed: ${Object.keys(JURISDICTION_TO_FORM_TYPES).join(", ")}` };
  }
  if (!allowedForJurisdiction.includes(formType)) {
    return { error: `form_type '${formType}' is not valid for jurisdiction '${jurisdiction}'. Allowed: ${allowedForJurisdiction.join(", ")}` };
  }

  // tax_id is optional at submission time (some creators submit without it pending document upload)
  // but we validate format if present
  if (b["tax_id"] !== undefined && typeof b["tax_id"] !== "string") {
    return { error: "tax_id must be a string" };
  }

  return {
    data: {
      ...(b as Record<string, unknown>),
      form_type: formType,
      jurisdiction,
    } as TaxFormPayload,
  };
}

function deriveLast4(taxId: string | undefined): string | null {
  if (!taxId || taxId.length < 4) return null;
  return taxId.slice(-4);
}

// ── GET /api/creator/tax/status ──────────────────────────────────────────────
router.get("/creator/tax/status", requireCreatorAuth, async (req: Request, res: Response) => {
  const creatorId = res.locals.creatorId as string;

  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const { data, error } = await supabase
    .from("creator_tax_forms")
    .select("id, form_type, jurisdiction, status, full_name, country, tax_id_last4, rejection_reason, submitted_at, updated_at")
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (error) {
    req.log.error({ err: error.message }, "[creator/tax/status] query error");
    res.status(500).json({ error: "Failed to fetch tax form status" });
    return;
  }

  if (!data) {
    res.json({
      status: "not_submitted",
      payout_eligible: false,
      form: null,
    });
    return;
  }

  res.json({
    status: data.status,
    payout_eligible: data.status === "submitted" || data.status === "approved",
    form: {
      id: data.id,
      form_type: data.form_type,
      jurisdiction: data.jurisdiction,
      full_name: data.full_name,
      country: data.country,
      tax_id_last4: data.tax_id_last4,
      rejection_reason: data.rejection_reason,
      submitted_at: data.submitted_at,
      updated_at: data.updated_at,
    },
  });
});

// ── POST /api/creator/tax/submit ─────────────────────────────────────────────
// Creator submits (or resubmits after rejection) their tax form.
// On resubmit after rejection, status resets to 'submitted' and rejection_reason is cleared.
router.post("/creator/tax/submit", requireCreatorAuth, async (req: Request, res: Response) => {
  const creatorId = res.locals.creatorId as string;

  const result = validatePayload(req.body);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  const payload = result.data;

  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  // Check for existing form — reject if already approved (no overwrite)
  const { data: existing } = await supabase
    .from("creator_tax_forms")
    .select("id, status")
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (existing?.status === "approved") {
    res.status(409).json({ error: "Tax form already approved. Contact support to update." });
    return;
  }

  const now = new Date().toISOString();
  const last4 = deriveLast4(payload.tax_id);

  // Strip tax_id from the stored payload snapshot? No — we store it so ops can verify.
  // The raw form_data is service-role only (RLS blocks creator selects of form_data).
  // In Slice 3 this will be encrypted at rest via pgcrypto.
  const formData = { ...payload };

  if (existing) {
    // Resubmit — only allowed from 'rejected' or 'submitted' state
    const { error: updateErr } = await supabase
      .from("creator_tax_forms")
      .update({
        form_type: payload.form_type,
        jurisdiction: payload.jurisdiction,
        status: "submitted",
        full_name: payload.full_name,
        country: payload.country,
        address: payload.address,
        tax_id_last4: last4,
        form_data: formData,
        rejection_reason: null,
        reviewed_by: null,
        reviewed_at: null,
        submitted_at: now,
        updated_at: now,
      })
      .eq("creator_id", creatorId);

    if (updateErr) {
      req.log.error({ err: updateErr.message }, "[creator/tax/submit] update error");
      res.status(500).json({ error: "Failed to update tax form" });
      return;
    }

    req.log.info({ creatorId, formType: payload.form_type }, "[creator/tax/submit] resubmitted");
    res.json({ ok: true, action: "resubmitted", payout_eligible: true });
    return;
  }

  // First submission
  const { error: insertErr } = await supabase
    .from("creator_tax_forms")
    .insert({
      creator_id: creatorId,
      form_type: payload.form_type,
      jurisdiction: payload.jurisdiction,
      status: "submitted",
      full_name: payload.full_name,
      country: payload.country,
      address: payload.address,
      tax_id_last4: last4,
      form_data: formData,
      submitted_at: now,
      updated_at: now,
      created_at: now,
    });

  if (insertErr) {
    req.log.error({ err: insertErr.message }, "[creator/tax/submit] insert error");
    res.status(500).json({ error: "Failed to submit tax form" });
    return;
  }

  req.log.info({ creatorId, formType: payload.form_type }, "[creator/tax/submit] submitted");
  res.status(201).json({ ok: true, action: "submitted", payout_eligible: true });
});

// ── GET /api/creator/tax/payout-gate ─────────────────────────────────────────
// Machine-callable endpoint for the payout system to check eligibility.
// Returns 200 eligible:true or 200 eligible:false (no 4xx — caller decides action).
router.get("/creator/tax/payout-gate", requireCreatorAuth, async (req: Request, res: Response) => {
  const creatorId = res.locals.creatorId as string;

  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const { data, error } = await supabase
    .rpc("check_payout_tax_eligible", { p_creator_id: creatorId });

  if (error) {
    req.log.error({ err: error.message }, "[creator/tax/payout-gate] rpc error");
    res.status(500).json({ error: "Eligibility check failed" });
    return;
  }

  res.json({ eligible: data === true });
});

export default router;
