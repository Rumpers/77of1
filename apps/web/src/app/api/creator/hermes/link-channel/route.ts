// POST /api/creator/hermes/link-channel
// Links an authenticated creator's account to a Telegram channel via hermes_channels.
// Called from the /creator/connect?tg_uid=... page after the creator completes OAuth sign-in.
// Body: { tg_uid: string; channel_type?: "telegram" | "line" }
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCreatorAuth, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';

function getDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  return createClient(url, key);
}

const ALLOWED_CHANNEL_TYPES = new Set(['telegram', 'line']);

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

  const { tg_uid, channel_type = 'telegram' } = body as {
    tg_uid?: string;
    channel_type?: string;
  };

  if (!tg_uid || typeof tg_uid !== 'string' || !/^\d+$/.test(tg_uid.trim())) {
    return NextResponse.json({ error: 'tg_uid must be a numeric Telegram user ID' }, { status: 400 });
  }

  if (!ALLOWED_CHANNEL_TYPES.has(channel_type)) {
    return NextResponse.json({ error: 'channel_type must be telegram or line' }, { status: 400 });
  }

  const db = getDb();
  const channelId = tg_uid.trim();

  // Guard: another creator must not own this channel_id already
  const { data: existing } = await db
    .from('hermes_channels')
    .select('creator_id')
    .eq('channel_type', channel_type)
    .eq('channel_id', channelId)
    .eq('is_active', true)
    .maybeSingle();

  if (existing && existing.creator_id !== session.creatorId) {
    return NextResponse.json(
      { error: 'This Telegram account is already linked to another creator.' },
      { status: 409 }
    );
  }

  const { error } = await db.from('hermes_channels').upsert(
    {
      creator_id: session.creatorId,
      channel_type,
      channel_id: channelId,
      is_primary: true,
      is_active: true,
      linked_at: new Date().toISOString(),
      unlinked_at: null,
    },
    { onConflict: 'creator_id,channel_type' }
  );

  if (error) {
    console.error('[hermes/link-channel] upsert error', error);
    return NextResponse.json({ error: 'Failed to link channel' }, { status: 500 });
  }

  console.log(
    `[hermes/link-channel] linked creator_id=${session.creatorId} channel_type=${channel_type} channel_id=${channelId}`
  );

  return NextResponse.json({ ok: true, channel_type, channel_id: channelId });
}
