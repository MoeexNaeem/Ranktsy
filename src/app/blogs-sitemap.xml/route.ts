import { connectDB } from '@/lib/db'
import { Blog } from '@/lib/models'
import { abs } from '@/lib/seo/site'
import { urlset, XML_HEADERS } from '@/lib/seo/sitemap'
import type { IBlog } from '@/types'

export const revalidate = 600

// One <url> per published blog post (/blogs/<slug>). Referenced by /sitemap.xml.
export async function GET() {
  let posts: IBlog[] = []
  try {
    await connectDB()
    posts = await Blog.find({ status: 'published' }).select('slug updatedAt publishedAt').sort({ publishedAt: -1 }).lean<IBlog[]>()
  } catch { posts = [] }

  const body = urlset(posts.map(p => ({
    loc: abs(`/blogs/${p.slug}`),
    lastmod: (p.updatedAt || p.publishedAt) ? new Date((p.updatedAt || p.publishedAt) as Date).toISOString() : undefined,
    changefreq: 'weekly',
    priority: 0.7,
  })))
  return new Response(body, { headers: XML_HEADERS })
}
