import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { Markdown } from '@/components/blog/Markdown'
import { DealCta } from '@/components/landing/DealCta'
import { DealsBackdrop } from '@/components/landing/DealsBackdrop'
import { connectDB } from '@/lib/db'
import { Deal } from '@/lib/models'
import { abs } from '@/lib/seo/site'
import type { IDeal } from '@/types'
import { C } from '@/utils'

export const revalidate = 60
const SANS = "'General Sans',sans-serif"
const ACCENT = '#FB5E09'

async function getDeal(slug: string): Promise<IDeal | null> {
  try {
    await connectDB()
    return await Deal.findOne({ slug, status: 'published' }).lean<IDeal>()
  } catch { return null }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const d = await getDeal(slug)
  if (!d) return {}
  const url = abs(`/deals/${d.slug}`)
  const description = d.summary || ''
  return {
    title: `${d.title} | Rankkw Deals`,
    description,
    alternates: { canonical: url },
    openGraph: { title: d.title, description, url, type: 'website' },
  }
}

export default async function DealPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = await getDeal(slug)
  if (!d) notFound()

  const ctaLabel = d.ctaLabel || 'Get this deal'

  return (
    <>
      <Navbar />
      <main style={{ background: C.paper, position: 'relative', overflow: 'hidden' }}>
        <DealsBackdrop />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1040, margin: '0 auto', padding: 'clamp(140px,15vw,180px) 24px 30px' }}>
          <Link href="/deals" style={{ fontSize: 13.5, color: C.orange, textDecoration: 'none', fontFamily: SANS }}>← All deals</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '22px 0 12px' }}>
            {d.badge && <span style={{ fontSize: 11, fontFamily: "'General Sans',monospace", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fff', background: ACCENT, padding: '4px 12px', borderRadius: 100 }}>{d.badge}</span>}
            <span style={{ fontSize: 11.5, fontFamily: "'General Sans',monospace", textTransform: 'uppercase', letterSpacing: '0.09em', color: C.stone }}>Deal</span>
          </div>
          <h1 style={{ fontSize: 'clamp(30px,4.6vw,50px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.08, marginBottom: 16, maxWidth: 820 }}>{d.title}</h1>
          {d.summary && <p style={{ fontSize: 'clamp(17px,1.8vw,20px)', color: C.graphite, lineHeight: 1.5, margin: '10px 0 8px', maxWidth: 780 }}>{d.summary}</p>}
        </div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1040, margin: '0 auto', padding: '14px 24px 24px' }}>
          {/* Wide, stretched frosted-glass card with a moving dashed border */}
          <div className="deal-card rk-ants" style={{ ['--ant' as string]: ACCENT, ['--glow' as string]: `${ACCENT}59`, padding: 'clamp(28px,4.5vw,52px)' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <Markdown text={d.content} />
              <div style={{ marginTop: 30, paddingTop: 24, borderTop: `1px solid ${C.hair}` }}>
                <DealCta plan={d.ctaPlan || undefined} url={d.ctaUrl || undefined} label={ctaLabel} />
              </div>
            </div>
          </div>
        </div>

        {/* CTA band */}
        <section style={{ position: 'relative', zIndex: 1, background: C.charcoal, padding: '64px 24px', textAlign: 'center', marginTop: 40 }}>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(22px,3vw,32px)', fontWeight: 600, color: '#F5F5EB', letterSpacing: '-0.03em', marginBottom: 14 }}>Ready to grab this deal?</h2>
            <p style={{ fontSize: 16, color: 'rgba(245,245,235,0.72)', lineHeight: 1.55, marginBottom: 24 }}>Secure checkout via Lemon Squeezy — cancel anytime.</p>
            <DealCta plan={d.ctaPlan || undefined} url={d.ctaUrl || undefined} label={ctaLabel} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
