import { type NextRequest, NextResponse } from 'next/server'
import { getReplitUser } from '@/lib/auth'

// Replit Auth session endpoint — returns current authenticated user from Replit headers.
// Platform session integration (OF-58) will extend this with platform-specific fields.
export function GET(_req: NextRequest) {
  const user = getReplitUser()
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  return NextResponse.json({ authenticated: true, user })
}
