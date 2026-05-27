import { NextRequest, NextResponse } from 'next/server';
import { createClient, getSupabaseUrl, getSupabaseServiceKey } from '@7of1/db';
import { requireCreatorAuth, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';

function getDb() {
  return createClient(getSupabaseUrl(), getSupabaseServiceKey());
}

// PATCH /api/assets/:assetId
// Body: { storagePath? }
// DB trigger auto-increments version when storagePath changes.
export async function PATCH(
  req: NextRequest,
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { storagePath } = body as { storagePath?: string };

  if (!storagePath) {
    return NextResponse.json({ error: 'storagePath is required' }, { status: 400 });
  }

  const { assetId } = params;
  const db = getDb();

  const { data: asset, error } = await db
    .from('creator_assets')
    .update({ storage_path: storagePath, updated_at: new Date().toISOString() })
    .eq('id', assetId)
    .eq('creator_id', session.creatorId)
    .select()
    .single();

  if (error) {
    console.error('[assets/:id] update error', error);
    return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 });
  }

  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  return NextResponse.json(asset);
}
