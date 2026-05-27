import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";

export const OAUTH_PROVIDERS = ["stripe_connect", "line_pay", "17live"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const creatorOauthTokens = pgTable(
  "creator_oauth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creatorId: uuid("creator_id").notNull(),
    provider: text("provider").notNull().$type<OAuthProvider>(),
    // AES-256-GCM encrypted at the application layer before insert
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    tokenType: text("token_type").notNull().default("Bearer"),
    scope: text("scope"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    providerUserId: text("provider_user_id"),
    rawMetadata: jsonb("raw_metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("creator_oauth_tokens_creator_provider_uidx").on(t.creatorId, t.provider),
    index("creator_oauth_tokens_creator_idx").on(t.creatorId),
    index("creator_oauth_tokens_expires_idx").on(t.expiresAt),
  ],
);

export type CreatorOauthToken = typeof creatorOauthTokens.$inferSelect;
export type InsertCreatorOauthToken = typeof creatorOauthTokens.$inferInsert;
