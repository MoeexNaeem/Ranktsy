import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'i.etsystatic.com' },
      { protocol: 'https', hostname: 'openapi.etsy.com' },
    ],
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options',        value: 'DENY'    },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ]
  },

  async redirects() {
    // Feature/tool pages were renamed to be Etsy-prefixed (e.g. /keyword-research
    // → /etsy-keyword-research). 301 the old paths so any indexed links or
    // bookmarks land on the new canonical URL instead of 404ing.
    const RENAMED_TOOLS = [
      'keyword-research', 'competitor-analysis', 'trend-analysis', 'find-hot-products',
      'tag-optimizer', 'ai-title-tag-generator', 'listing-audit', 'shop-analytics', 'top-sellers',
    ]
    return [
      { source: '/app', destination: '/dashboard', permanent: false },
      ...RENAMED_TOOLS.map(slug => ({
        source: `/${slug}`, destination: `/etsy-${slug}`, permanent: true,
      })),
      // Canonical host is the apex domain — send any www.* request to it (301).
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.rankkw.com' }],
        destination: 'https://rankkw.com/:path*',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
