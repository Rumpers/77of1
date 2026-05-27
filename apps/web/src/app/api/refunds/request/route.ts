import { NextRequest, NextResponse } from 'next/server'
import { createClient, getSupabaseUrl, getSupabaseServiceKey } from '@7of1/db'
import { requireFanAuth, AuthError } from '@/lib/auth'

export const runtime = 'nodejs'

function getDb() {
  return createClient(getSupabaseUrl(), getSupabaseServiceKey())
}

const RATE_LIMIT_DAYS = 30
const TRANSCRIPT_LIMIT = 5

const VALID_REASON_CATEGORIES = [
  'goodwill_7day',
  'technical_failure',
  'creator_no_show',
  'duplicate_charge',
  'other',
] as const

// POST /api/refunds/request
// Body: { creatorId, reasonCategory, fanNotes? }
// Auth: fan session (Replit Auth x-replit-user-id header)
// Rate-limit: 1 open request per fan per 30 days
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { creatorId, reasonCategory, fanNotes } = body as {
    creatorId?: string
    reasonCategory?: string
    fanNotes?: string
  }

  if (!creatorId) {
    return NextResponse.json({ error: 'creatorId is required' }, { status: 400 })
  }
  if (!reasonCategory) {
    return NextResponse.json({ error: 'reasonCategory is required' }, { status: 400 })
  }
  if (!VALID_REASON_CATEGORIES.includes(reasonCategory as (typeof VALID_REASON_CATEGORIES)[number])) {
    return NextResponse.json(
      { error: `reasonCategory must be one of: ${VALID_REASON_CATEGORIES.join(', ')}` },
      { status: 400 },
    )
  }

  // Fan auth scoped to this creator
  let session: { fanId: string }
  try {
    session = await requireFanAuth(creatorId)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Auth failed' }, { status: 401 })
  }

  const { fanId } = session
  const db = getDb()

  // Verify creator exists
  const { data: creator } = await db
    .from('creators')
    .select('id')
    .eq('id', creatorId)
    .maybeSingle()

  if (!creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
  }

  // Rate-limit: reject if pending/processing request exists within last 30 days
  const windowStart = new Date(Date.now() - RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data: existingRequest } = await db
    .from('refund_requests')
    .select('id')
    .eq('fan_id', fanId)
    .in('status', ['pending', 'processing'])
    .gte('created_at', windowStart)
    .maybeSingle()

  if (existingRequest) {
    return NextResponse.json(
      { error: 'An open refund request already exists. Please wait before submitting another.' },
      { status: 429 },
    )
  }

  // Look up last topup credit transaction for this fan+creator pair
  const { data: lastTx } = await db
    .from('credit_transactions')
    .select('stripe_event_id, amount')
    .eq('fan_id', fanId)
    .eq('creator_id', creatorId)
    .eq('kind', 'topup')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastTx) {
    return NextResponse.json(
      { error: 'No prior payment found for this creator' },
      { status: 422 },
    )
  }

  // Resolve credit pack details from credits amount (for amount_cents + currency)
  const { data: creditPack } = await db
    .from('credit_packs')
    .select('id, price_cents, currency')
    .eq('credits', lastTx.amount)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  // Pull last N generation jobs as transcript_excerpt
  const { data: jobs } = await db
    .from('generation_jobs')
    .select('modality, status, created_at')
    .eq('fan_id', fanId)
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })
    .limit(TRANSCRIPT_LIMIT)

  const transcriptExcerpt =
    jobs && jobs.length > 0
      ? jobs
          .map((j) => `[${j.modality}/${j.status}] ${j.created_at}`)
          .join('\n')
      : null

  // Insert refund_request
  const { data: refundRequest, error: insertErr } = await db
    .from('refund_requests')
    .insert({
      fan_id: fanId,
      creator_id: creatorId,
      stripe_payment_intent_id: lastTx.stripe_event_id ?? null,
      credit_pack_id: creditPack?.id ?? null,
      amount_credits: lastTx.amount,
      amount_cents: creditPack?.price_cents ?? null,
      currency: creditPack?.currency ?? null,
      reason_category: reasonCategory,
      fan_notes: fanNotes ?? null,
      transcript_excerpt: transcriptExcerpt,
      inbound_channel: 'web_form',
      status: 'pending',
      // sla_deadline_at is set by DB trigger (now() + 72h)
      sla_deadline_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    })
    .select('id, sla_deadline_at')
    .single()

  if (insertErr) {
    console.error('[refunds/request] insert error', insertErr)
    return NextResponse.json({ error: 'Failed to create refund request' }, { status: 500 })
  }

  return NextResponse.json(
    { requestId: refundRequest.id, slaDeadline: refundRequest.sla_deadline_at },
    { status: 201 },
  )
}
