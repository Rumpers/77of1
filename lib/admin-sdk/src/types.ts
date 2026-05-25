export type StaffRole = 'support' | 'ops' | 'engineering' | 'finance';

export type AuditAction =
  | 'VIEW_FAN_PII'
  | 'REFUND_APPROVE'
  | 'REFUND_DENY'
  | 'KYC_APPROVE'
  | 'CONTENT_OVERRIDE'
  | 'DSAR_OPEN'
  | 'PAYOUT_APPROVE'
  | 'STAFF_ROLE_CHANGE'
  | 'SYSTEM_CONFIG_CHANGE';

export interface AdminModuleConfig {
  name: string;
  label: string;
  icon?: React.ComponentType;
  /** Roles that may access this module. Empty array means all authenticated staff. */
  roles: StaffRole[];
  /** Optional React Admin dataProvider to scope CRUD for this resource. */
  dataProvider?: unknown;
}

export interface AdminModuleRegistration extends AdminModuleConfig {
  /** Resolved at registration time — true if the current user's role grants access. */
  accessible: boolean;
}

export interface AuditLogEntry {
  actorId: string;
  actorEmail: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  justification?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditClientConfig {
  /** Postgres connection string for the admin DB. */
  connectionString: string;
  /** HMAC-SHA256 secret from env AUDIT_SIGNING_SECRET. */
  signingSecret: string;
}
