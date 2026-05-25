import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

/** Returns a connected Postgres pool for the admin DB (Cloud SQL). */
export function getAdminDb(): pg.Pool {
  if (!pool) {
    if (!process.env.ADMIN_DATABASE_URL) {
      throw new Error('ADMIN_DATABASE_URL is not set');
    }
    pool = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  }
  return pool;
}
