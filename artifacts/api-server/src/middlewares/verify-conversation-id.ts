// verifyConversationId middleware (CHAT-03 — PATTERNS A4).
//
// Behaviour:
//   - Cookie absent           → mint a new conversation_id via newWebConversationId(),
//                               set the httpOnly cookie, attach res.locals.conversationId, next().
//   - Cookie present + valid  → set res.locals.conversationId, next().
//   - Cookie present + tamper → 401 + { error: "Invalid conversation token" }.
//
// We refuse to silently re-mint when verification fails — that would let an
// attacker churn through forged tokens until one accidentally validates. A
// 401 forces the client to drop its cookie before retrying (T-02-02-01).
import type { NextFunction, Request, Response } from "express";
import {
  CONVERSATION_COOKIE_NAME,
  conversationCookieOptions,
  newWebConversationId,
  verifyConversationId as verifyToken,
} from "../lib/hmac-conversation.js";

// Augment Express.Locals to advertise the new field to downstream handlers.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      conversationId?: string;
    }
  }
}

export async function verifyConversationId(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const cookies = (req as Request & {
    cookies?: Record<string, string>;
  }).cookies;
  const incoming = cookies ? cookies[CONVERSATION_COOKIE_NAME] : undefined;

  if (typeof incoming === "string" && incoming.length > 0) {
    const id = verifyToken(incoming);
    if (id === null) {
      res.status(401).json({ error: "Invalid conversation token" });
      return;
    }
    res.locals.conversationId = id;
    next();
    return;
  }

  // No cookie — first turn for this browser. Mint, set, continue.
  const { id, token } = newWebConversationId();
  res.cookie(CONVERSATION_COOKIE_NAME, token, conversationCookieOptions());
  res.locals.conversationId = id;
  next();
}
