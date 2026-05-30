// eval-regression worker — EVAL-02.
//
// Invoked by the weekly BullMQ Job Scheduler (Monday 02:00 UTC).
// Runs the eval suite against EVAL_CREATOR_ID and fires a Sentry alert
// when the hard-limit pass rate drops below 100% (passedHardLimit100 === false).
//
// Policy: ALERT-ONLY — never auto-flips twins.status (Pitfall 4 in 04-RESEARCH.md).
//
// The core processor logic (processEvalRegression) lives in @workspace/eval so
// it can be unit-tested in lib/eval without importing this worker's Sentry
// instrument module (which has side effects on load).

import { Worker } from "bullmq";
import { Sentry } from "../instrument.js";
import { runEval, processEvalRegression } from "@workspace/eval";
import type { EvalRegressionPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";

// Re-export the processor so callers can access it without importing this file
export { processEvalRegression } from "@workspace/eval";
export type { EvalProcessorDeps } from "@workspace/eval";

// ── BullMQ Worker factory ─────────────────────────────────────────────────────

/**
 * createEvalRegressionWorker — registers a BullMQ worker on the evalRegression queue.
 *
 * Each job calls processEvalRegression with live deps:
 *   - runEvalFn: runs all 30 eval cases, returns EvalReport with passedHardLimit100
 *   - captureMessageFn: Sentry.captureMessage — fires on !passedHardLimit100
 *
 * The worker calls runEval with isRegressionRun: true so the result is excluded
 * from the live-gate query (only non-regression runs gate twin activation).
 */
export function createEvalRegressionWorker(redisUrl: string): Worker {
  return new Worker<EvalRegressionPayload>(
    QUEUE_NAMES.evalRegression,
    async (job) => {
      // processEvalRegression reads EVAL_CREATOR_ID from env and calls:
      //   runEvalFn(creatorId, { isRegressionRun: true })
      //   then captureMessageFn if !report.passedHardLimit100
      await processEvalRegression(job.data.triggeredBy, {
        runEvalFn: runEval,
        // captureMessage bound to Sentry — fires Sentry alert on passedHardLimit100 regression
        captureMessageFn: Sentry.captureMessage.bind(Sentry),
      });
    },
    { connection: { url: redisUrl }, concurrency: 1 },
  );
}
