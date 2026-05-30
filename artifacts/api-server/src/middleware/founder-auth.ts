// founderAuth — founder-only HTTP bearer-token gate (04-03).
//
// Guards admin endpoints (e.g. POST /api/admin/twin/:creatorId/activate) that
// must not be reachable by fans or creators.  Applied per-route — never globally.
//
// Security properties:
//   - Constant-time comparison via crypto.timingSafeEqual (defeats timing oracles)
//   - Fails CLOSED when ADMIN_API_TOKEN is unset (401 for all requests)
//   - Error responses never echo the supplied token or eval-case detail (ASVS V13)
//   - Missing or malformed Authorization header → 401
//   - Wrong token → 401

import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";

/**
 * Express middleware that requires a valid `Authorization: Bearer <ADMIN_API_TOKEN>`
 * header.  Call `next()` only on match; otherwise responds 401 and returns.
 */
export function founderAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_API_TOKEN;

  // Fail closed: if the secret is unset or empty, deny everyone and log a warning.
  if (!expected) {
    logger.warn(
      { event: "founder_auth.token_unset" },
      "[founderAuth] ADMIN_API_TOKEN is unset or empty — failing closed (401 for all requests)",
    );
    res.status(401).json({ code: "unauthorized" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ code: "unauthorized" });
    return;
  }

  const supplied = authHeader.slice("Bearer ".length);

  // timingSafeEqual requires equal-length buffers; mismatched length → 401.
  const suppliedBuf = Buffer.from(supplied, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");

  if (suppliedBuf.length !== expectedBuf.length) {
    res.status(401).json({ code: "unauthorized" });
    return;
  }

  if (!crypto.timingSafeEqual(suppliedBuf, expectedBuf)) {
    res.status(401).json({ code: "unauthorized" });
    return;
  }

  next();
}
