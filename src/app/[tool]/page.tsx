import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { FaqList } from '@/components/seo/FaqList'
import { getToolPage, allToolSlugs } from '@/lib/seo/tools'
import { abs } from '@/lib/seo/site'
import { C } from '@/utils'

const SANS = "'General Sans',sans-serif"

// Only the known tool slugs are served; anything else 404s (and never shadows
// real routes like /about or /pricing, which resolve as static routes first).
export const dynamicParams = false
export function generateStaticParams() {
  return allToolSlugs().map(tool => ({ tool }))
}

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }): Promise<Metadata> {
  const { tool } = await params
  const t = getToolPage(tool)
  if (!t) return {}
  const url = abs(`/${t.slug}`)
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical: url },
    openGraph: { title: t.metaTitle, description: t.metaDescription, url, type: 'website' },
    robots: { index: true, follow: true },
  }
}

/* ── One curated palette, used the same way on every page ─────────────────────
   Orange is the primary brand accent; green and blue are the only two supporting
   hues; charcoal + parchment/bone are the neutrals. Cards rotate through this
   fixed set (same order for every tool) so the site reads as one system rather
   than a per-tool rainbow. */
const TINTS: { bg: string; ic: string }[] = [
  { bg: '#FCE7D8', ic: '#C2510B' }, // soft orange
  { bg: '#DEEFE4', ic: '#1F7A42' }, // soft green
  { bg: '#DEE6FF', ic: '#2E44C4' }, // soft blue
]
const SOLIDS = [C.charcoal, C.orange, '#2E7D46'] // bold blocks (white text)
const tintAt = (i: number) => TINTS[i % TINTS.length]
const solidAt = (i: number) => SOLIDS[i % SOLIDS.length]

function Check({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function Arrow({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  )
}

const sectionTag = (label: string) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 600, fontFamily: SANS, textTransform: 'uppercase', letterSpacing: '0.11em', color: C.orange, marginBottom: 16 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange }} />{label}
  </div>
)

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params
  const t = getToolPage(tool)
  if (!t) notFound()

  const related = t.related.map(getToolPage).filter(Boolean) as NonNullable<ReturnType<typeof getToolPage>>[]

  // FAQPage + Breadcrumb structured data for rich results.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: t.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: abs('/') },
          { '@type': 'ListItem', position: 2, name: t.name, item: abs(`/${t.slug}`) },
        ],
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />
      <main>
        {/* ── Hero ── */}
        <section style={{ background: C.canvas, padding: 'clamp(150px,16vw,190px) 24px 76px', position: 'relative', overflow: 'hidden' }}>
          <div aria-hidden style={{ position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)', width: 'min(880px,120vw)', height: 520, background: `radial-gradient(50% 50% at 50% 50%, ${C.orangeFaint}, transparent 70%)`, pointerEvents: 'none' }} />
          <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 100, padding: '7px 15px 7px 12px', fontSize: 12.5, fontWeight: 600, fontFamily: SANS, color: C.ink, marginBottom: 26, boxShadow: '0 6px 18px rgba(61,62,59,0.06)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.orange }} />
              {t.category} · Etsy tool
            </div>
            <h1 style={{ fontSize: 'clamp(38px,5.4vw,64px)', fontWeight: 600, letterSpacing: '-0.045em', color: C.ink, lineHeight: 1.02, marginBottom: 20 }}>
              {t.name}
            </h1>
            <p style={{ fontSize: 'clamp(18px,1.8vw,23px)', color: C.ink, fontWeight: 500, lineHeight: 1.4, marginBottom: 14, maxWidth: 680, marginInline: 'auto', letterSpacing: '-0.01em' }}>{t.tagline}</p>
            <p style={{ fontSize: 'clamp(15px,1.4vw,17px)', color: C.graphite, lineHeight: 1.62, maxWidth: 620, margin: '0 auto 32px' }}>{t.intro}</p>
            <div style={{ display: 'inline-flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link href="/register" style={{ background: C.orange, color: '#fff', textDecoration: 'none', fontSize: 16, fontWeight: 600, padding: '14px 28px', borderRadius: 30, boxShadow: '0 14px 30px rgba(251,94,9,0.28)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                Start free — try it now <Arrow color="#fff" />
              </Link>
              <Link href={`/dashboard?tab=${t.dashTab}`} style={{ background: C.paper, color: C.ink, textDecoration: 'none', fontSize: 16, fontWeight: 600, padding: '14px 26px', borderRadius: 30, border: `1px solid ${C.ash}` }}>
                Open in dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* ── Overview — narrative ── */}
        <section style={{ background: C.paper, padding: '84px 24px' }}>
          <div className="rsplit" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: 64, alignItems: 'start' }}>
            <div>
              {sectionTag('Overview')}
              <h2 style={{ fontSize: 'clamp(26px,3.2vw,38px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.1, margin: 0 }}>
                What is {t.name}?
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {t.overview.map((p, i) => (
                <p key={i} style={{ fontSize: 17, color: C.graphite, lineHeight: 1.72, margin: 0 }}>{p}</p>
              ))}
            </div>
          </div>
        </section>

        {/* ── What it does — pastel bento tiles ── */}
        <section style={{ background: C.canvas, padding: '84px 24px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            {sectionTag('What it does')}
            <h2 style={{ fontSize: 'clamp(28px,3.4vw,42px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.08, marginBottom: 40, maxWidth: 720 }}>
              Everything {t.name.toLowerCase()} gives you
            </h2>
            <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {t.what.map((w, i) => {
                const tint = tintAt(i)
                return (
                  <div key={i} style={{ background: tint.bg, borderRadius: 24, padding: '30px 30px 32px', display: 'flex', flexDirection: 'column', gap: 18, minHeight: 168 }}>
                    <span style={{ width: 46, height: 46, borderRadius: 14, background: C.paper, display: 'grid', placeItems: 'center', boxShadow: '0 4px 12px rgba(61,62,59,0.08)' }}>
                      <Check color={tint.ic} />
                    </span>
                    <p style={{ fontSize: 17, lineHeight: 1.5, color: C.ink, fontWeight: 500, letterSpacing: '-0.01em', margin: 0 }}>{w}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── How it works — numbered steps ── */}
        <section style={{ background: C.paper, padding: '84px 24px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            {sectionTag('How it works')}
            <h2 style={{ fontSize: 'clamp(28px,3.4vw,42px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.08, marginBottom: 36, maxWidth: 720 }}>
              From keyword to result in a few steps
            </h2>
            <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(t.how.length, 4)}, 1fr)`, gap: 18 }}>
              {t.how.map((s, i) => (
                <div key={i} style={{ background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 22, padding: '26px 24px' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 13, background: C.orange, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 16, marginBottom: 18, boxShadow: '0 8px 18px rgba(251,94,9,0.22)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: C.ink, marginBottom: 8, letterSpacing: '-0.015em' }}>{s.title}</h3>
                  <p style={{ fontSize: 14.5, color: C.graphite, lineHeight: 1.55 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why it helps — bold solid blocks ── */}
        <section style={{ background: C.canvas, padding: '84px 24px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            {sectionTag('Why it helps')}
            <h2 style={{ fontSize: 'clamp(28px,3.4vw,42px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.08, marginBottom: 40, maxWidth: 720 }}>
              How {t.name.toLowerCase()} grows your Etsy shop
            </h2>
            <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
              {t.benefits.map((b, i) => (
                <div key={i} style={{ background: solidAt(i), borderRadius: 26, padding: '32px 30px 34px', color: '#fff', display: 'flex', flexDirection: 'column', minHeight: 220 }}>
                  <span style={{ width: 34, height: 34, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.55)', display: 'grid', placeItems: 'center', marginBottom: 'auto' }}>
                    <Arrow color="#fff" size={15} />
                  </span>
                  <h3 style={{ fontSize: 22, fontWeight: 600, marginTop: 26, marginBottom: 12, letterSpacing: '-0.02em', lineHeight: 1.12 }}>{b.title}</h3>
                  <p style={{ fontSize: 15.5, lineHeight: 1.55, opacity: 0.92, margin: 0 }}>{b.desc}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 34 }}>
              {t.features.map(f => (
                <span key={f} style={{ fontSize: 13.5, fontWeight: 500, fontFamily: SANS, color: C.ink, background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 100, padding: '8px 16px' }}>{f}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Use cases ── */}
        <section style={{ background: C.paper, padding: '84px 24px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            {sectionTag('Use cases')}
            <h2 style={{ fontSize: 'clamp(28px,3.4vw,42px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.08, marginBottom: 40, maxWidth: 720 }}>
              What you&apos;ll do with {t.name.toLowerCase()}
            </h2>
            <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
              {t.useCases.map((u, i) => {
                const tint = tintAt(i)
                return (
                  <div key={i} style={{ background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 22, padding: '28px 26px 30px' }}>
                    <span style={{ display: 'inline-grid', placeItems: 'center', width: 40, height: 40, borderRadius: 12, background: tint.bg, color: tint.ic, fontFamily: SANS, fontWeight: 700, fontSize: 15, marginBottom: 18 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 style={{ fontSize: 18.5, fontWeight: 600, color: C.ink, marginBottom: 8, letterSpacing: '-0.02em' }}>{u.title}</h3>
                    <p style={{ fontSize: 15, color: C.graphite, lineHeight: 1.58, margin: 0 }}>{u.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section style={{ background: C.canvas, padding: '84px 24px' }}>
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            {sectionTag('FAQ')}
            <h2 style={{ fontSize: 'clamp(28px,3.4vw,44px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.06, marginBottom: 28 }}>
              {t.name} — questions, answered
            </h2>
            <FaqList items={t.faqs} />
          </div>
        </section>

        {/* ── Related tools — tinted cards ── */}
        {related.length > 0 && (
          <section style={{ background: C.paper, padding: '80px 24px' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
              {sectionTag('Related tools')}
              <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, marginTop: 8 }}>
                {related.map((r, i) => {
                  const tint = tintAt(i)
                  return (
                    <Link key={r.slug} href={`/${r.slug}`} style={{ display: 'flex', flexDirection: 'column', background: tint.bg, borderRadius: 22, padding: '26px 26px 28px', textDecoration: 'none', minHeight: 158 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'auto' }}>
                        <span style={{ fontSize: 11, fontFamily: SANS, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.09em', color: tint.ic }}>{r.category}</span>
                        <span style={{ width: 30, height: 30, borderRadius: '50%', background: C.paper, display: 'grid', placeItems: 'center' }}><Arrow color={tint.ic} size={14} /></span>
                      </div>
                      <h3 style={{ fontSize: 19, fontWeight: 600, color: C.ink, margin: '20px 0 6px', letterSpacing: '-0.02em' }}>{r.name}</h3>
                      <p style={{ fontSize: 14, color: C.graphite, lineHeight: 1.5, margin: 0 }}>{r.tagline}</p>
                    </Link>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Final CTA — charcoal block ── */}
        <section style={{ background: C.paper, padding: '0 24px 96px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', background: C.charcoal, borderRadius: 40, padding: 'clamp(56px,7vw,84px) 32px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden style={{ position: 'absolute', top: '-40%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, background: 'radial-gradient(50% 50% at 50% 50%, rgba(251,94,9,0.22), transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <h2 style={{ fontSize: 'clamp(30px,3.8vw,48px)', fontWeight: 600, letterSpacing: '-0.035em', color: '#fff', lineHeight: 1.06, marginBottom: 16 }}>
                Ready to try {t.name}?
              </h2>
              <p style={{ fontSize: 17.5, color: 'rgba(245,245,235,0.72)', lineHeight: 1.55, marginBottom: 30, maxWidth: 520, marginInline: 'auto' }}>
                Start free — real Etsy &amp; Google data from your very first search.
              </p>
              <Link href="/register" style={{ background: C.orange, color: '#fff', textDecoration: 'none', fontSize: 16, fontWeight: 600, padding: '15px 32px', borderRadius: 30, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 14px 30px rgba(251,94,9,0.34)' }}>
                Get started free <Arrow color="#fff" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
