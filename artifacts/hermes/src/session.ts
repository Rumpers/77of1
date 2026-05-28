// Persistent Telegraf session for Hermes — survives Replit restart (D-02 carried-over).
// Backed by @telegraf/session/pg adapter against the same Replit Postgres that
// @workspace/db uses. The adapter auto-creates a `telegraf-sessions` table on first write.
//
// Source: RESEARCH Pattern 4 + PATTERNS D4.
// Replaces the in-memory `Map<>` formerly in consent.ts (lines 89-106 of the pre-02-07 file).

import { session, type SessionStore } from "telegraf";
import { Pool } from "pg";
import { Postgres } from "@telegraf/session/pg";

// Telegraf's `session()` generic defaults to `{}`; SessionStore must match.
type HermesSession = object;

// Lazy singleton — avoid creating a Pool at module load (vitest unit tests run without DATABASE_URL).
let _pool: Pool | null = null;
let _store: SessionStore<HermesSession> | null = null;

function getStore(): SessionStore<HermesSession> {
  if (_store) return _store;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required for Hermes session persistence (@telegraf/session/pg)"
    );
  }
  if (!_pool) _pool = new Pool({ connectionString });
  _store = Postgres<HermesSession>({ pool: _pool });
  return _store;
}

// Lazy proxy SessionStore — defers DATABASE_URL touch until the first session read/write.
// Importing this file (e.g. from index.ts at module load) does NOT throw if DATABASE_URL
// is unset; only an actual chat message would.
const lazyStore: SessionStore<HermesSession> = {
  get: (key) => getStore().get(key),
  set: (key, value) => getStore().set(key, value),
  delete: (key) => getStore().delete(key),
};

// Session middleware — `bot.use(sessionMiddleware)` BEFORE `bot.use(stage.middleware())`.
// The default session table name is "telegraf-sessions"; we leave it default.
export const sessionMiddleware = session({ store: lazyStore });
