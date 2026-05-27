import "./instrument.js"; // must be first — Sentry instruments modules on load
import "./config/env.js"; // validates all required env vars at startup; crashes with clear message if any are missing
import app from "./app";
import { logger } from "./lib/logger";
import { startRevocationWorker } from "./workers/revocation.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Start consent-revocation BullMQ worker in-process (OF-103).
// Degrades gracefully when REDIS_URL is absent — DB fallback activates on the route layer.
const stopRevocationWorker = await startRevocationWorker(logger);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  await stopRevocationWorker();
  process.exit(0);
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
