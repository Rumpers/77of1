// [HID-013] Data-deletion verification tooling — OF-227
// Admin page: /admin/deletions
// Lists pending deletion requests with SLA status badges.
// Staff can trigger a verification run on any request.
// Accessible to: ops + engineering.

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAdminSupabase } from '@/lib/supabase';

type SlaStatus = 'on_track' | 'at_risk' | 'overdue' | 'complete' | 'cancelled';

interface DeletionRow {
  id: string;
  auth_user_id: string;
  account_type: string;
  status: string;
  requested_at: string;
  grace_period_expires_at: string;
  sla_deadline_at: string;
  cascade_complete_at: string | null;
  deletion_reference: string | null;
  verified_at: string | null;
  verification_result: {
    overall?: string;
    checks?: Array<{ table: string; found_rows: number; status: string; note?: string }>;
  } | null;
  sla_status: SlaStatus;
}

const SLA_BADGES: Record<SlaStatus, { label: string; bg: string; color: string }> = {
  on_track: { label: 'On track', bg: '#d1fae5', color: '#065f46' },
  at_risk: { label: 'At risk (<12h)', bg: '#fef3c7', color: '#92400e' },
  overdue: { label: 'OVERDUE', bg: '#fee2e2', color: '#991b1b' },
  complete: { label: 'Complete', bg: '#ede9fe', color: '#4c1d95' },
  cancelled: { label: 'Cancelled', bg: '#f3f4f6', color: '#6b7280' },
};

function deriveSlaStatus(row: Omit<DeletionRow, 'sla_status'>): SlaStatus {
  if (row.status === 'cancelled') return 'cancelled';
  if (row.status === 'complete') return 'complete';
  const now = new Date();
  const deadline = new Date(row.sla_deadline_at);
  const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (now > deadline) return 'overdue';
  if (hoursRemaining <= 12) return 'at_risk';
  return 'on_track';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

function SlaTag({ status }: { status: SlaStatus }) {
  const badge = SLA_BADGES[status];
  return (
    <span
      style={{
        background: badge.bg,
        color: badge.color,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {badge.label}
    </span>
  );
}

async function fetchDeletions(): Promise<DeletionRow[]> {
  try {
    const db = getAdminSupabase();
    const { data, error } = await db
      .from('deletion_requests')
      .select(
        'id, auth_user_id, account_type, status, requested_at, ' +
          'grace_period_expires_at, sla_deadline_at, cascade_complete_at, ' +
          'deletion_reference, verified_at, verification_result',
      )
      .neq('status', 'cancelled')
      .order('sla_deadline_at', { ascending: true })
      .limit(100);

    if (error) throw error;
    return (data ?? []).map((row) => ({
      ...(row as Omit<DeletionRow, 'sla_status'>),
      sla_status: deriveSlaStatus(row as Omit<DeletionRow, 'sla_status'>),
    }));
  } catch {
    return [];
  }
}

export default async function DeletionsPage() {
  const session = await auth();
  if (!session?.user) redirect('/auth/signin');

  const allowed = ['ops', 'engineering'].includes(session.user.role);
  if (!allowed) {
    return (
      <div>
        <h1>Deletion Verification</h1>
        <p style={{ color: '#dc2626' }}>Access restricted to ops and engineering roles.</p>
      </div>
    );
  }

  const rows = await fetchDeletions();

  const overdue = rows.filter((r) => r.sla_status === 'overdue');
  const atRisk = rows.filter((r) => r.sla_status === 'at_risk');
  const pending = rows.filter((r) => r.sla_status === 'on_track');
  const complete = rows.filter((r) => r.sla_status === 'complete');

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Data-Deletion Verification</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
            §8.4 / §16 — deletion cascade must complete within 72h of grace expiry.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {overdue.length > 0 && (
            <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 12px', borderRadius: 4, fontWeight: 700, fontSize: 14 }}>
              {overdue.length} OVERDUE
            </span>
          )}
          {atRisk.length > 0 && (
            <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: 4, fontWeight: 600, fontSize: 14 }}>
              {atRisk.length} at risk
            </span>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No active deletion requests.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px' }}>Reference</th>
              <th style={{ padding: '8px 12px' }}>Type</th>
              <th style={{ padding: '8px 12px' }}>Requested</th>
              <th style={{ padding: '8px 12px' }}>Grace expires</th>
              <th style={{ padding: '8px 12px' }}>SLA deadline</th>
              <th style={{ padding: '8px 12px' }}>SLA status</th>
              <th style={{ padding: '8px 12px' }}>Verified</th>
              <th style={{ padding: '8px 12px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {[...overdue, ...atRisk, ...pending, ...complete].map((row) => (
              <tr
                key={row.id}
                style={{
                  borderBottom: '1px solid #f3f4f6',
                  background: row.sla_status === 'overdue' ? '#fff5f5' : undefined,
                }}
              >
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>
                  {row.deletion_reference ?? row.id.slice(0, 8)}
                </td>
                <td style={{ padding: '8px 12px' }}>{row.account_type}</td>
                <td style={{ padding: '8px 12px' }}>{formatDate(row.requested_at)}</td>
                <td style={{ padding: '8px 12px' }}>{formatDate(row.grace_period_expires_at)}</td>
                <td style={{ padding: '8px 12px' }}>{formatDate(row.sla_deadline_at)}</td>
                <td style={{ padding: '8px 12px' }}>
                  <SlaTag status={row.sla_status} />
                </td>
                <td style={{ padding: '8px 12px', color: row.verified_at ? '#065f46' : '#6b7280' }}>
                  {row.verified_at ? (
                    <span title={formatDate(row.verified_at)}>
                      ✓ {row.verification_result?.overall ?? 'done'}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  {row.status !== 'cancelled' && (
                    <form method="POST" action={`/api/admin/deletions/${row.id}/verify`}>
                      <button
                        type="submit"
                        style={{
                          background: '#1a1a2e',
                          color: '#fff',
                          border: 'none',
                          padding: '4px 12px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >
                        {row.verified_at ? 'Re-verify' : 'Verify now'}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rows.some((r) => r.verification_result?.checks) && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Last verification detail</h2>
          {rows
            .filter((r) => r.verification_result?.checks)
            .slice(0, 3)
            .map((row) => (
              <div
                key={row.id}
                style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 16, marginBottom: 12 }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  {row.deletion_reference ?? row.id.slice(0, 8)} — {row.account_type} —{' '}
                  <span
                    style={{
                      color:
                        row.verification_result?.overall === 'verified'
                          ? '#065f46'
                          : row.verification_result?.overall === 'failed'
                            ? '#991b1b'
                            : '#92400e',
                    }}
                  >
                    {row.verification_result?.overall}
                  </span>
                </div>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Table</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Rows found</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Result</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.verification_result?.checks?.map((check, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{check.table}</td>
                        <td style={{ padding: '4px 8px' }}>{check.found_rows}</td>
                        <td
                          style={{
                            padding: '4px 8px',
                            color:
                              check.status === 'clear' || check.status === 'retained_per_policy'
                                ? '#065f46'
                                : '#991b1b',
                          }}
                        >
                          {check.status}
                        </td>
                        <td style={{ padding: '4px 8px', color: '#6b7280' }}>{check.note ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
      )}

      <p style={{ marginTop: 32, color: '#9ca3af', fontSize: 12 }}>
        HID-013 · OF-227 · §8.4 / §16 — SLA: 72h post grace expiry
      </p>
    </div>
  );
}
