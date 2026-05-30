---
quick_id: 20260530-claire-persona-direction
phase: quick
plan: 20260530-claire-persona-direction
subsystem: db, twin-runtime, api-server, worker, scripts
tags: [persona, system-prompt, seed, claire, direction]
dependency_graph:
  requires: []
  provides: [twins.direction, buildSystemPrompt direction param, claire persona, seed script]
  affects: [lib/db, lib/twin-runtime, artifacts/api-server, artifacts/worker, scripts]
tech_stack:
  added: []
  patterns: [lazy DB import (PATTERNS S1), Character Card V2, optional param backward compat]
key_files:
  created:
    - lib/db/src/migrations/015_twins_direction.sql
    - lib/twin-runtime/src/__tests__/system-prompt.test.ts
    - scripts/personas/claire.json
    - scripts/src/seed-claire.ts
  modified:
    - lib/db/src/schema/index.ts
    - lib/twin-runtime/src/system-prompt.ts
    - artifacts/api-server/src/routes/twin.ts
    - artifacts/api-server/src/__tests__/twin-chat.e2e.test.ts
    - artifacts/worker/src/workers/text-generation.ts
    - scripts/package.json
decisions:
  - direction param is optional (5th arg) in buildSystemPrompt — existing callers unchanged
  - Seed script is idempotent by handle — safe to re-run
  - claire.json marked PLACEHOLDER in creator_notes — must iterate before live
metrics:
  duration: ~25 minutes
  completed: 2026-05-30T06:59:00Z
  tasks: 3
  files: 10
---

# Quick Task: twin `direction` steering field + placeholder Claire persona & seed

One-liner: nullable `twins.direction` column wired into `buildSystemPrompt` as a founder steering lever; placeholder Claire Character Card V2 + idempotent seed script.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | twins.direction column + migration 015 | 0d92b29 | lib/db/src/schema/index.ts, lib/db/src/migrations/015_twins_direction.sql |
| 2 | inject direction into system prompt + callers + tests | b74dbe8 | lib/twin-runtime/src/system-prompt.ts, system-prompt.test.ts, routes/twin.ts, twin-chat.e2e.test.ts, text-generation.ts |
| 3 | placeholder Claire persona JSON + seed script | 9f2f9fc | scripts/personas/claire.json, scripts/src/seed-claire.ts, scripts/package.json, pnpm-lock.yaml |

## Verification

### Typechecks (affected packages)
- pnpm run typecheck:libs — PASS (db + twin-runtime)
- pnpm --filter @workspace/api-server run typecheck — PASS
- pnpm --filter @workspace/worker run typecheck — PASS
- pnpm --filter @workspace/scripts run typecheck — PASS
- Full workspace: 26 pre-existing errors in artifacts/web (fan-dsar.tsx i18n keys) — NOT introduced by this task

### Tests
- pnpm --filter @workspace/twin-runtime run test — 30 passed (system-prompt.test.ts: 7 new assertions GREEN)
- pnpm --filter @workspace/api-server exec vitest run src/__tests__/twin-chat.e2e.test.ts — 16 passed

### Character Card V2 field lengths (all within Zod max limits)
- description: 371 / 4000 chars
- personality: 359 / 2000 chars
- scenario: 291 / 2000 chars
- first_mes: 110 / 2000 chars
- mes_example: 521 / 4000 chars
- post_history_instructions: 874 / 2000 chars

## Deploy Steps (requires DATABASE_URL)

```bash
# Apply schema migration
pnpm --filter @workspace/db run push

# Seed Claire
pnpm tsx scripts/src/seed-claire.ts

# Set env from output and run eval
export EVAL_CREATOR_ID=<printed id>
pnpm --filter @workspace/eval run eval

# Activate after eval passes
# POST /api/admin/twin/:creatorId/activate
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

scripts/personas/claire.json creator_notes field explicitly marks this PLACEHOLDER. The persona is functional (passes eval hard-limit + injection categories) but the description/personality content should be replaced after first eval run with Claire real text samples. character_version: "0.1-placeholder" tracks this. Intentional per plan.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes at trust boundaries. The direction column is creator-authored text injected at the same trust level as the Character Card.

## Self-Check: PASSED

- lib/db/src/schema/index.ts modified (direction column added) — FOUND
- lib/db/src/migrations/015_twins_direction.sql created — FOUND
- lib/twin-runtime/src/system-prompt.ts modified (direction param) — FOUND
- lib/twin-runtime/src/__tests__/system-prompt.test.ts created — FOUND
- artifacts/api-server/src/routes/twin.ts modified — FOUND
- artifacts/api-server/src/__tests__/twin-chat.e2e.test.ts modified — FOUND
- artifacts/worker/src/workers/text-generation.ts modified — FOUND
- scripts/personas/claire.json created — FOUND
- scripts/src/seed-claire.ts created — FOUND
- Commits 0d92b29, b74dbe8, 9f2f9fc verified in git log — FOUND
