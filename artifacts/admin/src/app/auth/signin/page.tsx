'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 120 }}>
      <h1>7of1 Staff Console</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>Sign in with your 7of1.io Google Workspace account.</p>
      <button
        onClick={() => signIn('google', { callbackUrl })}
        style={{
          padding: '12px 24px',
          fontSize: 16,
          background: '#4285F4',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        Sign in with Google
      </button>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
