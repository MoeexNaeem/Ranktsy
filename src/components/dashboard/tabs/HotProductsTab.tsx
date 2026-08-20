'use client'
/**
 * Find Hot Products — a product-research database over LIVE Etsy listings.
 * Ranks products by a real "Hot Score" (favorite-velocity + engagement); every
 * filter and sort hits our live data for fresh real data. NO per-listing sales or
 * revenue is shown — Etsy publishes none, and this product never fabricates.
 */
import { useState, useCallback, useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import axios from 'axios'
import { useListingReviews } from '@/hooks/useListingReviews'
import { estimateListingSales } from '@/lib/salesEstimate'
import { C, D, ACCENT, withAlpha, formatNumber } from '@/utils'
import { chargeCredits } from '@/lib/credits-client'
import { SearchBar, Card, SectionTitle, ErrorBox, Loading, EmptyState, MONO } from '../kit'
import { HotProductDetail } from '../hot/HotProductDetail'
import type { HotProduct, HotProductsResponse, ApiResponse } from '@/types'

const ageDaysOf = (ts?: number | null) => ts ? Math.max(0, Math.floor((Date.now() - ts * 1000) / 86_400_000)) : null
const fmtAge = (ts?: number | null) => { const d = ageDaysOf(ts); return d == null ? '—' : d >= 365 ? `${(d / 365).toFixed(1)}y` : d >= 30 ? `${Math.round(d / 30)}mo` : `${d}d` }

const HUE = ACCENT.rose
// Always shown as $ — Etsy mixes currencies with no FX rate, and a raw amount
// tagged with the wrong symbol reads worse than a consistent $ convention.
const sym = (_c?: string) => '$'
const fmtDate = (ts?: number | null) => ts ? new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const SORTS: { id: string; label: string }[] = [
  { id: 'hot', label: '🔥 Hot Score' },
  { id: 'velocity', label: 'Fastest Growing' },
  { id: 'engagement', label: 'Most Engaging' },
  { id: 'favorites', label: 'Most Favorited' },
  { id: 'views', label: 'Most Viewed' },
  { id: 'newest', label: 'Newest' },
  { id: 'price_low', label: 'Price: Low → High' },
  { id: 'price_high', label: 'Price: High → Low' },
]

// Export the current results to CSV. Real, measured fields + the labelled review-based
// estimates (est. columns are blank for rows past the review-fetch cap).
function exportCsv(rows: HotProduct[], query: string, estimates: Record<number, { estMonthlySales: number | null; estMonthlyRevenue: number | null; estTotalSales: number | null; reviewCount: number | null }>) {
  const header = ['Title', 'Shop', 'Price', 'Currency', 'Views', 'Favorites', 'Engagement %', 'Favs/day', 'Hot Score', 'Quantity', 'Created', 'Age (days)', 'Reviews', 'Est. Sales/mo', 'Est. Revenue/mo', 'Est. Total sales', 'URL']
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = rows.map(p => { const e = estimates[p.listing_id]; return [
    p.title, p.shopName, p.price ?? '', p.currency, p.views, p.favorites, p.engagementPct,
    p.favPerDay ?? '', p.hotScore, p.quantity, fmtDate(p.createdTimestamp), ageDaysOf(p.createdTimestamp) ?? '',
    e?.reviewCount ?? '', e?.estMonthlySales ?? '', e?.estMonthlyRevenue ?? '', e?.estTotalSales ?? '', p.url,
  ].map(esc).join(',') })
  const csv = [header.map(esc).join(','), ...lines].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url; a.download = `hot-products-${query.replace(/\s+/g, '-').slice(0, 30)}.csv`; a.click()
  URL.revokeObjectURL(url)
}
const RELEASE: { id: string; label: string }[] = [
  { id: '30', label: '30 Days' }, { id: '180', label: '180 Days' }, { id: '365', label: '1 Year' }, { id: '', label: 'All Time' },
]

const ctrl: React.CSSProperties = { background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 100, padding: '9px 14px', fontSize: 13.5, fontFamily: 'inherit', color: C.ink, outline: 'none' }
const LIST_GRID = '2fr 0.9fr 0.55fr 0.7fr 0.75fr 0.85fr 0.9fr 0.95fr 0.45fr'
const LIST_HEADS = ['Product', 'Shop', 'Age', 'Views', 'Favorites', '~ Sales/mo', 'Favs/day', 'Hot Score', '']

function HotBar({ score }: { score: number }) {
  const color = score >= 55 ? D.hard : score >= 35 ? D.mid : D.good
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{ flex: 1, height: 9, background: C.bone, borderRadius: 999, overflow: 'hidden', minWidth: 56 }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: 15, fontFamily: MONO, fontWeight: 600, color, width: 34, textAlign: 'right' }}>{score}</span>
    </div>
  )
}

export function HotProductsTab({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const [input, setInput] = useState('sticker')
  const [sort, setSort] = useState('hot')
  const [cat, setCat] = useState('')
  const [minP, setMinP] = useState('')
  const [maxP, setMaxP] = useState('')
  const [minFav, setMinFav] = useState('')
  const [release, setRelease] = useState('')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [selected, setSelected] = useState<HotProduct | null>(null)
  const [applied, setApplied] = useState({ q: 'sticker', sort: 'hot', cat: '', minP: '', maxP: '', minFav: '', release: '' })

  const { data: taxo } = useQuery({
    queryKey: ['taxonomy'],
    queryFn: async () => (await axios.get('/api/etsy/taxonomy')).data.data as { id: number; name: string; fullPath: string; level: number }[],
    staleTime: 1000 * 60 * 60 * 24,
  })
  const categories = useMemo(() => (taxo ?? []).filter(t => t.level <= 2).sort((a, b) => a.fullPath.localeCompare(b.fullPath)), [taxo])

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['hot-products', applied],
    queryFn: async ({ signal }) => {
      const p = new URLSearchParams({ q: applied.q, sort: applied.sort })
      if (applied.cat) p.set('taxonomyId', applied.cat)
      if (applied.minP) p.set('minPrice', applied.minP)
      if (applied.maxP) p.set('maxPrice', applied.maxP)
      if (applied.minFav) p.set('minFavorites', applied.minFav)
      if (applied.release) p.set('releaseDays', applied.release)
      const { data } = await axios.get<ApiResponse<HotProductsResponse>>(`/api/etsy/hot-products?${p.toString()}`, { signal })
      if (!data.success || !data.data) throw new Error(data.error ?? 'Failed')
      return data.data
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 20,
    retry: false,
  })

  const apply = useCallback(async () => {
    const q = input.trim(); if (q.length < 2) return
    if (!(await chargeCredits('hotproducts'))) return
    setSelected(null)
    setApplied({ q, sort, cat, minP, maxP, minFav, release })
  }, [input, sort, cat, minP, maxP, minFav, release])

  // Sort/release are instant re-applies (cheap for the user).
  const setSortNow = useCallback((s: string) => { setSort(s); setApplied(a => ({ ...a, sort: s })) }, [])
  const setReleaseNow = useCallback((r: string) => { setRelease(r); setApplied(a => ({ ...a, release: r })) }, [])

  const products = useMemo(() => data?.products ?? [], [data])

  // Review-based sales ESTIMATE for the shown products. Fetched lazily and capped
  // to the first 30 rows (each id is its own Etsy call), same as the Top Listings
  // table — the grid paints first and the ~Sales/mo column fills in.
  const reviewIds = useMemo(() => products.slice(0, 30).map(p => p.listing_id), [products])
  const reviewsQ = useListingReviews(reviewIds)
  const estOf = useCallback((p: HotProduct) => {
    const rs = reviewsQ.data?.[p.listing_id]
    return estimateListingSales({ reviewCount: rs?.count ?? null, reviewsLast30d: rs?.last30d ?? null, price: p.price, ageDays: ageDaysOf(p.createdTimestamp), views: p.views ?? null, favorites: p.favorites ?? null })
  }, [reviewsQ.data])
  const reviewsLoading = reviewsQ.isPending || reviewsQ.isFetching

  if (selected) {
    return <HotProductDetail product={selected} onBack={() => setSelected(null)} onNavigate={onNavigate} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search + intro */}
      <Card pad="18px">
        <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: C.stone }}>live Etsy data</span>}>Find Hot Products</SectionTitle>
        <p style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.55, marginTop: -8, marginBottom: 14 }}>
          Search Etsy&apos;s live catalog and rank products by a real <strong style={{ color: HUE }}>Hot Score</strong> — how fast a
          listing gathers favorites for its age, plus its favorites-per-view. Click any product for a full breakdown. Etsy publishes no
          per-listing sales, so <strong style={{ color: D.mid }}>~ Sales/mo</strong> is a labelled estimate from review velocity.
        </p>
        <SearchBar value={input} onChange={setInput} onSubmit={apply} placeholder="Product, tag or niche — e.g. sticker, wall art…" button="Search →" />
      </Card>

      {/* Filters */}
      <Card pad="14px 18px">
        <div className="rwrap-sm" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontFamily: MONO, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filters</span>
          <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...ctrl, cursor: 'pointer', maxWidth: 220 }}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.fullPath}</option>)}
          </select>
          <input value={minP} onChange={e => setMinP(e.target.value.replace(/[^\d.]/g, ''))} onKeyDown={e => e.key === 'Enter' && apply()} placeholder="Min $" inputMode="decimal" style={{ ...ctrl, width: 88 }} />
          <input value={maxP} onChange={e => setMaxP(e.target.value.replace(/[^\d.]/g, ''))} onKeyDown={e => e.key === 'Enter' && apply()} placeholder="Max $" inputMode="decimal" style={{ ...ctrl, width: 88 }} />
          <input value={minFav} onChange={e => setMinFav(e.target.value.replace(/[^\d]/g, ''))} onKeyDown={e => e.key === 'Enter' && apply()} placeholder="Min favorites" inputMode="numeric" style={{ ...ctrl, width: 120 }} />
          <button onClick={apply} style={{ background: HUE, border: 'none', color: '#fff', borderRadius: 100, padding: '9px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Apply</button>
        </div>
        {/* Release-time pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontFamily: MONO, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Released</span>
          {RELEASE.map(r => {
            const on = release === r.id
            return (
              <button key={r.id} onClick={() => setReleaseNow(r.id)}
                style={{ fontSize: 13, fontFamily: 'inherit', padding: '6px 14px', borderRadius: 100, cursor: 'pointer', background: on ? withAlpha(HUE, 0.12) : 'transparent', color: on ? HUE : C.graphite, border: `1px solid ${on ? HUE : C.ash}` }}>
                {r.label}
              </button>
            )
          })}
        </div>
      </Card>

      {isError && <ErrorBox>Couldn&apos;t load products live. Try a different search or loosen the filters.</ErrorBox>}
      {isLoading && <Loading label="Scanning Etsy for hot products…" />}

      {data && !isLoading && (
        <>
          {/* Results header */}
          <div className="rsectitle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 13.5, color: C.graphite }}>
              <strong style={{ color: C.ink }}>{formatNumber(data.total)}</strong> live products for &ldquo;{applied.q}&rdquo; · scoring the top {data.sampled}
              {isFetching && <span style={{ color: C.stone, marginLeft: 8 }}>· refreshing…</span>}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <select value={sort} onChange={e => setSortNow(e.target.value)} style={{ ...ctrl, cursor: 'pointer' }}>
                {SORTS.map(s => <option key={s.id} value={s.id}>Sort: {s.label}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 4, background: C.bone, padding: 4, borderRadius: 100 }}>
                {(['list', 'grid'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)} title={`${v} view`}
                    style={{ padding: '6px 12px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 12.5, fontFamily: MONO, background: view === v ? C.paper : 'transparent', color: view === v ? C.ink : C.graphite }}>
                    {v === 'list' ? '☰' : '▦'}
                  </button>
                ))}
              </div>
              <button onClick={() => exportCsv(products, applied.q, Object.fromEntries(products.map(p => [p.listing_id, estOf(p)])))} disabled={products.length === 0}
                style={{ ...ctrl, cursor: products.length ? 'pointer' : 'default', opacity: products.length ? 1 : 0.5, whiteSpace: 'nowrap', fontFamily: MONO, fontSize: 12.5, padding: '9px 15px' }}>
                ↓ Export CSV
              </button>
            </div>
          </div>

          {products.length === 0 ? (
            <EmptyState icon="🔍" title="No products match these filters" sub="These filters apply to the top matches for your search. Try loosening the price, favorites, or release-time filters." />
          ) : view === 'list' ? (
            <Card pad={0}>
              <div style={{ display: 'grid', gridTemplateColumns: LIST_GRID, gap: 14, padding: '16px 22px', background: C.headerBg, borderBottom: `1px solid ${C.ash}` }}>
                {LIST_HEADS.map((h, i) => (
                  <span key={h || i} style={{ fontSize: 12, fontFamily: MONO, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: h === '~ Sales/mo' ? D.mid : C.graphite, textAlign: i === 0 || i === 1 || i === LIST_HEADS.length - 1 ? 'left' : 'right' }}>{h}</span>
                ))}
              </div>
              {products.map(p => (
                <button key={p.listing_id} onClick={() => setSelected(p)}
                  style={{ display: 'grid', gridTemplateColumns: LIST_GRID, gap: 14, padding: '18px 22px', borderBottom: `1px solid ${C.hair}`, alignItems: 'center', width: '100%', background: 'transparent', border: 'none', borderBottomStyle: 'solid', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', minWidth: 0 }}>
                    {p.image ? <img src={p.image} alt="" style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: `1px solid ${C.hair}` }} /> : <div style={{ width: 72, height: 72, borderRadius: 10, background: C.bone, flexShrink: 0 }} />}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 16, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                        {p.price != null && <span style={{ fontSize: 15, fontFamily: MONO, fontWeight: 600, color: HUE }}>{sym(p.currency)}{p.price}</span>}
                        <span style={{ fontSize: 13, color: C.stone }}>· {fmtDate(p.createdTimestamp)}</span>
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 13.5, color: C.graphite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{p.shopName || '—'}</span>
                  <span style={{ fontSize: 15, fontFamily: MONO, color: C.ink, textAlign: 'right' }}>{fmtAge(p.createdTimestamp)}</span>
                  <span style={{ fontSize: 16, fontFamily: MONO, color: D.series[1], textAlign: 'right' }}>{formatNumber(p.views)}</span>
                  <span style={{ fontSize: 16, fontFamily: MONO, color: D.series[5], textAlign: 'right' }}>{formatNumber(p.favorites)}</span>
                  {(() => { const s = estOf(p).estMonthlySales; return (
                    <span style={{ fontSize: 15, fontFamily: MONO, color: s != null ? D.mid : C.stone, fontWeight: s != null ? 600 : 400, textAlign: 'right' }} title="Estimated monthly sales — from review velocity, not real, measured data">
                      {s != null ? `~${formatNumber(s)}` : (reviewsLoading ? '…' : '—')}
                    </span>) })()}
                  <span style={{ fontSize: 15, fontFamily: MONO, color: p.favPerDay != null ? D.good : C.stone, textAlign: 'right' }}>{p.favPerDay != null ? p.favPerDay : '—'}</span>
                  <HotBar score={p.hotScore} />
                  <span style={{ fontSize: 13.5, fontFamily: MONO, color: HUE, textAlign: 'right' }}>View →</span>
                </button>
              ))}
            </Card>
          ) : (
            <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, opacity: isFetching ? 0.6 : 1 }}>
              {products.map(p => (
                <button key={p.listing_id} onClick={() => setSelected(p)}
                  style={{ display: 'block', textAlign: 'left', background: C.paper, border: `1px solid ${C.hair}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', fontFamily: 'inherit', padding: 0, transition: 'border-color 0.15s, transform 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = HUE; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.hair; e.currentTarget.style.transform = 'none' }}>
                  <div style={{ position: 'relative', height: 150, background: C.bone }}>
                    {p.image ? <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: C.stone }}>🛍</div>}
                    <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 11.5, fontFamily: MONO, fontWeight: 600, color: '#fff', background: withAlpha(HUE, 0.95), padding: '3px 9px', borderRadius: 100 }}>🔥 {p.hotScore}</span>
                  </div>
                  <div style={{ padding: '11px 13px' }}>
                    <p style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 7, minHeight: 34 }}>{p.title}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, fontFamily: MONO }}>
                      {p.price != null ? <span style={{ color: HUE, fontWeight: 600, fontSize: 13 }}>{sym(p.currency)}{p.price}</span> : <span />}
                      <span style={{ color: C.graphite }}>👁 {formatNumber(p.views)} · ♥ {formatNumber(p.favorites)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontFamily: MONO, marginTop: 5 }}>
                      <span style={{ color: C.stone }}>{fmtAge(p.createdTimestamp)} old</span>
                      {(() => { const s = estOf(p).estMonthlySales; return <span style={{ color: s != null ? D.mid : C.stone }} title="Estimated monthly sales — from review velocity">{s != null ? `~${formatNumber(s)}/mo` : (reviewsLoading ? '…' : '—')}</span> })()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.6 }}>
            Views, favorites, age and Hot Score are measured live measured live. Hot Score = favorite-velocity (favorites ÷ days live) + engagement (favorites ÷ views),
            scored on the top matches. Etsy exposes no per-listing sales, so <strong style={{ color: D.mid }}>~ Sales/mo</strong> is an <em>estimate</em> (reviews ÷ a review rate) — directional, not exact.
          </p>
        </>
      )}
    </div>
  )
}
