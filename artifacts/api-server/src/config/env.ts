import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().min(1, "PORT is required"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Supabase — required at startup
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // Redis/BullMQ — optional (queue features degrade gracefully without it)
  REDIS_URL: z.string().url().optional(),

  // GMI AI provider — optional (AI features degrade without it)
  GMI_API_KEY: z.string().optional(),
  GMI_API_BASE_URL: z.string().url().optional(),

  // App URL — required for magic link redirects and canonical URLs
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL")
    .optional(),

  // Observability — optional
  SENTRY_DSN: z.string().optional(),
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
