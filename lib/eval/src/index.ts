// lib/eval/src/index.ts
// Main entry point for @workspace/eval.

export type {
  EvalCategory,
  EvalCase,
  EvalCriterion,
  EvalGrade,
  EvalCaseResult,
  EvalReport,
} from "./types.js";

export { ALL_CASES } from "./cases/index.js";
export { gradeCase } from "./grader.js";
export { runEval } from "./runner.js";
export { isGoLiveEligible } from "./live-gate.js";
