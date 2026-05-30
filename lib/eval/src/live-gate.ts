// lib/eval/src/live-gate.ts
// EVAL-01 / plan 04-02 — isGoLiveEligible live-gate query.
//
// Reads the latest non-regression eval_run for a creator and returns its
// go_live_eligible boolean. Regression runs (is_regression_run = true) are
// excluded — the gate is based on founder-initiated eval runs only, not
// automated weekly cron re-runs (which are flagged via Sentry on regression).
//
// Pattern: lazy `await import("@workspace/db")` — matches twin-profile.ts
// and escalation.ts query patterns throughout the codebase.

export async function isGoLiveEligible(creatorId: string): Promise<boolean> {
  const { db, evalRunsTable } = await import("@workspace/db");
  const { eq, and, desc } = await import("drizzle-orm");

  const latest = await db
    .select({ goLiveEligible: evalRunsTable.goLiveEligible })
    .from(evalRunsTable)
    .where(
      and(
        eq(evalRunsTable.creatorId, creatorId),
        eq(evalRunsTable.isRegressionRun, false),
      ),
    )
    .orderBy(desc(evalRunsTable.ranAt))
    .limit(1)
    .then((rows: Array<{ goLiveEligible: boolean }>) => rows[0] ?? null);

  return latest?.goLiveEligible === true;
}
