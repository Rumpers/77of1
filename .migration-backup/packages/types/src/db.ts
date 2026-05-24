// DB row shapes — structural mirror of the PostgreSQL schema (migrations 001–007)
// For API-layer contracts (request/response), see ./platform.ts

// ─── Primitives ──────────────────────────────────────────────────────────────

export type DbConsentGrantType =
  | 'persona_text'
  | 'voice'
  | 'image'
  | 'talking_video'
  | 'fullbody_video'
  | 'social_oauth';

export type DbIntensityDial = 'warm' | 'intimate' | 'explicit';
export type DbMonetizationModel = 'subscription' | 'pay_per_message' | 'tiered' | 'free';
export type DbEmojiUsage = 'none' | 'minimal' | 'moderate' | 'heavy';
export type DbContentModality = 'text' | 'voice' | 'video' | 'image';
export type DbJobStatus = 'queued' | 'processing' | 'done' | 'failed' | 'cancelled';
export type DbWindowSize = 'daily' | 'weekly' | 'monthly';

// ─── creators ────────────────────────────────────────────────────────────────

export interface DbCreator {
  id: string;
  telegram_user_id: string | null;
  replit_user_id: string | null;  // migration 007: Replit Auth identity mapping
  display_name: string;
  created_at: string;
}

// ─── creator_config ──────────────────────────────────────────────────────────

export interface DbCreatorConfig {
  creator_id: string;
  handle: string;
  brand_color: string | null;
  font_weight: string | null;
  cover_image_url: string | null;
  monetization_model: DbMonetizationModel;
  languages_served: string[];
  intensity_dial: DbIntensityDial;
  forbidden_topics: string[];
  paused: boolean;
  persona_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── creator_personas ────────────────────────────────────────────────────────

export interface DbCreatorPersona {
  id: string;
  creator_id: string;
  greeting_style: string;
  fan_endearment: string;
  emoji_usage: DbEmojiUsage;
  bounds: string[];
  treatment_style: string;
  personality_traits: string[];
  message_style: string;
  intensity_dial: DbIntensityDial;
  updated_at: string;
}

// ─── consent_grants ──────────────────────────────────────────────────────────

export interface DbConsentGrant {
  id: string;
  creator_id: string;
  modality: DbContentModality;          // migration 001 original column
  grant_type: DbConsentGrantType | null; // migration 004 extended enum
  version: number;
  consent_grant_version: number;         // migration 004: which policy version was signed
  granted_at: string;
  revoked_at: string | null;
}

// ─── fan_sessions ────────────────────────────────────────────────────────────

export interface DbFanSession {
  id: string;
  creator_id: string;
  started_at: string;
  last_active_at: string;
}

// ─── fan_accounts ────────────────────────────────────────────────────────────

export interface DbFanAccount {
  fan_id: string;
  creator_id: string;
  replit_user_id: string | null;  // migration 007: Replit Auth identity mapping
  trial_count: number;
  credit_balance: number; // migration 005: spendable credits
  created_at: string;
}

// ─── generation_jobs ─────────────────────────────────────────────────────────

export interface DbGenerationJob {
  id: string;
  creator_id: string;
  fan_session_id: string;
  consent_grant_id: string;
  modality: DbContentModality;
  status: DbJobStatus;
  result_url: string | null;
  error_message: string | null;
  consent_grant_version: number; // migration 003
  created_at: string;
  completed_at: string | null;
}

// ─── usage_counters ──────────────────────────────────────────────────────────

export interface DbUsageCounter {
  fan_id: string;
  creator_id: string;
  modality: DbContentModality;
  window_start: string;
  window_size: DbWindowSize;
  count: number;
  updated_at: string;
}

// ─── creator_rag_entries (legacy) ────────────────────────────────────────────

export interface DbCreatorRagEntry {
  id: string;
  creator_id: string;
  content: string;
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── creator_content_embeddings ──────────────────────────────────────────────

export interface DbCreatorContentEmbedding {
  id: string;
  creator_id: string;
  chunk_text: string;
  embedding: number[] | null; // vector(1536) in DB
  source_type: string;
  created_at: string;
}

// ─── credit_packs ─────────────────────────────────────────────────────────────

export type DbMarket = 'JP' | 'TW' | 'EN';
export type DbCurrency = 'JPY' | 'TWD' | 'USD';

export interface DbCreditPack {
  id: string;              // e.g. 'jp_490'
  market: DbMarket;
  credits: number;
  price_cents: number;     // smallest currency unit
  currency: DbCurrency;
  stripe_price_id: string;
  active: boolean;
  created_at: string;
}

// ─── stripe_events ────────────────────────────────────────────────────────────

export interface DbStripeEvent {
  stripe_event_id: string;
  processed_at: string;
}
