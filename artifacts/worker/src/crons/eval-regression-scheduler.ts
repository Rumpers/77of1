// eval-regression-scheduler.ts — EVAL-02 weekly Job Scheduler registration.
//
// Called at worker startup. Uses BullMQ's upsertJobScheduler API (v5.16.0+)
// to register a persistent, idempotent weekly schedule in Redis.
//
// Schedule: Monday 02:00 UTC ("0 2 * * 1") — low-traffic window.
//
// Idempotent: calling upsertJobScheduler on every deploy is safe — BullMQ
// upserts the scheduler in Redis, not duplicating it.
//
// Redis-absent fallback: caller wraps this in try/catch; if Redis is
// unreachable, the weekly schedule is not registered but the worker
// process does not crash. Manual eval via CLI still works.

import { Queue } from "bullmq";
import { QUEUE_NAMES } from "@workspace/queue";
import type { EvalRegressionPayload } from "@workspace/queue";
import { JOB_OPTIONS } from "@workspace/queue";

/**
 * registerEvalRegressionScheduler — upserts the weekly eval-regression
 * BullMQ Job Scheduler. Creates a temporary Queue connection, upserts the
 * scheduler, then closes the queue. Safe to call on every worker startup.
 *
 * @param redisUrl — e.g. "redis://localhost:6379"
 */
export async function registerEvalRegressionScheduler(
  redisUrl: string,
): Promise<void> {
  const queue = new Queue<EvalRegressionPayload>(QUEUE_NAMES.evalRegression, {
    connection: { url: redisUrl },
  });

  // upsertJobScheduler is idempotent — safe on every startup.
  // Every Monday at 02:00 UTC (0 2 * * 1).
  // NOTE: do NOT use the deprecated queue.add(name, data, { repeat }) API —
  // that API is forbidden per 04-RESEARCH Pitfall 5.
  await queue.upsertJobScheduler(
    "eval-regression-weekly",
    { pattern: "0 2 * * 1" },
    {
      name: "eval-regression",
      data: {
        type: "eval-regression",
        triggeredBy: "weekly-cron",
      } as EvalRegressionPayload,
      opts: {
        attempts: JOB_OPTIONS.evalRegression?.attempts ?? 2,
        backoff: JOB_OPTIONS.evalRegression?.backoff ?? {
          type: "exponential",
          delay: 30_000,
        },
      },
    },
  );

  await queue.close();
  console.log(
    "[eval-regression] weekly scheduler registered — every Monday 02:00 UTC",
  );
}
