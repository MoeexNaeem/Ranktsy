'use client'
/**
 * Find Hot Products detail, Phase 2: what we MEASURED on this product.
 *  - MeasuredStrip: 7 / 30 day gains from the product database
 *  - PerformanceChart: its daily series (sales, views, favorites, reviews, price,
 *    stock, best search rank) over 30 or 90 days
 *  - ChangesTimeline: what the seller changed, and when we saw it
 *  - TagPerformance: each tag's market (competition, views, favorites, sales of the
 *    listings ranking for it, Google volume and CPC) with sparklines
 * Green = measured, amber "~" = estimate. Nothing is invented: no history means
 * "not tracked yet".
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { C, D, ACCENT, withAlpha, formatNumber } from '@/utils'
import { Card, SectionTitle, Loading, MONO } from '../kit'
import { Sparkline } from '@/components/charts/pro'
import { EventRow } from '../keyword/RankWhyPanel'
import type { ApiResponse, BulkKeywordRow } from '@/types'
import type { ProductItemData, HistoryPoint } from '@/lib/product-db'
import type { KeywordMarketHistory } from '@/lib/snapshots'

const HUE = ACCENT.rose
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const money = (n: number) => (n >= 1000 ? `$${formatNumber(n)}` : `$${Math.round(n * 100) / 100}`)

export function useProductItem(listingId: number, days: 30 | 90) {
  return useQuery({
    queryKey: ['hot-item', listingId, days],
    queryFn: async () => {
      const { data } = await axios.get<ApiResponse<ProductItemData>>(`/api/etsy/hot-products/item?id=${listingId}&days=${days}`)
      if (!data.success || !data.data) throw new Error(data.error ?? 'Failed')
      return data.data
    },
    staleTime: 1000 * 60 * 15,
    retry: 1,
  })
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'est' | 'muted' }) {
  const color = tone === 'good' ? D.good : tone === 'est' ? D.mid : tone === 'muted' ? C.stone : C.ink
  return (
    <div style={{ background: C.bone, borderRadius: 12, padding: '11px 13px', minWidth: 0 }}>
      <p style={{ fontSize: 10.5, fontFamily: MONO, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{label}</p>
      <p style={{ fontSize: 19, fontWeight: 600, color, lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: C.graphite, marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

/** The product-database row: measured 7 / 30 day gains, stock, rank and discount. */
export function MeasuredStrip({ data }: { data: ProductItemData | undefined }) {
  const s = data?.stat
  if (!s) {
    return (
      <Card>
        <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: C.stone }}>measured</span>}>Last 7 and 30 days</SectionTitle>
        <p style={{ fontSize: 13, color: C.graphite, lineHeight: 1.55 }}>
          {data ? 'This product is not in our tracking database yet, so there are no measured 7-day figures. Once our extension or searches see it on a few days, they appear here.' : 'Loading…'}
        </p>
      </Card>
    )
  }
  const g = (v: number | null, est = false, isMoney = false) => (v == null ? '-' : `${est ? '~' : '+'}${isMoney ? money(v) : formatNumber(v)}`)
  const off = s.onSale && s.priceOrig && s.price && s.priceOrig > s.price ? Math.round((1 - s.price / s.priceOrig) * 100) : null
  return (
    <Card>
      <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: C.stone }}>measured {fmtDay(s.lastDay)} · green measured, amber ~ estimate</span>}>Last 7 and 30 days</SectionTitle>
      <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        <Stat label="Sales · 7 days" value={g(s.sales7, s.salesEst)} sub={s.sales7 == null ? 'not enough history' : s.salesEst ? 'estimate from reviews' : 'measured from stock'} tone={s.sales7 == null ? 'muted' : s.salesEst ? 'est' : 'good'} />
        <Stat label="Sales · 30 days" value={g(s.sales30, s.salesEst30)} sub={s.sales30 == null ? 'not enough history' : s.salesEst30 ? 'estimate from reviews' : 'measured from stock'} tone={s.sales30 == null ? 'muted' : s.salesEst30 ? 'est' : 'good'} />
        <Stat label="Revenue · 7 days" value={s.rev7 == null ? '-' : `~${money(s.rev7)}`} sub="sales × price (USD)" tone={s.rev7 == null ? 'muted' : 'est'} />
        <Stat label="Revenue · 30 days" value={s.rev30 == null ? '-' : `~${money(s.rev30)}`} sub="sales × price (USD)" tone={s.rev30 == null ? 'muted' : 'est'} />
        <Stat label="Favorites gained" value={g(s.f7)} sub={`7 days · ${g(s.f30)} in 30`} tone={s.f7 == null ? 'muted' : 'good'} />
        <Stat label="Views gained" value={g(s.v7)} sub={`7 days · ${g(s.v30)} in 30`} tone={s.v7 == null ? 'muted' : 'good'} />
        <Stat label="Reviews gained" value={g(s.r7)} sub={`7 days · ${g(s.r30)} in 30`} tone={s.r7 == null ? 'muted' : 'good'} />
        <Stat label="Best search rank" value={s.bestRank != null ? `#${s.bestRank}` : '-'} sub="best position seen, 7 days" tone={s.bestRank == null ? 'muted' : undefined} />
        <Stat label="Price" value={s.priceUsd != null ? money(s.priceUsd) : s.price != null ? `${s.price} ${s.cur ?? ''}` : '-'} sub={off ? `${off}% off ${s.priceOrig} ${s.cur ?? ''}` : s.onSale === false ? 'not on sale' : undefined} />
        <Stat label="Stock" value={s.qty != null ? formatNumber(s.qty) : '-'} sub="units listed" />
        <Stat label="Total sales" value={s.salesTotal != null ? `~${formatNumber(s.salesTotal)}` : '-'} sub="estimate from all reviews" tone={s.salesTotal == null ? 'muted' : 'est'} />
        <Stat label="Badges" value={s.badges.length ? s.badges.join(', ') : 'None seen'} sub={[s.freeShip ? 'Free shipping' : '', s.ship ? `Ships from ${s.ship}` : '', s.made ? (s.made === 'vintage' ? 'Vintage' : 'Handmade') : ''].filter(Boolean).join(' · ') || undefined} />
        {s.bought24h != null && (
          <Stat label="Bought in 24 hours" value={`${formatNumber(s.bought24h)}+`} sub={`Etsy's own counter, seen ${fmtDay(s.boughtDay ?? s.lastDay)}`} tone="good" />
        )}
      </div>
    </Card>
  )
}

type MetricId = 'sales' | 'views' | 'favs' | 'reviews' | 'price' | 'qty' | 'rank'
const METRICS: { id: MetricId; label: string; color: string; unit: string }[] = [
  { id: 'sales', label: 'Sales', color: D.good, unit: 'per day' },
  { id: 'views', label: 'Views', color: D.series[1], unit: 'per day' },
  { id: 'favs', label: 'Favorites', color: D.series[5], unit: 'per day' },
  { id: 'reviews', label: 'Reviews', color: D.series[4], unit: 'total' },
  { id: 'price', label: 'Price', color: HUE, unit: '' },
  { id: 'qty', label: 'Stock', color: C.graphite, unit: 'units' },
  { id: 'rank', label: 'Search rank', color: D.series[2], unit: 'best position' },
]

function pointValue(p: HistoryPoint, m: MetricId): { v: number | null; est?: boolean } {
  switch (m) {
    case 'sales': return p.sold != null ? { v: p.sold } : { v: p.salesEst, est: true }
    case 'views': return { v: p.dViews }
    case 'favs': return { v: p.dFavs }
    case 'reviews': return { v: p.reviews }
    case 'price': return { v: p.price }
    case 'qty': return { v: p.qty }
    case 'rank': return { v: p.rank }
  }
}

export function PerformanceChart({ days, setDays, q }: { days: 30 | 90; setDays: (d: 30 | 90) => void; q: ReturnType<typeof useProductItem> }) {
  const [metric, setMetric] = useState<MetricId>('sales')
  const def = METRICS.find(m => m.id === metric)!
  const rows = useMemo(() => (q.data?.series ?? []).map(p => {
    const { v, est } = pointValue(p, metric)
    return { label: fmtDay(p.day), value: v, est: est ? v : null, measured: est ? null : v }
  }), [q.data, metric])
  const points = rows.filter(r => r.value != null).length
  const anyEst = rows.some(r => r.est != null)
  const cur = q.data?.series.find(p => p.cur)?.cur ?? null
  return (
    <Card>
      <SectionTitle right={
        <div style={{ display: 'flex', gap: 4, background: C.bone, padding: 3, borderRadius: 100 }}>
          {([30, 90] as const).map(d => (
            <button key={d} onClick={() => setDays(d)} style={{ padding: '4px 12px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: MONO, background: days === d ? C.paper : 'transparent', color: days === d ? HUE : C.graphite }}>{d} days</button>
          ))}
        </div>
      }>Product performance</SectionTitle>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {METRICS.map(m => (
          <button key={m.id} onClick={() => setMetric(m.id)}
            style={{ fontSize: 12.5, padding: '5px 12px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit', background: metric === m.id ? withAlpha(m.color, 0.14) : 'transparent', color: metric === m.id ? m.color : C.graphite, border: `1px solid ${metric === m.id ? m.color : C.ash}` }}>
            {m.label}
          </button>
        ))}
      </div>
      {q.isPending ? <Loading label="Loading history…" /> : q.isError ? (
        <p style={{ fontSize: 13, color: C.graphite }}>{(q.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'History is unavailable right now.'}</p>
      ) : points < 2 ? (
        <p style={{ fontSize: 13, color: C.graphite, lineHeight: 1.55, padding: '24px 0' }}>
          We have {points ? 'only one reading' : 'no readings'} of {def.label.toLowerCase()} for this product in the last {days} days. The chart fills in as we track it on more days
          {q.data?.trackedSince ? ` (tracking since ${fmtDay(q.data.trackedSince)})` : ''}.
        </p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={rows} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="hp-perf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={def.color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={def.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.hair} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.stone }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: C.stone }} tickLine={false} axisLine={false} width={44} reversed={metric === 'rank'} allowDecimals={metric === 'price'} />
              <Tooltip formatter={(v) => [typeof v === 'number' ? formatNumber(v) : String(v), `${def.label}${def.unit ? ` (${def.unit})` : ''}`]} contentStyle={{ borderRadius: 10, border: `1px solid ${C.ash}`, fontSize: 12.5 }} />
              {metric === 'sales' ? (
                <>
                  <Area type="monotone" dataKey="measured" stroke={D.good} fill="url(#hp-perf)" strokeWidth={2} connectNulls dot={false} name="measured" />
                  <Line type="monotone" dataKey="est" stroke={D.mid} strokeDasharray="4 3" strokeWidth={2} connectNulls dot={false} name="estimate" />
                </>
              ) : (
                <Area type="monotone" dataKey="value" stroke={def.color} fill="url(#hp-perf)" strokeWidth={2} connectNulls dot={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.6, marginTop: 8 }}>
            {metric === 'sales' ? <>Solid green = units that left stock (measured). {anyEst ? <>Dashed amber = reviews gained ÷ review rate (estimate). </> : null}</> : null}
            {metric === 'views' || metric === 'favs' ? 'Average gained per day between our readings. ' : null}
            {metric === 'price' ? `Seller's list price when recorded, else the price seen that day${cur ? ` (${cur})` : ''}. ` : null}
            {metric === 'rank' ? 'Best organic position seen in any tracked search that day (1 = top). ' : null}
            Days without a reading are joined by a line, never filled with a guess.
          </p>
        </>
      )}
    </Card>
  )
}

export function ChangesTimeline({ q }: { q: ReturnType<typeof useProductItem> }) {
  const [all, setAll] = useState(false)
  const events = q.data?.events ?? []
  if (q.isPending) return null
  return (
    <Card>
      <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: C.stone }}>{events.length} recorded</span>}>What changed</SectionTitle>
      {events.length === 0 ? (
        <p style={{ fontSize: 13, color: C.graphite, lineHeight: 1.55 }}>No title, tag, price, sale, stock, photo, shipping or badge changes recorded in the last {q.data?.days ?? 90} days.</p>
      ) : (
        <>
          {(all ? events : events.slice(0, 8)).map((e, i) => <EventRow key={`${e.kind}-${e.day}-${i}`} e={e} />)}
          {events.length > 8 && (
            <button onClick={() => setAll(a => !a)} style={{ marginTop: 8, background: 'none', border: 'none', color: HUE, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>{all ? 'Show fewer' : `Show all ${events.length}`}</button>
          )}
        </>
      )}
    </Card>
  )
}

const TAG_GRID = 'minmax(150px,1.6fr) repeat(7, minmax(78px,1fr))'

/** eHunt-style tag table: real competition + Google from the bulk analysis, measured market gains from our tracking. */
export function TagPerformance({ rows, loading, onResearch }: { rows: BulkKeywordRow[] | undefined; loading: boolean; onResearch: (t: string) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const tags = useMemo(() => (rows ?? []).filter(r => !r.error).map(r => r.keyword.toLowerCase()), [rows])
  const market = useQuery({
    queryKey: ['hot-tag-market', tags.join('|')],
    queryFn: async () => {
      const { data } = await axios.get<ApiResponse<Record<string, KeywordMarketHistory | null>>>(`/api/etsy/hot-products/tag-market?tags=${encodeURIComponent(tags.join('|'))}`)
      if (!data.success || !data.data) throw new Error(data.error ?? 'Failed')
      return data.data
    },
    enabled: tags.length > 0,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  })
  if (!rows && !loading) return null
  const heads = ['Tag', 'Competition', 'Avg views', 'Views · 30d', 'Favorites · 30d', '~ Sales · 30d', 'Google / mo', 'CPC']
  const cpc = (r: BulkKeywordRow) => (r.googleCpcHigh != null ? `${r.googleCpcLow != null ? `${Math.round(r.googleCpcLow * 100) / 100}-` : ''}${Math.round(r.googleCpcHigh * 100) / 100}` : '-')
  return (
    <Card pad={0}>
      <div style={{ padding: '16px 18px 12px' }}>
        <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: C.stone }}>{market.isFetching ? 'measuring markets…' : 'click a row for its trend'}</span>}>Tag performance</SectionTitle>
      </div>
      {loading ? <div style={{ padding: '0 18px 18px' }}><Loading label="Analyzing each tag…" /></div> : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 860 }}>
            <div style={{ display: 'grid', gridTemplateColumns: TAG_GRID, gap: 10, padding: '10px 18px', background: C.headerBg, borderTop: `1px solid ${C.ash}`, borderBottom: `1px solid ${C.ash}` }}>
              {heads.map((h, i) => <span key={h} style={{ fontSize: 10.5, fontFamily: MONO, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: h.startsWith('~') ? D.mid : C.graphite, textAlign: i === 0 ? 'left' : 'right' }}>{h}</span>)}
            </div>
            {(rows ?? []).map(r => {
              const m = market.data?.[r.keyword.toLowerCase()] ?? null
              const isOpen = open === r.keyword
              const measured = m && m.measuredListings > 0
              const cell = (v: number | null | undefined, color: string = C.graphite) => <span style={{ fontSize: 13, fontFamily: MONO, color: v == null ? C.stone : color, textAlign: 'right' }}>{v == null ? (market.isFetching ? '…' : '-') : formatNumber(v)}</span>
              return (
                <div key={r.keyword} style={{ borderBottom: `1px solid ${C.hair}` }}>
                  <button onClick={() => setOpen(isOpen ? null : r.keyword)}
                    style={{ display: 'grid', gridTemplateColumns: TAG_GRID, gap: 10, padding: '11px 18px', alignItems: 'center', width: '100%', background: isOpen ? C.rowHover : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                    <span style={{ fontSize: 13.5, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isOpen ? '▾' : '▸'} {r.keyword}</span>
                    <span style={{ fontSize: 13, fontFamily: MONO, color: r.competition == null ? C.stone : r.competition > 100000 ? D.hard : r.competition > 10000 ? D.mid : D.good, textAlign: 'right' }}>{r.competition != null ? formatNumber(r.competition) : '-'}</span>
                    {cell(r.avgViews)}
                    {cell(measured ? m.last30.views : null, D.good)}
                    {cell(measured ? m.last30.favorites : null, D.good)}
                    {cell(measured ? m.last30.sales : null, D.mid)}
                    {cell(r.googleSearches, C.ink)}
                    <span style={{ fontSize: 13, fontFamily: MONO, color: r.googleCpcHigh != null ? C.ink : C.stone, textAlign: 'right' }}>{cpc(r)}</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '6px 18px 16px', background: C.rowHover }}>
                      {!measured ? (
                        <p style={{ fontSize: 12.5, color: C.graphite }}>{market.isFetching ? 'Measuring…' : 'We have not tracked the listings ranking for this tag on enough days yet.'}</p>
                      ) : (
                        <>
                          <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                            {([['Views per day', 'views', D.series[1]], ['Favorites per day', 'favorites', D.series[5]], ['~ Sales per day', 'sales', D.mid]] as const).map(([label, key, color]) => (
                              <div key={key}>
                                <p style={{ fontSize: 11, fontFamily: MONO, color: C.graphite, marginBottom: 4 }}>{label}</p>
                                <Sparkline data={m.daily.map(d => ({ label: fmtDay(d.day), value: d[key] }))} color={color} height={56} name={label} />
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: C.graphite }}>
                            <span>Measured on {m.measuredListings} of {m.sampledListings} ranking listings, {m.trackedDays} days</span>
                            <button onClick={() => onResearch(r.keyword)} style={{ background: 'none', border: 'none', color: HUE, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, padding: 0 }}>Open in Keyword Search →</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.6, padding: '12px 18px' }}>
              Competition = live Etsy listings for the tag. Avg views = average lifetime views of the listings ranking for it. 30-day views, favorites and sales are what those
              listings gained in the last 30 days, measured by our tracking (sales = reviews gained ÷ review rate, an estimate). Google figures are real Keyword Planner data.
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}
