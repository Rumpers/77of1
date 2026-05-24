import crypto from 'crypto'
import { headers } from 'next/headers'
import { createClient, getSupabaseUrl, getSupabaseServiceKey } from '@7of1/db'
import type { ReplitAuthSession } from '@7of1/types'

// ─── Session token ────────────────────────────────────────────────────────────
// HMAC-SHA256 signed opaque token. Not a JWT — no standard claims, no decoder.
// Replit Auth (x-replit-user-id header) is the identity source of truth.

function getSessionSecret(): string {
  return process.env.SESSION_SECRET ?? 'dev-only-secret-change-before-deploy'
}

export function signSessionToken(userId: string): string {
  const payload = `${userId}:${Date.now()}`
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${sig}`
}

export function verifySessionToken(token: string, userId: string): boolean {
  const dot = token.lastIndexOf('.')
  if (dot === -1) return false
  const payloadB64 = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const payload = Buffer.from(payloadB64, 'base64url').toString()
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url')
  const sigBuf = Buffer.from(sig, 'base64url')
  const expectedBuf = Buffer.from(expectedSig, 'base64url')
  if (sigBuf.length !== expectedBuf.length) return false
  return crypto.timingSafeEqual(sigBuf, expectedBuf) && payload.startsWith(`${userId}:`)
}

// ─── Replit Auth header reader ────────────────────────────────────────────────

export type ReplitUser = {
  id: string
  name: string
  roles: string
  bio: string
  profileImage: string
  url: string
  teams: string
}

export function getReplitUser(): ReplitUser | null {
  const h = headers()
  const userId = h.get('x-replit-user-id')
  if (!userId) return null
  return {
    id: userId,
    name: h.get('x-replit-user-name') ?? '',
    roles: h.get('x-replit-user-roles') ?? '',
    bio: h.get('x-replit-user-bio') ?? '',
    profileImage: h.get('x-replit-user-profile-image') ?? '',
    url: h.get('x-replit-user-url') ?? '',
    teams: h.get('x-replit-user-teams') ?? '',
  }
}

function getDb() {
  return createClient(getSupabaseUrl(), getSupabaseServiceKey())
}

// ─── Creator session ──────────────────────────────────────────────────────────

export async function resolveCreatorSession(): Promise<ReplitAuthSession | null> {
  const user = getReplitUser()
  if (!user) return null
  const { data } = await getDb()
    .from('creators')
    .select('id')
    .eq('replit_user_id', user.id)
    .maybeSingle()
  if (!data) return null
  return {
    userId: user.id,
    creatorId: data.id,
    sessionToken: signSessionToken(user.id),
  }
}

// ─── Fan session ──────────────────────────────────────────────────────────────

export async function resolveFanSession(creatorId: string): Promise<ReplitAuthSession | null> {
  const user = getReplitUser()
  if (!user) return null
  const { data } = await getDb()
    .from('fan_accounts')
    .select('fan_id')
    .eq('replit_user_id', user.id)
    .eq('creator_id', creatorId)
    .maybeSingle()
  if (!data) return null
  return {
    userId: user.id,
    fanId: data.fan_id,
    sessionToken: signSessionToken(user.id),
  }
}

// ─── Auth middleware helpers ──────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export async function requireCreatorAuth(): Promise<ReplitAuthSession & { creatorId: string }> {
  const session = await resolveCreatorSession()
  if (!session) throw new AuthError(401, 'Creator auth required')
  if (!session.creatorId) throw new AuthError(403, 'Not a linked creator account')
  return { ...session, creatorId: session.creatorId }
}

export async function requireFanAuth(
  creatorId: string,
): Promise<ReplitAuthSession & { fanId: string }> {
  const session = await resolveFanSession(creatorId)
  if (!session) throw new AuthError(401, 'Fan auth required')
  if (!session.fanId) throw new AuthError(403, 'Fan account not found for this creator')
  return { ...session, fanId: session.fanId }
}

// Multi-tenant isolation guard: call before any creator-scoped data access.
export function assertSameCreator(sessionCreatorId: string, targetCreatorId: string): void {
  if (sessionCreatorId !== targetCreatorId) {
    throw new AuthError(403, 'Cross-creator access denied')
  }
}

// ─── Anonymous trial counter ──────────────────────────────────────────────────

export const TRIAL_COOKIE = '7of1_trial'

export function parseTrialCookie(cookieValue: string | undefined): number {
  if (!cookieValue) return 0
  const n = parseInt(cookieValue, 10)
  return Number.isNaN(n) || n < 0 ? 0 : n
}

export function buildTrialCookieHeader(count: number): string {
  return `${TRIAL_COOKIE}=${count}; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}; Path=/`
}

export function incrementTrialCount(cookieValue: string | undefined): {
  count: number
  cookieHeader: string
} {
  const count = parseTrialCookie(cookieValue) + 1
  return { count, cookieHeader: buildTrialCookieHeader(count) }
}

export async function migrateTrialToAccount(
  fanId: string,
  creatorId: string,
  trialCount: number,
): Promise<void> {
  await getDb()
    .from('fan_accounts')
    .update({ trial_count: trialCount })
    .eq('fan_id', fanId)
    .eq('creator_id', creatorId)
}
