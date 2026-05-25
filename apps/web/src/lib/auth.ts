import crypto from 'crypto'
import { headers, cookies } from 'next/headers'
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

// ─── Session cookie ───────────────────────────────────────────────────────────

export const SESSION_COOKIE = '7of1_session'
const SESSION_MAX_AGE_SECS = 60 * 60 * 24 * 30 // 30 days

export function buildSessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECS}; Path=/`
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/`
}

// ─── Session token internals ──────────────────────────────────────────────────

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function extractTokenTimestampMs(token: string): number {
  const dot = token.lastIndexOf('.')
  if (dot === -1) return 0
  const payload = Buffer.from(token.slice(0, dot), 'base64url').toString()
  const colon = payload.lastIndexOf(':')
  return colon === -1 ? 0 : (parseInt(payload.slice(colon + 1), 10) || 0)
}

function parseDeviceHint(ua: string): 'mobile' | 'desktop' | 'bot' | 'unknown' {
  if (!ua) return 'unknown'
  if (/bot|crawler|spider|slurp|curl/i.test(ua)) return 'bot'
  if (/mobile|android|iphone|ipad/i.test(ua)) return 'mobile'
  return 'desktop'
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

// ─── Session persistence ──────────────────────────────────────────────────────

// Creates or refreshes a user_sessions row. Fire-and-forget safe — errors do
// not affect auth outcome. Called from the /api/auth/session establishment
// endpoint; do not call on every request.
export async function persistSession(
  token: string,
  userId: string,
  ip: string | null,
  ua: string | null,
): Promise<void> {
  const db = getDb()
  const tokenHash = hashToken(token)
  const createdAtMs = extractTokenTimestampMs(token)
  const deviceHint = parseDeviceHint(ua ?? '')

  await db.from('user_sessions').upsert(
    {
      replit_user_id: userId,
      token_hash: tokenHash,
      created_at_ms: createdAtMs,
      device_hint: deviceHint,
      ip_address: ip,
      user_agent: ua,
      last_active_at: new Date().toISOString(),
    },
    { onConflict: 'token_hash' },
  )

  // Audit log — best-effort
  await db.from('audit_log').insert({
    event_type: 'session_created',
    payload: { replit_user_id: userId, device_hint: deviceHint, ip_address: ip },
  })
}

// Checks if a session token has been revoked. Returns true if the token is
// known to the DB and has been revoked; returns false if unknown (newly issued)
// so that existing Replit-only callers are not broken.
async function isSessionRevoked(token: string): Promise<boolean> {
  const db = getDb()
  const { data } = await db
    .from('user_sessions')
    .select('revoked_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle()
  return data !== null && data.revoked_at !== null
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

// Validates the 7of1_session cookie if present. Throws 401 if the cookie is
// present but the session has been revoked. No-op if cookie is absent (allows
// Replit-only callers to continue working).
async function enforceSessionCookie(userId: string): Promise<void> {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE)
  if (!sessionCookie) return // no session cookie — allow Replit-only auth

  const token = sessionCookie.value
  // Must bind to this user to prevent cross-user cookie reuse
  if (!verifySessionToken(token, userId)) {
    throw new AuthError(401, 'Session token invalid or expired')
  }
  if (await isSessionRevoked(token)) {
    throw new AuthError(401, 'Session has been revoked — please re-authenticate')
  }
}

export async function requireCreatorAuth(): Promise<ReplitAuthSession & { creatorId: string }> {
  const session = await resolveCreatorSession()
  if (!session) throw new AuthError(401, 'Creator auth required')
  if (!session.creatorId) throw new AuthError(403, 'Not a linked creator account')
  await enforceSessionCookie(session.userId)
  return { ...session, creatorId: session.creatorId }
}

export async function requireFanAuth(
  creatorId: string,
): Promise<ReplitAuthSession & { fanId: string }> {
  const session = await resolveFanSession(creatorId)
  if (!session) throw new AuthError(401, 'Fan auth required')
  if (!session.fanId) throw new AuthError(403, 'Fan account not found for this creator')
  await enforceSessionCookie(session.userId)
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
