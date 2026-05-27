import { NextRequest, NextResponse } from 'next/server';
import { createClient, getSupabaseUrl, getSupabaseServiceKey } from '@7of1/db';
import { requireCreatorAuth, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';

function getDb() {
  return createClient(getSupabaseUrl(), getSupabaseServiceKey());
}

// POST /api/approvals
// Body: { assetId, versionId?, reviewerId?, notes? }
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

  const { assetId, versionId, reviewerId, notes } = body as {
    assetId?: string;
    versionId?: string;
    reviewerId?: string;
    notes?: string;
  };

  if (!assetId) {
    return NextResponse.json({ error: 'assetId is required' }, { status: 400 });
  }

  const db = getDb();

  // Verify asset ownership
  const { data: asset, error: assetErr } = await db
    .from('creator_assets')
    .select('id')
    .eq('id', assetId)
    .eq('creator_id', session.creatorId)
    .maybeSingle();

  if (assetErr || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  // If versionId provided, verify it belongs to this asset
  if (versionId) {
    const { data: ver, error: verErr } = await db
      .from('content_versions')
      .select('id')
      .eq('id', versionId)
      .eq('asset_id', assetId)
      .maybeSingle();

    if (verErr || !ver) {
      return NextResponse.json({ error: 'Version not found for this asset' }, { status: 404 });
    }
  }

  const { data: approval, error } = await db
    .from('content_approvals')
    .insert({
      asset_id: assetId,
      approved_version_id: versionId ?? null,
      requested_by: session.creatorId,
      reviewer_id: reviewerId ?? null,
      notes: notes ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[approvals] insert error', error);
    return NextResponse.json({ error: 'Failed to create approval' }, { status: 500 });
  }

  return NextResponse.json(approval, { status: 201 });
}
