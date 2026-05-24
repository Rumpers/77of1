import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient, getSupabaseUrl, getSupabaseServiceKey } from '@7of1/db';
import { requireCreatorAuth, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';

const CONSENT_VERSION = 'v1.0';

type ConsentGrantType = 'persona_text' | 'voice' | 'image' | 'talking_video' | 'fullbody_video';
const GRANT_TYPES: ConsentGrantType[] = [
  'persona_text',
  'voice',
  'image',
  'talking_video',
  'fullbody_video',
];

function getDb() {
  return createClient(getSupabaseUrl(), getSupabaseServiceKey());
}

function hashIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = (forwarded ? forwarded.split(',')[0] : realIp) ?? '::1';
  return crypto.createHash('sha256').update(ip.trim()).digest('hex');
}

export async function POST(req: NextRequest) {
  let session: { creatorId: string };
  try {
    session = await requireCreatorAuth();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Auth failed' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { answers } = body as { answers?: Partial<Record<ConsentGrantType, boolean>> };
  if (!answers || typeof answers !== 'object') {
    return NextResponse.json({ error: 'Missing answers object' }, { status: 400 });
  }
  for (const gt of GRANT_TYPES) {
    if (typeof answers[gt] !== 'boolean') {
      return NextResponse.json({ error: `Missing or invalid answer for ${gt}` }, { status: 400 });
    }
  }

  const ipHash = hashIp(req);
  const confirmedAt = new Date().toISOString();
  const db = getDb();

  const rows = GRANT_TYPES.map((gt) => ({
    creator_id: session.creatorId,
    grant_type: gt,
    granted: answers[gt] ?? false,
    granted_at: confirmedAt,
    consent_version: CONSENT_VERSION,
    channel: 'web',
    ip_hash: ipHash,
    confirmed_at: confirmedAt,
  }));

  const { error: insertError } = await db.from('consent_grants').insert(rows);
  if (insertError) {
    console.error('[consent-api] insert error', insertError);
    return NextResponse.json({ error: 'Failed to record consent' }, { status: 500 });
  }

  if (answers['persona_text'] === true) {
    const { error: assetError } = await db
      .from('creator_assets')
      .update({ consent_state: 'released' })
      .eq('creator_id', session.creatorId)
      .eq('consent_state', 'pending_consent');
    if (assetError) {
      console.error('[consent-api] asset update error', assetError);
    }
  }

  const { error: onboardError } = await db
    .from('creator_onboarding')
    .update({ status: 'STEP_3_COMPLETE', updated_at: confirmedAt })
    .eq('creator_id', session.creatorId);
  if (onboardError) {
    console.error('[consent-api] onboarding status update error', onboardError);
  }

  // Slice 1 stub: real signal wired when Twin endpoint ships
  console.log(
    `[consent-api] twin production signal (stub) creator_id=${session.creatorId} persona_text_granted=${answers['persona_text']}`,
  );

  return NextResponse.json({ ok: true, persona_text_granted: answers['persona_text'] });
}
