import * as Sentry from "@sentry/node";
import crypto from "crypto";

const PII_FIELDS = new Set([
  "fan_id",
  "fanId",
  "email",
  "message",
  "prompt",
  "fan_email",
]);

function scrubObject(obj: unknown, depth = 0): unknown {
  if (depth > 8 || obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((v) => scrubObject(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = PII_FIELDS.has(k) ? "[Scrubbed]" : scrubObject(v, depth + 1);
  }
  return out;
}

function scrubEvent(event: Sentry.Event): Sentry.Event {
  if (event.extra) {
    event.extra = scrubObject(event.extra) as typeof event.extra;
  }
  if (event.contexts) {
    event.contexts = scrubObject(event.contexts) as typeof event.contexts;
  }
  if (event.breadcrumbs?.values) {
    event.breadcrumbs.values = event.breadcrumbs.values.map((b) => ({
      ...b,
      data: b.data ? (scrubObject(b.data) as typeof b.data) : b.data,
      message: b.category === "message" ? undefined : b.message,
    }));
  }
  if (event.request?.data && typeof event.request.data === "object") {
    event.request.data = scrubObject(event.request.data);
  }
  return event;
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  release: process.env.SENTRY_RELEASE ?? process.env.GIT_SHA,
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    return scrubEvent(event);
  },
});

export function captureWorkerError(
  err: unknown,
  tags: { creator_id: string; job_type: string }
): void {
  Sentry.withScope((scope) => {
    scope.setTags(tags);
    Sentry.captureException(err);
  });
}

// sha256 hash helper used by Helicone property tagging
export function hashId(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}
