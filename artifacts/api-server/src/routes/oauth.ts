// HID-069: OAuth connection routes
// Handles initiation, callback, status, and revocation of creator OAuth connections.
// Supported platforms: 17live, line, youtube.
//
// Flow:
//   Creator visits GET /api/oauth/:platform/connect
//   → redirected to external auth page
//   → external page redirects to GET /api/oauth/:platform/callback?code=...&state=...
//   → tokens stored encrypted; creator redirected to dashboard

import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import {
  upsertOAuthToken,
  getOAuthStatus,
  revokeOAuthToken,
  type OAuthPlatform,
} from "../lib/oauth-tokens.js";
import { requireCreatorAuth } from "../middlewares/require-creator-auth.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const VALID_PLATFORMS: OAuthPlatform[] = ["17live", "line", "youtube"];

function parsePlatform(raw: string): OAuthPlatform | null {
  return VALID_PLATFORMS.includes(raw as OAuthPlatform) ? (raw as OAuthPlatform) : null;
}

// Per-platform OAuth2 authorization URL builders.
// State is a CSRF token bound to the creator session.
function buildAuthorizationUrl(platform: OAuthPlatform, state: string): string {
  const redirectUri = `${process.env.API_BASE_URL}/api/oauth/${platform}/callback`;

  switch (platform) {
    case "17live": {
      const clientId = process.env.SEVENTEEN_LIVE_CLIENT_ID ?? "";
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "profile stream:read earnings:read",
        state,
      });
      return `https://auth.17.live/oauth/authorize?${params}`;
    }
    case "line": {
      const clientId = process.env.LINE_CHANNEL_ID ?? "";
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "profile openid",
        state,
      });
      return `https://access.line.me/oauth2/v2.1/authorize?${params}`;
    }
    case "youtube": {
      const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/youtube.readonly",
        access_type: "offline",
        prompt: "consent",
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }
  }
}

async function exchangeCodeForTokens(
  platform: OAuthPlatform,
  code: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number; scope?: string } | null> {
  const redirectUri = `${process.env.API_BASE_URL}/api/oauth/${platform}/callback`;

  let tokenUrl: string;
  let clientId: string;
  let clientSecret: string;

  switch (platform) {
    case "17live":
      tokenUrl = "https://api.17.live/oauth/token";
      clientId = process.env.SEVENTEEN_LIVE_CLIENT_ID ?? "";
      clientSecret = process.env.SEVENTEEN_LIVE_CLIENT_SECRET ?? "";
      break;
    case "line":
      tokenUrl = "https://api.line.me/oauth2/v2.1/token";
      clientId = process.env.LINE_CHANNEL_ID ?? "";
      clientSecret = process.env.LINE_CHANNEL_SECRET ?? "";
      break;
    case "youtube":
      tokenUrl = "https://oauth2.googleapis.com/token";
      clientId = process.env.GOOGLE_CLIENT_ID ?? "";
      clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
      break;
  }

  try {
    const resp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      logger.warn({ platform, status: resp.status, body: text.slice(0, 200) }, "[oauth] code exchange failed");
      return null;
    }
    const body = await resp.json() as Record<string, unknown>;
    return {
      accessToken: body.access_token as string,
      refreshToken: body.refresh_token as string | undefined,
      expiresIn: body.expires_in ? parseInt(body.expires_in as string, 10) : undefined,
      scope: body.scope as string | undefined,
    };
  } catch (err) {
    logger.error({ err, platform }, "[oauth] token exchange network error");
    return null;
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/oauth/:platform/connect
// Redirects the creator to the external OAuth authorization page.
// Requires creator to be authenticated (Supabase cookie).
router.get("/oauth/:platform/connect", requireCreatorAuth, (req: Request, res: Response) => {
  const platform = parsePlatform((req.params["platform"] ?? "") as string);
  if (!platform) {
    res.status(400).json({ error: "Unsupported platform" });
    return;
  }

  const creatorId = res.locals.creatorId as string;
  // State: base64(creatorId):random — used to recover creatorId on callback
  const rand = crypto.randomBytes(16).toString("hex");
  const state = `${Buffer.from(creatorId).toString("base64url")}.${rand}`;

  // Store state in a short-lived httpOnly cookie for CSRF validation
  const url = buildAuthorizationUrl(platform, state);
  res.cookie(`oauth_state_${platform}`, state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: "/",
  });
  res.redirect(302, url);
});

// GET /api/oauth/:platform/callback
// Handles the redirect from the external OAuth provider.
// Verifies state, exchanges code for tokens, stores encrypted tokens.
router.get("/oauth/:platform/callback", async (req: Request, res: Response) => {
  const platform = parsePlatform((req.params["platform"] ?? "") as string);
  if (!platform) {
    res.status(400).send("Unsupported platform");
    return;
  }

  const { code, state, error: oauthError } = req.query as Record<string, string | undefined>;
  const dashboardUrl = process.env.DASHBOARD_URL ?? "/";

  if (oauthError) {
    logger.warn({ platform, oauthError }, "[oauth] provider returned error");
    res.redirect(`${dashboardUrl}?oauth_error=${encodeURIComponent(oauthError)}`);
    return;
  }

  if (!code || !state) {
    res.status(400).send("Missing code or state");
    return;
  }

  // Validate state cookie (CSRF protection)
  const storedState = req.cookies?.[`oauth_state_${platform}`] as string | undefined;
  if (!storedState || storedState !== state) {
    logger.warn({ platform }, "[oauth] state mismatch — possible CSRF");
    res.status(400).send("Invalid state");
    return;
  }

  // Recover creatorId from state
  const creatorId = Buffer.from(state.split(".")[0] ?? "", "base64url").toString("utf8");
  if (!creatorId) {
    res.status(400).send("Invalid state payload");
    return;
  }

  // Clear state cookie
  res.clearCookie(`oauth_state_${platform}`, { path: "/" });

  const tokens = await exchangeCodeForTokens(platform, code);
  if (!tokens) {
    res.redirect(`${dashboardUrl}?oauth_error=token_exchange_failed`);
    return;
  }

  const expiresAt = tokens.expiresIn != null
    ? new Date(Date.now() + tokens.expiresIn * 1000)
    : undefined;

  try {
    await upsertOAuthToken(creatorId, platform, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
      scope: tokens.scope,
    });
  } catch (err) {
    logger.error({ err, platform, creatorId }, "[oauth] failed to persist tokens");
    res.redirect(`${dashboardUrl}?oauth_error=storage_failed`);
    return;
  }

  logger.info({ platform, creatorId }, "[oauth] connection established");
  res.redirect(`${dashboardUrl}?oauth_connected=${platform}`);
});

// GET /api/oauth/:platform/status
// Returns connection status for the authenticated creator (no token values exposed).
router.get("/oauth/:platform/status", requireCreatorAuth, async (req: Request, res: Response) => {
  const platform = parsePlatform((req.params["platform"] ?? "") as string);
  if (!platform) {
    res.status(400).json({ error: "Unsupported platform" });
    return;
  }

  const creatorId = res.locals.creatorId as string;
  try {
    const status = await getOAuthStatus(creatorId, platform);
    res.json({ platform, ...status });
  } catch (err) {
    logger.error({ err, platform, creatorId }, "[oauth] status query error");
    res.status(500).json({ error: "Failed to fetch connection status" });
  }
});

// DELETE /api/oauth/:platform
// Revokes and deletes stored tokens for the authenticated creator.
router.delete("/oauth/:platform", requireCreatorAuth, async (req: Request, res: Response) => {
  const platform = parsePlatform((req.params["platform"] ?? "") as string);
  if (!platform) {
    res.status(400).json({ error: "Unsupported platform" });
    return;
  }

  const creatorId = res.locals.creatorId as string;
  try {
    await revokeOAuthToken(creatorId, platform);
    logger.info({ platform, creatorId }, "[oauth] connection revoked");
    res.json({ revoked: true, platform });
  } catch (err) {
    logger.error({ err, platform, creatorId }, "[oauth] revoke error");
    res.status(500).json({ error: "Failed to revoke connection" });
  }
});

export default router;
