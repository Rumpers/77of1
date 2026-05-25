// Dunning access gate — OF-168
//
// Checks dunning_state on every authenticated fan request. No cache — live DB
// read ensures fans are gated immediately when state transitions occur.
//
// Responses:
//   402  dunning_state=paused  — { error, dunningState, bannerPayload }
//   403  dunning_state=cancelled — { error }
//   next() — active, grace, recovered (or no active subscription)

import type { Request, Response, NextFunction } from "express";
import { getUserFromToken, getSupabase, COOKIE_ACCESS_TOKEN } from "../lib/supabase.js";

declare global {
  namespace Express {
    interface Locals {
      fanAuthUserId?: string;
      fanId?: string;
      fanCreatorId?: string;
    }
  }
}

export async function requireFanAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token: string | undefined =
    req.cookies?.[COOKIE_ACCESS_TOKEN] ??
    req.headers.authorization?.replace(/^Bearer\s+/i, "");

  const user = await getUserFromToken(token);
  if (!user) {
    res.status(401).json({ error: "Fan auth required" });
    return;
  }

  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  // Resolve fan_id + creator_id from the auth token
  const { data: account } = await supabase
    .from("fan_accounts")
    .select("fan_id, creator_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!account) {
    // No fan account — let downstream routes handle this case
    res.locals.fanAuthUserId = user.id;
    next();
    return;
  }

  res.locals.fanAuthUserId = user.id;
  res.locals.fanId = account.fan_id;
  res.locals.fanCreatorId = account.creator_id;

  // Look up the active subscription for this fan+creator pair
  const { data: sub } = await supabase
    .from("fan_subscriptions")
    .select("id, dunning_state")
    .eq("fan_id", account.fan_id)
    .eq("creator_id", account.creator_id)
    .not("status", "eq", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) {
    // No subscription — not a dunning concern; let route handle access
    next();
    return;
  }

  if (sub.dunning_state === "paused") {
    res.status(402).json({
      error: "Subscription payment required",
      dunningState: "paused",
      bannerPayload: {
        type: "dunning_paused",
        message: "Your subscription payment is overdue. Update your payment method to restore access.",
        retryUrl: `/api/subscriptions/${sub.id}/retry`,
      },
    });
    return;
  }

  if (sub.dunning_state === "cancelled") {
    res.status(403).json({
      error: "Subscription cancelled",
      dunningState: "cancelled",
    });
    return;
  }

  // active, grace, or recovered — access permitted
  next();
}
