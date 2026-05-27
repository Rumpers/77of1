// SLA alerting cron — OF-196 / [HID-011-F]
// Fires every 15 minutes. Queries pending refund_requests approaching their
// sla_deadline_at, posts distinct alerts to ops Slack, and dedups via Redis
// so the same request is not re-alerted within 1 hour.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Redis } from "ioredis";

const INTERVAL_MS = 15 * 60 * 1000;
const DEDUP_TTL_S = 3600; // 1 hour
const AT_RISK_HOURS = 4;

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

export async function runSlaAlert(supabase: SupabaseClient, redis: Redis): Promise<void> {
  const webhookUrl = process.env.OPS_SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[sla-alert] OPS_SLACK_WEBHOOK_URL not set — skipping");
    return;
  }

  const adminBase = process.env.ADMIN_BASE_URL ?? "";
  const refundsPath = "/admin/refunds?filter=sla_at_risk";

  const now = new Date();
  const horizonIso = new Date(now.getTime() + AT_RISK_HOURS * 3_600_000).toISOString();

  const { data, error } = await supabase
    .from("refund_requests")
    .select("id, fan_id, creator_id, sla_deadline_at, amount_cents")
    .eq("status", "pending")
    .lt("sla_deadline_at", horizonIso)
    .order("sla_deadline_at", { ascending: true });

  if (error) {
    console.error("[sla-alert] DB query failed:", error.message);
    return;
  }

  const rows = (data ?? []) as RefundRow[];
  if (rows.length === 0) return;

  const nowMs = now.getTime();
  const overdue = rows.filter((r) => new Date(r.sla_deadline_at).getTime() < nowMs);
  const atRisk = rows.filter((r) => new Date(r.sla_deadline_at).getTime() >= nowMs);

  // --- At-risk alert ---
  if (atRisk.length > 0) {
    const fresh = (
      await Promise.all(atRisk.map(async (r) => ({ r, dup: await markSent(redis, r.id, "at_risk") })))
    )
      .filter((x) => !x.dup)
      .map((x) => x.r);

    if (fresh.length > 0) {
      const soonestMs = new Date(fresh[0].sla_deadline_at).getTime();
      const minsLeft = Math.round((soonestMs - nowMs) / 60_000);
      await postSlack(webhookUrl, {
        text: `:warning: ${fresh.length} refund request(s) approaching SLA deadline`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text:
                `:warning: *${fresh.length} refund request(s) at risk of SLA breach*\n` +
                `Soonest deadline: *${minsLeft} min from now*\n` +
                `<${adminBase}${refundsPath}|View at-risk refunds>`,
            },
          },
        ],
      });
      console.log(`[sla-alert] at-risk alert: count=${fresh.length} soonest_mins=${minsLeft}`);
    }
  }

  // --- Overdue alert ---
  if (overdue.length > 0) {
    const fresh = (
      await Promise.all(overdue.map(async (r) => ({ r, dup: await markSent(redis, r.id, "overdue") })))
    )
      .filter((x) => !x.dup)
      .map((x) => x.r);

    if (fresh.length > 0) {
      const oldestIso = fresh[0].sla_deadline_at;
      await postSlack(webhookUrl, {
        text: `:rotating_light: ${fresh.length} refund request(s) OVERDUE`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text:
                `:rotating_light: *${fresh.length} refund request(s) are OVERDUE*\n` +
                `Oldest breach: ${oldestIso}\n` +
                `<${adminBase}${refundsPath}|View overdue refunds>`,
            },
          },
        ],
      });
      console.log(`[sla-alert] overdue alert: count=${fresh.length} oldest=${oldestIso}`);
    }
  }
}

export function startSlaAlertCron(supabase: SupabaseClient, redis: Redis): ReturnType<typeof setInterval> {
  // Fire once immediately on startup, then every 15 minutes.
  runSlaAlert(supabase, redis).catch((err: Error) => {
    console.error("[sla-alert] startup check failed:", err.message);
  });
  const handle = setInterval(() => {
    runSlaAlert(supabase, redis).catch((err: Error) => {
      console.error("[sla-alert] unhandled error:", err.message);
    });
  }, INTERVAL_MS);
  console.log(`[sla-alert] cron started — interval=15min dedup_ttl=1h`);
  return handle;
}
