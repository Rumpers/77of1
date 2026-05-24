import crypto from 'crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { headers, cookies } from 'next/headers'
import { createClient, getSupabaseUrl, getSupabaseServiceKey } from '@7of1/db'
import {
  signSessionToken,
  TRIAL_COOKIE,
  parseTrialCookie,
  migrateTrialToAccount,
} from '@/lib/auth'
import type { ReplitAuthSession } from '@7of1/types'

// POST /api/auth/fan/signup
// Body: { creatorId: string }
//
// Converts an anonymous trial session to a linked fan account.
// Requires an active Replit Auth session. Idempotent — re-calling for an
// existing (replitUserId, creatorId) pair returns the existing fanId.
// Migrates the anonymous trial counter from the cookie to fan_accounts.trial_count.
export async function POST(request: NextRequest) {
  const h = headers()
  const replitUserId = h.get('x-replit-user-id')
  if (!replitUserId) {
    return NextResponse.json({ error: 'Replit Auth required' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const creatorId =
    body !== null &&
    typeof body === 'object' &&
    'creatorId' in body &&
    typeof (body as Record<string, unknown>).creatorId === 'string'
      ? (body as { creatorId: string }).creatorId
      : null

  if (!creatorId) {
    return NextResponse.json({ error: 'creatorId required' }, { status: 400 })
  }

  const db = createClient(getSupabaseUrl(), getSupabaseServiceKey())

  // Idempotent: return existing fanId if already linked
  const { data: existing } = await db
    .from('fan_accounts')
    .select('fan_id')
    .eq('replit_user_id', replitUserId)
    .eq('creator_id', creatorId)
    .maybeSingle()

  let fanId: string

  if (existing) {
    fanId = existing.fan_id
  } else {
    const cookieStore = cookies()
    const trialCount = parseTrialCookie(cookieStore.get(TRIAL_COOKIE)?.value)
    fanId = crypto.randomUUID()

    const { error: insertErr } = await db.from('fan_accounts').insert({
      fan_id: fanId,
      creator_id: creatorId,
      replit_user_id: replitUserId,
      trial_count: trialCount,
    })

    if (insertErr) {
      return NextResponse.json({ error: 'Failed to create fan account' }, { status: 500 })
    }

    // Best-effort: keep DB and cookie in sync (cookie survives as cache; DB is truth)
    await migrateTrialToAccount(fanId, creatorId, trialCount)
  }

  const session: ReplitAuthSession = {
    userId: replitUserId,
    fanId,
    sessionToken: signSessionToken(replitUserId),
  }
  return NextResponse.json({ session })
}
