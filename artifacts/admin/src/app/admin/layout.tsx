'use client';

import { Admin, Resource, Layout, AppBar, Menu } from 'react-admin';
import { StubDataProvider } from '@/lib/stub-data-provider';
import { registerAdminModule } from '@7of1/admin-sdk';
import type { AdminModuleRegistration } from '@7of1/admin-sdk';

// Stub module: registered per HID-010 scaffold requirement.
// HID-011..019 modules plug in here once implemented.
const stubModule: AdminModuleRegistration = registerAdminModule({
  name: 'stub',
  label: 'Dashboard',
  roles: [], // all authenticated roles
});

const registeredModules = [stubModule];

function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, background: '#1a1a2e', color: '#fff', padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 24 }}>7of1 Admin</div>
        <nav>
          {registeredModules
            .filter((m) => m.accessible)
            .map((m) => (
              <a
                key={m.name}
                href={`/admin/${m.name}`}
                style={{ display: 'block', color: '#ccc', padding: '8px 0', textDecoration: 'none' }}
              >
                {m.label}
              </a>
            ))}
        </nav>
      </aside>
      <main style={{ flex: 1, padding: 32 }}>{children}</main>
    </div>
  );
}

export default function AdminSectionLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
