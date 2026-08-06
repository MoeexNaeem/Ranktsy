import type { MetadataRoute } from 'next'
import { abs, siteUrl } from '@/lib/seo/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/admin', '/profile', '/api/'] }],
    sitemap: abs('/sitemap.xml'),
    host: siteUrl(),
  }
}
