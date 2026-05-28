// Fan auth middleware — validates signed session cookie and populates res.locals.fanId.
// Anonymous fans (no cookie) are allowed through; downstream routes check fanId presence.
// Trial cookie is parsed and exposed via res.locals.fanTrialCount.

import type { Request, Response, NextFunction } from "express";
import { COOKIE_ACCESS_TOKEN, TRIAL_COOKIE, parseTrialCookie, verifySessionToken } from "../lib/auth.js";

declare global {
  namespace Express {
    interface Locals {
      fanAuthUserId?: string;
      fanId?: string;
      fanCreatorId?: string;
      fanTrialCount?: number;
    }
  }
}

async function getFanById(fanId: string) {
  const { db, fansTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  return db
    .select({ id: fansTable.id })
    .from(fansTable)
    .where(eq(fansTable.id, fanId))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function requireFanAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Expose trial count for anonymous fans regardless of auth state
  res.locals.fanTrialCount = parseTrialCookie(req.cookies?.[TRIAL_COOKIE]);

  const token = req.cookies?.[COOKIE_ACCESS_TOKEN];
  if (!token) {
    next();
    return;
  }

  const fanId = verifySessionToken(token);
  if (!fanId) {
    next();
    return;
  }

  try {
    const fan = await getFanById(fanId);
    if (fan) {
      res.locals.fanId = fan.id;
      res.locals.fanAuthUserId = fan.id;
    }
  } catch {
    // DB unavailable — pass through; downstream will gate if fanId is required
  }

  next();
}
