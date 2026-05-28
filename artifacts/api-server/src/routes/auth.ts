// Fan and creator auth routes — email OTP + session management
// Phase 2: custom OTP (no Supabase). Signed httpOnly cookies. Trial cookie tracking.

import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  TRIAL_COOKIE,
  sessionCookieOptions,
  signSessionToken,
  verifySessionToken,
  getReplitUser,
} from "../lib/auth.js";

const router: IRouter = Router();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

async function getDb() {
  const { db, fansTable, fanEmailOtpsTable } = await import("@workspace/db");
  const { eq, and, gt, isNull } = await import("drizzle-orm");
  return { db, fansTable, fanEmailOtpsTable, eq, and, gt, isNull };
}

function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

// ─── Session ──────────────────────────────────────────────────────────────────

// GET /api/auth/session
router.get("/auth/session", async (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIE_ACCESS_TOKEN];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const fanId = verifySessionToken(token);
  if (!fanId) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  let db: Awaited<ReturnType<typeof getDb>>["db"];
  let fansTable: Awaited<ReturnType<typeof getDb>>["fansTable"];
  let eq: Awaited<ReturnType<typeof getDb>>["eq"];
  try {
    ({ db, fansTable, eq } = await getDb());
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const fan = await db
    .select({ id: fansTable.id, email: fansTable.email, locale: fansTable.locale, trialCount: fansTable.trialCount })
    .from(fansTable)
    .where(eq(fansTable.id, fanId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!fan) {
    res.status(401).json({ error: "Fan account not found" });
    return;
  }

  res.json({ authenticated: true, fan });
});

// ─── Fan auth (email OTP) ─────────────────────────────────────────────────────

const SendOtpBody = z.object({
  email: z.string().email(),
});

// POST /api/auth/fan/send-otp
router.post("/auth/fan/send-otp", async (req: Request, res: Response) => {
  const parsed = SendOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }

  const { email } = parsed.data;

  let db: Awaited<ReturnType<typeof getDb>>["db"];
  let fanEmailOtpsTable: Awaited<ReturnType<typeof getDb>>["fanEmailOtpsTable"];
  // eq not needed for insert but keep destructure consistent
  try {
    ({ db, fanEmailOtpsTable } = await getDb());
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const otpCode = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.insert(fanEmailOtpsTable).values({ email, otpCode, expiresAt });

  // Email sending deferred — log OTP to console for dev/testing
  console.log(`[fan-auth] OTP for ${email}: ${otpCode}`);

  res.json({ sent: true });
});

const VerifyOtpBody = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

// POST /api/auth/fan/verify-otp
router.post("/auth/fan/verify-otp", async (req: Request, res: Response) => {
  const parsed = VerifyOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "email and 6-digit otp are required" });
    return;
  }

  const { email, otp } = parsed.data;

  let db: Awaited<ReturnType<typeof getDb>>["db"];
  let fansTable: Awaited<ReturnType<typeof getDb>>["fansTable"];
  let fanEmailOtpsTable: Awaited<ReturnType<typeof getDb>>["fanEmailOtpsTable"];
  let eq: Awaited<ReturnType<typeof getDb>>["eq"];
  let and: Awaited<ReturnType<typeof getDb>>["and"];
  let gt: Awaited<ReturnType<typeof getDb>>["gt"];
  let isNull: Awaited<ReturnType<typeof getDb>>["isNull"];
  try {
    ({ db, fansTable, fanEmailOtpsTable, eq, and, gt, isNull } = await getDb());
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const now = new Date();
  const otpRow = await db
    .select()
    .from(fanEmailOtpsTable)
    .where(
      and(
        eq(fanEmailOtpsTable.email, email),
        eq(fanEmailOtpsTable.otpCode, otp),
        isNull(fanEmailOtpsTable.usedAt),
        gt(fanEmailOtpsTable.expiresAt, now)
      )
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!otpRow) {
    res.status(401).json({ error: "Invalid or expired OTP" });
    return;
  }

  // Mark OTP used
  await db
    .update(fanEmailOtpsTable)
    .set({ usedAt: now })
    .where(eq(fanEmailOtpsTable.id, otpRow.id));

  // Upsert fan row
  const existing = await db
    .select({ id: fansTable.id })
    .from(fansTable)
    .where(eq(fansTable.email, email))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  let fanId: string;
  if (existing) {
    fanId = existing.id;
  } else {
    const inserted = await db
      .insert(fansTable)
      .values({ email })
      .returning({ id: fansTable.id });
    fanId = inserted[0].id;
  }

  // Sign session token and set httpOnly cookies
  const token = signSessionToken(fanId);
  res.cookie(COOKIE_ACCESS_TOKEN, token, sessionCookieOptions(SESSION_MAX_AGE));
  // Clear any trial cookie now that fan is authenticated
  res.clearCookie(TRIAL_COOKIE);

  res.json({ fanId, authenticated: true });
});

// ─── Sign out ─────────────────────────────────────────────────────────────────

// POST /api/auth/signout
router.post("/auth/signout", (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_ACCESS_TOKEN, sessionCookieOptions(0));
  res.clearCookie(COOKIE_REFRESH_TOKEN, sessionCookieOptions(0));
  res.json({ success: true });
});

// ─── Creator auth (email OTP) ─────────────────────────────────────────────────
// Creator sign-in uses Replit identity (see require-creator-auth.ts).
// These stubs preserved for OpenAPI spec compatibility — will be removed in Phase 3.

router.post("/auth/creator/send-otp", async (_req: Request, res: Response) => {
  res.status(410).json({ error: "Creator auth uses Replit identity; this endpoint is not in use" });
});

router.post("/auth/creator/verify-otp", async (_req: Request, res: Response) => {
  res.status(410).json({ error: "Creator auth uses Replit identity; this endpoint is not in use" });
});

router.post("/auth/creator/telegram-connect", async (_req: Request, res: Response) => {
  res.status(503).json({ error: "Telegram connect restored in Phase 3", code: "PHASE_2_STUB" });
});

// ─── Phone OTP ────────────────────────────────────────────────────────────────
// Phone OTP deferred to Phase 3 (phone_otp_attempts table).

router.post("/auth/fan/send-phone-otp", async (_req: Request, res: Response) => {
  res.status(503).json({ error: "Phone OTP restored in Phase 3", code: "PHASE_2_STUB" });
});

router.post("/auth/fan/verify-phone-otp", async (_req: Request, res: Response) => {
  res.status(503).json({ error: "Phone OTP restored in Phase 3", code: "PHASE_2_STUB" });
});

// ─── Creator-link (Replit) ────────────────────────────────────────────────────

const CreatorLinkQuery = z.object({ token: z.string().min(1) });

// GET /auth/creator-link — link a Replit user to a creator by token
router.get("/auth/creator-link", async (req: Request, res: Response) => {
  const parsed = CreatorLinkQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "token query param required" });
    return;
  }
  const user = getReplitUser(req);
  if (!user) {
    res.status(401).json({ error: "Replit auth required" });
    return;
  }
  // Token-based creator linking deferred to Phase 3 onboarding flow
  res.status(503).json({ error: "Creator linking restored in Phase 3", code: "PHASE_2_STUB" });
});

// ─── Fan signup (convert trial) ───────────────────────────────────────────────

const FanSignupBody = z.object({ creatorId: z.string().uuid() });

// POST /auth/fan/signup — convert anonymous trial to linked fan account
router.post("/auth/fan/signup", async (req: Request, res: Response) => {
  const parsed = FanSignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "creatorId (UUID) is required" });
    return;
  }

  const token = req.cookies?.[COOKIE_ACCESS_TOKEN];
  if (!token) {
    res.status(401).json({ error: "Not authenticated — complete email OTP first" });
    return;
  }

  const fanId = verifySessionToken(token);
  if (!fanId) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  res.json({
    session: {
      userId: fanId,
      fanId,
      creatorId: null,
      sessionToken: token,
    },
  });
});

export default router;
