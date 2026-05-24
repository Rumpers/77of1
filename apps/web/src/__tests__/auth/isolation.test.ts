import { describe, it, expect } from 'vitest'
import {
  assertSameCreator,
  AuthError,
  parseTrialCookie,
  incrementTrialCount,
  buildTrialCookieHeader,
  TRIAL_COOKIE,
  signSessionToken,
  verifySessionToken,
} from '../../lib/auth'

// ─── Multi-tenant isolation ───────────────────────────────────────────────────

describe('assertSameCreator', () => {
  it('allows access when creator IDs match', () => {
    expect(() => assertSameCreator('creator-a', 'creator-a')).not.toThrow()
  })

  it('throws AuthError(403) when creator IDs differ', () => {
    expect(() => assertSameCreator('creator-a', 'creator-b')).toThrow(AuthError)
  })

  it('error status is 403', () => {
    try {
      assertSameCreator('creator-a', 'creator-b')
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError)
      expect((err as AuthError).status).toBe(403)
    }
  })

  it('does not allow prefix matches (creator-1 vs creator-10)', () => {
    expect(() => assertSameCreator('creator-1', 'creator-10')).toThrow(AuthError)
  })
})

// ─── Anonymous trial counter ──────────────────────────────────────────────────

describe('parseTrialCookie', () => {
  it('returns 0 for missing cookie', () => {
    expect(parseTrialCookie(undefined)).toBe(0)
  })

  it('returns 0 for empty string', () => {
    expect(parseTrialCookie('')).toBe(0)
  })

  it('returns 0 for NaN string', () => {
    expect(parseTrialCookie('NaN')).toBe(0)
  })

  it('returns 0 for negative values', () => {
    expect(parseTrialCookie('-3')).toBe(0)
  })

  it('parses a valid count', () => {
    expect(parseTrialCookie('5')).toBe(5)
  })
})

describe('incrementTrialCount', () => {
  it('increments from zero (no prior cookie)', () => {
    const { count, cookieHeader } = incrementTrialCount(undefined)
    expect(count).toBe(1)
    expect(cookieHeader).toContain(`${TRIAL_COOKIE}=1`)
  })

  it('increments an existing count', () => {
    const { count } = incrementTrialCount('7')
    expect(count).toBe(8)
  })
})

describe('buildTrialCookieHeader', () => {
  it('sets HttpOnly and SameSite=Lax', () => {
    const header = buildTrialCookieHeader(3)
    expect(header).toContain('HttpOnly')
    expect(header).toContain('SameSite=Lax')
    expect(header).toContain(`${TRIAL_COOKIE}=3`)
  })
})

// ─── Session token ────────────────────────────────────────────────────────────

describe('signSessionToken / verifySessionToken', () => {
  it('produces a verifiable token for a given userId', () => {
    const token = signSessionToken('user-123')
    expect(verifySessionToken(token, 'user-123')).toBe(true)
  })

  it('rejects a token for a different userId', () => {
    const token = signSessionToken('user-123')
    expect(verifySessionToken(token, 'user-456')).toBe(false)
  })

  it('rejects a tampered token', () => {
    const token = signSessionToken('user-123')
    const tampered = token.slice(0, -4) + 'xxxx'
    expect(verifySessionToken(tampered, 'user-123')).toBe(false)
  })

  it('rejects a token with no separator', () => {
    expect(verifySessionToken('notavalidtoken', 'user-123')).toBe(false)
  })
})
