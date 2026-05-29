// Re-export shim — moved to @workspace/twin-runtime in plan 02-06a.
//
// Rule 3 (blocking) deviation: `constitution.ts` and `moderation.ts` (both
// moved) import this logger, so it had to travel with them into the shared
// package. api-server's existing import surface is preserved.
export * from "@workspace/twin-runtime/logger";
