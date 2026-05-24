import { type NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient, getSupabaseUrl, getSupabaseServiceKey } from '@7of1/db'
import { signSessionToken } from '@/lib/auth'
import type { ReplitAuthSession } from '@7of1/types'

// GET /api/auth/creator-link?token=<creatorId>
//
// Deep-link handler: creator arrives from a Hermes-generated link.
// Requires an active Replit Auth session (x-replit-user-id header injected by
// the Replit runtime proxy). On success, writes the replit_user_id → creator_id
// mapping into the creators table and returns a ReplitAuthSession.
export async function GET(request: NextRequest) {
  const h = headers()
  const replitUserId = h.get('x-replit-user-id')
  if (!replitUserId) {
    return NextResponse.json({ error: 'Replit Auth required' }, { status: 401 })
  }

  const creatorId = request.nextUrl.searchParams.get('token')
  if (!creatorId) {
    return NextResponse.json({ error: 'Missing token parameter' }, { status: 400 })
  }

  const db = createClient(getSupabaseUrl(), getSupabaseServiceKey())

  const { data: creator, error: lookupErr } = await db
    .from('creators')
    .select('id, replit_user_id')
    .eq('id', creatorId)
    .maybeSingle()

  if (lookupErr || !creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
  }

  if (creator.replit_user_id && creator.replit_user_id !== replitUserId) {
    return NextResponse.json(
      { error: 'Creator already linked to a different Replit account' },
      { status: 409 },
    )
  }

  if (!creator.replit_user_id) {
    const { error: updateErr } = await db
      .from('creators')
      .update({ replit_user_id: replitUserId })
      .eq('id', creatorId)
    if (updateErr) {
      return NextResponse.json({ error: 'Failed to link account' }, { status: 500 })
    }
  }

  const session: ReplitAuthSession = {
    userId: replitUserId,
    creatorId,
    sessionToken: signSessionToken(replitUserId),
  }
  return NextResponse.json({ session })
}
