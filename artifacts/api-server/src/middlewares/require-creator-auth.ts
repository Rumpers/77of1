import type { Request, Response, NextFunction } from "express";
import { getUserFromToken, getSupabase, COOKIE_ACCESS_TOKEN } from "../lib/supabase.js";

export type CreatorAuthLocals = {
  authUserId: string;
  creatorId: string;
};

declare global {
  namespace Express {
    interface Locals {
      authUserId?: string;
      creatorId?: string;
    }
  }
}

// Reads the Supabase access token from the httpOnly cookie, verifies it,
// then looks up the linked creator record. Sets res.locals.authUserId and
// res.locals.creatorId for downstream handlers.
export async function requireCreatorAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token: string | undefined =
    req.cookies?.[COOKIE_ACCESS_TOKEN] ??
    req.headers.authorization?.replace(/^Bearer\s+/i, "");

  const user = await getUserFromToken(token);
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

  const { data: creator } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!creator) {
    res.status(403).json({ error: "No creator account linked to this user" });
    return;
  }

  res.locals.authUserId = user.id;
  res.locals.creatorId = creator.id;
  next();
}
