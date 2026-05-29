// [HID-013] Data-deletion verification tooling — OF-227
// POST /api/admin/deletions/[id]/verify
// Runs spot-checks across all cascade tables for the given deletion request.
// Records result in deletion_requests.verification_result + admin audit log.
// Accessible to: ops + engineering staff roles.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { AuditClient } from '@7of1/admin-sdk';

const ALLOWED_ROLES = ['ops', 'engineering'] as const;

interface CheckResult {
  table: string;
  description: string;
  found_rows: number;
  status: 'clear' | 'residual' | 'retained_per_policy' | 'not_applicable';
  note?: string;
}

interface DeletionRow {
  id: string;
  auth_user_id: string;
  account_type: 'fan' | 'creator';
  entity_ids: string[];
  status: string;
}

async function runCreatorChecks(
  db: ReturnType<typeof getAdminSupabase>,
  creatorId: string,
): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];

  // creators row — should be gone after cascade
  const { count: creatorCount } = await db
    .from('creators')
    .select('id', { count: 'exact', head: true })
    .eq('id', creatorId);
  checks.push({
    table: 'creators',
    description: 'Creator profile row',
    found_rows: creatorCount ?? 0,
    status: (creatorCount ?? 0) === 0 ? 'clear' : 'residual',
  });

  // creator_assets — should be gone (ON DELETE CASCADE from creators)
  const { count: assetCount } = await db
    .from('creator_assets')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', creatorId);
  checks.push({
    table: 'creator_assets',
    description: 'Creator assets (photos, videos, audio)',
    found_rows: assetCount ?? 0,
    status: (assetCount ?? 0) === 0 ? 'clear' : 'residual',
  });

  // consent_grants — §8.3 requires retention of revocation records.
  // All remaining rows must have revoked_at set (not active grants).
  const { count: totalConsent } = await db
    .from('consent_grants')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', creatorId);
  const { count: activeConsent } = await db
    .from('consent_grants')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', creatorId)
    .is('revoked_at', null);
  checks.push({
    table: 'consent_grants',
    description: 'Consent grant records (§8.3: revoked records retained)',
    found_rows: totalConsent ?? 0,
    status:
      (activeConsent ?? 0) === 0
        ? 'retained_per_policy'
        : 'residual',
    note:
      (activeConsent ?? 0) > 0
        ? `${activeConsent} active (non-revoked) grants remain — expected 0 after deletion`
        : `${totalConsent ?? 0} revocation records retained per §8.3 audit requirement`,
  });

  // generation_jobs — should be gone (cascade or anonymized)
  const { count: jobCount } = await db
    .from('generation_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', creatorId);
  checks.push({
    table: 'generation_jobs',
    description: 'Generation job records',
    found_rows: jobCount ?? 0,
    status: (jobCount ?? 0) === 0 ? 'clear' : 'residual',
  });

  // fans belonging to this creator — should be gone (cascade)
  const { count: fanCount } = await db
    .from('fans')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', creatorId);
  checks.push({
    table: 'fans',
    description: 'Fan accounts under this creator',
    found_rows: fanCount ?? 0,
    status: (fanCount ?? 0) === 0 ? 'clear' : 'residual',
  });

  // usage_counters — should be gone (cascade)
  const { count: usageCount } = await db
    .from('usage_counters')
    .select('creator_id', { count: 'exact', head: true })
    .eq('creator_id', creatorId);
  checks.push({
    table: 'usage_counters',
    description: 'Usage counter rows',
    found_rows: usageCount ?? 0,
    status: (usageCount ?? 0) === 0 ? 'clear' : 'residual',
  });

  return checks;
}

async function runFanChecks(
  db: ReturnType<typeof getAdminSupabase>,
  fanIds: string[],
): Promise<CheckResult[]> {
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

  const { count: fanCount } = await db
    .from('fans')
    .select('id', { count: 'exact', head: true })
    .in('id', fanIds);
  checks.push({
    table: 'fans',
    description: 'Fan profile rows',
    found_rows: fanCount ?? 0,
    status: (fanCount ?? 0) === 0 ? 'clear' : 'residual',
  });

  const { count: subCount } = await db
    .from('fan_subscriptions')
    .select('id', { count: 'exact', head: true })
    .in('fan_id', fanIds);
  checks.push({
    table: 'fan_subscriptions',
    description: 'Active fan subscriptions',
    found_rows: subCount ?? 0,
    status: (subCount ?? 0) === 0 ? 'clear' : 'residual',
  });

  const { count: creditCount } = await db
    .from('fan_credits')
    .select('fan_id', { count: 'exact', head: true })
    .in('fan_id', fanIds);
  checks.push({
    table: 'fan_credits',
    description: 'Fan credit balance rows',
    found_rows: creditCount ?? 0,
    status: (creditCount ?? 0) === 0 ? 'clear' : 'residual',
  });

  const { count: usageCount } = await db
    .from('usage_counters')
    .select('fan_id', { count: 'exact', head: true })
    .in('fan_id', fanIds);
  checks.push({
    table: 'usage_counters',
    description: 'Usage counter rows for fan',
    found_rows: usageCount ?? 0,
    status: (usageCount ?? 0) === 0 ? 'clear' : 'residual',
  });

  // credit_transactions are financial records — retained for accounting.
  const { count: txCount } = await db
    .from('credit_transactions')
    .select('id', { count: 'exact', head: true })
    .in('fan_id', fanIds);
  checks.push({
    table: 'credit_transactions',
    description: 'Credit transaction ledger (financial records retained)',
    found_rows: txCount ?? 0,
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

  let db: ReturnType<typeof getAdminSupabase>;
  try {
    db = getAdminSupabase();
  } catch {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { data: deletion, error: fetchErr } = await db
    .from('deletion_requests')
    .select('id, auth_user_id, account_type, entity_ids, status')
    .eq('id', deletionId)
    .maybeSingle();

  if (fetchErr || !deletion) {
    return NextResponse.json({ error: 'Deletion request not found' }, { status: 404 });
  }

  const row = deletion as DeletionRow;

  if (row.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot verify a cancelled request' }, { status: 409 });
  }

  // Run appropriate checks based on account type
  const entityIds: string[] = Array.isArray(row.entity_ids) ? row.entity_ids : [];
  const checks: CheckResult[] =
    row.account_type === 'creator'
      ? await runCreatorChecks(db, entityIds[0] ?? '')
      : await runFanChecks(db, entityIds);

  const hasResidual = checks.some((c) => c.status === 'residual');
  const overall: 'verified' | 'failed' | 'partial' = hasResidual
    ? checks.every((c) => c.status !== 'clear' && c.status !== 'retained_per_policy')
      ? 'failed'
      : 'partial'
    : 'verified';

  const verificationResult = {
    checked_at: new Date().toISOString(),
    checked_by: session.user.id,
    checks,
    overall,
  };

  // Write verification result back to deletion_requests
  const newStatus =
    overall === 'verified' && row.status !== 'complete' ? 'complete' : row.status;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = db as any;
  const { error: updateErr } = await dbAny
    .from('deletion_requests')
    .update({
      verification_result: verificationResult,
      verified_by: session.user.id,
      verified_at: new Date().toISOString(),
      status: newStatus,
      cascade_complete_at: overall === 'verified' ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', deletionId);

  if (updateErr) {
    console.error('[admin/deletions/verify] update error', updateErr);
    return NextResponse.json({ error: 'Failed to save verification result' }, { status: 500 });
  }

  // Write audit log entry
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
        account_type: row.account_type,
        overall,
        residual_tables: checks
          .filter((c) => c.status === 'residual')
          .map((c) => c.table),
      },
    });
  } catch (auditErr) {
    // Log but don't fail — verification result is already saved
    console.error('[admin/deletions/verify] audit log error', auditErr);
  }

  return NextResponse.json({ id: deletionId, overall, checks, new_status: newStatus });
}
