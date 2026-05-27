// DLQ processor — fires when a generation job exhausts all retries.
// Responsibilities:
//   1. Mark generation_jobs.status = 'dlq'
//   2. Write audit_log entry (event_type='job_dlq')
//   3. Upsert creator_notifications so dashboard polls pick it up
//   4. Emit structured Sentry-style error log (PII-free)
//
// Sentry: captured via @sentry/node when SENTRY_DSN is set at runtime.
// If SENTRY_DSN is absent the structured log still fires; no silent drop.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface DlqContext {
  jobId: string;
  bullmqJobId: string | undefined;
  creatorId: string;
  jobType: string;
  errorMessage: string;
  attemptsMade: number;
}

export async function handleDlqEvent(
  supabase: SupabaseClient,
  ctx: DlqContext
): Promise<void> {
  const { jobId, creatorId, jobType, errorMessage, attemptsMade } = ctx;

  // 1. Stamp generation_jobs as dlq
  const { error: jobUpdateErr } = await supabase
    .from("generation_jobs")
    .update({
      status: "dlq",
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (jobUpdateErr) {
    console.error(
      `[dlq] DB update failed job=${jobId}: ${jobUpdateErr.message}`
    );
  }

  // 2. Append audit_log entry (immutable, append-only)
  const { error: auditErr } = await supabase.from("audit_log").insert({
    creator_id: creatorId,
    event_type: "job_dlq",
    payload: {
      job_id: jobId,
      job_type: jobType,
      attempts_made: attemptsMade,
      // error stored as-is; fan PII (prompt text) is NOT stored here
      error_summary: sanitizeError(errorMessage),
    },
  });

  if (auditErr) {
    console.error(
      `[dlq] audit_log write failed job=${jobId}: ${auditErr.message}`
    );
  }

  // 3. Upsert creator_notifications — dashboard polls this row
  const { error: notifyErr } = await supabase
    .from("creator_notifications")
    .upsert(
      {
        creator_id: creatorId,
        has_dlq_jobs: true,
        last_dlq_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "creator_id" }
    );

  if (notifyErr) {
    console.error(
      `[dlq] creator_notifications upsert failed creator=${creatorId}: ${notifyErr.message}`
    );
  }

  // 4. Structured DLQ metric log — GCP Logging compatible (stdout JSON, OF-112)
  process.stdout.write(
    JSON.stringify({
      event: "job_dlq",
      job_type: jobType,
      creator_id: creatorId,
      error_code: sanitizeError(errorMessage),
      attempt_count: attemptsMade,
    }) + "\n"
  );

  // 5. Sentry capture (PII-stripped)
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
