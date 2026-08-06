import { allToolSlugs } from '@/lib/seo/tools'
import { abs } from '@/lib/seo/site'
import { urlset, XML_HEADERS } from '@/lib/seo/sitemap'

export const revalidate = 3600

// One <url> per tool/feature page (/keyword-research, /competitor-analysis, …).
export function GET() {
  const body = urlset(allToolSlugs().map(slug => ({
    loc: abs(`/${slug}`), changefreq: 'weekly', priority: 0.8,
  })))
  return new Response(body, { headers: XML_HEADERS })
}
