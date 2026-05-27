// HID-069: OAuth token service
// Handles encrypted storage and transparent refresh of creator OAuth tokens.
// Proactive refresh threshold: 5 minutes before expiry.
// Max consecutive refresh failures before the token is marked dead: 3.

import { encrypt, decrypt } from "./token-crypto.js";
import { getSupabase } from "./supabase.js";
import { logger } from "./logger.js";

export type OAuthPlatform = "17live" | "line" | "youtube";

export type OAuthTokenData = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: Date;
  scope?: string;
  platformUserId?: string;
  platformUsername?: string;
};

export type StoredOAuthToken = OAuthTokenData & {
  id: string;
  creatorId: string;
  platform: OAuthPlatform;
  lastRefreshedAt?: Date;
  refreshFailCount: number;
};

// Seconds before expiry at which we proactively refresh.
const REFRESH_BUFFER_SECS = 5 * 60;
// Max failures before we stop attempting refresh and require re-auth.
const MAX_REFRESH_FAILURES = 3;

// ─── Platform refresh endpoint configuration ──────────────────────────────────
// Each platform's token refresh is handled by calling its token endpoint with
// grant_type=refresh_token. Credentials come from env vars.

type PlatformConfig = {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
};

function getPlatformConfig(platform: OAuthPlatform): PlatformConfig {
  switch (platform) {
    case "17live": {
      const clientId = process.env.SEVENTEEN_LIVE_CLIENT_ID;
      const clientSecret = process.env.SEVENTEEN_LIVE_CLIENT_SECRET;
      if (!clientId || !clientSecret)
        throw new Error("17 Live OAuth credentials not configured");
      return {
        tokenUrl: "https://api.17.live/oauth/token",
        clientId,
        clientSecret,
      };
    }
    case "line": {
      const clientId = process.env.LINE_CHANNEL_ID;
      const clientSecret = process.env.LINE_CHANNEL_SECRET;
      if (!clientId || !clientSecret)
        throw new Error("LINE OAuth credentials not configured");
      return {
        tokenUrl: "https://api.line.me/oauth2/v2.1/token",
        clientId,
        clientSecret,
      };
    }
    case "youtube": {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret)
        throw new Error("Google/YouTube OAuth credentials not configured");
      return {
        tokenUrl: "https://oauth2.googleapis.com/token",
        clientId,
        clientSecret,
      };
    }
  }
}

// ─── Core service ──────────────────────────────────────────────────────────────

// Persist or update a token set for a creator+platform. Encrypts before write.
export async function upsertOAuthToken(
  creatorId: string,
  platform: OAuthPlatform,
  tokens: OAuthTokenData,
): Promise<void> {
  const db = getSupabase();
  const now = new Date().toISOString();

  const row = {
    creator_id: creatorId,
    platform,
    access_token_enc: encrypt(tokens.accessToken),
    refresh_token_enc: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
    token_type: tokens.tokenType ?? "Bearer",
    expires_at: tokens.expiresAt?.toISOString() ?? null,
    scope: tokens.scope ?? null,
    platform_user_id: tokens.platformUserId ?? null,
    platform_username: tokens.platformUsername ?? null,
    last_refreshed_at: now,
    refresh_fail_count: 0,
    refresh_failed_at: null,
    updated_at: now,
  };

  const { error } = await db
    .from("creator_oauth_tokens")
    .upsert(row, { onConflict: "creator_id,platform" });

  if (error) throw new Error(`Failed to upsert OAuth token: ${error.message}`);
}

// Returns the decrypted token for a creator+platform.
// Auto-refreshes if the token expires within REFRESH_BUFFER_SECS.
// Returns null if no token is stored, or if the token is dead (too many failures).
export async function getOAuthToken(
  creatorId: string,
  platform: OAuthPlatform,
): Promise<StoredOAuthToken | null> {
  const db = getSupabase();

  const { data, error } = await db
    .from("creator_oauth_tokens")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("platform", platform)
    .maybeSingle();

  if (error) {
    logger.error({ err: error, creatorId, platform }, "[oauth-tokens] getOAuthToken query error");
    return null;
  }
  if (!data) return null;
  if (data.refresh_fail_count >= MAX_REFRESH_FAILURES) {
    logger.warn({ creatorId, platform }, "[oauth-tokens] token dead — too many refresh failures");
    return null;
  }

  // Decrypt stored fields
  let accessToken: string;
  try {
    accessToken = decrypt(data.access_token_enc);
  } catch {
    logger.error({ creatorId, platform }, "[oauth-tokens] access token decryption failed");
    return null;
  }
  let refreshToken: string | undefined;
  if (data.refresh_token_enc) {
    try {
      refreshToken = decrypt(data.refresh_token_enc);
    } catch {
      logger.warn({ creatorId, platform }, "[oauth-tokens] refresh token decryption failed");
    }
  }

  const expiresAt = data.expires_at ? new Date(data.expires_at) : undefined;
  const needsRefresh =
    expiresAt != null &&
    expiresAt.getTime() - Date.now() < REFRESH_BUFFER_SECS * 1000 &&
    !!refreshToken;

  let token: StoredOAuthToken = {
    id: data.id,
    creatorId,
    platform,
    accessToken,
    refreshToken,
    tokenType: data.token_type,
    expiresAt,
    scope: data.scope ?? undefined,
    platformUserId: data.platform_user_id ?? undefined,
    platformUsername: data.platform_username ?? undefined,
    lastRefreshedAt: data.last_refreshed_at ? new Date(data.last_refreshed_at) : undefined,
    refreshFailCount: data.refresh_fail_count,
  };

  if (needsRefresh) {
    const refreshed = await performRefresh(creatorId, platform, refreshToken!);
    if (refreshed) token = refreshed;
  }

  return token;
}

// Returns connection status without decrypting or refreshing tokens.
export async function getOAuthStatus(
  creatorId: string,
  platform: OAuthPlatform,
): Promise<{ connected: boolean; platformUsername?: string; expiresAt?: string; dead?: boolean }> {
  const db = getSupabase();
  const { data } = await db
    .from("creator_oauth_tokens")
    .select("platform_username, expires_at, refresh_fail_count")
    .eq("creator_id", creatorId)
    .eq("platform", platform)
    .maybeSingle();

  if (!data) return { connected: false };
  const dead = data.refresh_fail_count >= MAX_REFRESH_FAILURES;
  return {
    connected: !dead,
    dead,
    platformUsername: data.platform_username ?? undefined,
    expiresAt: data.expires_at ?? undefined,
  };
}

// Revoke and delete stored tokens for a creator+platform.
export async function revokeOAuthToken(
  creatorId: string,
  platform: OAuthPlatform,
): Promise<void> {
  const db = getSupabase();
  const { error } = await db
    .from("creator_oauth_tokens")
    .delete()
    .eq("creator_id", creatorId)
    .eq("platform", platform);
  if (error) throw new Error(`Failed to revoke OAuth token: ${error.message}`);
}

// ─── Internal refresh ─────────────────────────────────────────────────────────

async function performRefresh(
  creatorId: string,
  platform: OAuthPlatform,
  refreshToken: string,
): Promise<StoredOAuthToken | null> {
  const db = getSupabase();
  let config: PlatformConfig;
  try {
    config = getPlatformConfig(platform);
  } catch (err) {
    logger.error({ err, platform }, "[oauth-tokens] platform not configured for refresh");
    return null;
  }

  let body: Record<string, string>;
  try {
    const resp = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    body = await resp.json() as Record<string, string>;
  } catch (err) {
    logger.warn({ err, creatorId, platform }, "[oauth-tokens] token refresh failed");
    // Read current fail count, then increment — avoids needing a stored procedure.
    const { data: cur } = await db
      .from("creator_oauth_tokens")
      .select("refresh_fail_count")
      .eq("creator_id", creatorId)
      .eq("platform", platform)
      .maybeSingle();
    await db
      .from("creator_oauth_tokens")
      .update({
        refresh_fail_count: (cur?.refresh_fail_count ?? 0) + 1,
        refresh_failed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("creator_id", creatorId)
      .eq("platform", platform);
    return null;
  }

  const newAccessToken = body.access_token as string;
  const newRefreshToken = (body.refresh_token as string | undefined) ?? refreshToken;
  const expiresIn = parseInt(body.expires_in as string, 10);
  const expiresAt = isNaN(expiresIn)
    ? undefined
    : new Date(Date.now() + expiresIn * 1000);

  await upsertOAuthToken(creatorId, platform, {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    tokenType: (body.token_type as string) ?? "Bearer",
    expiresAt,
    scope: (body.scope as string | undefined),
  });

  logger.info({ creatorId, platform }, "[oauth-tokens] token refreshed successfully");

  return {
    id: "",
    creatorId,
    platform,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    tokenType: (body.token_type as string) ?? "Bearer",
    expiresAt,
    scope: (body.scope as string | undefined),
    lastRefreshedAt: new Date(),
    refreshFailCount: 0,
  };
}
