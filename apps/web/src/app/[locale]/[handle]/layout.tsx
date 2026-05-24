import { getCreatorConfig } from '@/lib/creator-fixtures'

// Injects per-creator CSS variables server-side — zero FOUC on first paint.
export default function HandleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string; handle: string }
}) {
  const config = getCreatorConfig(params.handle)
  const css = `:root{--brand:${config.brand_color};--font-weight:${config.font_weight};}`
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {children}
    </>
  )
}
