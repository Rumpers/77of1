// Set required fan-twin env vars BEFORE any test module is imported.
// vitest config's `setupFiles` runs this file synchronously before the test
// file (and therefore before vi.mock hoists + ESM imports trigger module
// evaluation of src/index.ts which throws on missing TELEGRAM_BOT_TOKEN_FAN_TWIN).
process.env.TELEGRAM_BOT_TOKEN_FAN_TWIN ??= "test-token";
process.env.CREATOR_HANDLE_FAN_TWIN ??= "testcreator";
process.env.HMAC_CONVERSATION_SECRET ??=
  "test-hmac-secret-needs-to-be-32-or-more-chars-long";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
