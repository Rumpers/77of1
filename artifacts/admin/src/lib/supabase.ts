import { createClient } from '@supabase/supabase-js';

let _client: ReturnType<typeof createClient> | null = null;

/**
 * Service-role Supabase client for admin use.
 * Bypasses RLS — only use for staff-initiated verification queries.
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars.
 */
export function getAdminSupabase(): ReturnType<typeof createClient> {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    _client = createClient(url, key, { auth: { persistSession: false } });
  }
  return _client;
}
