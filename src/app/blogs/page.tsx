import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { connectDB } from '@/lib/db'
import { Blog } from '@/lib/models'
import { abs } from '@/lib/seo/site'
import type { IBlog } from '@/types'
import { C } from '@/utils'

export const revalidate = 60
const SANS = "'General Sans',sans-serif"

export const metadata: Metadata = {
  title: 'Blog — Etsy SEO tips, guides & data | Rankkw',
  description: 'Practical Etsy SEO guides, keyword-research tips and seller strategies from Rankkw — grounded in real Etsy & Google data.',
  alternates: { canonical: abs('/blogs') },
  openGraph: { title: 'Rankkw Blog', description: 'Etsy SEO guides and seller strategies.', url: abs('/blogs'), type: 'website' },
}

const fmt = (d?: Date | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

async function getPosts(): Promise<IBlog[]> {
  try {
    await connectDB()
    return await Blog.find({ status: 'published' }).sort({ publishedAt: -1 }).limit(60)
      .select('title slug excerpt coverImage category tags readingMinutes publishedAt').lean<IBlog[]>()
  } catch { return [] }
}

export default async function BlogIndex() {
  const posts = await getPosts()
  const [featured, ...rest] = posts

  return (
    <>
      <Navbar />
      <main>
        <section style={{ background: C.canvas, padding: 'clamp(150px,16vw,190px) 24px 56px', textAlign: 'center' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 500, fontFamily: SANS, textTransform: 'uppercase', letterSpacing: '0.11em', color: C.ink, marginBottom: 16 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange }} />Blog
            </div>
            <h1 style={{ fontSize: 'clamp(38px,5.4vw,60px)', fontWeight: 600, letterSpacing: '-0.04em', color: C.ink, lineHeight: 1.03, marginBottom: 16 }}>
              Etsy SEO, made practical
            </h1>
            <p style={{ fontSize: 'clamp(16px,1.5vw,18px)', color: C.graphite, lineHeight: 1.55, maxWidth: 540, margin: '0 auto' }}>
              Guides, tips and data-backed strategies to help your Etsy shop rank and grow.
            </p>
          </div>
        </section>

        <section style={{ background: C.paper, padding: '40px 24px 100px' }}>
          <div style={{ maxWidth: 1160, margin: '0 auto' }}>
            {posts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: C.graphite }}>
                <p style={{ fontSize: 18, fontWeight: 500, color: C.ink, marginBottom: 6 }}>No articles yet</p>
                <p style={{ fontSize: 15 }}>New Etsy SEO guides are on the way — check back soon.</p>
              </div>
            ) : (
              <>
                {/* Featured */}
                {featured && (
                  <Link href={`/blogs/${featured.slug}`} className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 30, alignItems: 'center', background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 24, overflow: 'hidden', textDecoration: 'none', marginBottom: 40 }}>
                    <div style={{ aspectRatio: '16/10', background: C.bone, backgroundImage: featured.coverImage ? `url(${featured.coverImage})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    <div style={{ padding: '28px 34px 28px 6px' }}>
                      <p style={{ fontSize: 11.5, fontFamily: "'General Sans',monospace", textTransform: 'uppercase', letterSpacing: '0.09em', color: C.orange, marginBottom: 12 }}>{featured.category || 'Guide'}</p>
                      <h2 style={{ fontSize: 'clamp(24px,2.8vw,34px)', fontWeight: 600, letterSpacing: '-0.03em', color: C.ink, lineHeight: 1.12, marginBottom: 12 }}>{featured.title}</h2>
                      {featured.excerpt && <p style={{ fontSize: 16, color: C.graphite, lineHeight: 1.6, marginBottom: 16 }}>{featured.excerpt}</p>}
                      <p style={{ fontSize: 13, color: C.stone, fontFamily: "'General Sans',monospace" }}>{fmt(featured.publishedAt)} · {featured.readingMinutes || 1} min read</p>
                    </div>
                  </Link>
                )}

                {/* Grid */}
                <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
                  {rest.map(p => (
                    <Link key={p.slug} href={`/blogs/${p.slug}`} style={{ display: 'flex', flexDirection: 'column', background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 18, overflow: 'hidden', textDecoration: 'none', height: '100%' }}>
                      <div style={{ aspectRatio: '16/9', background: C.bone, backgroundImage: p.coverImage ? `url(${p.coverImage})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', flex: 'none' }} />
                      <div style={{ padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <p style={{ fontSize: 11, fontFamily: "'General Sans',monospace", textTransform: 'uppercase', letterSpacing: '0.09em', color: C.orange, marginBottom: 9 }}>{p.category || 'Guide'}</p>
                        <h3 style={{ fontSize: 19, fontWeight: 600, color: C.ink, lineHeight: 1.25, letterSpacing: '-0.02em', marginBottom: 9 }}>{p.title}</h3>
                        {p.excerpt && <p style={{ fontSize: 14.5, color: C.graphite, lineHeight: 1.55, marginBottom: 14 }}>{p.excerpt}</p>}
                        <p style={{ marginTop: 'auto', fontSize: 12.5, color: C.stone, fontFamily: "'General Sans',monospace" }}>{fmt(p.publishedAt)} · {p.readingMinutes || 1} min</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
