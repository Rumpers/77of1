/**
 * HID-069: OAuth token storage + refresh.
 *
 * Routes:
 *   GET  /api/oauth/connections            — list connected providers
 *   GET  /api/oauth/:provider/connect      — start OAuth flow (redirect)
 *   GET  /api/oauth/:provider/callback     — handle callback + store token
 *   DELETE /api/oauth/:provider            — revoke connection
 */

import { Router, type IRouter, type Request, type Response } from "express";
import Stripe from "stripe";
import {
  storeOAuthToken,
  getOAuthToken,
  revokeOAuthToken,
  listOAuthConnections,
  registerRefreshHandler,
  type OAuthProvider,
} from "../lib/oauth-tokens.js";
import { getReplitUser } from "../lib/auth.js";
import { getSupabase } from "../lib/supabase.js";

const router: IRouter = Router();

// ── Stripe Connect refresh handler ────────────────────────────────────────────

registerRefreshHandler("stripe_connect", async (current) => {
  const clientSecret = process.env.STRIPE_SECRET_KEY;
  if (!clientSecret) throw new Error("STRIPE_SECRET_KEY not set");

  if (!current.refreshToken) {
    throw new Error("No Stripe Connect refresh token available");
  }

  // Stripe Connect tokens do not expire unless explicitly deauthorized,
  // but the standard OAuth deauthorization flow uses refresh tokens.
  // Stripe's token refresh endpoint:
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: current.refreshToken,
  });

  const resp = await fetch("https://connect.stripe.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientSecret}:`).toString("base64")}`,
    },
    body: params.toString(),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Stripe token refresh failed: ${err}`);
  }

  const json = (await resp.json()) as {
    access_token: string;
    refresh_token?: string;
    stripe_user_id?: string;
    token_type?: string;
    scope?: string;
  };

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    rawMetadata: {
      stripe_user_id: json.stripe_user_id ?? current.providerUserId,
      token_type: json.token_type,
      scope: json.scope,
    },
  };
});

// ── LINE Pay refresh handler (client credentials) ─────────────────────────────

registerRefreshHandler("line_pay", async () => {
  const channelId = process.env.LINE_PAY_CHANNEL_ID;
  const channelSecret = process.env.LINE_PAY_CHANNEL_SECRET;
  if (!channelId || !channelSecret) {
    throw new Error("LINE_PAY_CHANNEL_ID / LINE_PAY_CHANNEL_SECRET not set");
  }

  // LINE Pay uses HMAC-signed requests; access token is derived from channel
  // credentials, not a user-level token. For now we re-derive it.
  const nonce = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const { createHmac } = await import("crypto");
  const sig = createHmac("sha256", channelSecret)
    .update(`${channelId}${timestamp}${nonce}`)
    .digest("base64");

  // Resolve the access token endpoint per LINE Pay sandbox vs prod
  const base =
    process.env.LINE_PAY_ENV === "sandbox"
      ? "https://sandbox-api-pay.line.me"
      : "https://api-pay.line.me";

  const resp = await fetch(`${base}/v3/oauth/accessToken`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-LINE-ChannelId": channelId,
      "X-LINE-Authorization-Nonce": nonce,
      "X-LINE-Authorization": sig,
    },
    body: JSON.stringify({ grantType: "client_credentials" }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`LINE Pay token refresh failed: ${err}`);
  }

  const json = (await resp.json()) as {
    info?: { accessToken?: string; expiresIn?: number };
    returnCode?: string;
  };

  if (json.returnCode !== "0000" || !json.info?.accessToken) {
    throw new Error(`LINE Pay token refresh returned non-zero: ${json.returnCode}`);
  }

  return {
    accessToken: json.info.accessToken,
    expiresIn: json.info.expiresIn,
  };
});

// ── Helper: resolve creator id from Replit auth ───────────────────────────────

async function getCreatorId(req: Request): Promise<string | null> {
  const user = getReplitUser(req);
  if (!user) return null;
  const db = getSupabase();
  const { data } = await db
    .from("creators")
    .select("id")
    .eq("replit_user_id", user.id)
    .maybeSingle();
  return data?.id ?? null;
}

// ── Supported providers guard ─────────────────────────────────────────────────

const SUPPORTED_PROVIDERS: OAuthProvider[] = ["stripe_connect", "line_pay", "17live"];

function isProvider(p: string): p is OAuthProvider {
  return (SUPPORTED_PROVIDERS as string[]).includes(p);
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/oauth/connections
router.get("/oauth/connections", async (req: Request, res: Response) => {
  const creatorId = await getCreatorId(req);
  if (!creatorId) {
    res.status(401).json({ error: "Creator auth required" });
    return;
  }

  try {
    const connections = await listOAuthConnections(creatorId);
    res.json({ connections });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err: msg }, "[oauth] listConnections failed");
    res.status(500).json({ error: "Failed to list connections" });
  }
});

// GET /api/oauth/:provider/status
router.get("/oauth/:provider/status", async (req: Request, res: Response) => {
  const { provider } = req.params;
  if (!isProvider(provider)) {
    res.status(404).json({ error: "Unknown provider" });
    return;
  }

  const creatorId = await getCreatorId(req);
  if (!creatorId) {
    res.status(401).json({ error: "Creator auth required" });
    return;
  }

  try {
    const token = await getOAuthToken(creatorId, provider, { autoRefresh: false });
    if (!token) {
      res.json({ connected: false });
      return;
    }
    res.json({
      connected: true,
      providerUserId: token.providerUserId,
      scope: token.scope,
      connectedAt: token.createdAt,
      expiresAt: token.expiresAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err: msg, provider }, "[oauth] status check failed");
    res.status(500).json({ error: "Status check failed" });
  }
});

// GET /api/oauth/stripe_connect/connect
// Redirects creator to Stripe's OAuth authorization page.
router.get("/oauth/stripe_connect/connect", async (req: Request, res: Response) => {
  const creatorId = await getCreatorId(req);
  if (!creatorId) {
    res.status(401).json({ error: "Creator auth required" });
    return;
  }

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "Stripe Connect not configured" });
    return;
  }

  const appUrl = process.env.APP_URL ?? "https://7of1.app";
  const state = Buffer.from(JSON.stringify({ creatorId })).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    scope: "read_write",
    response_type: "code",
    redirect_uri: `${appUrl}/api/oauth/stripe_connect/callback`,
    state,
    "stripe_user[email]": "",
    "stripe_user[country]": "US",
    suggested_capabilities: ["transfers"],
  });

  res.redirect(`https://connect.stripe.com/oauth/authorize?${params.toString()}`);
});

// GET /api/oauth/stripe_connect/callback
router.get("/oauth/stripe_connect/callback", async (req: Request, res: Response) => {
  const { code, state, error: oauthError } = req.query as Record<string, string>;

  const appUrl = process.env.APP_URL ?? "https://7of1.app";

  if (oauthError) {
    req.log.warn({ oauthError }, "[oauth/stripe] authorization denied");
    res.redirect(`${appUrl}/creator/settings?oauth_error=${encodeURIComponent(oauthError)}`);
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: "Missing code or state" });
    return;
  }

  let creatorId: string;
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString());
    creatorId = parsed.creatorId;
    if (!creatorId) throw new Error("no creatorId in state");
  } catch {
    res.status(400).json({ error: "Invalid state parameter" });
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    res.status(503).json({ error: "Stripe not configured" });
    return;
  }

  try {
    // @ts-ignore — Stripe apiVersion
    const stripe = new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" });
    const tokenResponse = await stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });

    await storeOAuthToken(creatorId, "stripe_connect", {
      accessToken: tokenResponse.access_token!,
      refreshToken: tokenResponse.refresh_token,
      tokenType: tokenResponse.token_type ?? "Bearer",
      scope: tokenResponse.scope,
      providerUserId: tokenResponse.stripe_user_id,
      rawMetadata: {
        stripe_user_id: tokenResponse.stripe_user_id,
        stripe_publishable_key: tokenResponse.stripe_publishable_key,
        livemode: tokenResponse.livemode,
      },
    });

    req.log.info({ creatorId }, "[oauth/stripe] connected");
    res.redirect(`${appUrl}/creator/settings?oauth_success=stripe_connect`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err: msg }, "[oauth/stripe] callback failed");
    res.redirect(`${appUrl}/creator/settings?oauth_error=stripe_connect_callback_failed`);
  }
});

// GET /api/oauth/line_pay/connect
// LINE Pay uses channel credentials (not user-level OAuth).
// This endpoint provisions the channel token and stores it.
router.get("/oauth/line_pay/connect", async (req: Request, res: Response) => {
  const creatorId = await getCreatorId(req);
  if (!creatorId) {
    res.status(401).json({ error: "Creator auth required" });
    return;
  }

  const channelId = process.env.LINE_PAY_CHANNEL_ID;
  const channelSecret = process.env.LINE_PAY_CHANNEL_SECRET;
  if (!channelId || !channelSecret) {
    res.status(503).json({ error: "LINE Pay not configured" });
    return;
  }

  try {
    const nonce = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const { createHmac } = await import("crypto");
    const sig = createHmac("sha256", channelSecret)
      .update(`${channelId}${timestamp}${nonce}`)
      .digest("base64");

    const base =
      process.env.LINE_PAY_ENV === "sandbox"
        ? "https://sandbox-api-pay.line.me"
        : "https://api-pay.line.me";

    const resp = await fetch(`${base}/v3/oauth/accessToken`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-LINE-ChannelId": channelId,
        "X-LINE-Authorization-Nonce": nonce,
        "X-LINE-Authorization": sig,
      },
      body: JSON.stringify({ grantType: "client_credentials" }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`LINE Pay token request failed: ${err}`);
    }

    const json = (await resp.json()) as {
      info?: { accessToken?: string; expiresIn?: number };
      returnCode?: string;
    };

    if (json.returnCode !== "0000" || !json.info?.accessToken) {
      throw new Error(`LINE Pay returned non-zero: ${json.returnCode}`);
    }

    await storeOAuthToken(creatorId, "line_pay", {
      accessToken: json.info.accessToken,
      expiresIn: json.info.expiresIn,
      providerUserId: channelId,
      rawMetadata: { channel_id: channelId },
    });

    res.json({ ok: true, provider: "line_pay" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err: msg }, "[oauth/line_pay] connect failed");
    res.status(502).json({ error: "LINE Pay connection failed" });
  }
});

// DELETE /api/oauth/:provider
router.delete("/oauth/:provider", async (req: Request, res: Response) => {
  const { provider } = req.params;
  if (!isProvider(provider)) {
    res.status(404).json({ error: "Unknown provider" });
    return;
  }

  const creatorId = await getCreatorId(req);
  if (!creatorId) {
    res.status(401).json({ error: "Creator auth required" });
    return;
  }

  try {
    // For Stripe Connect, also deauthorize on Stripe's side
    if (provider === "stripe_connect") {
      const token = await getOAuthToken(creatorId, "stripe_connect", { autoRefresh: false });
      if (token?.providerUserId) {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        if (secretKey) {
          try {
            // @ts-ignore
            const stripe = new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" });
            await stripe.oauth.deauthorize({
              client_id: process.env.STRIPE_CONNECT_CLIENT_ID!,
              stripe_user_id: token.providerUserId,
            });
          } catch (deauthErr) {
            // Log but continue — local revocation should still succeed
            req.log.warn(
              { err: deauthErr instanceof Error ? deauthErr.message : deauthErr },
              "[oauth/stripe] deauthorize on Stripe failed — revoking locally",
            );
          }
        }
      }
    }

    await revokeOAuthToken(creatorId, provider);
    res.json({ ok: true, provider });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err: msg, provider }, "[oauth] revoke failed");
    res.status(500).json({ error: "Failed to revoke connection" });
  }
});

export default router;
