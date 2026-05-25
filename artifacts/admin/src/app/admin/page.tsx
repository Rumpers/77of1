import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user) redirect('/auth/signin');

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>7of1 Staff Console</h1>
      <p style={{ color: '#666' }}>
        Signed in as <strong>{session.user.email}</strong> ({session.user.role})
      </p>
      <p style={{ marginTop: 32, color: '#999' }}>
        HID-011..019 modules will appear in the left nav once registered.
      </p>
    </div>
  );
}
