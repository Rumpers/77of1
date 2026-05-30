// lib/eval/src/index.ts
// Main entry point for @workspace/eval.
// runner.ts will be added in 04-02.

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
