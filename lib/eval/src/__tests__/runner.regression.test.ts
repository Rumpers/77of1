// runner.regression.test.ts — EVAL-02 success criterion 2.
//
// Proves that:
//   1. Sentry.captureMessage fires exactly once when passedHardLimit100 is false.
//   2. Sentry.captureMessage is NOT called when passedHardLimit100 is true.
//
// Test approach: import processEvalRegression from @workspace/eval (the pure
// processor that the worker wraps), inject mock runEval and captureMessage
// deps, assert on captureMessage call count.
//
// NOTE: This unit test validates the alert path at the function level.
// The full BullMQ schedule → worker path is NOT exercised here.
// Post-deploy manual verification: trigger via bull-board, confirm the Sentry
// event appears in the Sentry dashboard (see SUMMARY.md go-live runbook).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { processEvalRegression } from "../regression-processor.js";
import type { EvalReport } from "../types.js";

// ── Minimal mock helpers ──────────────────────────────────────────────────────

function makeReport(passedHardLimit100: boolean): EvalReport {
  const hardLimitPassed = passedHardLimit100 ? 5 : 4;
  return {
    runId: "test-run-id-abc123",
    creatorId: "creator-uuid-test",
    ranAt: new Date("2026-05-30T02:00:00Z"),
    totalCases: 30,
    totalPassed: passedHardLimit100 ? 30 : 29,
    totalFailed: passedHardLimit100 ? 0 : 1,
    byCategory: {
      "in-character": { passed: 10, total: 10 },
      "boundary-push": { passed: 10, total: 10 },
      "hard-limit": { passed: hardLimitPassed, total: 5 },
      "prompt-injection": { passed: 5, total: 5 },
    },
    passedHardLimit100,
    passedInjection100: true,
    goLiveEligible: passedHardLimit100,
    failedCases: passedHardLimit100
      ? []
      : [{ caseId: "HL-03", passed: false, reason: "moderation did NOT fire" }],
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("processEvalRegression (EVAL-02 success criterion 2)", () => {
  const CREATOR_ID = "00000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    vi.stubEnv("EVAL_CREATOR_ID", CREATOR_ID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fires Sentry.captureMessage exactly once when passedHardLimit100 is false (deliberate regression)", async () => {
    const mockRunEval = vi.fn().mockResolvedValue(makeReport(false));
    const mockCaptureMessage = vi.fn();

    await processEvalRegression("weekly-cron", {
      runEvalFn: mockRunEval,
      captureMessageFn: mockCaptureMessage,
    });

    // ASSERTION 1: captureMessage must be called exactly once on regression
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);

    // ASSERTION 2: captureMessage is called with error level + relevant extra data
    const [msg, ctx] = mockCaptureMessage.mock.calls[0] as [
      string,
      { level: string; extra: Record<string, unknown> },
    ];
    expect(ctx.level).toBe("error");
    expect(msg).toContain("REGRESSION");
    expect(msg).toContain("hard-limit");
    expect(ctx.extra).toMatchObject({
      creatorId: CREATOR_ID,
      runId: "test-run-id-abc123",
      hardLimitPassed: 4,
      hardLimitTotal: 5,
    });

    // ASSERTION 3: runEval was called with isRegressionRun: true
    expect(mockRunEval).toHaveBeenCalledWith(CREATOR_ID, { isRegressionRun: true });
  });

  it("does NOT call Sentry.captureMessage when passedHardLimit100 is true (clean run)", async () => {
    const mockRunEval = vi.fn().mockResolvedValue(makeReport(true));
    const mockCaptureMessage = vi.fn();

    await processEvalRegression("weekly-cron", {
      runEvalFn: mockRunEval,
      captureMessageFn: mockCaptureMessage,
    });

    // ASSERTION: captureMessage must NOT be called on a clean run
    expect(mockCaptureMessage).not.toHaveBeenCalled();

    // runEval was still called once
    expect(mockRunEval).toHaveBeenCalledTimes(1);
  });

  it("skips and returns null when EVAL_CREATOR_ID is unset (graceful no-op)", async () => {
    vi.stubEnv("EVAL_CREATOR_ID", "");

    const mockRunEval = vi.fn();
    const mockCaptureMessage = vi.fn();

    const result = await processEvalRegression("weekly-cron", {
      runEvalFn: mockRunEval,
      captureMessageFn: mockCaptureMessage,
    });

    expect(result).toBeNull();
    expect(mockRunEval).not.toHaveBeenCalled();
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });
});
