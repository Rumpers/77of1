import { z } from "zod";

// Phase 2 env schema (D-02-07). Supabase fields REMOVED — Phase 1 carry-over.
// All required vars must be present in Replit Secrets before cold-start.
const envSchema = z.object({
  PORT: z.string().min(1, "PORT is required"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Database (Replit-managed PostgreSQL) — required
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  DATABASE_URL_DIRECT: z.string().url().optional(),

  // Redis/BullMQ — optional (queue features degrade gracefully without it)
  REDIS_URL: z.string().url().optional(),

  // GMI AI provider — required (Phase 2 hard dep)
  GMI_API_KEY: z.string().min(1, "GMI_API_KEY is required"),
  GMI_API_BASE_URL: z.string().url().optional(),

  // OpenAI moderation — required (Phase 2: L1/L3 moderation pipeline)
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),

  // HMAC for signing conversation_id tokens — required, ≥32 chars
  HMAC_CONVERSATION_SECRET: z
    .string()
    .min(32, "HMAC_CONVERSATION_SECRET must be ≥32 characters"),

  // Telegram bot tokens — consumed by hermes/fan-twin artifacts, not api-server.
  // Optional here so api-server can boot for web-only smoke without them; the
  // artifacts that need them validate their own env at their own boot.
  TELEGRAM_BOT_TOKEN_LALA: z.string().optional(),
  TELEGRAM_BOT_TOKEN_FAN_TWIN: z.string().optional(),

  // Founder alert channel — recommended for L5 (Sentry + Telegram notify)
  FOUNDER_TELEGRAM_CHAT_ID: z.string().optional(),

  // Session cookie signing — required
  SESSION_SECRET: z.string().min(1, "SESSION_SECRET is required"),

  // App URL — optional (magic link redirects fail without it)
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL")
    .optional(),

  // Observability — optional
  SENTRY_DSN: z.string().url().optional(),
  HELICONE_API_KEY: z.string().optional(),

  // Safety crisis alerts — Slack incoming webhook URL
  SAFETY_ALERT_WEBHOOK_URL: z.string().url().optional(),

  // Health check auth — protects /api/health/db and deeper
  HEALTH_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    process.stderr.write(
      `[startup] Environment validation failed — fix the following before starting:\n${issues}\n`,
    );
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
