// HMAC-signed conversation_id (CHAT-03) — per PATTERNS A3, RESEARCH Pattern 2.
//
// Two flavours of conversation_id:
//   - Web: randomBytes(16).toString("hex") + HMAC token in httpOnly cookie.
//   - Telegram: HMAC of `${chatId}:${creatorId}` — deterministic so the same
//     fan/chat always resolves to the same conversation history.
//
// Cookie pattern mirrors `lib/auth.ts` (httpOnly, sameSite=lax, secure in prod).
// Secret env var: HMAC_CONVERSATION_SECRET (validated ≥32 chars in config/env.ts).
import crypto from "crypto";
import type { CookieOptions } from "express";

const COOKIE_NAME = "conversation_id";
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getConversationSecret(): string {
  const secret = process.env.HMAC_CONVERSATION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "HMAC_CONVERSATION_SECRET must be set and ≥32 characters. " +
        "Configure it in Replit Secrets before any chat route is hit.",
    );
  }
  return secret;
}

// ─── signing primitives ──────────────────────────────────────────────────────

export function signConversationId(id: string): string {
  return crypto
    .createHmac("sha256", getConversationSecret())
    .update(id)
    .digest("hex")
    .slice(0, 32);
}

export function verifyConversationId(combined: string): string | null {
  if (typeof combined !== "string" || combined.length === 0) return null;
  const idx = combined.indexOf(".");
  if (idx <= 0 || idx === combined.length - 1) return null;
  const id = combined.slice(0, idx);
  const token = combined.slice(idx + 1);
  let expected: string;
  try {
    expected = signConversationId(id);
  } catch {
    return null;
  }
  // constant-time compare to defeat timing oracles
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return id;
}

// ─── new id factories ────────────────────────────────────────────────────────

export interface NewConversationIdResult {
  id: string;
  token: string; // combined "<id>.<sig>" — write this to the cookie
}

export function newWebConversationId(): NewConversationIdResult {
  const id = crypto.randomBytes(16).toString("hex"); // 128 bits of entropy
  const sig = signConversationId(id);
  return { id, token: `${id}.${sig}` };
}

export function deriveTelegramConversationId(
  chatId: number,
  creatorId: string,
): string {
  const seed = `${chatId}:${creatorId}`;
  return crypto
    .createHmac("sha256", getConversationSecret())
    .update(seed)
    .digest("hex")
    .slice(0, 32);
}

// ─── cookie options ──────────────────────────────────────────────────────────

export function conversationCookieOptions(
  maxAge: number = COOKIE_MAX_AGE_MS,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export { COOKIE_NAME as CONVERSATION_COOKIE_NAME };
