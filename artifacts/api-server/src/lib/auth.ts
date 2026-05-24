import crypto from "crypto";
import type { Request } from "express";

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

export const TRIAL_COOKIE = "7of1_trial";

export function parseTrialCookie(cookieValue: string | undefined): number {
  if (!cookieValue) return 0;
  const n = parseInt(cookieValue, 10);
  return Number.isNaN(n) || n < 0 ? 0 : n;
}
