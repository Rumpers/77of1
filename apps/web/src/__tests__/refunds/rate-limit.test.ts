import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Rate-limit logic tests ───────────────────────────────────────────────────
// Tests the 30-day / open-request rate-limit for POST /api/refunds/request
// without standing up a real DB.  We verify the logic against the schema rules:
//   - pending or processing rows within 30 days → 429
//   - done/denied rows within 30 days → allowed
//   - no rows → allowed

const RATE_LIMIT_DAYS = 30

function isRateLimited(
  existingRows: Array<{ status: string; created_at: string }>,
  now: Date = new Date(),
): boolean {
  const windowStart = new Date(now.getTime() - RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000)
  return existingRows.some(
    (row) =>
      ['pending', 'processing'].includes(row.status) &&
      new Date(row.created_at) >= windowStart,
  )
}

describe('refund request rate-limit — 30-day window', () => {
  const now = new Date('2026-05-25T00:00:00Z')

  it('allows request when no prior requests exist', () => {
    expect(isRateLimited([], now)).toBe(false)
  })

  it('blocks when a pending request is within 30 days', () => {
    const rows = [{ status: 'pending', created_at: '2026-05-10T00:00:00Z' }]
    expect(isRateLimited(rows, now)).toBe(true)
  })

  it('blocks when a processing request is within 30 days', () => {
    const rows = [{ status: 'processing', created_at: '2026-05-20T00:00:00Z' }]
    expect(isRateLimited(rows, now)).toBe(true)
  })

  it('allows when the only recent request is done', () => {
    const rows = [{ status: 'done', created_at: '2026-05-20T00:00:00Z' }]
    expect(isRateLimited(rows, now)).toBe(false)
  })

  it('allows when the only recent request is denied', () => {
    const rows = [{ status: 'denied', created_at: '2026-05-20T00:00:00Z' }]
    expect(isRateLimited(rows, now)).toBe(false)
  })

  it('allows when a pending request is older than 30 days', () => {
    const rows = [{ status: 'pending', created_at: '2026-04-01T00:00:00Z' }]
    expect(isRateLimited(rows, now)).toBe(false)
  })

  it('blocks even if one of multiple rows is pending within window', () => {
    const rows = [
      { status: 'done', created_at: '2026-05-10T00:00:00Z' },
      { status: 'pending', created_at: '2026-05-22T00:00:00Z' },
    ]
    expect(isRateLimited(rows, now)).toBe(true)
  })

  it('window boundary: exactly 30 days ago is within limit', () => {
    const exactBoundary = new Date(now.getTime() - RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000)
    const rows = [{ status: 'pending', created_at: exactBoundary.toISOString() }]
    expect(isRateLimited(rows, now)).toBe(true)
  })

  it('window boundary: 30 days + 1 ms ago is outside limit', () => {
    const justOutside = new Date(now.getTime() - RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000 - 1)
    const rows = [{ status: 'pending', created_at: justOutside.toISOString() }]
    expect(isRateLimited(rows, now)).toBe(false)
  })
})
