// [HID-013] Data-deletion verification tooling — OF-227
// GET /api/admin/deletions — list deletion requests with SLA status
// Accessible to: ops + engineering staff roles.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb, deletionRequestsTable } from '@/lib/db';
import { eq, ne, count, asc } from 'drizzle-orm';

const ALLOWED_ROLES = ['ops', 'engineering'] as const;

type SlaStatus = 'on_track' | 'at_risk' | 'overdue' | 'complete' | 'cancelled';

function deriveSlaStatus(row: {
  status: string;
  slaDeadlineAt: Date | null;
  cascadeCompleteAt: Date | null;
  verifiedAt: Date | null;
}): SlaStatus {
  if (row.status === 'cancelled') return 'cancelled';
  if (row.status === 'complete') return 'complete';

  const now = new Date();
  const deadline = row.slaDeadlineAt;
  if (!deadline) return 'on_track';

  const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (now > deadline) return 'overdue';
  if (hoursRemaining <= 12) return 'at_risk';
  return 'on_track';
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(session.user.role as (typeof ALLOWED_ROLES)[number])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = 50;
  const offset = (page - 1) * limit;

  const statusFilter = url.searchParams.get('status');

  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const whereClause = statusFilter
    ? eq(deletionRequestsTable.status, statusFilter)
    : ne(deletionRequestsTable.status, 'cancelled');

  const [countResult] = await db
    .select({ total: count() })
    .from(deletionRequestsTable)
    .where(whereClause);

  const rows = await db
    .select({
      id: deletionRequestsTable.id,
      auth_user_id: deletionRequestsTable.authUserId,
      account_type: deletionRequestsTable.accountType,
      entity_ids: deletionRequestsTable.entityIds,
      status: deletionRequestsTable.status,
      requested_at: deletionRequestsTable.requestedAt,
      grace_period_expires_at: deletionRequestsTable.gracePeriodExpiresAt,
      sla_deadline_at: deletionRequestsTable.slaDeadlineAt,
      cascade_started_at: deletionRequestsTable.cascadeStartedAt,
      cascade_complete_at: deletionRequestsTable.cascadeCompleteAt,
      deletion_reference: deletionRequestsTable.deletionReference,
      verified_by: deletionRequestsTable.verifiedBy,
      verified_at: deletionRequestsTable.verifiedAt,
      verification_result: deletionRequestsTable.verificationResult,
      notes: deletionRequestsTable.notes,
    })
    .from(deletionRequestsTable)
    .where(whereClause)
    .orderBy(asc(deletionRequestsTable.slaDeadlineAt))
    .limit(limit)
    .offset(offset);

  const result = rows.map((row) => ({
    ...row,
    sla_status: deriveSlaStatus({
      status: row.status,
      slaDeadlineAt: row.sla_deadline_at,
      cascadeCompleteAt: row.cascade_complete_at,
      verifiedAt: row.verified_at,
    }),
  }));

  return NextResponse.json({ rows: result, total: countResult?.total ?? 0, page, limit });
}
