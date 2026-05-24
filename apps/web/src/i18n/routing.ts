import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'ja', 'zh-TW'],
  defaultLocale: 'en',
})
