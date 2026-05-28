// OF-117 / HID-004: Fan account recovery proxy.
// Supports both JSON (backup_email / backup_phone) and multipart (id_attestation).
// Forwards Replit Auth headers so the API server can identify the fan.
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';

export const runtime = 'nodejs';

const REPLIT_HEADERS = [
  'x-replit-user-id',
  'x-replit-user-name',
  'x-replit-user-roles',
  'x-replit-user-bio',
  'x-replit-user-profile-image',
  'x-replit-user-url',
  'x-replit-user-teams',
] as const;

function forwardReplitHeaders(req: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of REPLIT_HEADERS) {
    const v = req.headers.get(h);
    if (v) out[h] = v;
  }
  return out;
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';
  const replitHeaders = forwardReplitHeaders(req);

  let upstream: Response;

  if (contentType.includes('multipart/form-data')) {
    // ID attestation — forward the multipart body as-is
    const blob = await req.blob();
    upstream = await fetch(`${API_BASE}/api/account/fan/recover`, {
      method: 'POST',
      headers: {
        'content-type': contentType,
        ...replitHeaders,
      },
      body: blob,
    });
  } else {
    // Backup email / phone — JSON body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    upstream = await fetch(`${API_BASE}/api/account/fan/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...replitHeaders },
      body: JSON.stringify(body),
    });
  }

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
