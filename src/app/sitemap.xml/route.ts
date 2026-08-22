import { abs } from '@/lib/seo/site'
import { sitemapIndex, XML_HEADERS } from '@/lib/seo/sitemap'

export const revalidate = 3600

// Master sitemap INDEX - submit THIS one to Google Search Console. Every other
// sitemap (features, pages, and blogs once published) is referenced here, so a
// single submission covers the whole site.
export function GET() {
  const now = new Date().toISOString()
  const body = sitemapIndex([
    { loc: abs('/features-sitemap.xml'), lastmod: now },
    { loc: abs('/pages-sitemap.xml'), lastmod: now },
    { loc: abs('/blogs-sitemap.xml'), lastmod: now },
    { loc: abs('/deals-sitemap.xml'), lastmod: now },
  ])
  return new Response(body, { headers: XML_HEADERS })
}
