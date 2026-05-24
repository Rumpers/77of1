export type CreatorConfig = {
  handle: string
  brand_color: string
  font_weight: string
  cover_image_url: string
  monetization_model: 'credits' | 'subscription' | 'free'
  languages_served: string[]
}

const FIXTURES: Record<string, CreatorConfig> = {
  demo: {
    handle: 'demo',
    brand_color: '#7c3aed',
    font_weight: '600',
    cover_image_url: 'https://placehold.co/800x300/7c3aed/ffffff?text=demo',
    monetization_model: 'credits',
    languages_served: ['en', 'ja', 'zh-TW'],
  },
  sakura: {
    handle: 'sakura',
    brand_color: '#f43f5e',
    font_weight: '500',
    cover_image_url: 'https://placehold.co/800x300/f43f5e/ffffff?text=sakura',
    monetization_model: 'credits',
    languages_served: ['ja', 'en'],
  },
  luna: {
    handle: 'luna',
    brand_color: '#0ea5e9',
    font_weight: '700',
    cover_image_url: 'https://placehold.co/800x300/0ea5e9/ffffff?text=luna',
    monetization_model: 'subscription',
    languages_served: ['zh-TW', 'en'],
  },
}

const DEFAULT_CONFIG = (handle: string): CreatorConfig => ({
  handle,
  brand_color: '#1e1b4b',
  font_weight: '500',
  cover_image_url: `https://placehold.co/800x300/1e1b4b/ffffff?text=${encodeURIComponent(handle)}`,
  monetization_model: 'credits',
  languages_served: ['en'],
})

export function getCreatorConfig(handle: string): CreatorConfig {
  return FIXTURES[handle] ?? DEFAULT_CONFIG(handle)
}
