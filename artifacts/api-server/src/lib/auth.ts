import crypto from "crypto";
import type { Request, CookieOptions } from "express";

function getSessionSecret(): string {
  return process.env.SESSION_SECRET ?? "dev-only-secret-change-before-deploy";
}

export function signSessionToken(userId: string): string {
  const payload = `${userId}:${Date.now()}`;
  const sig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const encodedPayload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expectedSig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(Buffer.from(encodedPayload, "base64url").toString())
    .digest("base64url");
  if (sig !== expectedSig) return null;
  const payload = Buffer.from(encodedPayload, "base64url").toString();
  const colonIdx = payload.indexOf(":");
  if (colonIdx < 0) return null;
  return payload.slice(0, colonIdx);
}

export type ReplitUser = {
  id: string;
  name: string;
  roles: string;
  bio: string;
  profileImage: string;
  url: string;
  teams: string;
};

export function getReplitUser(req: Request): ReplitUser | null {
  const userId = req.headers["x-replit-user-id"] as string | undefined;
  if (!userId) return null;
  return {
    id: userId,
    name: (req.headers["x-replit-user-name"] as string) ?? "",
    roles: (req.headers["x-replit-user-roles"] as string) ?? "",
    bio: (req.headers["x-replit-user-bio"] as string) ?? "",
    profileImage: (req.headers["x-replit-user-profile-image"] as string) ?? "",
    url: (req.headers["x-replit-user-url"] as string) ?? "",
    teams: (req.headers["x-replit-user-teams"] as string) ?? "",
  };
}

// ── Cookie/session helpers (relocated from deleted supabase.ts) ─────────────────
// COOKIE_ACCESS_TOKEN value stays "sb-access-token" for Phase 1 backwards-compat.
// Rename deferred to Phase 2 per PATTERNS.md.
export const COOKIE_ACCESS_TOKEN = "sb-access-token";
export const COOKIE_REFRESH_TOKEN = "sb-refresh-token";

export function sessionCookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export const TRIAL_COOKIE = "7of1_trial";

export function parseTrialCookie(cookieValue: string | undefined): number {
  if (!cookieValue) return 0;
  const n = parseInt(cookieValue, 10);
  return Number.isNaN(n) || n < 0 ? 0 : n;
}
