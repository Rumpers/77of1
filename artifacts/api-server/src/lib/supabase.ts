import { createClient } from "@supabase/supabase-js";

// Service-role client: full DB access, no RLS. Server-only.
export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role env vars not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Anon-key client: respects RLS. Used for auth operations (signInWithOtp, verifyOtp).
export function getSupabaseAnon() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_ANON_KEY not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Validate a Supabase JWT. Returns the user or null if invalid/expired.
export async function getUserFromToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { data, error } = await getSupabase().auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

export const COOKIE_ACCESS_TOKEN = "sb-access-token";
export const COOKIE_REFRESH_TOKEN = "sb-refresh-token";

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
