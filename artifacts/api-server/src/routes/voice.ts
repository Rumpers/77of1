// GET /api/voice/:jobId — HMAC-token-gated mp3 audio proxy (VOICE-03, 03-07).
//
// Security model (per threat model T-03-07-01 through T-03-07-10):
//   - UUID_RE validation of jobId BEFORE HMAC verify BEFORE DB lookup (T-03-07-08).
//   - verifyVoiceUrl timingSafeEqual check — returns 403 on any failure (T-03-07-01, T-03-07-03).
//   - 24h token TTL (T-03-07-02).
//   - Cache-Control: private, max-age=0 prevents CDN caching (T-03-07-02).
//   - Object Storage key from DB result_url — not guessable from outside (T-03-07-04).
//   - Raw GCS URL (storage.googleapis.com) never leaves the worker (T-03-07-10).
//   - 409 when job status !== "complete" — fan-page retries (T-03-07-06).
//
// Object Storage: uses the raw-fetch GET pattern (mirrors hermes PUT pattern).
// REPLIT_OBJECT_STORAGE_BUCKET (or REPLIT_OBJECT_STORAGE_BASE_URL) env var.
// The storage key stored in generation_jobs.result_url is in the form:
//   creators/{creatorId}/generations/{jobDbId}.mp3

import { Router, type IRouter, type Request, type Response } from "express";
import { verifyVoiceUrl } from "../lib/voice-token.js";
import { db, generationJobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// UUID v4 validation — must match before any crypto or DB work (T-03-07-08).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Resolve Object Storage base URL (mirrors hermes/src/lib/object-storage.ts).
function getStorageBaseUrl(): string | null {
  const override = process.env.REPLIT_OBJECT_STORAGE_BASE_URL;
  if (override && override.length > 0) return override.replace(/\/$/, "");
  const bucket = process.env.REPLIT_OBJECT_STORAGE_BUCKET;
  if (!bucket || bucket.length === 0) return null;
  return `https://storage.replit.com/v1/buckets/${encodeURIComponent(bucket)}/objects`;
}

// GET /api/voice/:jobId?exp=...&token=...
router.get(
  "/voice/:jobId",
  async (req: Request, res: Response): Promise<void> => {
    const rawJobId = req.params["jobId"];
    const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId;
    // req.query values can be string | string[] | ParsedQs | ParsedQs[]
    // We only accept plain string values; anything else → treated as missing.
    const rawToken = req.query["token"];
    const token = typeof rawToken === "string" ? rawToken : undefined;
    const rawExp = req.query["exp"];
    const expRaw = typeof rawExp === "string" ? rawExp : undefined;

    // 1. Validate jobId format (UUID) — before crypto (T-03-07-08).
    if (!jobId || !UUID_RE.test(jobId)) {
      res.status(403).send("invalid id");
      return;
    }

    // 2. Parse exp.
    const exp = parseInt(expRaw ?? "", 10);

    // 3. HMAC token verification (timingSafeEqual) — before DB lookup.
    if (!token || isNaN(exp) || !verifyVoiceUrl(jobId, exp, token)) {
      res.status(403).send("invalid or expired token");
      return;
    }

    // 4. DB lookup: check job exists and is complete.
    let row: { resultUrl: string | null; status: string } | undefined;
    try {
      const rows = await db
        .select({
          resultUrl: generationJobsTable.resultUrl,
          status: generationJobsTable.status,
        })
        .from(generationJobsTable)
        .where(eq(generationJobsTable.id, jobId))
        .limit(1);
      row = rows[0];
    } catch (err) {
      logger.error(
        { event: "voice.proxy.db_error", jobId, err: (err as Error).message },
        "[voice/proxy] DB lookup failed",
      );
      res.status(500).send("server error");
      return;
    }

    if (!row || !row.resultUrl) {
      res.status(404).send("not found");
      return;
    }

    if (row.status !== "complete") {
      // Job exists but isn't ready yet — fan-page should retry (T-03-07-06).
      res.status(409).send("not ready");
      return;
    }

    // 5. Fetch from Object Storage and pipe to response.
    // The storage key is stored in result_url (not the raw GCS URL — T-03-07-10).
    const base = getStorageBaseUrl();
    if (!base) {
      logger.error(
        { event: "voice.proxy.no_storage_config", jobId },
        "[voice/proxy] Object Storage not configured",
      );
      res.status(503).send("storage not configured");
      return;
    }

    const storageUrl = `${base}/${row.resultUrl}`;

    let storageRes: globalThis.Response;
    try {
      storageRes = await fetch(storageUrl, { method: "GET" });
    } catch (err) {
      logger.error(
        {
          event: "voice.proxy.fetch_error",
          jobId,
          err: (err as Error).message,
        },
        "[voice/proxy] Object Storage fetch failed",
      );
      res.status(502).send("storage fetch failed");
      return;
    }

    if (!storageRes.ok) {
      logger.warn(
        { event: "voice.proxy.storage_error", jobId, status: storageRes.status },
        "[voice/proxy] Object Storage returned non-2xx",
      );
      res.status(502).send("storage error");
      return;
    }

    // 6. Stream bytes to client — Content-Type audio/mpeg (mp3, per 03-01 contract).
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "private, max-age=0");

    // Node.js fetch body is a ReadableStream — pipe through to Express response.
    if (!storageRes.body) {
      res.status(502).send("empty storage response");
      return;
    }

    try {
      const reader = storageRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } catch (err) {
      logger.error(
        { event: "voice.proxy.stream_error", jobId, err: (err as Error).message },
        "[voice/proxy] stream write error",
      );
      if (!res.headersSent) {
        res.status(500).send("stream error");
      } else {
        res.destroy();
      }
    }
  },
);

export default router;
