// regression-processor.ts — EVAL-02 alert logic (exported for unit testing).
//
// Extracted from the worker so it can be tested in lib/eval without importing
// the worker's Sentry instrument module (which has side effects). The worker
// wraps this function and injects live deps; tests inject mocks.

import { runEval } from "./runner.js";
import type { EvalReport } from "./types.js";

export interface EvalProcessorDeps {
  runEvalFn: typeof runEval;
  // captureMessage accepts any second arg — typed loosely so this module
  // does not import Sentry types (which live in @sentry/node, a worker dep).
  // The worker binds Sentry.captureMessage directly; tests pass a vi.fn().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  captureMessageFn: (message: string, captureContext?: any) => unknown;
}

/**
 * processEvalRegression — the core job handler, exported for unit testing.
 *
 * Reads EVAL_CREATOR_ID from env (workers cannot receive it as a job field
 * because the scheduler stores the payload at upsert time, before the
 * creator UUID is known to the caller). If the env var is absent, logs and
 * returns null — never throws, so BullMQ does not retry a configuration error.
 *
 * Policy: ALERT-ONLY — never auto-flips twins.status (Pitfall 4 in 04-RESEARCH.md).
 */
export async function processEvalRegression(
  triggeredBy: "weekly-cron" | "manual",
  deps: EvalProcessorDeps,
): Promise<EvalReport | null> {
  const creatorId = process.env.EVAL_CREATOR_ID ?? "";
  if (!creatorId) {
    console.warn(
      "[eval-regression] EVAL_CREATOR_ID not set — skipping regression run",
    );
    return null;
  }

  console.info(
    `[eval-regression] starting regression run triggeredBy=${triggeredBy} creator=${creatorId}`,
  );

  const report = await deps.runEvalFn(creatorId, { isRegressionRun: true });

  if (!report.passedHardLimit100) {
    const hardLimitPassed = report.byCategory["hard-limit"].passed;
    const hardLimitTotal = report.byCategory["hard-limit"].total;
    const injectionPassed = report.byCategory["prompt-injection"].passed;

    const msg =
      `[eval-regression] REGRESSION: hard-limit pass rate dropped below 100%` +
      ` (${hardLimitPassed}/${hardLimitTotal} passed)` +
      ` for creator=${creatorId} runId=${report.runId}`;

    console.error(
      JSON.stringify({ event: "eval_regression_alert", runId: report.runId }),
    );

    deps.captureMessageFn(msg, {
      level: "error",
      extra: {
        creatorId,
        runId: report.runId,
        hardLimitPassed,
        hardLimitTotal,
        injectionPassed,
      },
    });
  } else {
    console.info(
      `[eval-regression] run clean — all hard-limit cases passed` +
        ` runId=${report.runId} creator=${creatorId}`,
    );
  }

  return report;
}
