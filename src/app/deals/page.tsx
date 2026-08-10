import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { DealsBackdrop } from '@/components/landing/DealsBackdrop'
import { connectDB } from '@/lib/db'
import { Deal } from '@/lib/models'
import { ensureDefaultDeals } from '@/lib/deals'
import { abs } from '@/lib/seo/site'
import type { IDeal } from '@/types'
import { C } from '@/utils'

export const revalidate = 60
const SANS = "'General Sans',sans-serif"
const PER_PAGE = 2 // only two deals per page, then paginate

// Cohesive warm palette (not rainbow) — each deal gets one of these, cycled.
const ACCENTS = ['#FB5E09', '#B7791F', '#C2510B', '#D08326']

export const metadata: Metadata = {
  title: 'Deals — Special offers on Rankkw plans',
  description: 'Current deals and special offers on Rankkw — save on Etsy SEO tools, credits and AI listing images.',
  alternates: { canonical: abs('/deals') },
  openGraph: { title: 'Rankkw Deals', description: 'Special offers on Rankkw plans.', url: abs('/deals'), type: 'website' },
}

async function getDeals(): Promise<IDeal[]> {
  try {
    await connectDB()
    await ensureDefaultDeals()
    return await Deal.find({ status: 'published' }).sort({ createdAt: -1 })
      .select('title slug summary badge ctaLabel createdAt').lean<IDeal[]>()
  } catch { return [] }
}

export default async function DealsIndex({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams
  const deals = await getDeals()
  const pageCount = Math.max(1, Math.ceil(deals.length / PER_PAGE))
  const page = Math.min(Math.max(1, parseInt(pageParam || '1', 10) || 1), pageCount)
  const shown = deals.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <>
      <Navbar />
      <main style={{ background: C.paper, position: 'relative', overflow: 'hidden' }}>
        <DealsBackdrop />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1120, margin: '0 auto', padding: 'clamp(140px,15vw,180px) 24px 96px' }}>
          {/* Professional, compact header (no full hero band) */}
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 600, fontFamily: SANS, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.orange, marginBottom: 14 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange }} />Deals
            </div>
            <h1 style={{ fontSize: 'clamp(32px,4.4vw,52px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.05, marginBottom: 12 }}>
              Special offers
            </h1>
            <p style={{ fontSize: 'clamp(15px,1.4vw,17px)', color: C.graphite, lineHeight: 1.55, maxWidth: 520, margin: '0 auto' }}>
              Limited-time deals on Rankkw plans — more tools, credits and AI images for less.
            </p>
          </div>

          {deals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: C.graphite }}>
              <p style={{ fontSize: 18, fontWeight: 500, color: C.ink, marginBottom: 6 }}>No deals right now</p>
              <p style={{ fontSize: 15 }}>Check back soon — new offers are on the way.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
                {shown.map((d, i) => {
                  const accent = ACCENTS[((page - 1) * PER_PAGE + i) % ACCENTS.length]
                  return (
                    <div key={d.slug} className="deal-card rk-ants"
                      style={{ ['--ant' as string]: accent, ['--glow' as string]: `${accent}59`, padding: 'clamp(28px, 4vw, 44px)' }}>
                      <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                          {d.badge && (
                            <span style={{ fontSize: 11, fontFamily: "'General Sans',monospace", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fff', background: accent, padding: '5px 12px', borderRadius: 100 }}>{d.badge}</span>
                          )}
                          <span style={{ fontSize: 11.5, fontFamily: "'General Sans',monospace", textTransform: 'uppercase', letterSpacing: '0.08em', color: C.stone }}>Deal</span>
                        </div>
                        <h2 style={{ fontSize: 'clamp(24px,2.9vw,34px)', fontWeight: 600, letterSpacing: '-0.03em', color: C.ink, lineHeight: 1.12, marginBottom: 14 }}>{d.title}</h2>
                        {d.summary && <p style={{ fontSize: 'clamp(15px,1.5vw,17px)', color: C.graphite, lineHeight: 1.6, marginBottom: 24, maxWidth: 760 }}>{d.summary}</p>}
                        <Link href={`/deals/${d.slug}`} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8, background: accent, color: '#fff',
                          textDecoration: 'none', fontSize: 15, fontWeight: 600, padding: '12px 26px', borderRadius: 100,
                          boxShadow: `0 10px 24px -10px ${accent}`,
                        }}>
                          Show more →
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination */}
              {pageCount > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 44 }}>
                  <PageLink page={page - 1} disabled={page <= 1} label="‹" />
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map(n => (
                    <PageLink key={n} page={n} active={n === page} label={String(n)} />
                  ))}
                  <PageLink page={page + 1} disabled={page >= pageCount} label="›" />
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}

function PageLink({ page, label, active, disabled }: { page: number; label: string; active?: boolean; disabled?: boolean }) {
  const base: React.CSSProperties = {
    minWidth: 40, height: 40, padding: '0 12px', borderRadius: 100, fontSize: 14.5,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
    fontFamily: "'General Sans',monospace", fontWeight: 500,
    border: `1px solid ${active ? C.orange : C.ash}`, background: active ? C.orange : C.paper, color: active ? '#fff' : C.ink,
  }
  if (disabled) return <span style={{ ...base, opacity: 0.4 }}>{label}</span>
  return <Link href={page === 1 ? '/deals' : `/deals?page=${page}`} style={base}>{label}</Link>
}
