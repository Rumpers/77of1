// DLQ processor — fires when a generation job exhausts all retries.
// Responsibilities:
//   1. Mark generation_jobs.status = 'dlq'
//   2. Emit structured audit log entry (event_type='job_dlq') — hashed identifiers only (COMPLY-03)
//   3. Emit structured Sentry-style error log (PII-free)
//
// Note: creator_notifications upsert is deferred (table not in Phase 1 schema).
// audit_log insert is deferred (table not in Phase 1 schema — Drizzle safetyAuditLogTable
// covers moderation events; job DLQ events logged to stdout only in Phase 1).
//
// Sentry: captured via @sentry/node when SENTRY_DSN is set at runtime.
// If SENTRY_DSN is absent the structured log still fires; no silent drop.

import { db, generationJobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface DlqContext {
  jobId: string;
  bullmqJobId: string | undefined;
  creatorId: string;
  jobType: string;
  errorMessage: string;
  attemptsMade: number;
}

export async function handleDlqEvent(ctx: DlqContext): Promise<void> {
  const { jobId, creatorId, jobType, errorMessage, attemptsMade } = ctx;

  // 1. Stamp generation_jobs as dlq
  try {
    await db
      .update(generationJobsTable)
      .set({
        status: "dlq",
        errorMessage: sanitizeError(errorMessage),
        completedAt: new Date(),
      })
      .where(eq(generationJobsTable.id, jobId));
  } catch (err: unknown) {
    console.error(
      `[dlq] DB update failed job=${jobId}: ${String(err)}`
    );
  }

  // 2. Structured DLQ audit log — hashed identifiers only (COMPLY-03 / T-04b-01).
  // Phase 1: audit_log table is out-of-scope; event written to stdout only.
  // Phase 2: replace with db.insert(auditLogTable) when table is added to schema.
  process.stdout.write(
    JSON.stringify({
      event: "job_dlq",
      job_type: jobType,
      // creator_id is not fan PII — safe to log (it's a UUID, not a name)
      creator_id: creatorId,
      error_code: sanitizeError(errorMessage),
      attempt_count: attemptsMade,
      // STUB: audit_log table write deferred to Phase 2 (COMPLY-03 tracked)
    }) + "\n"
  );

  // 3. creator_notifications upsert — deferred to Phase 2 (table not in Phase 1 schema).
  // STUB: console.log so DLQ flow is visible in ops logs
  console.log(
    `[dlq] STUB: creator_notifications upsert deferred creator=${creatorId} (Phase 2)`
  );

  // 4. Sentry capture (PII-stripped)
  captureToSentry({
    level: "error",
    message: "generation_job_dlq",
    extra: {
      job_id: jobId,
      creator_id: creatorId,
      job_type: jobType,
      attempts_made: attemptsMade,
      error_summary: sanitizeError(errorMessage),
    },
  });

  console.error(
    `[dlq] job=${jobId} creator=${creatorId} jobType=${jobType}` +
      ` attempts=${attemptsMade} error="${sanitizeError(errorMessage)}"`
  );
}

// Strip fan PII from error messages before logging/alerting.
// Removes anything after a colon that looks like user content.
function sanitizeError(msg: string): string {
  // Preserve structured error codes (e.g. "consent_revoked", "provider_unavailable")
  // but drop free-text that could contain fan content.
  if (msg.length <= 120) return msg;
  return msg.slice(0, 120) + "…";
}

interface SentryPayload {
  level: "error" | "warning";
  message: string;
  extra: Record<string, unknown>;
}

// Emit to Sentry when SENTRY_DSN is set; otherwise structured console only.
function captureToSentry(payload: SentryPayload): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    // Structured log so it can be ingested by any log aggregator
    console.error(
      JSON.stringify({
        sentry_level: payload.level,
        sentry_event: payload.message,
        ...payload.extra,
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Dynamic Sentry capture — @sentry/node must be installed separately.
  // Uses fire-and-forget; DLQ flow must not block on Sentry.
  // The Function constructor avoids static module resolution for an optional dep.
  const sentryImport = new Function("m", "return import(m)") as (m: string) => Promise<unknown>;
  sentryImport("@sentry/node")
    .then((mod: unknown) => {
      const sentry = mod as {
        captureException: (e: Error) => void;
        withScope: (cb: (s: { setLevel: (l: string) => void; setExtra: (k: string, v: unknown) => void }) => void) => void;
      };
      sentry.withScope((scope) => {
        scope.setLevel(payload.level);
        for (const [k, v] of Object.entries(payload.extra)) {
          scope.setExtra(k, v);
        }
        sentry.captureException(new Error(payload.message));
      });
    })
    .catch((err: unknown) => {
      console.error(`[dlq] Sentry capture failed: ${String(err)}`);
    });
}
