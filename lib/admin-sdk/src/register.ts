import type { AdminModuleConfig, AdminModuleRegistration, StaffRole } from './types.js';

/**
 * Registers an admin module with the scaffold.
 *
 * Each HID-011..019 module calls this once at startup to declare its name,
 * access roles, and optional React Admin dataProvider.
 *
 * The returned registration object is consumed by the admin app's nav builder.
 */
export function registerAdminModule(
  config: AdminModuleConfig,
  currentRole?: StaffRole,
): AdminModuleRegistration {
  const accessible =
    config.roles.length === 0 ||
    (currentRole !== undefined && config.roles.includes(currentRole));

  return { ...config, accessible };
}
