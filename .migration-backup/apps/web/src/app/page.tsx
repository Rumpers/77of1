import { redirect } from 'next/navigation'

// Redirect root to default locale — middleware handles most cases,
// but this catches direct root hits in standalone mode.
export default function RootPage() {
  redirect('/en')
}
