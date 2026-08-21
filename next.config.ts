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
    // Content-Security-Policy — allowlists exactly the external hosts the app
    // actually loads (Lordicon icons, Fontshare/Google fonts, Lemon Squeezy
    // checkout, reCAPTCHA) and blocks everything else. 'unsafe-inline' is still
    // required for Next's hydration bootstrap and the app's inline styles; the
    // high-value wins here are object-src/base-uri/form-action locks and
    // frame-ancestors (clickjacking) — the stored-XSS holes are fixed at source.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.lordicon.com https://www.google.com https://www.gstatic.com https://app.lemonsqueezy.com https://assets.lemonsqueezy.com",
      "style-src 'self' 'unsafe-inline' https://api.fontshare.com https://cdn.fontshare.com https://fonts.googleapis.com",
      "font-src 'self' data: https://cdn.fontshare.com https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https:",
      "frame-src 'self' https://www.google.com https://app.lemonsqueezy.com https://checkout.lemonsqueezy.com https://www.youtube.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self' https://checkout.lemonsqueezy.com",
    ].join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options',        value: 'DENY'    },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
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
      { source: '/fee-calculator', destination: '/etsy-fee-calculator', permanent: true },
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
