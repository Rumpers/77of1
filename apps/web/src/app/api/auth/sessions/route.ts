// GET    /api/auth/sessions   — list active sessions for the current user
// DELETE /api/auth/sessions   — revoke ALL sessions ("log out everywhere")

import { type NextRequest, NextResponse } from 'next/server'
import { createClient, getSupabaseUrl, getSupabaseServiceKey } from '@7of1/db'
import { getReplitUser, AuthError, clearSessionCookieHeader } from '@/lib/auth'

export const runtime = 'nodejs'

function getDb() {
  return createClient(getSupabaseUrl(), getSupabaseServiceKey())
}

// GET /api/auth/sessions
// Returns the list of active (non-revoked) sessions for the current user,
// ordered by most-recently-active first.
export async function GET(_req: NextRequest) {
  const user = getReplitUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const db = getDb()
  const { data, error } = await db
    .from('user_sessions')
    .select('id, device_hint, ip_address, user_agent, last_active_at, created_at')
    .eq('replit_user_id', user.id)
    .is('revoked_at', null)
    .order('last_active_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[auth/sessions GET] query error', error)
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }

  return NextResponse.json({ sessions: data })
}

// DELETE /api/auth/sessions
// Revokes ALL active sessions for the current user and clears the session
// cookie. Revocation propagates to other devices within 60s (next API call).
export async function DELETE(_req: NextRequest) {
  const user = getReplitUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const db = getDb()
  const now = new Date().toISOString()

  const { error } = await db
    .from('user_sessions')
    .update({ revoked_at: now })
    .eq('replit_user_id', user.id)
    .is('revoked_at', null)

  if (error) {
    console.error('[auth/sessions DELETE] revoke error', error)
    return NextResponse.json({ error: 'Failed to revoke sessions' }, { status: 500 })
  }

  // Audit log
  await db.from('audit_log').insert({
    event_type: 'sessions_revoked_all',
    payload: { replit_user_id: user.id },
  })

  return NextResponse.json(
    { success: true, revokedAt: now },
    {
      status: 200,
      headers: {
        // Also clear cookie on the requesting client
        'Set-Cookie': clearSessionCookieHeader(),
      },
    },
  )
}
