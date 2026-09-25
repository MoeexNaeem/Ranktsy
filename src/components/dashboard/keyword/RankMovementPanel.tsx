'use client'
/**
 * Rank movement for a keyword: who climbed, who fell, measured day by day.
 *
 * This panel is the one thing in Rankkw that cannot be fetched on demand from
 * anywhere. Etsy's API returns today's ordering and keeps no history, so every
 * point here exists only because the extension captured the real ordering a
 * shopper saw on that day. A day nobody captured is gone for good, which is why
 * an untracked keyword says "tracking has started" instead of showing zeros.
 */
import { memo, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, SectionTitle, MONO } from '../kit'
import { C, D } from '@/utils'
import type { ApiResponse } from '@/types'

interface RankMover {
  listingId: number
  shopId: number | null
  title: string
  shopName: string | null
  first: number
  latest: number
  best: number
  worst: number
  change: number      // positive = climbed toward position 1
  days: number
  firstDay: string
  latestDay: string
  series: { day: string; position: number }[]
}
interface PageSignals {
  sample: number
  freeShippingPct: number | null
  withVideoPct: number | null
  badgePct: number | null
  starSellerPct: number | null
  medianImages: number | null
  inCartsMedian: number | null
  topBadges: { badge: string; count: number }[]
}
interface Coverage { keyword: string; days: number; listings: number; fromDay: string | null }
interface Payload {
  movers: RankMover[]
  reliable: boolean
  reason: 'ok' | 'none' | 'ambiguous'
  country?: string
  coverage: Coverage | null
  signals: PageSignals | null
}

/**
 * What the listings ranking for this keyword have in common.
 *
 * Every one of these is visible to any shopper and absent from the Etsy API, so
 * it exists only because the extension saw a real page. A null share means
 * nothing reported that field yet, which is shown as a dash rather than 0%.
 */
function SignalStrip({ s }: { s: PageSignals }) {
  const cells: { label: string; value: string | null; hint: string }[] = [
    { label: 'Free shipping', value: s.freeShippingPct != null ? `${s.freeShippingPct}%` : null, hint: 'Share of ranking listings offering free shipping, a documented Etsy ranking factor.' },
    { label: 'Has video', value: s.withVideoPct != null ? `${s.withVideoPct}%` : null, hint: 'Share with a listing video.' },
    { label: 'Etsy badge', value: s.badgePct != null ? `${s.badgePct}%` : null, hint: 'Share carrying any Etsy badge, such as Bestseller or Etsy’s Pick.' },
    { label: 'Star Seller', value: s.starSellerPct != null ? `${s.starSellerPct}%` : null, hint: 'Share sold by a Star Seller shop.' },
    { label: 'Median images', value: s.medianImages != null ? String(s.medianImages) : null, hint: 'Median gallery image count.' },
    { label: 'Median in carts', value: s.inCartsMedian != null ? String(s.inCartsMedian) : null, hint: 'Median "in N carts" counter shown on these listings.' },
  ]
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.hair}` }}>
      <p style={{ fontSize: 12.5, color: C.graphite, margin: '0 0 10px', lineHeight: 1.55 }}>
        What the top-ranking listings for this keyword have in common
        (<strong style={{ color: C.ink }}>{s.sample}</strong> listings).
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(122px, 1fr))', gap: 10 }}>
        {cells.map(c => (
          <div key={c.label} title={c.hint} style={{ border: `1px solid ${C.hair}`, borderRadius: 10, padding: '10px 12px', background: C.paper }}>
            <p style={{ fontSize: 10, fontFamily: MONO, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, whiteSpace: 'nowrap' }}>{c.label}</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: c.value ? C.ink : C.stone, margin: '4px 0 0', lineHeight: 1.1 }}>{c.value ?? '-'}</p>
          </div>
        ))}
      </div>
      {s.topBadges.length > 0 && (
        <p style={{ fontSize: 12, color: C.graphite, marginTop: 10 }}>
          Most common badges: {s.topBadges.map(b => `${b.badge} (${b.count})`).join(', ')}
        </p>
      )}
    </div>
  )
}

/** True when at least one signal has a real value (an all-dash strip says nothing). */
const hasSignals = (s: PageSignals | null | undefined): s is PageSignals =>
  !!s && [s.freeShippingPct, s.withVideoPct, s.badgePct, s.starSellerPct, s.medianImages, s.inCartsMedian].some(v => v != null)

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/**
 * A rank sparkline is inverted on purpose: position 1 is the BEST, so the line
 * is drawn with low numbers at the top. A line going up means the listing is
 * climbing, which is what people expect a rising line to mean.
 */
function Spark({ series, w = 96, h = 26 }: { series: { day: string; position: number }[]; w?: number; h?: number }) {
  const path = useMemo(() => {
    if (series.length < 2) return null
    const ps = series.map(p => p.position)
    const min = Math.min(...ps)
    const max = Math.max(...ps)
    const span = max - min || 1
    const stepX = w / (series.length - 1)
    return series
      .map((p, i) => {
        // Invert: the best (lowest) position sits at the top of the box.
        const y = ((p.position - min) / span) * (h - 4) + 2
        return `${i === 0 ? 'M' : 'L'} ${(i * stepX).toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')
  }, [series, w, h])
  if (!path) return <span style={{ fontSize: 11, color: C.stone, fontFamily: MONO }}>-</span>

  const climbed = series[0].position - series[series.length - 1].position
  const stroke = climbed > 0 ? D.good : climbed < 0 ? D.hard : C.stone
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }} aria-hidden>
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Change({ value }: { value: number }) {
  if (value === 0) return <span style={{ fontSize: 13, fontFamily: MONO, color: C.stone }}>no change</span>
  const up = value > 0
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13.5, fontWeight: 700, fontFamily: MONO, color: up ? D.good : D.hard }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        style={{ transform: up ? 'none' : 'rotate(180deg)' }}>
        <polyline points="18 15 12 9 6 15" />
      </svg>
      {Math.abs(value)}
    </span>
  )
}

const GRID = '2.2fr 0.8fr 0.8fr 1fr 1.1fr 0.8fr'

function Row({ m }: { m: RankMover }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, alignItems: 'center', padding: '11px 14px', borderTop: `1px solid ${C.hair}` }}>
      <div style={{ minWidth: 0 }}>
        <a href={`https://www.etsy.com/listing/${m.listingId}`} target="_blank" rel="noopener noreferrer"
          title={m.title || `Listing ${m.listingId}`}
          style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.title || `Listing ${m.listingId}`}
        </a>
        <span style={{ fontSize: 11, color: C.graphite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
          {m.shopName || '-'}
        </span>
      </div>
      <span style={{ fontSize: 13, fontFamily: MONO, color: C.graphite }}>#{m.first}</span>
      <span style={{ fontSize: 14, fontFamily: MONO, fontWeight: 700, color: C.ink }}>#{m.latest}</span>
      <Change value={m.change} />
      <Spark series={m.series} />
      <span title={`Ranked on ${m.days} days, ${fmtDay(m.firstDay)} to ${fmtDay(m.latestDay)} · best #${m.best}, worst #${m.worst}`}
        style={{ fontSize: 11.5, fontFamily: MONO, color: C.stone }}>
        {m.days}d
      </span>
    </div>
  )
}

export const RankMovementPanel = memo(function RankMovementPanel({ query }: { query: string }) {
  const q = useQuery({
    queryKey: ['rank-movers', query.toLowerCase().trim()],
    queryFn: async ({ signal }) => {
      const r = await fetch(`/api/etsy/rank-movers?q=${encodeURIComponent(query)}&days=30`, { signal })
      const j = (await r.json()) as ApiResponse<Payload>
      if (!j.success || !j.data) throw new Error(j.error ?? 'Failed')
      return j.data
    },
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 30,
    // This is our own recorded history, never a live upstream call, so a miss is
    // a real "not tracked yet" answer and retrying cannot change it.
    retry: false,
  })

  // Only shown once there is real movement for this keyword: no loader, no empty state.
  const movers = q.data?.movers ?? []
  const cov = q.data?.coverage
  // 'xx' means captured before we recorded the market, so claiming a country
  // would be a guess.
  const market = q.data?.country && q.data.country !== 'xx' ? q.data.country.toUpperCase() : null
  const signals = hasSignals(q.data?.signals) ? q.data!.signals : null

  if (!movers.length) {
    // No movement yet, but the shared traits of the top listings may already be known.
    if (!signals) return null
    return (
      <Card>
        <SectionTitle>What Top Listings Share</SectionTitle>
        <SignalStrip s={signals} />
      </Card>
    )
  }

  const climbers = movers.filter(m => m.change > 0).length
  const fallers = movers.filter(m => m.change < 0).length

  return (
    <Card>
      <SectionTitle right={
        <span style={{ fontSize: 11, fontFamily: MONO, color: C.graphite }}>
          <span style={{ color: D.good }}>{climbers} up</span> · <span style={{ color: D.hard }}>{fallers} down</span>
        </span>
      }>Rank Movement</SectionTitle>
      <p style={{ fontSize: 13, color: C.graphite, marginTop: -8, marginBottom: 12, lineHeight: 1.55 }}>
        Where these listings ranked for <strong style={{ color: C.ink }}>{query}</strong>, day by day{cov?.fromDay ? ` since ${fmtDay(cov.fromDay)}` : ' over the last 30 days'}.
        Organic positions only (ads excluded){market ? `, as ordered for shoppers in ${market}` : ''}.
      </p>

      <div className="rtable" style={{ border: `1px solid ${C.hair}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '9px 14px', background: C.canvas }}>
          {['Listing', 'Was', 'Now', 'Change', '30-day trend', 'Days'].map(h => (
            <span key={h} style={{ fontSize: 10.5, fontFamily: MONO, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>
        {movers.map(m => <Row key={m.listingId} m={m} />)}
      </div>

      <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.6, marginTop: 10 }}>
        Position 1 is best, so a rising line means a listing climbed.
      </p>
      {signals && <SignalStrip s={signals} />}
    </Card>
  )
})
