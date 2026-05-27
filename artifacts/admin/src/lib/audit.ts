import { AuditClient } from '@7of1/admin-sdk';
import type { AuditAction, AuditLogEntry, StaffRole } from '@7of1/admin-sdk';
import { auth } from './auth.js';

let _auditClient: AuditClient | null = null;

function getAuditClient(): AuditClient {
  if (!_auditClient) {
    _auditClient = new AuditClient({
      connectionString: process.env.ADMIN_DATABASE_URL!,
      signingSecret: process.env.AUDIT_SIGNING_SECRET!,
    });
  }
  return _auditClient;
}

export interface AuditMiddlewareOptions {
  action: AuditAction;
  resourceType: string;
  resourceIdFn: (...args: unknown[]) => string;
  /** If true, justification must be the last argument of the wrapped function. */
  requiresJustification?: boolean;
  /** Roles allowed to invoke this action. Empty means all authenticated roles. */
  allowedRoles?: StaffRole[];
}

type ServerAction<TArgs extends unknown[], TReturn> = (...args: TArgs) => Promise<TReturn>;

/**
 * Wraps a Next.js server action with audit logging and PII justification enforcement.
 *
 * PII-tagged actions (requiresJustification: true) MUST receive a non-empty justification
 * string as their last argument. If missing, the function returns a 422 Response and writes
 * no audit log entry.
 */
export function auditMiddleware<TArgs extends unknown[], TReturn>(
  opts: AuditMiddlewareOptions,
  fn: ServerAction<TArgs, TReturn>,
): ServerAction<TArgs, TReturn | Response> {
  return async (...args: TArgs): Promise<TReturn | Response> => {
    const session = await auth();
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (opts.allowedRoles && opts.allowedRoles.length > 0) {
      if (!opts.allowedRoles.includes(session.user.role)) {
        return new Response('Forbidden', { status: 403 });
      }
    }

    let justification: string | undefined;

    if (opts.requiresJustification) {
      const lastArg = args[args.length - 1];
      if (typeof lastArg !== 'string' || lastArg.trim().length < 10) {
        return new Response(
          JSON.stringify({
            error: 'justification_required',
            message: 'A justification of at least 10 characters is required for PII access.',
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } },
        );
      }
      justification = lastArg.trim();
    }

    const resourceId = opts.resourceIdFn(...args);

    const entry: AuditLogEntry = {
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: opts.action,
      resourceType: opts.resourceType,
      resourceId,
      justification,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };

    await getAuditClient().insert(entry);

    return fn(...args);
  };
}
