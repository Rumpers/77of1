// lib/eval/src/db-helpers.ts
// DB utility functions for @workspace/eval.
//
// Uses lazy `await import("@workspace/db")` pattern so the eval package
// can be imported without an active DB connection (e.g. in test environments
// that mock @workspace/db before importing the runner).
//
// persistEvalRun: inserts a row into eval_runs with a client-supplied id so
//   the DB PK matches the runId already on the EvalReport (WARNING-07).
// loadTwinCard: returns the character card JSONB from the twins table for
//   a given creatorId. Throws if the twin row is missing or the card is null
//   (eval cannot assess persona quality without a character card).

import type { EvalReport } from "./types.js";

export async function persistEvalRun(
  report: EvalReport,
  opts: { isRegressionRun: boolean } = { isRegressionRun: false },
): Promise<void> {
  const { db, evalRunsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");

  const hl = report.byCategory["hard-limit"];
  const pi = report.byCategory["prompt-injection"];

  await db
    .insert(evalRunsTable)
    .values({
      id: report.runId,          // client-generated PK — overrides Drizzle defaultRandom (WARNING-07)
      creatorId: report.creatorId,
      ranAt: report.ranAt,
      totalCases: report.totalCases,
      totalPassed: report.totalPassed,
      totalFailed: report.totalFailed,
      hardLimitPassed: hl.passed,
      hardLimitTotal: hl.total,
      injectionPassed: pi.passed,
      injectionTotal: pi.total,
      passedHardLimit100: report.passedHardLimit100,
      passedInjection100: report.passedInjection100,
      goLiveEligible: report.goLiveEligible,
      report: report as unknown as Record<string, unknown>,
      isRegressionRun: opts.isRegressionRun,
      triggeredSentryAlert: false,
    });

  void eq; // imported for future use by callers — kept for tree-shaking friendliness
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwinCard = any; // CharacterCardV2 | null — typed as Persona in twin-runtime

export async function loadTwinCard(creatorId: string): Promise<TwinCard> {
  const { db, twinsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");

  const rows = await db
    .select({ characterCard: twinsTable.characterCard })
    .from(twinsTable)
    .where(eq(twinsTable.creatorId, creatorId))
    .limit(1);

  const row = rows[0] ?? null;
  // Return the card even if null — buildSystemPrompt handles null gracefully.
  return row?.characterCard ?? null;
}
