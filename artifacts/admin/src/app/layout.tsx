import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '7of1 Admin',
  description: 'Internal staff console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
