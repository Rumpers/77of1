import { Router, type IRouter, type Request, type Response } from "express";
import { getReplitUser, signSessionToken, TRIAL_COOKIE, parseTrialCookie } from "../lib/auth.js";
import { getSupabase } from "../lib/supabase.js";
import crypto from "crypto";
import { FanSignupBody } from "@workspace/api-zod";

const router: IRouter = Router();

// GET /api/auth/session
router.get("/auth/session", (req: Request, res: Response) => {
  const user = getReplitUser(req);
  if (!user) {
    res.status(401).json({ authenticated: false });
    return;
  }
  res.json({ authenticated: true, user });
});

// GET /api/auth/creator-link?token=<creatorId>
router.get("/auth/creator-link", async (req: Request, res: Response) => {
  const user = getReplitUser(req);
  if (!user) {
    res.status(401).json({ error: "Replit Auth required" });
    return;
  }

  const creatorId = req.query["token"] as string | undefined;
  if (!creatorId) {
    res.status(400).json({ error: "Missing token parameter" });
    return;
  }

  let db: ReturnType<typeof getSupabase>;
  try {
    db = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }
  const { data: creator, error: lookupErr } = await db
    .from("creators")
    .select("id, replit_user_id")
    .eq("id", creatorId)
    .maybeSingle();

  if (lookupErr || !creator) {
    res.status(404).json({ error: "Creator not found" });
    return;
  }

  if (creator.replit_user_id && creator.replit_user_id !== user.id) {
    res.status(409).json({ error: "Creator already linked to a different Replit account" });
    return;
  }

  if (!creator.replit_user_id) {
    const { error: updateErr } = await db
      .from("creators")
      .update({ replit_user_id: user.id })
      .eq("id", creatorId);
    if (updateErr) {
      res.status(500).json({ error: "Failed to link account" });
      return;
    }
  }

  res.json({
    session: {
      userId: user.id,
      creatorId,
      sessionToken: signSessionToken(user.id),
    },
  });
});

// POST /api/auth/fan/signup
router.post("/auth/fan/signup", async (req: Request, res: Response) => {
  const user = getReplitUser(req);
  if (!user) {
    res.status(401).json({ error: "Replit Auth required" });
    return;
  }

  const parsed = FanSignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "creatorId required" });
    return;
  }
  const { creatorId } = parsed.data;

  let db: ReturnType<typeof getSupabase>;
  try {
    db = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }
  const { data: existing } = await db
    .from("fan_accounts")
    .select("fan_id")
    .eq("replit_user_id", user.id)
    .eq("creator_id", creatorId)
    .maybeSingle();

  let fanId: string;

  if (existing) {
    fanId = existing.fan_id;
  } else {
    const trialCount = parseTrialCookie(req.cookies?.[TRIAL_COOKIE]);
    fanId = crypto.randomUUID();

    const { error: insertErr } = await db.from("fan_accounts").insert({
      fan_id: fanId,
      creator_id: creatorId,
      replit_user_id: user.id,
      trial_count: trialCount,
    });

    if (insertErr) {
      res.status(500).json({ error: "Failed to create fan account" });
      return;
    }
  }

  res.json({
    session: {
      userId: user.id,
      fanId,
      sessionToken: signSessionToken(user.id),
    },
  });
});

export default router;
