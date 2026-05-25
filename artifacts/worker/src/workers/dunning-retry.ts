// Dunning retry worker — OF-168
//
// Retry ladder (all delays are job-level BullMQ delays):
//   attempt=0: charge_failed → grace,   enqueue attempt=1 at +72h
//   attempt=1: retry #1 fail → paused,  enqueue attempt=2 at +48h
//   attempt=2: retry #2 fail → paused,  enqueue attempt=3 at +48h
//   attempt=3: retry #3 fail → paused,  enqueue attempt=4 at +72h
//   attempt=4: cancellation job         → cancelled
//
// If dunning_enabled=false: retries are frozen; access is grace-level.
// PaymentProvider is injected — defaults to Stripe via env if none provided.

import { Worker, Queue } from "bullmq";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DunningRetryPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";
import type { IPaymentProvider } from "@workspace/providers";
import { StripeDunningAdapter } from "./stripe-dunning-adapter.js";

// Retry delay ladder in milliseconds
const RETRY_DELAYS_MS: Record<number, number> = {
  0: 72 * 60 * 60 * 1000,  // T+72h  (day 3)
  1: 48 * 60 * 60 * 1000,  // T+48h  (day 5)
  2: 48 * 60 * 60 * 1000,  // T+48h  (day 7)
  3: 72 * 60 * 60 * 1000,  // T+72h  (day 10 → cancel)
};

type DunningState = "active" | "grace" | "paused" | "cancelled" | "recovered";

const CONCURRENCY = 5;

async function isDunningEnabled(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", "dunning_enabled")
    .maybeSingle();
  return data?.enabled === true;
}

async function writeAuditEntry(
  supabase: SupabaseClient,
  opts: {
    subscriptionId: string;
    fanId: string;
    creatorId: string;
    fromState: DunningState;
    toState: DunningState;
    eventType: string;
    attempt: number;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from("dunning_audit_log").insert({
    subscription_id: opts.subscriptionId,
    fan_id: opts.fanId,
    creator_id: opts.creatorId,
    from_state: opts.fromState,
    to_state: opts.toState,
    event_type: opts.eventType,
    attempt: opts.attempt,
    payload: opts.payload ?? {},
  });

  if (error) {
    console.error(`[dunning] audit write failed sub=${opts.subscriptionId}: ${error.message}`);
  }

  // Also write to the shared audit_log for analytics
  await supabase.from("audit_log").insert({
    creator_id: opts.creatorId,
    fan_id: opts.fanId,
    event_type: `subscription.${opts.eventType}`,
    payload: {
      subscription_id: opts.subscriptionId,
      from_state: opts.fromState,
      to_state: opts.toState,
      attempt: opts.attempt,
      ...opts.payload,
    },
  });
}

async function transitionState(
  supabase: SupabaseClient,
  subscriptionId: string,
  toState: DunningState,
  attempt: number,
  retryAt: Date | null,
): Promise<void> {
  const { error } = await supabase
    .from("fan_subscriptions")
    .update({
      dunning_state: toState,
      dunning_attempt: attempt,
      dunning_retry_at: retryAt?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  if (error) {
    throw new Error(`[dunning] state transition failed: ${error.message}`);
  }
}

async function enqueueNextRetry(
  redisUrl: string,
  payload: DunningRetryPayload,
  delayMs: number,
): Promise<void> {
  const queue = new Queue(QUEUE_NAMES.dunningRetry, { connection: { url: redisUrl } });
  try {
    const jobId = `dunning:${payload.subscriptionId}:attempt:${payload.attempt}`;
    await queue.add(`dunning-retry`, payload, {
      delay: delayMs,
      jobId,  // idempotent: same job ID dedups if re-enqueued
    });
    console.log(
      `[dunning] enqueued sub=${payload.subscriptionId} attempt=${payload.attempt} delay=${delayMs}ms`,
    );
  } finally {
    await queue.close();
  }
}

export function createWorker(
  redisUrl: string,
  supabase: SupabaseClient,
  paymentProvider?: IPaymentProvider,
): Worker<DunningRetryPayload> {
  const provider = paymentProvider ?? new StripeDunningAdapter();

  const worker = new Worker<DunningRetryPayload>(
    QUEUE_NAMES.dunningRetry,
    async (job) => {
      const { subscriptionId, fanId, creatorId, stripeSubscriptionId, stripeCustomerId, attempt } =
        job.data;

      console.log(
        `[dunning] processing sub=${subscriptionId} attempt=${attempt} job=${job.id}`,
      );

      // Fetch current subscription state (guard against double-processing)
      const { data: sub, error: fetchErr } = await supabase
        .from("fan_subscriptions")
        .select("dunning_state, dunning_attempt")
        .eq("id", subscriptionId)
        .maybeSingle();

      if (fetchErr || !sub) {
        throw new Error(`[dunning] subscription not found: ${subscriptionId}`);
      }

      // attempt=4 means this is the cancellation job — no charge attempt
      if (attempt === 4) {
        if (sub.dunning_state === "cancelled") {
          console.log(`[dunning] already cancelled sub=${subscriptionId} — skipping`);
          return;
        }

        const fromState = sub.dunning_state as DunningState;
        await transitionState(supabase, subscriptionId, "cancelled", attempt, null);
        await provider.cancelSubscription(stripeSubscriptionId);
        await writeAuditEntry(supabase, {
          subscriptionId,
          fanId,
          creatorId,
          fromState,
          toState: "cancelled",
          eventType: "dunning_cancelled",
          attempt,
        });

        console.log(`[dunning] cancelled sub=${subscriptionId}`);
        return;
      }

      // Check feature flag — if disabled, freeze ladder (grant grace access)
      const dunningEnabled = await isDunningEnabled(supabase);
      if (!dunningEnabled) {
        console.log(`[dunning] flag disabled — freezing ladder for sub=${subscriptionId}`);
        return;
      }

      // Attempt the charge
      const chargeResult = await provider.retryCharge(stripeSubscriptionId);

      if (chargeResult.success) {
        // Recovery path
        const fromState = sub.dunning_state as DunningState;
        await transitionState(supabase, subscriptionId, "recovered", attempt, null);
        await writeAuditEntry(supabase, {
          subscriptionId,
          fanId,
          creatorId,
          fromState,
          toState: "recovered",
          eventType: "dunning_recovered",
          attempt,
        });

        console.log(`[dunning] recovered sub=${subscriptionId} attempt=${attempt}`);
        return;
      }

      // Charge failed — advance the ladder
      const nextAttempt = attempt + 1;
      const delayMs = RETRY_DELAYS_MS[attempt];

      // State transitions per ladder spec:
      // attempt=0 (initial failure) → grace
      // attempt=1,2,3 → paused
      const nextState: DunningState = attempt === 0 ? "grace" : "paused";
      const fromState = sub.dunning_state as DunningState;
      const retryAt = new Date(Date.now() + delayMs);

      await transitionState(supabase, subscriptionId, nextState, nextAttempt, retryAt);

      const eventType =
        attempt === 0
          ? "dunning_grace"
          : attempt === 1
            ? "dunning_paused"
            : "charge_failed";

      await writeAuditEntry(supabase, {
        subscriptionId,
        fanId,
        creatorId,
        fromState,
        toState: nextState,
        eventType,
        attempt,
        payload: {
          error_code: chargeResult.errorCode,
          error_message: chargeResult.errorMessage,
          retry_at: retryAt.toISOString(),
        },
      });

      // Enqueue next step
      await enqueueNextRetry(
        redisUrl,
        {
          type: "dunning-retry",
          subscriptionId,
          fanId,
          creatorId,
          stripeSubscriptionId,
          stripeCustomerId,
          attempt: nextAttempt,
        },
        delayMs,
      );

      console.log(
        `[dunning] charge failed sub=${subscriptionId} attempt=${attempt}` +
          ` → ${nextState} next=${nextAttempt} retryAt=${retryAt.toISOString()}`,
      );
    },
    { connection: { url: redisUrl }, concurrency: CONCURRENCY },
  );

  worker.on("failed", (job, err) => {
    console.error(
      `[dunning] job failed sub=${job?.data?.subscriptionId} attempt=${job?.data?.attempt} error=${err.message}`,
    );
  });

  return worker;
}
