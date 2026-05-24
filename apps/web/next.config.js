/** @type {import('next').NextConfig} */
const nextConfig = {
  // Replit-agnostic config — no platform-specific APIs
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["bullmq"],
  },
};

module.exports = nextConfig;
