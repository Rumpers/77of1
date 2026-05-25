import { NextRequest, NextResponse } from 'next/server';
import { createClient, getSupabaseUrl, getSupabaseServiceKey } from '@7of1/db';
import { requireCreatorAuth, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';

function getDb() {
  return createClient(getSupabaseUrl(), getSupabaseServiceKey());
}

// POST /api/assets
// Body: { assetType, storagePath }
// DB trigger auto-creates version 1 on insert.
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

  const { assetType, storagePath } = body as { assetType?: string; storagePath?: string };

  if (!assetType || !storagePath) {
    return NextResponse.json({ error: 'assetType and storagePath are required' }, { status: 400 });
  }

  const validTypes = ['photo', 'video', 'audio'];
  if (!validTypes.includes(assetType)) {
    return NextResponse.json(
      { error: `assetType must be one of: ${validTypes.join(', ')}` },
      { status: 400 },
    );
  }

  const db = getDb();

  const { data: asset, error } = await db
    .from('creator_assets')
    .insert({
      creator_id: session.creatorId,
      asset_type: assetType,
      storage_path: storagePath,
      consent_status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[assets] insert error', error);
    return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 });
  }

  return NextResponse.json(asset, { status: 201 });
}
