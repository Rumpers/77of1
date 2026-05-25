import { NextRequest, NextResponse } from 'next/server';
import { createClient, getSupabaseUrl, getSupabaseServiceKey } from '@7of1/db';
import { requireCreatorAuth, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';

function getDb() {
  return createClient(getSupabaseUrl(), getSupabaseServiceKey());
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { assetId: string } },
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

  const { assetId } = params;
  const db = getDb();

  // Verify asset belongs to creator
  const { data: asset, error: assetErr } = await db
    .from('creator_assets')
    .select('id')
    .eq('id', assetId)
    .eq('creator_id', session.creatorId)
    .maybeSingle();

  if (assetErr || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const { data: versions, error } = await db
    .from('content_versions')
    .select('*')
    .eq('asset_id', assetId)
    .order('version_num', { ascending: true });

  if (error) {
    console.error('[versions] select error', error);
    return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 });
  }

  return NextResponse.json(versions ?? []);
}
