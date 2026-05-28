// kycGate — reusable KYC gate middleware factory (PATTERNS A5).
//
// Lifts the inline KYC block from routes/twin.ts (existing 02-01 baseline) into
// a middleware that can be wired in front of any twin route that needs the
// `creator_kyc.status === 'signed'` strict-positive assertion (D-05).
//
// Returns 404 when the handle does not resolve to a creator; 423 with
// `code: "KYC_UNSIGNED"` when the creator exists but KYC is not signed.
// On success, sets `res.locals.creatorId` for downstream handlers.
import type { NextFunction, Request, Response } from "express";
import { isKycSigned } from "../lib/kyc.js";

export type HandleSource = "body" | "param" | "locals";

// Lazy DB import (PATTERNS S1) — tests run without DATABASE_URL.
async function getDb() {
  const { db, creatorsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  return { db, creatorsTable, eq };
}

function readHandle(
  req: Request,
  res: Response,
  source: HandleSource,
): string | null {
  if (source === "body") {
    const v = (req.body as { handle?: unknown } | undefined)?.handle;
    return typeof v === "string" && v.trim().length > 0 ? v : null;
  }
  if (source === "param") {
    const v = req.params?.handle;
    return typeof v === "string" && v.trim().length > 0 ? v : null;
  }
  // locals — for routes that resolve the handle earlier in the chain
  const v = (res.locals as { handle?: unknown }).handle;
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

export function kycGate(handleSource: HandleSource) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const handle = readHandle(req, res, handleSource);
    if (!handle) {
      res.status(400).json({ error: "handle is required" });
      return;
    }

    let db: Awaited<ReturnType<typeof getDb>>["db"];
    let creatorsTable: Awaited<ReturnType<typeof getDb>>["creatorsTable"];
    let eq: Awaited<ReturnType<typeof getDb>>["eq"];
    try {
      ({ db, creatorsTable, eq } = await getDb());
    } catch {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const creator = await db
      .select({ id: creatorsTable.id })
      .from(creatorsTable)
      .where(eq(creatorsTable.handle, handle))
      .limit(1)
      .then((r: Array<{ id: string }>) => r[0] ?? null);

    if (!creator) {
      res.status(404).json({ error: "Creator not found" });
      return;
    }

    // Strict positive assertion (D-05). pending / rejected / missing all 423.
    const signed = await isKycSigned(creator.id);
    if (!signed) {
      res.status(423).json({
        error: "Creator onboarding not complete",
        code: "KYC_UNSIGNED",
      });
      return;
    }

    res.locals.creatorId = creator.id;
    next();
  };
}
