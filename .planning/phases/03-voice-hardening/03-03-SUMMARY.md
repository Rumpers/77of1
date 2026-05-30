---
phase: 03-voice-hardening
plan: 03-03
type: summary
status: complete
---

# MOD-07 Crescendo Cross-Turn Escalation Scorer — Summary

## What Was Implemented

### Task 1: `lib/twin-runtime/src/escalation.ts` + Tests

**`scoreEscalation()` pure function** (114 lines):
- Reads `MOD_07_THRESHOLD` (default 1.5), `MOD_07_HALF_LIFE` (default 3), `MOD_07_WINDOW_TURNS` (default 10) at call time for `vi.stubEnv()` testability
- NaN-safe: invalid env var strings fall back to defaults (T-03-03-05 mitigation)
- Queries last `WINDOW_TURNS - 1` rows from `safety_audit_log` filtered by `(creatorId, fanIdHash)`, ordered `createdAt DESC`
- Hash consistency: queries with `sha256(fanIdHash)` to match how `writeSafetyAuditLog` stores the field
- Recency weighting: `weight = 0.5 ^ (age / halfLife)`, age=0 is current turn
- Cumulates all category contributions; identifies `triggeringCategory` as highest-total category
- SLA warn-log when DB query exceeds 100ms (T-03-03-04)

**`__tests__/escalation.test.ts`** (11 tests):
- Empty history + low score → not flagged
- 9 borderline rows + current turn → flagged (Crescendo scenario, cumScore ≈ 1.75 > 1.5)
- NULL categoryScores → zero contribution, still counted in windowSize
- WINDOW_TURNS env override respected
- MOD_07_THRESHOLD lower/raise → correct flag/no-flag
- MOD_07_HALF_LIFE → faster decay reduces cumulative
- Invalid env var (NaN) falls back to 1.5 default
- Same fanIdHash, different creatorId → isolation (correct empty-result behavior)
- triggeringCategory identifies dominant category across window
- Empty currentTurnCategoryScores → cumulative=0

### Task 2: Moderation Pipeline + Consumer Wiring

**`lib/twin-runtime/src/safety-audit.ts`**:
- Added `retentionCategory?: "operational" | "transcript" | "audit" | "ephemeral_30d"` to `SafetyAuditEntry`
- `writeSafetyAuditLog` uses `entry.retentionCategory ?? "audit"` (backward-compatible)

**`lib/twin-runtime/src/moderation.ts`**:
- Added `categoryScores?: Record<string, number>` to `ModerationOutcome`
- Both `runL1Moderation` and `runL3Moderation` now return `categoryScores: mod.scores` in both flagged and non-flagged paths
- `writeSafetyAuditLog` calls in the flagged path now pass `categoryScores: mod.scores`
- New export `writeNonFlaggedScores()`: writes per-turn `ephemeral_30d` snapshot to `safety_audit_log` with `crisisLevel="none"` so the scorer accumulates cross-turn signal

**`artifacts/api-server/src/routes/twin.ts`** (web path):
- Insertion point: after L1 returns non-flagged, before LLM call
- Calls `writeNonFlaggedScores(...)` (per-turn snapshot)
- Calls `scoreEscalation(...)` with `currentTurnCategoryScores: l1Scores`
- On `escResult.flagged`: writes `crisisType="escalation_detected"` audit row, calls `notifyFounderAsync`, sends helpline+deflection, returns without LLM

**`artifacts/worker/src/workers/text-generation.ts`** (Telegram path):
- Same insertion point and logic as web path
- Reuses `sendFlaggedReplyToTelegram()` for Telegram-formatted helpline+deflection delivery

## Verification

| Check | Result |
|-------|--------|
| `export async function scoreEscalation` exists | ✓ 1 match |
| `scoreEscalation` re-exported in `index.ts` | ✓ 1 match |
| MOD_07_* env vars in `escalation.ts` | ✓ 3+ matches |
| `categoryScores` in moderation.ts writeSafetyAuditLog calls | ✓ 5 matches (L1+L3 flagged, L1+L3 non-flagged return, writeNonFlaggedScores) |
| `scoreEscalation` in `routes/twin.ts` | ✓ 1 match |
| `scoreEscalation` in `text-generation.ts` | ✓ 1 match |
| `escalation_detected` in both consumer paths | ✓ 2 matches |
| `writeNonFlaggedScores` exported from moderation.ts | ✓ 1 match |
| `ephemeral_30d` in moderation.ts | ✓ 1 match |
| `pnpm --filter @workspace/twin-runtime run typecheck` | ✓ exit 0 |
| `pnpm --filter @workspace/api-server run typecheck` | ✓ exit 0 |
| `pnpm --filter @workspace/worker run typecheck` | ✓ exit 0 |
| Escalation tests (11 cases) | ✓ 11/11 pass |

## Commit

`031e99c` on `rio-de-janeiro` — feat(moderation): MOD-07 Crescendo cross-turn escalation scorer
