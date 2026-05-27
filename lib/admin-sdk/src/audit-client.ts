import crypto from 'crypto';
import type { AuditClientConfig, AuditLogEntry } from './types.js';

/**
 * Builds the HMAC-SHA256 payload signature.
 * Input: `{actor_id}:{action}:{resource_id}:{created_at}`
 */
export function buildPayloadHmac(
  actorId: string,
  action: string,
  resourceId: string,
  createdAt: string,
  signingSecret: string,
): string {
  const payload = `${actorId}:${action}:${resourceId}:${createdAt}`;
  return crypto.createHmac('sha256', signingSecret).update(payload).digest('hex');
}

/**
 * Minimal audit client used by the admin app server actions.
 * Writes directly to the admin Postgres DB via a plain pg Pool.
 *
 * Import pg dynamically so lib/admin-sdk remains usable in environments
 * that tree-shake server-only modules.
 */
export class AuditClient {
  private config: AuditClientConfig;

  constructor(config: AuditClientConfig) {
    this.config = config;
  }

  async insert(entry: AuditLogEntry): Promise<void> {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: this.config.connectionString });

    const createdAt = new Date().toISOString();
    const payloadHmac = buildPayloadHmac(
      entry.actorId,
      entry.action,
      entry.resourceId,
      createdAt,
      this.config.signingSecret,
    );

    await pool.query(
      `INSERT INTO admin_audit_log
         (actor_id, actor_email, action, resource_type, resource_id, justification, payload_hmac, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.actorId,
        entry.actorEmail,
        entry.action,
        entry.resourceType,
        entry.resourceId,
        entry.justification ?? null,
        payloadHmac,
        JSON.stringify(entry.metadata ?? {}),
        createdAt,
      ],
    );

    await pool.end();
  }
}
