// Persistent Telegraf session for fan-twin — survives Replit restart.
// Backed by @telegraf/session/pg against the same Replit Postgres pool used
// by @workspace/db. The adapter auto-creates a `telegraf-sessions` table on
// first write. Mirrors `artifacts/hermes/src/session.ts` (PATTERNS D4 +
// RESEARCH Pattern 4).
//
// Lazy singleton — avoid creating a Pool at module load (vitest unit tests
// run without DATABASE_URL). Importing this file from index.ts at module
// load does NOT throw if DATABASE_URL is unset; only an actual session
// read/write does.

import { session, type SessionStore } from "telegraf";
import { Pool } from "pg";
import { Postgres } from "@telegraf/session/pg";

type FanTwinSession = object;

let _pool: Pool | null = null;
let _store: SessionStore<FanTwinSession> | null = null;

function getStore(): SessionStore<FanTwinSession> {
  if (_store) return _store;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required for fan-twin session persistence (@telegraf/session/pg)",
    );
  }
  if (!_pool) _pool = new Pool({ connectionString });
  _store = Postgres<FanTwinSession>({ pool: _pool });
  return _store;
}

const lazyStore: SessionStore<FanTwinSession> = {
  get: (key) => getStore().get(key),
  set: (key, value) => getStore().set(key, value),
  delete: (key) => getStore().delete(key),
};

export const sessionMiddleware = session({ store: lazyStore });
