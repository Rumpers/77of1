import { NextRequest, NextResponse } from 'next/server'
import { createClient, getSupabaseUrl, getSupabaseServiceKey } from '@7of1/db'
import { verifyIngestSignature, getIngestSecret } from '@/lib/refund-ingest'

export const runtime = 'nodejs'

function getDb() {
  return createClient(getSupabaseUrl(), getSupabaseServiceKey())
}

// POST /api/webhooks/refund-email-ingest
// Auth: HMAC-SHA256 via X-Refund-Ingest-Signature header (value: sha256=<hex>)
// Body: { sender: string, subject: string, body: string }
// Creates a refund_requests row with inbound_channel='email', reason_category='other'.
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-refund-ingest-signature') ?? ''

  if (!signature) {
    return NextResponse.json({ error: 'Missing X-Refund-Ingest-Signature header' }, { status: 401 })
  }

  let secret: string
  try {
    secret = getIngestSecret()
  } catch {
    console.error('[refund-email-ingest] REFUND_EMAIL_INGEST_SECRET not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  if (!verifyIngestSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { sender, subject, body: emailBody } = payload as {
    sender?: string
    subject?: string
    body?: string
  }

  if (!sender || typeof sender !== 'string') {
    return NextResponse.json({ error: 'sender is required and must be a string' }, { status: 400 })
  }

  const senderEmail = sender.trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(senderEmail)) {
    return NextResponse.json({ error: 'sender must be a valid email address' }, { status: 400 })
  }

  const db = getDb()

  // Look up fan via auth.users (linked to fan_accounts.auth_user_id)
  const {
    data: { users },
    error: authErr,
  } = await db.auth.admin.listUsers({ perPage: 1000 })

  if (authErr) {
    console.error('[refund-email-ingest] auth.admin.listUsers error', authErr)
    return NextResponse.json({ error: 'User lookup failed' }, { status: 500 })
  }

  const authUser = users.find((u) => u.email?.toLowerCase() === senderEmail)
  if (!authUser) {
    return NextResponse.json({ error: 'Fan not found for this email address' }, { status: 404 })
  }

  const { data: fanAccount } = await db
    .from('fan_accounts')
    .select('fan_id, creator_id')
    .eq('auth_user_id', authUser.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!fanAccount) {
    return NextResponse.json({ error: 'Fan account not found' }, { status: 404 })
  }

  const { fan_id: fanId, creator_id: creatorId } = fanAccount

  // Best-effort financial field lookup from last topup transaction
  const { data: lastTx } = await db
    .from('credit_transactions')
    .select('stripe_event_id, amount')
    .eq('fan_id', fanId)
    .eq('creator_id', creatorId)
    .eq('kind', 'topup')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: creditPack } = lastTx
    ? await db
        .from('credit_packs')
        .select('id, price_cents, currency')
        .eq('credits', lastTx.amount)
        .eq('active', true)
        .limit(1)
        .maybeSingle()
    : { data: null }

  const excerptParts = [
    subject ? `Subject: ${subject}` : null,
    emailBody ? `Body: ${emailBody.slice(0, 500)}` : null,
  ].filter(Boolean)
  const transcriptExcerpt = excerptParts.length > 0 ? excerptParts.join('\n') : null

  const { data: refundRequest, error: insertErr } = await db
    .from('refund_requests')
    .insert({
      fan_id: fanId,
      creator_id: creatorId,
      stripe_payment_intent_id: lastTx?.stripe_event_id ?? null,
      credit_pack_id: creditPack?.id ?? null,
      amount_credits: lastTx?.amount ?? null,
      amount_cents: creditPack?.price_cents ?? null,
      currency: creditPack?.currency ?? null,
      reason_category: 'other',
      fan_notes: emailBody ?? null,
      transcript_excerpt: transcriptExcerpt,
      inbound_channel: 'email',
      status: 'pending',
      sla_deadline_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()

  if (insertErr) {
    console.error('[refund-email-ingest] insert error', insertErr)
    return NextResponse.json({ error: 'Failed to create refund request' }, { status: 500 })
  }

  return NextResponse.json({ received: true, requestId: refundRequest.id })
}
