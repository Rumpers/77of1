import type { Request, Response, NextFunction } from "express";
import { getReplitUser } from "../lib/auth.js";

// ─── Global type augmentation ─────────────────────────────────────────────────
// Preserved from the Supabase version; downstream routes read these locals.
declare global {
  namespace Express {
    interface Locals {
      authUserId?: string;
      creatorId?: string;
    }
  }
}

export type CreatorAuthLocals = {
  authUserId: string;
  creatorId: string;
};

// DB imports are lazy to avoid throwing at module load time when DATABASE_URL
// is absent (e.g., unit test environments without a real DB).
async function getDb() {
  const { db, creatorsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  return { db, creatorsTable, eq };
}

// requireCreatorAuth — Phase 1 (Replit identity)
//
// Reads the Replit identity headers injected by the Replit proxy:
//   x-replit-user-id, x-replit-user-name, ...
//
// Then resolves the linked creator row via creators.replit_user_id.
// Sets res.locals.authUserId and res.locals.creatorId for downstream handlers.
//
// Replaces the Supabase JWT-based version (T-03-01).
export async function requireCreatorAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = getReplitUser(req);
  if (!user) {
    res.status(401).json({ error: "Creator auth required" });
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
    .where(eq(creatorsTable.replitUserId, user.id))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!creator) {
    res.status(403).json({ error: "No creator account linked to this user" });
    return;
  }

  res.locals.authUserId = user.id;
  res.locals.creatorId = creator.id;
  next();
}
