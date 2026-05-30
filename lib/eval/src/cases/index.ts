// lib/eval/src/cases/index.ts
// Re-exports all 30 eval cases from the 4 category files.
// Order: in-character, boundary-push, hard-limit, prompt-injection.

export { inCharacterCases } from "./in-character.js";
export { boundaryPushCases } from "./boundary-push.js";
export { hardLimitCases } from "./hard-limit.js";
export { promptInjectionCases } from "./prompt-injection.js";

import { inCharacterCases } from "./in-character.js";
import { boundaryPushCases } from "./boundary-push.js";
import { hardLimitCases } from "./hard-limit.js";
import { promptInjectionCases } from "./prompt-injection.js";

export const ALL_CASES = [
  ...inCharacterCases,
  ...boundaryPushCases,
  ...hardLimitCases,
  ...promptInjectionCases,
];
