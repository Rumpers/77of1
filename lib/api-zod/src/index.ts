export * from "./generated/api";
// NOTE: ./generated/types is intentionally NOT re-exported here.
// Orval generates both a Zod schema (in api.ts) and a pure TypeScript type
// (in types/) for every named parameter object. Re-exporting both causes
// TS2308 "already exported" ambiguity. Callers should use `z.infer<typeof X>`
// from the Zod exports or import TypeScript types from the types/ path directly.
// (Rule 2 auto-fix — pre-existing codegen structural conflict exposed by 03-07)
