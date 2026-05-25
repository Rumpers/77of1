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

// GET /api/policies/pending?user_type=creator|fan
// Proxy to api-server. Returns pending policy versions for re-acceptance gate.
export async function GET(req: NextRequest) {
  const userType = req.nextUrl.searchParams.get('user_type') ?? 'fan';

  const headers: Record<string, string> = {};
  for (const h of REPLIT_HEADERS) {
    const v = req.headers.get(h);
    if (v) headers[h] = v;
  }

  try {
    const upstream = await fetch(
      `${API_BASE}/api/policies/pending?user_type=${encodeURIComponent(userType)}`,
      { headers, cache: 'no-store' }
    );
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    // Fail-open: if upstream is down, return empty pending so user is not blocked.
    return NextResponse.json({ pending: [] });
  }
}
