import { defineConfig } from "drizzle-kit";
import path from "path";

// Prefer a direct (non-pooled) connection URL for drizzle-kit push DDL.
// PgBouncer pooled URLs (containing 'pgbouncer=true' or port 6543) break DDL
// transactions — see Pitfall #6 in RESEARCH.md.
const resolvedUrl =
  process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;

if (!resolvedUrl) {
  throw new Error(
    "DATABASE_URL (or DATABASE_URL_DIRECT) must be set. Did you forget to provision a database?"
  );
}

if (
  resolvedUrl.includes("pgbouncer") ||
  /:\d*6543\b/.test(resolvedUrl)
) {
  console.warn(
    "[drizzle-kit] WARNING: Resolved DATABASE_URL appears to be a PgBouncer pooled URL " +
      "(detected 'pgbouncer' or port 6543). DDL transactions may fail. " +
      "Set DATABASE_URL_DIRECT to a non-pooled connection URL and retry."
  );
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: resolvedUrl,
  },
});
