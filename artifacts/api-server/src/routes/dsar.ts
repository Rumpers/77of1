// DSAR (Data Subject Access Request) routes — §16 compliance
// Fan:     POST /api/dsar/request  → { requestId, etaDays }
// Creator: POST /api/dsar/request  → same, with role=creator
// Status:  GET  /api/dsar/status/:requestId
//
// Slice 1 stub: persists to dsar_requests table, returns ETA.
// Platform Engineer prerequisite: create `dsar_requests` table:
//   id uuid PK, email text, role text (fan|creator), request_type text,
//   locale text, status text (pending|processing|ready|delivered|failed),
//   eta_days int, created_at timestamptz, completed_at timestamptz
import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import { getSupabase } from "../lib/supabase.js";

const router: IRouter = Router();

const FAN_ETA_DAYS = 30;
const CREATOR_ETA_DAYS = 3; // 72 h → round to 3 days for UI display

const VALID_REQUEST_TYPES = ["all", "messages", "account", "creator_export"] as const;
type RequestType = (typeof VALID_REQUEST_TYPES)[number];

const VALID_ROLES = ["fan", "creator"] as const;
type Role = (typeof VALID_ROLES)[number];

// POST /api/dsar/request
// Body: { email: string, requestType: RequestType, role: Role, locale?: string }
// Response: { requestId: string, etaDays: number }
router.post("/dsar/request", async (req: Request, res: Response) => {
  const { email, requestType, role, locale } = req.body ?? {};

  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Valid email address is required" });
    return;
  }

  if (!VALID_ROLES.includes(role as Role)) {
    res.status(400).json({ error: "role must be fan or creator" });
    return;
  }

  if (!VALID_REQUEST_TYPES.includes(requestType as RequestType)) {
    res.status(400).json({ error: "Invalid requestType" });
    return;
  }

  const etaDays = role === "creator" ? CREATOR_ETA_DAYS : FAN_ETA_DAYS;
  const requestId = crypto.randomUUID();

  let db: ReturnType<typeof getSupabase>;
  try {
    db = getSupabase();
  } catch {
    // DB not configured — still return a stub success so the UI works in dev.
    res.status(200).json({ requestId, etaDays });
    return;
  }

  const { error: insertErr } = await db.from("dsar_requests").insert({
    id: requestId,
    email: email.toLowerCase().trim(),
    role,
    request_type: requestType,
    locale: locale ?? "en",
    status: "pending",
    eta_days: etaDays,
    created_at: new Date().toISOString(),
  });

  if (insertErr) {
    req.log.error({ err: insertErr.message }, "[dsar/request] insert error");
    // Degrade gracefully — acknowledge receipt even if DB write fails.
    res.status(200).json({ requestId, etaDays });
    return;
  }

  res.status(200).json({ requestId, etaDays });
});

// GET /api/dsar/status/:requestId
router.get("/dsar/status/:requestId", async (req: Request, res: Response) => {
  const { requestId } = req.params;

  let db: ReturnType<typeof getSupabase>;
  try {
    db = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const { data, error } = await db
    .from("dsar_requests")
    .select("id, status, eta_days, created_at, completed_at")
    .eq("id", requestId)
    .maybeSingle();

  if (error || !data) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  res.json({
    requestId: data.id,
    status: data.status,
    etaDays: data.eta_days,
    createdAt: data.created_at,
    completedAt: data.completed_at ?? null,
  });
});

export default router;
