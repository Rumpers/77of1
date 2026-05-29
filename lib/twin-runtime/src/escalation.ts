// MOD-07: Crescendo cross-turn escalation scorer (arXiv:2404.01833 §6.2).
//
// Detects gradual-escalation jailbreaks by accumulating recency-weighted
// category_scores from the last N safety_audit_log rows for a given
// (creatorId, fanIdHash) pair. When the cumulative score crosses
// MOD_07_THRESHOLD, the current turn should be treated as L1-flagged.
//
// Constants are read at CALL TIME (not module load) so tests can override
// via vi.stubEnv() without module reload cycles.

import { createHash } from "crypto";
import { db, safetyAuditLogTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

export interface EscalationResult {
  flagged: boolean;
  cumulativeScore: number;
  windowSize: number;
  triggeringCategory?: string;
}

/**
 * Compute a recency-weighted cumulative category score across the last N
 * turns for a given fan+creator pair. Returns `flagged=true` when the
 * cumulative score crosses MOD_07_THRESHOLD.
 *
 * DB query: reads `category_scores` from `safety_audit_log` ordered by
 * `created_at DESC`, limited to `MOD_07_WINDOW_TURNS - 1` rows (the current
 * turn's scores are supplied via `currentTurnCategoryScores`).
 *
 * Weight decay: `weight = 0.5 ** (age / halfLife)` where age=0 is the
 * current turn and halfLife defaults to MOD_07_HALF_LIFE (default 3 turns).
 */
export async function scoreEscalation(args: {
  creatorId: string;
  fanIdHash: string;
  currentTurnCategoryScores: Record<string, number>;
}): Promise<EscalationResult> {
  const startTime = Date.now();

  // Read env vars at call time — vi.stubEnv() can override between tests.
  const rawThreshold = parseFloat(process.env.MOD_07_THRESHOLD ?? "1.5");
  const rawHalfLife = parseFloat(process.env.MOD_07_HALF_LIFE ?? "3");
  const rawWindowTurns = parseInt(process.env.MOD_07_WINDOW_TURNS ?? "10", 10);

  // Clamp NaN to defaults (T-03-03-05: invalid env var should not silently disable scorer).
  const threshold = isNaN(rawThreshold) ? 1.5 : rawThreshold;
  const halfLife = isNaN(rawHalfLife) ? 3 : rawHalfLife;
  const windowTurns = isNaN(rawWindowTurns) ? 10 : rawWindowTurns;

  // safety_audit_log stores sha256(fanIdHash) — writeSafetyAuditLog hashes
  // the `fanId` field it receives (which callers set to fanIdHash).
  const storedFanIdHash = createHash("sha256")
    .update(args.fanIdHash, "utf8")
    .digest("hex");

  const recentRows = await db
    .select({ categoryScores: safetyAuditLogTable.categoryScores })
    .from(safetyAuditLogTable)
    .where(
      and(
        eq(safetyAuditLogTable.creatorId, args.creatorId),
        eq(safetyAuditLogTable.fanIdHash, storedFanIdHash),
      ),
    )
    .orderBy(desc(safetyAuditLogTable.createdAt))
    .limit(windowTurns - 1);

  // Build turn sequence: [currentTurn(age=0), ...recentRows(age=1..n)]
  const turns: Array<Record<string, number>> = [
    args.currentTurnCategoryScores,
    ...recentRows.map(
      (r) => (r.categoryScores as Record<string, number> | null) ?? {},
    ),
  ];

  // Accumulate recency-weighted scores across all categories in all turns.
  let cumulative = 0;
  const categoryTotals: Record<string, number> = {};

  for (let age = 0; age < turns.length; age++) {
    const weight = Math.pow(0.5, age / halfLife);
    const scores = turns[age];
    for (const [category, score] of Object.entries(scores)) {
      const contribution = (score as number) * weight;
      cumulative += contribution;
      categoryTotals[category] = (categoryTotals[category] ?? 0) + contribution;
    }
  }

  // The category with the highest weighted total drove the escalation.
  let triggeringCategory: string | undefined;
  let topContribution = 0;
  for (const [cat, total] of Object.entries(categoryTotals)) {
    if (total > topContribution) {
      topContribution = total;
      triggeringCategory = cat;
    }
  }

  const latencyMs = Date.now() - startTime;
  if (latencyMs > 100) {
    console.warn(
      `[escalation] scoreEscalation latencyMs=${latencyMs} — exceeds 100ms SLA (creatorId=${args.creatorId})`,
    );
  }

  return {
    flagged: cumulative >= threshold,
    cumulativeScore: cumulative,
    windowSize: turns.length,
    triggeringCategory,
  };
}
