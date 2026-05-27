/**
 * HID-069: OAuth token storage + refresh.
 *
 * Handles encrypted storage and transparent refresh of creator OAuth tokens.
 * Tokens are AES-256-GCM encrypted before hitting the database.
 *
 * Providers:
 *   stripe_connect — Stripe Connect standard account (payout splits)
 *   line_pay       — LINE Pay merchant API
 *   17live         — 17 Live streaming API
 */

import crypto from "crypto";
import { getSupabase } from "./supabase.js";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Encryption ────────────────────────────────────────────────────────────────

const ALGO = "aes-256-gcm";
const KEY_LEN = 32; // bytes for AES-256
const IV_LEN = 12;  // bytes for GCM nonce

function getEncKey(): Buffer {
  const raw = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== KEY_LEN) {
    throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  }
  return buf;
}

function encrypt(plaintext: string): string {
  const key = getEncKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // format: <iv:24hex><tag:32hex><ciphertext:hex>
  return iv.toString("hex") + tag.toString("hex") + ct.toString("hex");
}

function decrypt(encoded: string): string {
  const iv = Buffer.from(encoded.slice(0, 24), "hex");
  const tag = Buffer.from(encoded.slice(24, 56), "hex");
  const ct = Buffer.from(encoded.slice(56), "hex");
  const key = getEncKey();
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ct) + decipher.final("utf8");
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type OAuthProvider = "stripe_connect" | "line_pay" | "17live";

export interface OAuthTokenInput {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  expiresIn?: number;        // seconds from now
  expiresAt?: Date;          // absolute, takes precedence over expiresIn
  providerUserId?: string;
  rawMetadata?: Record<string, unknown>;
}

export interface StoredOAuthToken {
  id: string;
  creatorId: string;
  provider: OAuthProvider;
  accessToken: string;       // decrypted
  refreshToken: string | null; // decrypted
  tokenType: string;
  scope: string | null;
  expiresAt: Date | null;
  providerUserId: string | null;
  rawMetadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ── Refresh handlers (pluggable per provider) ─────────────────────────────────

export interface RefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  rawMetadata?: Record<string, unknown>;
}

type RefreshHandler = (
  current: StoredOAuthToken,
) => Promise<RefreshResult>;

const refreshHandlers: Partial<Record<OAuthProvider, RefreshHandler>> = {};

export function registerRefreshHandler(
  provider: OAuthProvider,
  handler: RefreshHandler,
): void {
  refreshHandlers[provider] = handler;
}

// ── Core operations ───────────────────────────────────────────────────────────

export async function storeOAuthToken(
  creatorId: string,
  provider: OAuthProvider,
  input: OAuthTokenInput,
): Promise<void> {
  const db = getSupabase();

  const expiresAt =
    input.expiresAt ??
    (input.expiresIn != null
      ? new Date(Date.now() + input.expiresIn * 1000)
      : null);

  const row = {
    creator_id: creatorId,
    provider,
    access_token: encrypt(input.accessToken),
    refresh_token: input.refreshToken ? encrypt(input.refreshToken) : null,
    token_type: input.tokenType ?? "Bearer",
    scope: input.scope ?? null,
    expires_at: expiresAt?.toISOString() ?? null,
    provider_user_id: input.providerUserId ?? null,
    raw_metadata: input.rawMetadata ?? {},
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from("creator_oauth_tokens")
    .upsert(row, { onConflict: "creator_id,provider" });

  if (error) throw new Error(`storeOAuthToken: ${error.message}`);
}

export async function getOAuthToken(
  creatorId: string,
  provider: OAuthProvider,
  { autoRefresh = true }: { autoRefresh?: boolean } = {},
): Promise<StoredOAuthToken | null> {
  const db = getSupabase();

  const { data, error } = await db
    .from("creator_oauth_tokens")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) throw new Error(`getOAuthToken: ${error.message}`);
  if (!data) return null;

  const token = decryptRow(data);

  if (autoRefresh && needsRefresh(token)) {
    return refreshOAuthToken(creatorId, provider, db, token);
  }

  return token;
}

export async function revokeOAuthToken(
  creatorId: string,
  provider: OAuthProvider,
): Promise<void> {
  const db = getSupabase();
  const { error } = await db
    .from("creator_oauth_tokens")
    .delete()
    .eq("creator_id", creatorId)
    .eq("provider", provider);
  if (error) throw new Error(`revokeOAuthToken: ${error.message}`);
}

export async function listOAuthConnections(
  creatorId: string,
): Promise<Array<{ provider: OAuthProvider; connectedAt: Date; scope: string | null; providerUserId: string | null }>> {
  const db = getSupabase();
  const { data, error } = await db
    .from("creator_oauth_tokens")
    .select("provider, created_at, scope, provider_user_id")
    .eq("creator_id", creatorId);

  if (error) throw new Error(`listOAuthConnections: ${error.message}`);
  return (data ?? []).map((row) => ({
    provider: row.provider as OAuthProvider,
    connectedAt: new Date(row.created_at),
    scope: row.scope,
    providerUserId: row.provider_user_id,
  }));
}

// ── Internal helpers ──────────────────────────────────────────────────────────

// Refresh 5 minutes before actual expiry
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

function needsRefresh(token: StoredOAuthToken): boolean {
  if (!token.expiresAt) return false;
  return token.expiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decryptRow(row: Record<string, any>): StoredOAuthToken {
  return {
    id: row.id,
    creatorId: row.creator_id,
    provider: row.provider as OAuthProvider,
    accessToken: decrypt(row.access_token),
    refreshToken: row.refresh_token ? decrypt(row.refresh_token) : null,
    tokenType: row.token_type,
    scope: row.scope,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    providerUserId: row.provider_user_id,
    rawMetadata: row.raw_metadata ?? {},
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

async function refreshOAuthToken(
  creatorId: string,
  provider: OAuthProvider,
  db: SupabaseClient,
  current: StoredOAuthToken,
): Promise<StoredOAuthToken> {
  const handler = refreshHandlers[provider];
  if (!handler) {
    // No refresh handler registered — return current token even if stale
    return current;
  }

  const result = await handler(current);

  const expiresAt = result.expiresIn
    ? new Date(Date.now() + result.expiresIn * 1000)
    : current.expiresAt;

  const update = {
    access_token: encrypt(result.accessToken),
    refresh_token: result.refreshToken
      ? encrypt(result.refreshToken)
      : current.refreshToken
      ? encrypt(current.refreshToken)
      : null,
    expires_at: expiresAt?.toISOString() ?? null,
    raw_metadata: result.rawMetadata ?? current.rawMetadata,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from("creator_oauth_tokens")
    .update(update)
    .eq("creator_id", creatorId)
    .eq("provider", provider);

  if (error) throw new Error(`refreshOAuthToken: ${error.message}`);

  return {
    ...current,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken ?? current.refreshToken,
    expiresAt,
    rawMetadata: (result.rawMetadata ?? current.rawMetadata) as Record<string, unknown>,
    updatedAt: new Date(),
  };
}
