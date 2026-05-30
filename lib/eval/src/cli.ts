// lib/eval/src/cli.ts
// EVAL-01 / plan 04-02 — eval CLI entry point.
// Usage: pnpm --filter @workspace/eval run eval
//
// Reads EVAL_CREATOR_ID from env, validates it is a valid UUID (ASVS V5),
// calls runEval(creatorId), prints the EvalReport as formatted JSON + a
// per-category summary to stdout, and exits:
//   0 — goLiveEligible (passed 100% hard-limit and 100% injection)
//   1 — not yet eligible (failures exist)

import { runEval } from "./runner.js";
import type { EvalReport } from "./types.js";

// UUID v4 pattern (also accepts any UUID format used by Postgres gen_random_uuid())
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUuid(value: string | undefined, name: string): string {
  if (!value || value.trim().length === 0) {
    console.error(`[eval-cli] ERROR: ${name} is not set. Export it as an environment variable.`);
    process.exit(1);
  }
  const trimmed = value.trim();
  if (!UUID_RE.test(trimmed)) {
    console.error(
      `[eval-cli] ERROR: ${name}="${trimmed}" is not a valid UUID. ` +
      "Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    );
    process.exit(1);
  }
  return trimmed;
}

function printSummary(report: EvalReport): void {
  console.log("\n=== Eval Report ===");
  console.log(`Run ID:         ${report.runId}`);
  console.log(`Creator:        ${report.creatorId}`);
  console.log(`Ran at:         ${report.ranAt.toISOString()}`);
  console.log(`Total cases:    ${report.totalCases}`);
  console.log(`Total passed:   ${report.totalPassed}`);
  console.log(`Total failed:   ${report.totalFailed}`);
  console.log("");
  console.log("Per-category results:");
  for (const [cat, counts] of Object.entries(report.byCategory)) {
    const pct = counts.total > 0 ? Math.round((counts.passed / counts.total) * 100) : 0;
    const icon = counts.passed === counts.total ? "PASS" : "FAIL";
    console.log(`  ${icon}  ${cat.padEnd(20)} ${counts.passed}/${counts.total} (${pct}%)`);
  }
  console.log("");
  console.log(`Hard-limit 100%:   ${report.passedHardLimit100}`);
  console.log(`Injection 100%:    ${report.passedInjection100}`);
  console.log(`Go-live eligible:  ${report.goLiveEligible}`);

  if (report.failedCases.length > 0) {
    console.log("\nFailed cases:");
    for (const f of report.failedCases) {
      console.log(`  [${f.caseId}] ${f.reason.slice(0, 200)}`);
    }
  }

  console.log("\n=== Full Report JSON ===");
  console.log(JSON.stringify(report, null, 2));
}

async function main(): Promise<void> {
  const creatorId = validateUuid(process.env["EVAL_CREATOR_ID"], "EVAL_CREATOR_ID");

  console.log(`[eval-cli] Starting eval for creator ${creatorId}...`);

  let report: EvalReport;
  try {
    report = await runEval(creatorId);
  } catch (err) {
    console.error("[eval-cli] FATAL: runEval threw an error:", (err as Error).message);
    if ((err as Error).stack) console.error((err as Error).stack);
    process.exit(1);
  }

  printSummary(report);

  if (report.goLiveEligible) {
    console.log("\n[eval-cli] RESULT: GO-LIVE ELIGIBLE — exiting 0");
    process.exit(0);
  } else {
    console.log("\n[eval-cli] RESULT: NOT YET ELIGIBLE — exiting 1");
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("[eval-cli] Unhandled error:", err);
  process.exit(1);
});
