import { NextRequest, NextResponse } from 'next/server';
import { createClient, getSupabaseUrl, getSupabaseServiceKey } from '@7of1/db';
import { requireCreatorAuth, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';

function getDb() {
  return createClient(getSupabaseUrl(), getSupabaseServiceKey());
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { assetId: string; versionId: string } },
) {
  let session: { creatorId: string };
  try {
    session = await requireCreatorAuth();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Auth failed' }, { status: 401 });
  }

  const { assetId, versionId } = params;
  const db = getDb();

  const { data: asset, error: assetErr } = await db
    .from('creator_assets')
    .select('id')
    .eq('id', assetId)
    .eq('creator_id', session.creatorId)
    .maybeSingle();

  if (assetErr || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const { data: version, error } = await db
    .from('content_versions')
    .select('*')
    .eq('id', versionId)
    .eq('asset_id', assetId)
    .maybeSingle();

  if (error) {
    console.error('[versions/:id] select error', error);
    return NextResponse.json({ error: 'Failed to fetch version' }, { status: 500 });
  }

  if (!version) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }

  return NextResponse.json(version);
}
