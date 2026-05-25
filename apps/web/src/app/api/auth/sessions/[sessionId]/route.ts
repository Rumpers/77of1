// DELETE /api/auth/sessions/:sessionId — revoke a specific session

import { type NextRequest, NextResponse } from 'next/server'
import { createClient, getSupabaseUrl, getSupabaseServiceKey } from '@7of1/db'
import { getReplitUser } from '@/lib/auth'

export const runtime = 'nodejs'

function getDb() {
  return createClient(getSupabaseUrl(), getSupabaseServiceKey())
}

// DELETE /api/auth/sessions/:sessionId
// Revokes a single session by ID. Only the session owner can revoke their own
// sessions (enforced by matching replit_user_id).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const user = getReplitUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { sessionId } = params
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }

  const db = getDb()
  const now = new Date().toISOString()

  const { data, error } = await db
    .from('user_sessions')
    .update({ revoked_at: now })
    .eq('id', sessionId)
    .eq('replit_user_id', user.id) // ownership check — users can only revoke their own sessions
    .is('revoked_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[auth/sessions/:id DELETE] error', error)
    return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Session not found or already revoked' },
      { status: 404 },
    )
  }

  // Audit log
  await db.from('audit_log').insert({
    event_type: 'session_revoked',
    payload: { replit_user_id: user.id, session_id: sessionId, revoked_at: now },
  })

  return NextResponse.json({ success: true, revokedAt: now })
}
