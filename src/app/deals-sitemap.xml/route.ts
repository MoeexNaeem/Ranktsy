import { connectDB } from '@/lib/db'
import { Deal } from '@/lib/models'
import { abs } from '@/lib/seo/site'
import { urlset, XML_HEADERS } from '@/lib/seo/sitemap'
import type { IDeal } from '@/types'

export const revalidate = 600

// One <url> per published deal (/deals/<slug>). Referenced by /sitemap.xml so the
// public deal pages are discoverable - they were live but missing from every map.
export async function GET() {
  let deals: IDeal[] = []
  try {
    await connectDB()
    deals = await Deal.find({ status: 'published' }).select('slug updatedAt createdAt').sort({ createdAt: -1 }).lean<IDeal[]>()
  } catch { deals = [] }

  const body = urlset(deals.map(d => ({
    loc: abs(`/deals/${d.slug}`),
    lastmod: (d.updatedAt || d.createdAt) ? new Date((d.updatedAt || d.createdAt) as Date).toISOString() : undefined,
    changefreq: 'weekly',
    priority: 0.6,
  })))
  return new Response(body, { headers: XML_HEADERS })
}
