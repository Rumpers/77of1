const createNextIntlPlugin = require('next-intl/plugin')
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Replit-agnostic config — no platform-specific APIs
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["bullmq"],
  },
  webpack: (config) => {
    // Workspace packages use NodeNext .js extension convention; teach webpack to resolve them.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    }
    return config
  },
}

module.exports = withNextIntl(nextConfig)
