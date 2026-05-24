// ─── Replit Auth session ─────────────────────────────────────────────────────
// Single source of truth for both creator and fan session shapes.
// Replit Auth is the identity provider — no custom JWT layer.

export interface ReplitAuthSession {
  userId: string;       // Replit user ID (x-replit-user-id header)
  creatorId?: string;   // present if this user is a linked creator
  fanId?: string;       // present if this user is a linked fan
  sessionToken: string; // HMAC-signed opaque token; bound to userId
}

// ─── Anonymous fan trial ──────────────────────────────────────────────────────
// Pre-auth trial state; stored in HttpOnly cookie until fan completes signup.

export interface AnonymousTrialSession {
  trialCount: number;
  creatorId: string;
}
