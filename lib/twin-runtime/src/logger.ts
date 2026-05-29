// Shared structured logger for twin-runtime modules (and re-used by api-server
// via re-export shim at `artifacts/api-server/src/lib/logger.ts`).
//
// Moved to twin-runtime in plan 02-06a as a Rule 3 (blocking) deviation:
// `constitution.ts` and `moderation.ts` both import this logger, so it must
// travel with them into the shared package.
import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
