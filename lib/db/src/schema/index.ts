import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  boolean,
  jsonb,
  integer,
  timestamp,
  real,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Re-exports ──────────────────────────────────────────────────────────────
// Character Card V2 Zod schema + type (PERSONA-01). Persona spec stored in
// twins.character_card JSONB — see ./character-card.ts.
export {
  characterCardV2Schema,
  type CharacterCardV2,
} from "./character-card.js";

// ─── Enums (must be defined BEFORE the pgTable that uses them) ───────────────

export const kycStatusEnum = pgEnum("kyc_status", [
  "pending",
  "signed",
  "rejected",
]);

export const twinVisibilityEnum = pgEnum("twin_visibility", [
  "public",
  "private",
]);

export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
]);

export const retentionCategoryEnum = pgEnum("retention_category", [
  "operational",
  "transcript",
  "audit",
]);

export const consentGrantModalityEnum = pgEnum("consent_grant_modality", [
  "persona_text",
  "voice",
  "image",
  "talking_video",
  "fullbody_video",
]);

export const generationJobStatusEnum = pgEnum("generation_job_status", [
  "queued",
  "processing",
  "complete",
  "failed",
  "cancelled",
  "dlq",
]);

export const crisisLevelEnum = pgEnum("crisis_level", [
  "none",
  "low",
  "medium",
  "high",
]);

// ─── Table 1: creators ────────────────────────────────────────────────────────
// Source: supabase/migrations/20260524000001_schema_v1.sql
// Added: telegram_user_id (needed by hermes findCreatorByTelegramId)
// Added: kill_switch_active (per ARCHITECTURE.md)

export const creatorsTable = pgTable("creators", {
  id: uuid("id").primaryKey().defaultRandom(),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  config: jsonb("config").notNull().default({}),
  replitUserId: text("replit_user_id").unique(),
  telegramUserId: text("telegram_user_id").unique(),
  killSwitchActive: boolean("kill_switch_active").notNull().default(false),
  personaConfig: jsonb("persona_config"),
  intensity: varchar("intensity", { length: 50 }),
  // Monetization target URL (D-02-10). Captured by the persona-wizard final step
  // (plan 02-07) — same value also lives in creators.config.platform_url for
  // platform-name lookup. NULL = creator hasn't completed onboarding yet.
  monetizationUrl: text("monetization_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const insertCreatorSchema = createInsertSchema(creatorsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Creator = typeof creatorsTable.$inferSelect;
export type InsertCreator = z.infer<typeof insertCreatorSchema>;

// ─── Table 2: twins ───────────────────────────────────────────────────────────
// No existing Supabase migration. Created fresh per PERSONA-03.
// visibility: twin_visibility pgEnum default 'private' (PERSONA-03)

export const twinsTable = pgTable("twins", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => creatorsTable.id, { onDelete: "cascade" }),
  handle: text("handle").notNull().unique(),
  status: text("status").notNull().default("inactive"),
  visibility: twinVisibilityEnum("visibility").notNull().default("private"),
  characterCard: jsonb("character_card"),
  // Voice reference clip URL (D-02-02). Replit Object Storage key:
  // creators/{creatorId}/voice_reference.wav — populated by the /voice wizard
  // scene (plan 02-08). NULL until creator uploads a 6+ second voice note.
  voiceReferenceUrl: text("voice_reference_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const insertTwinSchema = createInsertSchema(twinsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Twin = typeof twinsTable.$inferSelect;
export type InsertTwin = z.infer<typeof insertTwinSchema>;

// ─── Table 3: creator_kyc ─────────────────────────────────────────────────────
// Source: supabase/migrations/20260525000001_creator_kyc.sql
// Collapsed from 8-state enum to 3-state per D-05.
// status is NOT NULL DEFAULT 'pending' — prevents null bypass (Pitfall #4).
// Added: voice_synthesis_consent_granted per D-07.

export const creatorKycTable = pgTable("creator_kyc", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id")
    .notNull()
    .unique()
    .references(() => creatorsTable.id, { onDelete: "cascade" }),
  status: kycStatusEnum("status").notNull().default("pending"),
  signwellDocId: text("signwell_doc_id").unique(),
  signwellSigningUrl: text("signwell_signing_url"),
  personalityRightsSignedAt: timestamp("personality_rights_signed_at", {
    withTimezone: true,
  }),
  personalityRightsIpHash: text("personality_rights_ip_hash"),
  voiceSynthesisConsentGranted: boolean(
    "voice_synthesis_consent_granted"
  )
    .notNull()
    .default(false),
  opsNotes: text("ops_notes"),
  opsReviewedBy: text("ops_reviewed_by"),
  opsReviewedAt: timestamp("ops_reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const insertCreatorKycSchema = createInsertSchema(
  creatorKycTable
).omit({ id: true, createdAt: true, updatedAt: true });
export type CreatorKyc = typeof creatorKycTable.$inferSelect;
export type InsertCreatorKyc = z.infer<typeof insertCreatorKycSchema>;

// ─── Table 4: creator_config ──────────────────────────────────────────────────
// Implicit from hermes usage. Not in schema_v1.sql. Created fresh.
// Source: hermes/db.ts — setPaused, getCreatorPreferences, setTimezone, setHermesLanguage

export const creatorConfigTable = pgTable("creator_config", {
  creatorId: uuid("creator_id")
    .primaryKey()
    .references(() => creatorsTable.id, { onDelete: "cascade" }),
  paused: boolean("paused").notNull().default(false),
  timezone: text("timezone").notNull().default("UTC"),
  hermesLanguage: text("hermes_language").notNull().default("en"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const insertCreatorConfigSchema = createInsertSchema(
  creatorConfigTable
).omit({ updatedAt: true });
export type CreatorConfig = typeof creatorConfigTable.$inferSelect;
export type InsertCreatorConfig = z.infer<typeof insertCreatorConfigSchema>;

// ─── Table 5: consent_grants ──────────────────────────────────────────────────
// Source: supabase/migrations/20260524000001_schema_v1.sql
// Modified: consentGrantModality pgEnum (was free text); added retention_category per D-14.
// Added: consentVersion, channel, ipHash per hermes/consent.ts commitConsent.

export const consentGrantsTable = pgTable(
  "consent_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creatorsTable.id, { onDelete: "cascade" }),
    modality: consentGrantModalityEnum("modality").notNull(),
    granted: boolean("granted").notNull().default(false),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    consentVersion: text("consent_version").notNull().default("v1.0"),
    channel: text("channel").notNull().default("telegram"),
    ipHash: text("ip_hash"),
    retentionCategory: retentionCategoryEnum("retention_category")
      .notNull()
      .default("operational"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueCreatorModalityVersion: unique().on(
      t.creatorId,
      t.modality,
      t.version
    ),
  })
);

export const insertConsentGrantSchema = createInsertSchema(
  consentGrantsTable
).omit({ id: true, createdAt: true });
export type ConsentGrant = typeof consentGrantsTable.$inferSelect;
export type InsertConsentGrant = z.infer<typeof insertConsentGrantSchema>;

// ─── Table 6: conversation_messages ──────────────────────────────────────────
// Not in existing Supabase schema. Created fresh per D-03.
// Stores plaintext content with retentionCategory = 'transcript'.
// 90-day TTL applied in Phase 4 cleanup cron.

export const conversationMessagesTable = pgTable(
  "conversation_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: text("conversation_id").notNull(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creatorsTable.id),
    twinId: uuid("twin_id").references(() => twinsTable.id),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    retentionCategory: retentionCategoryEnum("retention_category")
      .notNull()
      .default("transcript"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    conversationIdx: index(
      "conversation_messages_conversation_idx"
    ).on(t.conversationId),
    creatorCreatedIdx: index(
      "conversation_messages_creator_created_idx"
    ).on(t.creatorId, t.createdAt),
  })
);

export const insertConversationMessageSchema = createInsertSchema(
  conversationMessagesTable
).omit({ id: true, createdAt: true });
export type ConversationMessage =
  typeof conversationMessagesTable.$inferSelect;
export type InsertConversationMessage = z.infer<
  typeof insertConversationMessageSchema
>;

// ─── Table 7: generation_jobs ─────────────────────────────────────────────────
// Source: supabase/migrations/20260524000001_schema_v1.sql
// Modified: generationJobStatus pgEnum; added consent_grant_id FK per D-04;
// added retention_category per D-14; removed fan_id FK (out of scope per D-01).
// job_type replaces modality (broader: text|voice|video|moderation).

export const generationJobsTable = pgTable(
  "generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creatorsTable.id),
    consentGrantId: uuid("consent_grant_id")
      .notNull()
      .references(() => consentGrantsTable.id),
    bullmqJobId: text("bullmq_job_id"),
    jobType: text("job_type").notNull(),
    status: generationJobStatusEnum("status").notNull().default("queued"),
    attemptCount: integer("attempt_count").notNull().default(0),
    consentGrantVersion: integer("consent_grant_version")
      .notNull()
      .default(1),
    resultUrl: text("result_url"),
    errorMessage: text("error_message"),
    retentionCategory: retentionCategoryEnum("retention_category")
      .notNull()
      .default("operational"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    creatorIdx: index("generation_jobs_creator_idx").on(t.creatorId),
    revocationIdx: index("generation_jobs_revocation_idx").on(
      t.creatorId,
      t.consentGrantId,
      t.status
    ),
  })
);

export const insertGenerationJobSchema = createInsertSchema(
  generationJobsTable
).omit({ id: true, createdAt: true });
export type GenerationJob = typeof generationJobsTable.$inferSelect;
export type InsertGenerationJob = z.infer<typeof insertGenerationJobSchema>;

// ─── Table 8: safety_audit_log ────────────────────────────────────────────────
// Source: supabase/migrations/20260525000001_safety_audit_log.sql
// NO raw fan_id or message_text column — hashes only (COMPLY-03, D-02).
// Added: retention_category per D-14, default 'audit'.

export const safetyAuditLogTable = pgTable(
  "safety_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creatorsTable.id),
    fanIdHash: text("fan_id_hash").notNull(),
    sessionId: text("session_id").notNull(),
    messageHash: text("message_hash").notNull(),
    crisisLevel: crisisLevelEnum("crisis_level").notNull(),
    crisisType: text("crisis_type"),
    locale: text("locale").notNull().default("en"),
    confidence: real("confidence"),
    responseSent: boolean("response_sent").notNull().default(false),
    twinPaused: boolean("twin_paused").notNull().default(false),
    alerted: boolean("alerted").notNull().default(false),
    retentionCategory: retentionCategoryEnum("retention_category")
      .notNull()
      .default("audit"),
  },
  (t) => ({
    createdAtIdx: index("safety_audit_log_created_at_idx").on(t.createdAt),
    creatorCreatedIdx: index(
      "safety_audit_log_creator_created_idx"
    ).on(t.creatorId, t.createdAt),
  })
);

export const insertSafetyAuditLogSchema = createInsertSchema(
  safetyAuditLogTable
).omit({ id: true, createdAt: true });
export type SafetyAuditLog = typeof safetyAuditLogTable.$inferSelect;
export type InsertSafetyAuditLog = z.infer<typeof insertSafetyAuditLogSchema>;

// ─── Supplemental Table: creator_totp ────────────────────────────────────────
// Not in schema_v1.sql. Column set inferred from hermes/db.ts usage (lines 84–132).
// Functions: getTotpRecord, saveTotpEnabled, disableTotpRecord, updateRecoveryCodes.
// Uses creatorId as PK (upsert pattern); no separate uuid id column.

export const creatorTotpTable = pgTable("creator_totp", {
  creatorId: uuid("creator_id")
    .primaryKey()
    .references(() => creatorsTable.id, { onDelete: "cascade" }),
  totpSecret: text("totp_secret").notNull(),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  recoveryCodes: text("recovery_codes").array().notNull().default([]),
  enabledAt: timestamp("enabled_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const insertCreatorTotpSchema = createInsertSchema(
  creatorTotpTable
).omit({ updatedAt: true });
export type CreatorTotp = typeof creatorTotpTable.$inferSelect;
export type InsertCreatorTotp = z.infer<typeof insertCreatorTotpSchema>;

// ─── Table: fans ─────────────────────────────────────────────────────────────
// Fan users who chat with AI twins. Authenticated via Supabase (magic-link OTP).
// trial_count tracks free interactions before a credit pack is required.

export const fansTable = pgTable("fans", {
  id: uuid("id").primaryKey().defaultRandom(),
  // nullable: custom OTP auth doesn't use Supabase; field preserved for future Supabase migration path
  supabaseUid: uuid("supabase_uid").unique(),
  email: text("email").notNull().unique(),
  locale: text("locale").notNull().default("en"),
  trialCount: integer("trial_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertFanSchema = createInsertSchema(fansTable).omit({
  id: true,
  createdAt: true,
});
export type Fan = typeof fansTable.$inferSelect;
export type InsertFan = z.infer<typeof insertFanSchema>;

// ─── Table: fan_email_otps ────────────────────────────────────────────────────
// Short-lived one-time passwords for email-based fan sign-in.
// Row is soft-deleted by setting usedAt; hard GC via cron after 24h.

export const fanEmailOtpsTable = pgTable(
  "fan_email_otps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    otpCode: varchar("otp_code", { length: 6 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailIdx: index("fan_email_otps_email_idx").on(t.email),
  })
);

export const insertFanEmailOtpSchema = createInsertSchema(
  fanEmailOtpsTable
).omit({ id: true, createdAt: true });
export type FanEmailOtp = typeof fanEmailOtpsTable.$inferSelect;
export type InsertFanEmailOtp = z.infer<typeof insertFanEmailOtpSchema>;

// ─── Table: sessions ─────────────────────────────────────────────────────────
// Supabase JWT sessions for fans and creators. Exactly one of fan_id / creator_id
// is non-null per row — the other is null.

export const sessionsTable = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fanId: uuid("fan_id").references(() => fansTable.id, {
      onDelete: "cascade",
    }),
    creatorId: uuid("creator_id").references(() => creatorsTable.id, {
      onDelete: "cascade",
    }),
    supabaseAccessToken: text("supabase_access_token").notNull(),
    supabaseRefreshToken: text("supabase_refresh_token").notNull(),
    device: text("device"),
    lastActive: timestamp("last_active", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    fanIdx: index("sessions_fan_idx").on(t.fanId),
    creatorIdx: index("sessions_creator_idx").on(t.creatorId),
  })
);

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  id: true,
});
export type Session = typeof sessionsTable.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

// ─── Table: credit_packs ─────────────────────────────────────────────────────
// Fan credit purchases. credits_remaining is decremented atomically per message
// to enforce the credits invariant (never go negative).

export const creditPacksTable = pgTable(
  "credit_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fanId: uuid("fan_id")
      .notNull()
      .references(() => fansTable.id, { onDelete: "cascade" }),
    packType: varchar("pack_type", { length: 50 }).notNull(),
    creditsTotal: integer("credits_total").notNull(),
    creditsRemaining: integer("credits_remaining").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
    purchasedAt: timestamp("purchased_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    fanIdx: index("credit_packs_fan_idx").on(t.fanId),
  })
);

export const insertCreditPackSchema = createInsertSchema(
  creditPacksTable
).omit({ id: true });
export type CreditPack = typeof creditPacksTable.$inferSelect;
export type InsertCreditPack = z.infer<typeof insertCreditPackSchema>;

// ─── Table: conversations ─────────────────────────────────────────────────────
// Parent table linking a fan to a creator for a chat thread.

export const conversationsTable = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fanId: uuid("fan_id")
      .notNull()
      .references(() => fansTable.id, { onDelete: "cascade" }),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creatorsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    fanCreatorIdx: index("conversations_fan_creator_idx").on(
      t.fanId,
      t.creatorId
    ),
  })
);

export const insertConversationSchema = createInsertSchema(
  conversationsTable
).omit({ id: true, createdAt: true });
export type Conversation = typeof conversationsTable.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

// ─── Table: messages ─────────────────────────────────────────────────────────
// Fan-facing chat messages with credit tracking and modality metadata.
// credits_deducted is locked at write time; never modify after insert.

export const messagesTable = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    locale: text("locale").notNull().default("en"),
    creditsDeducted: integer("credits_deducted").notNull().default(0),
    modality: text("modality").notNull().default("text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    conversationIdx: index("messages_conversation_idx").on(t.conversationId),
    conversationCreatedIdx: index("messages_conversation_created_idx").on(
      t.conversationId,
      t.createdAt
    ),
  })
);

export const insertMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
  createdAt: true,
});
export type Message = typeof messagesTable.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// ─── Table: personas ─────────────────────────────────────────────────────────
// Per-creator persona configuration: 7-field OFA-11 config + intensity dial.

export const EmojiUsage = z.enum(["none", "minimal", "moderate", "heavy"]);
export const IntensityLevel = z.enum(["warm", "intimate", "explicit"]);

export const personasTable = pgTable("personas", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: text("creator_id").notNull(),
  greetingStyle: text("greeting_style").notNull().default(""),
  fanEndearment: text("fan_endearment").notNull().default("fan"),
  emojiUsage: text("emoji_usage").notNull().default("minimal"),
  hardStops: jsonb("hard_stops").notNull().default([]),
  treatmentStyle: text("treatment_style").notNull().default(""),
  personalityTraits: jsonb("personality_traits").notNull().default([]),
  messageStyle: text("message_style").notNull().default(""),
  intensityLevel: text("intensity_level").notNull().default("warm"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPersonaSchema = createInsertSchema(personasTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Persona = typeof personasTable.$inferSelect;
export type InsertPersona = z.infer<typeof insertPersonaSchema>;

// ─── Table: twin_configs ──────────────────────────────────────────────────────
// Per-creator AI twin behaviour config: kill switch, active persona FK, locale
// allowlist, response length cap, enabled modalities, outbound moderation flag.

export const twinConfigsTable = pgTable("twin_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: text("creator_id").notNull().unique(),
  personaId: uuid("persona_id").references(() => personasTable.id, { onDelete: "set null" }),
  killSwitch: boolean("kill_switch").notNull().default(false),
  killSwitchActivatedAt: timestamp("kill_switch_activated_at", { withTimezone: true }),
  allowedLocales: text("allowed_locales").array().notNull().default(["en"]),
  responseLength: varchar("response_length", { length: 50 }).notNull().default("medium"),
  modalities: text("modalities").array().notNull().default(["text"]),
  outboundModEnabled: boolean("outbound_mod_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTwinConfigSchema = createInsertSchema(twinConfigsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type TwinConfig = typeof twinConfigsTable.$inferSelect;
export type InsertTwinConfig = z.infer<typeof insertTwinConfigSchema>;
