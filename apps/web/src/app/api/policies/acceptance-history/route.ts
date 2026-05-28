import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const API_BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:3001';

const REPLIT_HEADERS = [
  'x-replit-user-id',
  'x-replit-user-name',
  'x-replit-user-roles',
  'x-replit-user-bio',
  'x-replit-user-profile-image',
  'x-replit-user-url',
  'x-replit-user-teams',
] as const;

// GET /api/policies/acceptance-history
// Proxy to api-server. Returns full version history queryable per user.
export async function GET(req: NextRequest) {
  const headers: Record<string, string> = {};
  for (const h of REPLIT_HEADERS) {
    const v = req.headers.get(h);
    if (v) headers[h] = v;
  }

  try {
    const upstream = await fetch(`${API_BASE}/api/policies/acceptance-history`, {
      headers,
      cache: 'no-store',
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Upstream unavailable' }, { status: 503 });
  }
}
