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

// POST /api/policies/accept
// Body: { policy_version_ids: string[], user_type?: "creator" | "fan" }
// Proxy to api-server to record acceptance atomically.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  for (const h of REPLIT_HEADERS) {
    const v = req.headers.get(h);
    if (v) headers[h] = v;
  }

  try {
    const upstream = await fetch(`${API_BASE}/api/policies/accept`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Upstream unavailable' }, { status: 503 });
  }
}
