// [HID-013] Data-deletion verification tooling — OF-227
// POST /api/admin/deletions/[id]/verify
// Runs spot-checks across all cascade tables for the given deletion request.
// Records result in deletion_requests.verification_result + admin audit log.
// Accessible to: ops + engineering staff roles.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb, getMainPool, deletionRequestsTable, type CheckResult, type VerificationResult } from '@/lib/db';
import { AuditClient } from '@7of1/admin-sdk';
import { eq } from 'drizzle-orm';
import type pg from 'pg';

const ALLOWED_ROLES = ['ops', 'engineering'] as const;

async function sqlCount(pool: pg.Pool, query: string, params: unknown[]): Promise<number> {
  const result = await pool.query<{ count: number }>(query, params);
  return result.rows[0]?.count ?? 0;
}

async function runCreatorChecks(pool: pg.Pool, creatorId: string): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];

  const creatorCount = await sqlCount(
    pool,
    'SELECT COUNT(*)::int AS count FROM creators WHERE id = $1',
    [creatorId],
  );
  checks.push({
    table: 'creators',
    description: 'Creator profile row',
    found_rows: creatorCount,
    status: creatorCount === 0 ? 'clear' : 'residual',
  });

  const assetCount = await sqlCount(
    pool,
    'SELECT COUNT(*)::int AS count FROM creator_assets WHERE creator_id = $1',
    [creatorId],
  );
  checks.push({
    table: 'creator_assets',
    description: 'Creator assets (photos, videos, audio)',
    found_rows: assetCount,
    status: assetCount === 0 ? 'clear' : 'residual',
  });

  const totalConsent = await sqlCount(
    pool,
    'SELECT COUNT(*)::int AS count FROM consent_grants WHERE creator_id = $1',
    [creatorId],
  );
  const activeConsent = await sqlCount(
    pool,
    'SELECT COUNT(*)::int AS count FROM consent_grants WHERE creator_id = $1 AND revoked_at IS NULL',
    [creatorId],
  );
  checks.push({
    table: 'consent_grants',
    description: 'Consent grant records (§8.3: revoked records retained)',
    found_rows: totalConsent,
    status: activeConsent === 0 ? 'retained_per_policy' : 'residual',
    note:
      activeConsent > 0
        ? `${activeConsent} active (non-revoked) grants remain — expected 0 after deletion`
        : `${totalConsent} revocation records retained per §8.3 audit requirement`,
  });

  const jobCount = await sqlCount(
    pool,
    'SELECT COUNT(*)::int AS count FROM generation_jobs WHERE creator_id = $1',
    [creatorId],
  );
  checks.push({
    table: 'generation_jobs',
    description: 'Generation job records',
    found_rows: jobCount,
    status: jobCount === 0 ? 'clear' : 'residual',
  });

  const fanCount = await sqlCount(
    pool,
    'SELECT COUNT(*)::int AS count FROM fans WHERE creator_id = $1',
    [creatorId],
  );
  checks.push({
    table: 'fans',
    description: 'Fan accounts under this creator',
    found_rows: fanCount,
    status: fanCount === 0 ? 'clear' : 'residual',
  });

  const usageCount = await sqlCount(
    pool,
    'SELECT COUNT(*)::int AS count FROM usage_counters WHERE creator_id = $1',
    [creatorId],
  );
  checks.push({
    table: 'usage_counters',
    description: 'Usage counter rows',
    found_rows: usageCount,
    status: usageCount === 0 ? 'clear' : 'residual',
  });

  return checks;
}

async function runFanChecks(pool: pg.Pool, fanIds: string[]): Promise<CheckResult[]> {
  if (fanIds.length === 0) {
    return [
      {
        table: '(all fan tables)',
        description: 'No fan entity IDs recorded',
        found_rows: 0,
        status: 'not_applicable',
        note: 'entity_ids was empty — cannot verify',
      },
    ];
  }

  const checks: CheckResult[] = [];

  const fanCount = await sqlCount(
    pool,
    'SELECT COUNT(*)::int AS count FROM fans WHERE id = ANY($1)',
    [fanIds],
  );
  checks.push({
    table: 'fans',
    description: 'Fan profile rows',
    found_rows: fanCount,
    status: fanCount === 0 ? 'clear' : 'residual',
  });

  const subCount = await sqlCount(
    pool,
    'SELECT COUNT(*)::int AS count FROM fan_subscriptions WHERE fan_id = ANY($1)',
    [fanIds],
  );
  checks.push({
    table: 'fan_subscriptions',
    description: 'Active fan subscriptions',
    found_rows: subCount,
    status: subCount === 0 ? 'clear' : 'residual',
  });

  const creditCount = await sqlCount(
    pool,
    'SELECT COUNT(*)::int AS count FROM fan_credits WHERE fan_id = ANY($1)',
    [fanIds],
  );
  checks.push({
    table: 'fan_credits',
    description: 'Fan credit balance rows',
    found_rows: creditCount,
    status: creditCount === 0 ? 'clear' : 'residual',
  });

  const usageCount = await sqlCount(
    pool,
    'SELECT COUNT(*)::int AS count FROM usage_counters WHERE fan_id = ANY($1)',
    [fanIds],
  );
  checks.push({
    table: 'usage_counters',
    description: 'Usage counter rows for fan',
    found_rows: usageCount,
    status: usageCount === 0 ? 'clear' : 'residual',
  });

  const txCount = await sqlCount(
    pool,
    'SELECT COUNT(*)::int AS count FROM credit_transactions WHERE fan_id = ANY($1)',
    [fanIds],
  );
  checks.push({
    table: 'credit_transactions',
    description: 'Credit transaction ledger (financial records retained)',
    found_rows: txCount,
    status: 'retained_per_policy',
    note: 'Financial transaction records retained per accounting requirements',
  });

  return checks;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(session.user.role as (typeof ALLOWED_ROLES)[number])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const deletionId = params.id;

  let db: ReturnType<typeof getDb>;
  let pool: pg.Pool;
  try {
    db = getDb();
    pool = getMainPool();
  } catch {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  let deletion: typeof deletionRequestsTable.$inferSelect | undefined;
  try {
    [deletion] = await db
      .select()
      .from(deletionRequestsTable)
      .where(eq(deletionRequestsTable.id, deletionId))
      .limit(1);
  } catch (fetchErr) {
    console.error('[admin/deletions/verify] fetch error', fetchErr);
    return NextResponse.json({ error: 'Failed to fetch deletion request' }, { status: 500 });
  }

  if (!deletion) {
    return NextResponse.json({ error: 'Deletion request not found' }, { status: 404 });
  }

  if (deletion.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot verify a cancelled request' }, { status: 409 });
  }

  const entityIds: string[] = Array.isArray(deletion.entityIds) ? deletion.entityIds : [];
  const checks: CheckResult[] =
    deletion.accountType === 'creator'
      ? await runCreatorChecks(pool, entityIds[0] ?? '')
      : await runFanChecks(pool, entityIds);

  const hasResidual = checks.some((c) => c.status === 'residual');
  const overall: VerificationResult['overall'] = hasResidual
    ? checks.every((c) => c.status !== 'clear' && c.status !== 'retained_per_policy')
      ? 'failed'
      : 'partial'
    : 'verified';

  const verificationResult: VerificationResult = {
    checked_at: new Date().toISOString(),
    checked_by: session.user.id,
    checks,
    overall,
  };

  const newStatus =
    overall === 'verified' && deletion.status !== 'complete' ? 'complete' : deletion.status;
  const now = new Date();

  try {
    await db
      .update(deletionRequestsTable)
      .set({
        verificationResult,
        verifiedBy: session.user.id,
        verifiedAt: now,
        status: newStatus,
        cascadeCompleteAt: overall === 'verified' ? now : undefined,
        updatedAt: now,
      })
      .where(eq(deletionRequestsTable.id, deletionId));
  } catch (updateErr) {
    console.error('[admin/deletions/verify] update error', updateErr);
    return NextResponse.json({ error: 'Failed to save verification result' }, { status: 500 });
  }

  try {
    const auditClient = new AuditClient({
      connectionString: process.env.ADMIN_DATABASE_URL!,
      signingSecret: process.env.AUDIT_SIGNING_SECRET!,
    });
    await auditClient.insert({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: 'DELETION_VERIFY',
      resourceType: 'deletion_request',
      resourceId: deletionId,
      metadata: {
        account_type: deletion.accountType,
        overall,
        residual_tables: checks
          .filter((c) => c.status === 'residual')
          .map((c) => c.table),
      },
    });
  } catch (auditErr) {
    console.error('[admin/deletions/verify] audit log error', auditErr);
  }

  return NextResponse.json({ id: deletionId, overall, checks, new_status: newStatus });
}
