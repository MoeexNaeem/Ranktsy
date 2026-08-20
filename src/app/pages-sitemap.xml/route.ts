import { abs } from '@/lib/seo/site'
import { urlset, XML_HEADERS } from '@/lib/seo/sitemap'

export const revalidate = 3600

// Core public marketing/legal pages.
const PAGES: { path: string; priority: number; changefreq: string }[] = [
  { path: '/', priority: 1.0, changefreq: 'daily' },
  { path: '/pricing', priority: 0.9, changefreq: 'weekly' },
  { path: '/blogs', priority: 0.8, changefreq: 'daily' },
  { path: '/deals', priority: 0.6, changefreq: 'weekly' },
  { path: '/about', priority: 0.6, changefreq: 'monthly' },
  { path: '/contact', priority: 0.6, changefreq: 'monthly' },
  { path: '/methodology', priority: 0.6, changefreq: 'monthly' },
  { path: '/etsy-fee-calculator', priority: 0.7, changefreq: 'monthly' },
  { path: '/terms', priority: 0.3, changefreq: 'yearly' },
  { path: '/privacy', priority: 0.3, changefreq: 'yearly' },
  { path: '/refund-policy', priority: 0.3, changefreq: 'yearly' },
  { path: '/service-policy', priority: 0.3, changefreq: 'yearly' },
]

export function GET() {
  const body = urlset(PAGES.map(p => ({ loc: abs(p.path), changefreq: p.changefreq, priority: p.priority })))
  return new Response(body, { headers: XML_HEADERS })
}
