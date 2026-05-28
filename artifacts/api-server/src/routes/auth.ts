// Fan and creator auth routes — email OTP + phone OTP
// PHASE-1 STUB: Supabase Auth (signInWithOtp, verifyOtp), fan_accounts, phone_otp_attempts
// not in @workspace/db Phase 1 schema. Auth flow restored in Phase 2 with Replit PG.
//
// NOTE: /api/auth/creator/telegram-connect uses creatorsTable (Phase 1) but is kept
// stubbed because it also uses the Supabase-auth user_id which is a Supabase concept.
// Fully restored in Phase 2.

import { Router, type IRouter, type Request, type Response } from "express";
import { TRIAL_COOKIE } from "../lib/auth.js";

const router: IRouter = Router();

// ─── Session ──────────────────────────────────────────────────────────────────

// GET /api/auth/session
// PHASE-1 STUB: Supabase JWT session not available — restored in Phase 2
router.get("/auth/session", async (_req: Request, res: Response) => {
  // PHASE-1 STUB: fan_accounts, Supabase JWT not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

// POST /api/auth/signout
// PHASE-1 STUB: Supabase session cookies not in Phase 1 — restored in Phase 2
router.post("/auth/signout", (_req: Request, res: Response) => {
  // PHASE-1 STUB: sb-access-token, sb-refresh-token cookies are Supabase auth artifacts — restored in Phase 2
  res.json({ success: true });
});

// ─── Fan auth (email OTP) ─────────────────────────────────────────────────────

// POST /api/auth/fan/send-otp
// PHASE-1 STUB: Supabase Auth OTP, fan_accounts not in Phase 1 schema — restored in Phase 2
router.post("/auth/fan/send-otp", async (_req: Request, res: Response) => {
  // PHASE-1 STUB: Supabase Auth, fan_accounts not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

// POST /api/auth/fan/verify-otp
// PHASE-1 STUB: Supabase Auth OTP, fan_accounts not in Phase 1 schema — restored in Phase 2
router.post("/auth/fan/verify-otp", async (_req: Request, res: Response) => {
  // PHASE-1 STUB: Supabase Auth, fan_accounts not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

// ─── Creator auth (email OTP) ─────────────────────────────────────────────────

// POST /api/auth/creator/send-otp
// PHASE-1 STUB: Supabase Auth OTP not in Phase 1 schema — restored in Phase 2
router.post("/auth/creator/send-otp", async (_req: Request, res: Response) => {
  // PHASE-1 STUB: Supabase Auth, creators.auth_user_id not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

// POST /api/auth/creator/verify-otp
// PHASE-1 STUB: Supabase Auth OTP not in Phase 1 schema — restored in Phase 2
router.post("/auth/creator/verify-otp", async (_req: Request, res: Response) => {
  // PHASE-1 STUB: Supabase Auth, creators.auth_user_id not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

// POST /api/auth/creator/telegram-connect
// PHASE-1 STUB: Supabase Auth dependency — restored in Phase 2
router.post("/auth/creator/telegram-connect", async (_req: Request, res: Response) => {
  // PHASE-1 STUB: Supabase Auth not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

// ─── Phone OTP (HID-002) ──────────────────────────────────────────────────────

// POST /api/auth/fan/send-phone-otp
// PHASE-1 STUB: Supabase Auth, phone_otp_attempts not in Phase 1 schema — restored in Phase 2
router.post("/auth/fan/send-phone-otp", async (_req: Request, res: Response) => {
  // PHASE-1 STUB: Supabase Auth, phone_otp_attempts not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

// POST /api/auth/fan/verify-phone-otp
// PHASE-1 STUB: Supabase Auth, phone_otp_attempts, fan_accounts not in Phase 1 schema — restored in Phase 2
router.post("/auth/fan/verify-phone-otp", async (_req: Request, res: Response) => {
  // PHASE-1 STUB: Supabase Auth, fan_accounts not in Phase 1 schema — restored in Phase 2
  res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
});

export default router;
