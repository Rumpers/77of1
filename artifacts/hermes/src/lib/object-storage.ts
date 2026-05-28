// Replit Object Storage helpers for Hermes (D-02-13).
//
// Shared entry point for the persona wizard (plan 02-07 — constitution.md
// stub) and the voice wizard (plan 02-08 — voice_reference.{ext}).
//
// Resolves the storage base URL from one of two env shapes (matching
// artifacts/api-server/src/lib/constitution.ts read path):
//   - REPLIT_OBJECT_STORAGE_BUCKET: bucket name (production)
//   - REPLIT_OBJECT_STORAGE_BASE_URL: full base URL override (test/dev)
//
// CONTRACT: uploadObject MAY throw on storage outage (caller decides whether
// to swallow). Callers that must succeed-or-skip wrap in their own try/catch
// — see constitution-writer.ts which never throws into the wizard flow.

export interface UploadResult {
  url: string;
  key: string;
}

export interface UploadOptions {
  contentType?: string;
}

function getBucketBaseUrl(): string | null {
  const override = process.env.REPLIT_OBJECT_STORAGE_BASE_URL;
  if (override && override.length > 0) {
    return override.replace(/\/$/, "");
  }
  const bucket = process.env.REPLIT_OBJECT_STORAGE_BUCKET;
  if (!bucket || bucket.length === 0) return null;
  return `https://storage.replit.com/v1/buckets/${encodeURIComponent(bucket)}/objects`;
}

// Low-level PUT to Replit Object Storage. Throws on missing bucket env or
// non-2xx response. Callers needing graceful-degrade must catch.
export async function uploadObject(
  key: string,
  body: Buffer | string,
  opts: UploadOptions = {},
): Promise<UploadResult> {
  const base = getBucketBaseUrl();
  if (!base) {
    throw new Error(
      "REPLIT_OBJECT_STORAGE_BUCKET (or REPLIT_OBJECT_STORAGE_BASE_URL) is not set"
    );
  }
  const url = `${base}/${key}`;
  const headers: Record<string, string> = {
    "Content-Type": opts.contentType ?? "application/octet-stream",
  };
  // Node fetch accepts Buffer | string as body. Cast through unknown to satisfy
  // RequestInit's body typing across Node versions without dragging in DOM libs.
  const init = { method: "PUT", headers, body: body as unknown } as unknown as Parameters<typeof fetch>[1];
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(
      `Replit Object Storage PUT ${url} returned ${res.status} ${res.statusText}`
    );
  }
  return { url, key };
}

// Used by plan 02-08's /voice wizard. Lives here so the storage path
// convention (`creators/{id}/voice_reference.{ext}`) is owned in one place.
export async function uploadVoiceReference(
  creatorId: string,
  buffer: Buffer,
  opts: { mimeType?: string } = {},
): Promise<UploadResult> {
  const mime = opts.mimeType ?? "audio/wav";
  // mime "audio/ogg" → "ogg", "audio/wav" → "wav", "audio/mpeg" → "mpeg".
  const ext = (mime.split("/")[1] ?? "wav").toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = `creators/${encodeURIComponent(creatorId)}/voice_reference.${ext}`;
  return uploadObject(key, buffer, { contentType: mime });
}
