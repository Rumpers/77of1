// [HID-013] Data-deletion verification tooling — OF-227
// GET /api/admin/deletions — list deletion requests with SLA status
// Accessible to: ops + engineering staff roles.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';

const ALLOWED_ROLES = ['ops', 'engineering'] as const;

type SlaStatus = 'on_track' | 'at_risk' | 'overdue' | 'complete' | 'cancelled';

function deriveSlaStatus(row: {
  status: string;
  sla_deadline_at: string;
  cascade_complete_at: string | null;
  verified_at: string | null;
}): SlaStatus {
  if (row.status === 'cancelled') return 'cancelled';
  if (row.status === 'complete') return 'complete';

  const now = new Date();
  const deadline = new Date(row.sla_deadline_at);
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

  // Filter by status if provided; default to active (non-cancelled)
  const statusFilter = url.searchParams.get('status');

  let db: ReturnType<typeof getAdminSupabase>;
  try {
    db = getAdminSupabase();
  } catch {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  let query = db
    .from('deletion_requests')
    .select(
      'id, auth_user_id, account_type, entity_ids, status, requested_at, ' +
        'grace_period_expires_at, sla_deadline_at, cascade_started_at, ' +
        'cascade_complete_at, deletion_reference, verified_by, verified_at, ' +
        'verification_result, notes',
      { count: 'exact' },
    )
    .order('sla_deadline_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  } else {
    query = query.neq('status', 'cancelled');
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('[admin/deletions] fetch error', error);
    return NextResponse.json({ error: 'Failed to fetch deletion requests' }, { status: 500 });
  }

  const rows = (data ?? []).map((row) => ({
    ...row,
    sla_status: deriveSlaStatus(row as Parameters<typeof deriveSlaStatus>[0]),
  }));

  return NextResponse.json({ rows, total: count ?? 0, page, limit });
}
