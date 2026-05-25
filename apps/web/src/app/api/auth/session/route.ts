// GET  /api/auth/session
//   Establishes (or refreshes) a session cookie for the current Replit user.
//   Call this once per login to register the session in the DB and get the
//   7of1_session cookie. All subsequent protected API calls that send this
//   cookie will have revocation enforced.
//
// DELETE /api/auth/session
//   Clears the session cookie (client-side logout). Does not revoke the DB
//   row — use DELETE /api/auth/sessions to revoke all sessions.

import { type NextRequest, NextResponse } from 'next/server'
import {
  resolveCreatorSession,
  resolveFanSession,
  persistSession,
  buildSessionCookieHeader,
  clearSessionCookieHeader,
  getReplitUser,
  SESSION_COOKIE,
} from '@/lib/auth'

export const runtime = 'nodejs'

// GET /api/auth/session
export async function GET(req: NextRequest) {
  const user = getReplitUser()
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  // Try creator first, then fall back to checking the creatorId query param for
  // fan sessions. A bare GET with no creatorId returns the creator session.
  const creatorId = req.nextUrl.searchParams.get('creatorId')

  let session = await resolveCreatorSession()

  if (!session && creatorId) {
    session = await resolveFanSession(creatorId)
  }

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const ua = req.headers.get('user-agent') ?? null

  // Persist the session to user_sessions and write audit log entry.
  // We don't await errors — a failure here should not block auth.
  persistSession(session.sessionToken, user.id, ip, ua).catch((err) => {
    console.error('[auth/session] persistSession error', err)
  })

  return NextResponse.json(
    {
      authenticated: true,
      userId: session.userId,
      creatorId: session.creatorId ?? null,
      fanId: session.fanId ?? null,
    },
    {
      status: 200,
      headers: {
        'Set-Cookie': buildSessionCookieHeader(session.sessionToken),
      },
    },
  )
}

// DELETE /api/auth/session
// Clears the session cookie on the client. The DB row is NOT revoked here —
// it remains active until it expires or is revoked via DELETE /api/auth/sessions.
export async function DELETE(_req: NextRequest) {
  return NextResponse.json(
    { success: true },
    {
      status: 200,
      headers: {
        'Set-Cookie': clearSessionCookieHeader(),
      },
    },
  )
}
