// Atomic credit deduction for fan interactions (CHAT-02, D-02-10).
//
// Two modes:
//   trial:  anonymous fan identified by conversation cookie; no DB row.
//           downstream sets/increments TRIAL_COOKIE; rejects at TRIAL_LIMIT.
//   paid:   authenticated fan (fanId set by requireFanAccess); deducts one
//           credit from the oldest non-empty pack atomically.
//
// Credits invariant: balance NEVER goes negative. The UPDATE targets a single
// pack row via subquery; the WHERE credits_remaining > 0 guard is atomic under
// Postgres default read-committed isolation — no separate SELECT needed.

import { logger } from "./logger.js";

export const TRIAL_LIMIT = 10;

// Lazy DB import (PATTERNS S1) — tests run without DATABASE_URL.
async function getDb() {
  const { db, creditPacksTable } = await import("@workspace/db");
  const { eq, and, gt, sql } = await import("drizzle-orm");
  return { db, creditPacksTable, eq, and, gt, sql };
}

export interface DeductResult {
  allowed: boolean;
  creditsRemaining: number | null;
}

// atomicDeductCredit — deducts 1 credit from the fan's oldest non-empty pack.
// Single UPDATE statement — no separate SELECT, no TOCTOU gap.
// Returns { allowed: false } when the fan has no credits remaining.
export async function atomicDeductCredit(fanId: string): Promise<DeductResult> {
  const { db, creditPacksTable, eq, and, gt, sql } = await getDb();

  const rows = await db
    .update(creditPacksTable)
    .set({ creditsRemaining: sql`${creditPacksTable.creditsRemaining} - 1` })
    .where(
      and(
        eq(
          creditPacksTable.id,
          // oldest pack for this fan that still has credits
          sql`(SELECT id FROM credit_packs WHERE fan_id = ${fanId}::uuid AND credits_remaining > 0 ORDER BY purchased_at ASC LIMIT 1)`,
        ),
        gt(creditPacksTable.creditsRemaining, 0),
      ),
    )
    .returning({ creditsRemaining: creditPacksTable.creditsRemaining });

  if (rows.length === 0) {
    logger.info(
      { event: "credits.exhausted", fanId },
      "[credits] fan has no credits remaining",
    );
    return { allowed: false, creditsRemaining: 0 };
  }

  const remaining = rows[0]!.creditsRemaining;
  logger.info(
    { event: "credits.deducted", fanId, remaining },
    "[credits] credit deducted",
  );
  return { allowed: true, creditsRemaining: remaining };
}

// totalCreditsRemaining — sum of credits_remaining across all packs for a fan.
// Used by balance-check endpoints (non-atomic; for display only, not gates).
export async function totalCreditsRemaining(fanId: string): Promise<number> {
  const { db, creditPacksTable, eq, sql } = await getDb();

  const rows = await db
    .select({ total: sql<number>`COALESCE(SUM(${creditPacksTable.creditsRemaining}), 0)` })
    .from(creditPacksTable)
    .where(eq(creditPacksTable.fanId, fanId));

  return Number((rows[0] as { total: number | null } | undefined)?.total ?? 0);
}
