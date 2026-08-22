import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { Markdown } from '@/components/blog/Markdown'
import { JsonLd } from '@/components/seo/JsonLd'
import { connectDB } from '@/lib/db'
import { Blog } from '@/lib/models'
import { abs } from '@/lib/seo/site'
import type { IBlog } from '@/types'
import { C } from '@/utils'

export const revalidate = 60
const SANS = "'General Sans',sans-serif"

async function getPost(slug: string): Promise<IBlog | null> {
  try {
    await connectDB()
    return await Blog.findOne({ slug, status: 'published' }).lean<IBlog>()
  } catch { return null }
}

const fmt = (d?: Date | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const p = await getPost(slug)
  if (!p) return {}
  const url = abs(`/blogs/${p.slug}`)
  const title = p.seoTitle || `${p.title} | Rankkw Blog`
  const description = p.seoDescription || p.excerpt || ''
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'article', images: p.coverImage ? [p.coverImage] : undefined, publishedTime: p.publishedAt ? new Date(p.publishedAt).toISOString() : undefined },
    twitter: { card: 'summary_large_image', title, description, images: p.coverImage ? [p.coverImage] : undefined },
  }
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = await getPost(slug)
  if (!p) notFound()

  const url = abs(`/blogs/${p.slug}`)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: p.title,
    description: p.excerpt || p.seoDescription || '',
    image: p.coverImage ? [p.coverImage] : undefined,
    datePublished: p.publishedAt ? new Date(p.publishedAt).toISOString() : undefined,
    dateModified: p.updatedAt ? new Date(p.updatedAt).toISOString() : undefined,
    author: { '@type': 'Organization', name: p.author || 'Rankkw' },
    publisher: { '@type': 'Organization', name: 'Rankkw' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    keywords: (p.tags || []).join(', '),
  }

  return (
    <>
      <JsonLd data={jsonLd} />
      <Navbar />
      <main style={{ background: C.paper }}>
        <article style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(140px,15vw,180px) 24px 40px' }}>
          <Link href="/blogs" style={{ fontSize: 13.5, color: C.orange, textDecoration: 'none', fontFamily: SANS }}>← All articles</Link>
          <p style={{ fontSize: 11.5, fontFamily: "'General Sans',monospace", textTransform: 'uppercase', letterSpacing: '0.09em', color: C.orange, margin: '22px 0 12px' }}>{p.category || 'Guide'}</p>
          <h1 style={{ fontSize: 'clamp(30px,4.6vw,50px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.08, marginBottom: 16 }}>{p.title}</h1>
          <p style={{ fontSize: 14, color: C.stone, fontFamily: "'General Sans',monospace", marginBottom: 8 }}>
            By {p.author || 'Rankkw'} · {fmt(p.publishedAt)} · {p.readingMinutes || 1} min read
          </p>
          {p.excerpt && <p style={{ fontSize: 'clamp(17px,1.8vw,20px)', color: C.graphite, lineHeight: 1.5, margin: '18px 0 8px' }}>{p.excerpt}</p>}
        </article>

        {p.coverImage && (
          <div style={{ maxWidth: 960, margin: '0 auto 8px', padding: '0 24px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.coverImage} alt={p.title} style={{ width: '100%', borderRadius: 18, aspectRatio: '16/8', objectFit: 'cover' }} />
          </div>
        )}

        <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px 60px' }}>
          <Markdown text={p.content} />

          {(p.tags?.length ?? 0) > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 40, paddingTop: 24, borderTop: `1px solid ${C.ash}` }}>
              {p.tags!.map(t => <span key={t} style={{ fontSize: 13, fontFamily: "'General Sans',monospace", color: C.graphite, background: C.bone, borderRadius: 100, padding: '6px 13px' }}>#{t}</span>)}
            </div>
          )}
        </div>

        {/* CTA */}
        <section style={{ background: C.charcoal, padding: '72px 24px', textAlign: 'center' }}>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(24px,3vw,36px)', fontWeight: 600, color: '#F5F5EB', letterSpacing: '-0.03em', marginBottom: 14 }}>Put this into practice</h2>
            <p style={{ fontSize: 16, color: 'rgba(245,245,235,0.72)', lineHeight: 1.55, marginBottom: 24 }}>Research keywords with real Etsy &amp; Google data - free to start.</p>
            <Link href="/register" style={{ background: C.orange, color: '#fff', textDecoration: 'none', fontSize: 16, fontWeight: 500, padding: '14px 30px', borderRadius: 28, display: 'inline-block' }}>Start free →</Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
