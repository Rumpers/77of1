import { NextRequest, NextResponse } from 'next/server';
import { createClient, getSupabaseUrl, getSupabaseServiceKey } from '@7of1/db';
import { requireCreatorAuth, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';

function getDb() {
  return createClient(getSupabaseUrl(), getSupabaseServiceKey());
}

// GET /api/assets/:assetId/lineage
// Returns full chain: versions → approvals (with version ref) → posts (with version ref)
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

  const { data: asset, error: assetErr } = await db
    .from('creator_assets')
    .select('id')
    .eq('id', assetId)
    .eq('creator_id', session.creatorId)
    .maybeSingle();

  if (assetErr || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const [versionsRes, approvalsRes, postsRes] = await Promise.all([
    db
      .from('content_versions')
      .select('*')
      .eq('asset_id', assetId)
      .order('version_num', { ascending: true }),
    db
      .from('content_approvals')
      .select('*')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: true }),
    db
      .from('posted_content')
      .select('*')
      .eq('asset_id', assetId)
      .order('posted_at', { ascending: true }),
  ]);

  if (versionsRes.error || approvalsRes.error || postsRes.error) {
    console.error('[lineage] fetch error', {
      versions: versionsRes.error,
      approvals: approvalsRes.error,
      posts: postsRes.error,
    });
    return NextResponse.json({ error: 'Failed to fetch lineage' }, { status: 500 });
  }

  return NextResponse.json({
    versions: versionsRes.data ?? [],
    approvals: approvalsRes.data ?? [],
    posts: postsRes.data ?? [],
  });
}
