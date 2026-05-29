// Dunning retry worker — OF-168
//
// Retry ladder (all delays are job-level BullMQ delays):
//   attempt=0: charge_failed → grace,   enqueue attempt=1 at +72h
//   attempt=1: retry #1 fail → paused,  enqueue attempt=2 at +48h
//   attempt=2: retry #2 fail → paused,  enqueue attempt=3 at +48h
//   attempt=3: retry #3 fail → paused,  enqueue attempt=4 at +72h
//   attempt=4: cancellation job         → cancelled
//
// Per D-13: worker body is a STUB in Phase 1 (Stripe/dunning dormant per CLAUDE.md).
// fan_subscriptions, feature_flags, dunning_audit_log tables are out-of-scope for Phase 1.
// Phase 2: restore full dunning ladder once Stripe/subscription tables are in schema.

import { Worker } from "bullmq";
import type { DunningRetryPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";
import type { IPaymentProvider } from "@workspace/providers";
import { StripeDunningAdapter } from "./stripe-dunning-adapter.js";

// Retry delay ladder in milliseconds — preserved for Phase 2 reference
const RETRY_DELAYS_MS: Record<number, number> = {
  0: 72 * 60 * 60 * 1000,  // T+72h  (day 3)
  1: 48 * 60 * 60 * 1000,  // T+48h  (day 5)
  2: 48 * 60 * 60 * 1000,  // T+48h  (day 7)
  3: 72 * 60 * 60 * 1000,  // T+72h  (day 10 → cancel)
};
void RETRY_DELAYS_MS; // used in Phase 2 implementation

const CONCURRENCY = 5;

export function createWorker(
  redisUrl: string,
  paymentProvider?: IPaymentProvider,
): Worker<DunningRetryPayload> {
  // Provider preserved for Phase 2; not called in stub body
  const _provider = paymentProvider ?? new StripeDunningAdapter();
  void _provider;

  const worker = new Worker<DunningRetryPayload>(
    QUEUE_NAMES.dunningRetry,
    async (job) => {
      const { subscriptionId, attempt } = job.data;

      console.log(
        `[dunning] processing sub=${subscriptionId} attempt=${attempt} job=${job.id}`,
      );

      // STUB: Stripe dunning ladder is dormant in Phase 1.
      // fan_subscriptions, feature_flags, dunning_audit_log tables not in Phase 1 schema.
      // Phase 2: restore full dunning retry logic with Drizzle queries.
      console.log(`[dunning] STUB: dunning retry body filled in Phase 2`);
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
