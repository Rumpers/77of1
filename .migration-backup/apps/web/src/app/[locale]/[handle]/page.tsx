import { getTranslations } from 'next-intl/server'
import { getCreatorConfig } from '@/lib/creator-fixtures'
import { getReplitUser } from '@/lib/auth'

// Fan page — IG/TikTok webview-safe.
// No OAuth popups, no custom URL schemes. Payment uses Replit Auth + magic links.
// Stub AI Twin responses until real endpoints ship (Slice 2).
export default async function FanPage({
  params,
}: {
  params: { locale: string; handle: string }
}) {
  const { handle, locale } = params
  const config = getCreatorConfig(handle)
  const t = await getTranslations({ locale, namespace: 'fan' })
  const user = getReplitUser()

  return (
    <main
      style={{
        maxWidth: '480px',
        margin: '0 auto',
        padding: '1.5rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={config.cover_image_url}
        alt={handle}
        style={{ width: '100%', borderRadius: '12px', marginBottom: '1.25rem' }}
      />

      <h1
        style={{
          color: 'var(--brand)',
          fontWeight: 'var(--font-weight)',
          margin: '0 0 0.5rem',
          fontSize: '1.5rem',
        }}
      >
        @{handle}
      </h1>

      {user ? (
        <p style={{ color: '#555', fontSize: '0.9rem' }}>
          Welcome back, {user.name}
        </p>
      ) : (
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Replit Auth link — safe for IG/TikTok webviews (standard href, no JS popup) */}
          <a
            href={`/_replit/auth?callback=/${locale}/${handle}`}
            style={{
              display: 'block',
              background: 'var(--brand)',
              color: '#fff',
              padding: '0.875rem 1.5rem',
              borderRadius: '10px',
              textDecoration: 'none',
              textAlign: 'center',
              fontWeight: 600,
              fontSize: '1rem',
            }}
          >
            {t('free_trial')}
          </a>
          <p
            style={{
              textAlign: 'center',
              fontSize: '0.8125rem',
              color: '#999',
              margin: 0,
            }}
          >
            {t('send_message')}
          </p>
        </div>
      )}

      <p
        style={{
          marginTop: '3rem',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: '#ccc',
        }}
      >
        {t('powered_by')}
      </p>
    </main>
  )
}
