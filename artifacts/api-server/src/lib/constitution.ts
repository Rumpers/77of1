// PERSONA-02 constitution read path (D-02-13).
//
// Reads the creator's free-form Markdown constitution from Replit Object
// Storage at key `creators/{creatorId}/constitution.md` and returns its
// contents. The result is prepended to the system prompt by
// `buildSystemPrompt(card, locale, constitution)` when non-null.
//
// CONTRACT: this function NEVER throws. Storage outages, missing buckets,
// 404s, decode errors — all return null and log a warning. The Character
// Card V2 alone is still a valid persona, so a missing constitution must
// degrade gracefully rather than blocking chat (T-02-02-07 threat register).
//
// Plan 02-07 owns the write side (persona-wizard stub). Plans 02-03 (web
// chat route) and 02-06b (worker text-generation) consume this read.
import { logger } from "./logger.js";

let warnedAboutMissingBucket = false;

// Resolve the storage base URL for Replit Object Storage. We accept two
// env var shapes:
//   - REPLIT_OBJECT_STORAGE_BUCKET: bucket name (Replit Storage SDK style)
//   - REPLIT_OBJECT_STORAGE_BASE_URL: full base URL override (test/dev)
// When neither is set, this helper returns null and the caller treats it
// as "constitution not available". This matches the same graceful-degrade
// pattern the voice upload helper (plan 02-08) uses.
function getBucketBaseUrl(): string | null {
  const override = process.env.REPLIT_OBJECT_STORAGE_BASE_URL;
  if (override && override.length > 0) {
    return override.replace(/\/$/, "");
  }
  const bucket = process.env.REPLIT_OBJECT_STORAGE_BUCKET;
  if (!bucket || bucket.length === 0) return null;
  // Replit Object Storage REST endpoint. Final URL: `${base}/<key>`.
  return `https://storage.replit.com/v1/buckets/${encodeURIComponent(bucket)}/objects`;
}

export async function readConstitution(
  creatorId: string,
): Promise<string | null> {
  if (!creatorId || typeof creatorId !== "string") return null;

  const base = getBucketBaseUrl();
  if (!base) {
    if (!warnedAboutMissingBucket) {
      warnedAboutMissingBucket = true;
      logger.warn(
        { event: "constitution.bucket_unset" },
        "[constitution] REPLIT_OBJECT_STORAGE_BUCKET not set — persona will run on Character Card V2 alone (graceful degrade per T-02-02-07).",
      );
    }
    return null;
  }

  const key = `creators/${encodeURIComponent(creatorId)}/constitution.md`;
  const url = `${base}/${key}`;

  try {
    const res = await fetch(url, { method: "GET" });
    if (res.status === 404) return null; // optional file — silently absent
    if (!res.ok) {
      logger.warn(
        {
          event: "constitution.fetch_non_ok",
          creatorId,
          status: res.status,
        },
        `[constitution] storage returned ${res.status}; falling back to card-only persona`,
      );
      return null;
    }
    const text = await res.text();
    return text.length > 0 ? text : null;
  } catch (err) {
    logger.warn(
      {
        event: "constitution.fetch_error",
        creatorId,
        err: (err as Error).message,
      },
      "[constitution] storage fetch failed; falling back to card-only persona",
    );
    return null;
  }
}

// Test-only: reset the once-per-process warning latch so unit tests can
// assert the warning fires when the env var is unset.
export function __resetConstitutionWarningLatchForTests(): void {
  warnedAboutMissingBucket = false;
}
