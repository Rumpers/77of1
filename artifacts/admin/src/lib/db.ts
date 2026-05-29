import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import pg from 'pg';

const { Pool } = pg;

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface CheckResult {
  table: string;
  description: string;
  found_rows: number;
  status: 'clear' | 'residual' | 'retained_per_policy' | 'not_applicable';
  note?: string;
}

export interface VerificationResult {
  checked_at: string;
  checked_by: string;
  checks: CheckResult[];
  overall: 'verified' | 'failed' | 'partial';
}

// ─── deletion_requests table schema ──────────────────────────────────────────
// Generated columns (grace_period_expires_at, sla_deadline_at) are read-only
// in PostgreSQL — never include them in INSERT or UPDATE sets.

export const deletionRequestsTable = pgTable('deletion_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  authUserId: text('auth_user_id').notNull(),
  accountType: text('account_type').notNull(),
  entityIds: jsonb('entity_ids').notNull().$type<string[]>(),
  status: text('status').notNull(),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
  gracePeriodExpiresAt: timestamp('grace_period_expires_at', { withTimezone: true }),
  slaDeadlineAt: timestamp('sla_deadline_at', { withTimezone: true }),
  cascadeStartedAt: timestamp('cascade_started_at', { withTimezone: true }),
  cascadeCompleteAt: timestamp('cascade_complete_at', { withTimezone: true }),
  deletionReference: text('deletion_reference'),
  verificationResult: jsonb('verification_result').$type<VerificationResult | null>(),
  verifiedBy: text('verified_by'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export type DeletionRequest = typeof deletionRequestsTable.$inferSelect;

// ─── Admin DB pool (for AuditClient / ADMIN_DATABASE_URL) ────────────────────

let _adminPool: pg.Pool | null = null;

/** Returns a Postgres pool connected to ADMIN_DATABASE_URL (for AuditClient). */
export function getAdminDb(): pg.Pool {
  if (!_adminPool) {
    if (!process.env.ADMIN_DATABASE_URL) {
      throw new Error('ADMIN_DATABASE_URL is not set');
    }
    _adminPool = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  }
  return _adminPool;
}

// ─── Main DB (Drizzle + DATABASE_URL) ────────────────────────────────────────

let _mainPool: pg.Pool | null = null;

/** Returns the raw pg.Pool for DATABASE_URL — use for raw SQL spot-check queries. */
export function getMainPool(): pg.Pool {
  if (!_mainPool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set');
    }
    _mainPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _mainPool;
}

const _schema = { deletionRequestsTable };

/** Returns the Drizzle ORM client for the main database. */
export function getDb() {
  return drizzle(getMainPool(), { schema: _schema });
}
