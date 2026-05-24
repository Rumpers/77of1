import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import { getReplitUser } from "../lib/auth.js";
import { getSupabase } from "../lib/supabase.js";

const router: IRouter = Router();

const CONSENT_VERSION = "v1.0";

type ConsentGrantType =
  | "persona_text"
  | "voice"
  | "image"
  | "talking_video"
  | "fullbody_video";

const GRANT_TYPES: ConsentGrantType[] = [
  "persona_text",
  "voice",
  "image",
  "talking_video",
  "fullbody_video",
];

function hashIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"] as string | undefined;
  const realIp = req.headers["x-real-ip"] as string | undefined;
  const ip = (forwarded ? forwarded.split(",")[0] : realIp) ?? "::1";
  return crypto.createHash("sha256").update(ip.trim()).digest("hex");
}

// POST /api/onboarding/consent
// Requires creator Replit Auth session.
router.post("/onboarding/consent", async (req: Request, res: Response) => {
  const user = getReplitUser(req);
  if (!user) {
    res.status(401).json({ error: "Creator auth required" });
    return;
  }

  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  // Resolve creator_id from Replit user ID
  const { data: creator, error: creatorErr } = await supabase
    .from("creators")
    .select("id")
    .eq("replit_user_id", user.id)
    .maybeSingle();

  if (creatorErr || !creator) {
    res.status(403).json({ error: "Not a linked creator account" });
    return;
  }

  const { answers } = req.body as {
    answers?: Partial<Record<ConsentGrantType, boolean>>;
  };

  if (!answers || typeof answers !== "object") {
    res.status(400).json({ error: "Missing answers object" });
    return;
  }

  for (const gt of GRANT_TYPES) {
    if (typeof answers[gt] !== "boolean") {
      res.status(400).json({ error: `Missing or invalid answer for ${gt}` });
      return;
    }
  }

  const ipHash = hashIp(req);
  const confirmedAt = new Date().toISOString();
  const creatorId = creator.id as string;

  const rows = GRANT_TYPES.map((gt) => ({
    creator_id: creatorId,
    grant_type: gt,
    granted: answers[gt] ?? false,
    granted_at: confirmedAt,
    consent_version: CONSENT_VERSION,
    channel: "web",
    ip_hash: ipHash,
    confirmed_at: confirmedAt,
  }));

  const { error: insertError } = await supabase
    .from("consent_grants")
    .insert(rows);

  if (insertError) {
    req.log.error(
      { err: insertError.message },
      "[onboarding/consent] insert error"
    );
    res.status(500).json({ error: "Failed to record consent" });
    return;
  }

  if (answers["persona_text"] === true) {
    const { error: assetError } = await supabase
      .from("creator_assets")
      .update({ consent_state: "released" })
      .eq("creator_id", creatorId)
      .eq("consent_state", "pending_consent");
    if (assetError) {
      req.log.error(
        { err: assetError.message },
        "[onboarding/consent] asset update error"
      );
    }
  }

  const { error: onboardError } = await supabase
    .from("creator_onboarding")
    .update({ status: "STEP_3_COMPLETE", updated_at: confirmedAt })
    .eq("creator_id", creatorId);

  if (onboardError) {
    req.log.error(
      { err: onboardError.message },
      "[onboarding/consent] onboarding status update error"
    );
  }

  // Slice 1 stub: real signal wired when Twin endpoint ships
  req.log.info(
    { creatorId, personaTextGranted: answers["persona_text"] },
    "[onboarding/consent] twin production signal (stub)"
  );

  res.json({ ok: true, persona_text_granted: answers["persona_text"] });
});

export default router;
