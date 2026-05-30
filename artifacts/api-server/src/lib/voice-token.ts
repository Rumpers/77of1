// HMAC-gated voice URL signing — VOICE-03 (03-07).
//
// Mirrors the hmac-conversation.ts pattern but is specialized for voice-job
// proxy URLs. Signs a {jobId}.{exp} payload with VOICE_URL_SIGNING_SECRET
// and embeds exp + token as query params in the /api/voice/:jobId URL.
//
// The proxy route (artifacts/api-server/src/routes/voice.ts) calls
// verifyVoiceUrl() BEFORE any DB lookup or Object Storage access.
//
// Security notes:
//   - Full 64-hex HMAC digest (not truncated) — 256-bit security.
//   - timingSafeEqual after length check to defeat timing oracles.
//   - Default TTL = 24h (VOICE_URL_TTL_SECONDS env var override for tests/ops).
//   - Secret must be ≥32 chars; openssl rand -hex 32 = 64 hex chars (256-bit).
//   - VOICE_URL_SIGNING_SECRET must be provisioned in Replit Secrets.
import { createHmac, timingSafeEqual } from "crypto";

// ─── Secret accessor ─────────────────────────────────────────────────────────

function getVoiceSecret(): string {
  const secret = process.env.VOICE_URL_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "VOICE_URL_SIGNING_SECRET must be set and ≥32 characters. " +
        "Provision it in Replit Secrets: openssl rand -hex 32",
    );
  }
  return secret;
}

// ─── TTL helper ──────────────────────────────────────────────────────────────

function getDefaultTtlSeconds(): number {
  const override = process.env.VOICE_URL_TTL_SECONDS;
  if (override) {
    const parsed = parseInt(override, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 86_400; // 24 hours
}

// ─── signVoiceUrl ────────────────────────────────────────────────────────────

/**
 * Return a signed proxy URL of the form:
 *   `/api/voice/{jobId}?exp={epochSeconds}&token={64hexChars}`
 *
 * TTL defaults to 24h (or VOICE_URL_TTL_SECONDS env var).
 * Pass `ttlSeconds` explicitly to override (e.g. in tests).
 *
 * Throws if VOICE_URL_SIGNING_SECRET is unset or <32 chars.
 */
export function signVoiceUrl(jobId: string, ttlSeconds?: number): string {
  const secret = getVoiceSecret();
  const ttl = ttlSeconds !== undefined ? ttlSeconds : getDefaultTtlSeconds();
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const payload = `${jobId}.${exp}`;
  const token = createHmac("sha256", secret).update(payload).digest("hex");
  return `/api/voice/${encodeURIComponent(jobId)}?exp=${exp}&token=${token}`;
}

// ─── verifyVoiceUrl ──────────────────────────────────────────────────────────

/**
 * Returns true only when:
 *   - exp is in the future (token not expired)
 *   - HMAC(jobId.exp) matches the supplied token (constant-time compare)
 *
 * Returns false on any validation failure (no exceptions thrown to callers —
 * the route converts false to a 403).
 */
export function verifyVoiceUrl(
  jobId: string,
  exp: number,
  token: string,
): boolean {
  // 1. Expiry check first (cheap, no crypto needed).
  if (exp * 1000 < Date.now()) return false;

  // 2. Compute expected HMAC.
  let secret: string;
  try {
    secret = getVoiceSecret();
  } catch {
    return false; // Secret not configured — treat as invalid
  }

  const payload = `${jobId}.${exp}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  // 3. Constant-time comparison (T-03-07-03).
  const a = Buffer.from(token, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
