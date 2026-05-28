// PHASE-1 STUB — require-fan-access (T-03-02)
//
// Fan accounts, subscriptions, and dunning logic are scoped to Phase 2.
// This stub passes all requests through so existing routes compile and
// respond without a Supabase dependency.
//
// When Phase 2 ships, replace the body of requireFanAccess with:
//   1. Replit or session-cookie identity check
//   2. Drizzle lookup of fan_accounts + fan_subscriptions (if modelled)
//   3. Dunning state gate (402/403 for paused/cancelled)
//
// The Global Locals declaration is preserved so other middleware files that
// reference fanId/fanCreatorId continue to typecheck.

import type { Request, Response, NextFunction } from "express";

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
  _req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  // PHASE-1 STUB: pass-through — fan auth and dunning gate deferred to Phase 2
  next();
}
