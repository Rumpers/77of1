// Root layout: html/body tags live in [locale]/layout.tsx for per-locale lang attribute.
// Metadata is also in the locale layout.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
