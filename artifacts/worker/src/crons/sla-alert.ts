// SLA alerting cron — OF-196 / [HID-011-F]
// Fires every 15 minutes. Queries pending refund_requests approaching their
// sla_deadline_at, posts distinct alerts to ops Slack, and dedups via Redis
// so the same request is not re-alerted within 1 hour.
//
// Phase 1 stub: refund_requests table is out-of-scope (Stripe/dunning dormant per CLAUDE.md).
// SLA alert query replaced with a no-op until Phase 2 when refund_requests is added to schema.

import type { Redis } from "ioredis";

const INTERVAL_MS = 15 * 60 * 1000;
const DEDUP_TTL_S = 3600; // 1 hour
const AT_RISK_HOURS = 4;
void AT_RISK_HOURS; // used in Phase 2 implementation

interface RefundRow {
  id: string;
  fan_id: string;
  creator_id: string;
  sla_deadline_at: string;
  amount_cents: number;
}

// Returns true when key already existed (duplicate), false when key was newly set.
async function markSent(redis: Redis, requestId: string, kind: "at_risk" | "overdue"): Promise<boolean> {
  const result = await redis.set(`sla-alert:${kind}:${requestId}`, "1", "EX", DEDUP_TTL_S, "NX");
  return result === null;
}
void markSent; // used in Phase 2 when refund_requests table is in-scope

async function postSlack(webhookUrl: string, body: object): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Slack webhook ${res.status}: ${res.statusText}`);
  }
}
void postSlack; // used in Phase 2 when refund_requests table is in-scope

export async function runSlaAlert(redis: Redis): Promise<void> {
  const webhookUrl = process.env.OPS_SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[sla-alert] OPS_SLACK_WEBHOOK_URL not set — skipping");
    return;
  }

  // STUB: refund_requests table is out-of-scope in Phase 1 (Stripe/dunning dormant).
  // Phase 2: replace with db.select(...).from(refundRequestsTable).where(...)
  const rows: RefundRow[] = [];
  console.log("[sla-alert] STUB: refund_requests query deferred to Phase 2");

  if (rows.length === 0) return;
}

export function startSlaAlertCron(redis: Redis): ReturnType<typeof setInterval> {
  // Fire once immediately on startup, then every 15 minutes.
  runSlaAlert(redis).catch((err: Error) => {
    console.error("[sla-alert] startup check failed:", err.message);
  });
  const handle = setInterval(() => {
    runSlaAlert(redis).catch((err: Error) => {
      console.error("[sla-alert] unhandled error:", err.message);
    });
  }, INTERVAL_MS);
  console.log(`[sla-alert] cron started — interval=15min dedup_ttl=1h`);
  return handle;
}
