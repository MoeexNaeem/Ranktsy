'use client'
import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Popover, PopItem, ExportBtn, toCsv, downloadCsv, slugify, ctrlBtn } from '../controls'
import { useListingReviews } from '@/hooks/useListingReviews'
import { useUsdRates } from '@/hooks/useFx'
import { estimateListingSales, type ListingSalesEstimate } from '@/lib/salesEstimate'
import { ListingDetailPanel } from './ListingDetailPanel'
import { C, D, formatNumber } from '@/utils'
import { MONO, tableCard } from '../kit'
import type { EtsyListing, ListingReviewStats } from '@/types'

// Real columns are exact Etsy fields (or a ratio of two): Age, Views, Favs/View,
// Hearts, Reviews, Price, Qty… The Est. Sales / Revenue columns are the Everbee-
// style ESTIMATES — Etsy publishes no per-listing sales, so they're derived from
// review count + 30-day review velocity ÷ a review rate (see salesEstimate.ts) and
// clearly badged "~ est". Never presented as real, measured sales.

const CUR: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$', PKR: '₨', INR: '₹', JPY: '¥' }
const sym = (c?: string) => CUR[c ?? 'USD'] ?? (c ? `${c} ` : '$')

interface Row {
  l: EtsyListing
  rank: number
  ageDays: number | null
  dailyViews: number | null
  fpv: number | null        // favorites ÷ views, %
  favsPerDay: number | null // favourite velocity
  price: number
}

type SortKey = 'rank' | 'ageDays' | 'views' | 'dailyViews' | 'fpv' | 'hearts' | 'favsPerDay' | 'price' | 'quantity' | 'tags' | 'reviews' | 'rev30' | 'estSales' | 'estRev' | 'estTotal'

interface Col { id: string; label: string; width: string; key?: SortKey; locked?: boolean; num?: boolean; est?: boolean }
// Columns use minmax(px, fr): the px floor keeps every column readable, and when
// the sum can't fit the container the table scrolls horizontally (see .rtable
// overflowX below) instead of crushing the numbers into unreadable slivers.
const ALL_COLS: Col[] = [
  { id: 'rank',    label: '#',           width: '57px',                key: 'rank', locked: true },
  { id: 'listing', label: 'Listing',     width: 'minmax(429px,3fr)',   locked: true },
  { id: 'age',     label: 'Age (days)',  width: 'minmax(143px,0.9fr)',  key: 'ageDays',    num: true },
  { id: 'views',   label: 'Views',       width: 'minmax(135px,0.8fr)',  key: 'views',      num: true },
  { id: 'dviews',  label: 'Views / day', width: 'minmax(169px,0.9fr)',  key: 'dailyViews', num: true },
  { id: 'fpv',     label: 'Favs / View', width: 'minmax(169px,0.9fr)',  key: 'fpv',        num: true },
  { id: 'hearts',  label: 'Hearts',      width: 'minmax(143px,0.8fr)',  key: 'hearts',     num: true },
  { id: 'reviews', label: 'Reviews',     width: 'minmax(153px,0.85fr)', key: 'reviews',    num: true },
  { id: 'estSales',label: '~ Sales / mo', width: 'minmax(163px,0.9fr)', key: 'estSales',   num: true, est: true },
  { id: 'estRev',  label: '~ Rev / mo',   width: 'minmax(166px,0.9fr)', key: 'estRev',     num: true, est: true },
  { id: 'estTotal',label: '~ Total sales',width: 'minmax(171px,0.9fr)', key: 'estTotal',   num: true, est: true },
  { id: 'rev30',   label: 'Reviews / 30d',width: 'minmax(171px,0.9fr)', key: 'rev30',      num: true },
  { id: 'fpd',     label: 'Favs / day',  width: 'minmax(159px,0.85fr)', key: 'favsPerDay', num: true },
  { id: 'price',   label: 'Price',       width: 'minmax(166px,0.9fr)',  key: 'price',      num: true },
  { id: 'qty',     label: 'Qty',         width: 'minmax(114px,0.6fr)',  key: 'quantity',   num: true },
  { id: 'ships',   label: 'Ships (d)',   width: 'minmax(151px,0.8fr)',  num: true },
  { id: 'tags',    label: 'Tags',        width: 'minmax(125px,0.7fr)',  key: 'tags',       num: true },
]
const DEFAULT_HIDDEN = new Set(['fpd', 'rev30'])

// Sort indicators — mirror the Keyword table: an active column shows a single
// caret (asc/desc); every other sortable column shows a faint up+down pair so the
// little "sortable" arrows are visible on all columns, not just the active one.
const AscIcon  = () => <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
const DescIcon = () => <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
const BothIcon = () => <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}><polyline points="18 15 12 9 6 15" /><polyline points="6 9 12 15 18 9" /></svg>

function ExtIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-1px' }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
}

export const TopListingsTable = memo(function TopListingsTable({ listings, query }: { listings: EtsyListing[]; query: string }) {
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filter, setFilter]   = useState('')
  const [hidden, setHidden]   = useState<Set<string>>(new Set(DEFAULT_HIDDEN))
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [allTags, setAllTags] = useState(false)
  const [detail, setDetail] = useState<Row | null>(null)
  // Captured once at mount (lazy init) — keeps age stable across re-renders and
  // avoids calling Date.now() during render.
  const [nowSec] = useState(() => Date.now() / 1000)

  const rows = useMemo<Row[]>(() => {
    return listings.map((l, i) => {
      const ageDays = l.created_timestamp ? Math.max(Math.floor((nowSec - l.created_timestamp) / 86400), 0) : null
      const views = l.views ?? 0
      const favs = l.num_favorers ?? 0
      return {
        l, rank: i + 1, ageDays,
        dailyViews: ageDays && ageDays > 0 ? views / ageDays : null,
        fpv: views > 0 ? (favs / views) * 100 : null,
        favsPerDay: ageDays && ageDays > 0 ? favs / ageDays : null,
        price: l.price.amount / (l.price.divisor || 100),
      }
    })
  }, [listings, nowSec])

  // Real per-listing review stats (count = a verified sold-floor; last30d = recent
  // velocity). When the listings come from the shared Collective store they already
  // carry `review_count`, so use those (velocity unknown → null) and skip the network.
  // Otherwise fetch lazily (capped to the top rows — each id is its own Etsy call).
  const storedReviews = useMemo(() => {
    const m: Record<number, ListingReviewStats> = {}
    let has = false
    for (const l of listings) { if (l.review_count != null) { m[l.listing_id] = { count: l.review_count, last30d: null }; has = true } }
    return has ? m : null
  }, [listings])
  const ids = useMemo(() => storedReviews ? [] : listings.slice(0, 30).map(l => l.listing_id), [listings, storedReviews])
  const reviewsQ = useListingReviews(ids)
  // Live rates so the estimated-revenue column can be shown in ONE currency (USD),
  // regardless of each listing's own currency. Null rate → keep the local figure.
  const usdRates = useUsdRates(useMemo(() => listings.map(l => l.price.currency_code), [listings])).data
  const reviews = storedReviews ?? reviewsQ.data
  const reviewsLoading = !storedReviews && (reviewsQ.isPending || reviewsQ.isFetching)

  // Everbee-style per-listing sales ESTIMATE, from review count + 30-day velocity ÷
  // a review rate. Recomputed as review stats arrive. estimateListingSales returns
  // all-null when there's no review data yet, so cells read "—" until then.
  const estimates = useMemo(() => {
    const m: Record<number, ListingSalesEstimate> = {}
    for (const r of rows) {
      const rs = reviews?.[r.l.listing_id]
      m[r.l.listing_id] = estimateListingSales({
        reviewCount: rs?.count ?? null,
        reviewsLast30d: rs?.last30d ?? null,
        price: r.price,
        ageDays: r.ageDays,
        views: r.l.views ?? null,
        favorites: r.l.num_favorers ?? null,
      })
    }
    return m
  }, [rows, reviews])

  const cols = useMemo(() => ALL_COLS.filter(c => !hidden.has(c.id)), [hidden])
  const grid = useMemo(() => cols.map(c => c.width).join(' ') + ' 34px', [cols])
  // Sum of the px floors → the row's min-width, so backgrounds/borders span the
  // full width when the table scrolls horizontally instead of being cut short.
  const minTableW = useMemo(() => cols.reduce((s, c) => {
    const mm = c.width.match(/minmax\((\d+)px/)
    const fixed = c.width.match(/^(\d+)px$/)
    return s + (mm ? +mm[1] : fixed ? +fixed[1] : 0)
  }, 34 + cols.length * 15), [cols])

  const handleSort = useCallback((key: SortKey) => {
    setSortDir(prev => (sortKey === key ? (prev === 'asc' ? 'desc' : 'asc') : (key === 'rank' ? 'asc' : 'desc')))
    setSortKey(key)
  }, [sortKey])

  const view = useMemo(() => {
    const f = filter.trim().toLowerCase()
    let base = rows
    if (f) base = base.filter(r => r.l.title.toLowerCase().includes(f) || r.l.shop_name?.toLowerCase().includes(f))
    const val = (r: Row): number | null => {
      switch (sortKey) {
        case 'rank': return r.rank
        case 'ageDays': return r.ageDays
        case 'views': return r.l.views ?? 0
        case 'dailyViews': return r.dailyViews
        case 'fpv': return r.fpv
        case 'hearts': return r.l.num_favorers ?? 0
        case 'favsPerDay': return r.favsPerDay
        case 'price': { const rate = usdRates?.[(r.l.price.currency_code ?? 'USD').toUpperCase()]; return rate != null ? r.price * rate : r.price }
        case 'quantity': return r.l.quantity ?? 0
        case 'tags': return r.l.tags?.length ?? 0
        case 'reviews': return reviews?.[r.l.listing_id]?.count ?? null
        case 'rev30': return reviews?.[r.l.listing_id]?.last30d ?? null
        case 'estSales': return estimates[r.l.listing_id]?.estMonthlySales ?? null
        case 'estRev': return estimates[r.l.listing_id]?.estMonthlyRevenue ?? null
        case 'estTotal': return estimates[r.l.listing_id]?.estTotalSales ?? null
      }
    }
    const dir = sortDir === 'desc' ? -1 : 1
    return [...base].sort((a, b) => {
      const av = val(a), bv = val(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return dir * (av - bv)
    })
  }, [rows, filter, sortKey, sortDir, reviews, estimates, usdRates])

  const toggleRow = useCallback((id: number) => setExpanded(p => {
    const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n
  }), [])

  const exportCsv = useCallback(() => {
    downloadCsv(`top-listings-${slugify(query)}.csv`, toCsv(
      ['Rank', 'Title', 'Shop', 'URL', 'Age (days)', 'Views', 'Views/day', 'Favs/View %', 'Hearts', 'Reviews', 'Reviews/30d', 'Est. Sales/mo', 'Est. Revenue/mo', 'Est. Total sales', 'Favs/day', 'Price', 'Currency', 'Quantity', 'Ships min (d)', 'Ships max (d)', 'Tag count', 'Tags'],
      view.map(r => { const e = estimates[r.l.listing_id]; return [r.rank, r.l.title, r.l.shop_name, r.l.url, r.ageDays ?? '', r.l.views ?? 0, r.dailyViews != null ? r.dailyViews.toFixed(1) : '', r.fpv != null ? r.fpv.toFixed(1) : '', r.l.num_favorers ?? 0, reviews?.[r.l.listing_id]?.count ?? '', reviews?.[r.l.listing_id]?.last30d ?? '', e?.estMonthlySales ?? '', e?.estMonthlyRevenue ?? '', e?.estTotalSales ?? '', r.favsPerDay != null ? r.favsPerDay.toFixed(2) : '', r.price.toFixed(2), r.l.price.currency_code, r.l.quantity ?? '', r.l.processing_min ?? '', r.l.processing_max ?? '', r.l.tags?.length ?? 0, (r.l.tags ?? []).join('; ')] }),
    ))
  }, [view, query, reviews, estimates])

  const num = (v: number | null, opts?: { digits?: number; color?: string; suffix?: string }) =>
    v == null
      ? <span style={{ fontFamily: MONO, fontSize: 17.5, color: C.stone }}>—</span>
      : <span style={{ fontFamily: MONO, fontSize: 17.5, color: opts?.color ?? C.ink }}>{opts?.digits != null ? v.toFixed(opts.digits) : formatNumber(v)}{opts?.suffix ?? ''}</span>

  // Estimate cell: a "~" prefix + amber tone flag it as a modelled figure, never a
  // real, measured number. `prefix` carries a currency symbol for the revenue column.
  const estNum = (v: number | null, loading: boolean, prefix = '') => {
    if (v == null && loading) return <span className="shimmer" style={{ height: 15, width: 46, borderRadius: 4, background: '#e8e7e2', display: 'inline-block' }} />
    if (v == null) return <span style={{ fontFamily: MONO, fontSize: 17.5, color: C.stone }}>—</span>
    return <span style={{ fontFamily: MONO, fontSize: 17.5, color: D.mid, fontWeight: 600 }} title="Estimated — from review count & velocity, not real, measured sales">~{prefix}{formatNumber(v)}</span>
  }

  const cell = (c: Col, r: Row) => {
    switch (c.id) {
      case 'rank': {
        const podium = r.rank <= 3
        return <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 30, height: 28, padding: '0 8px', borderRadius: 9, background: podium ? C.orange : C.bone, color: podium ? '#fff' : C.graphite, fontSize: 14, fontFamily: MONO, fontWeight: 700 }}>{r.rank}</span>
      }
      case 'listing':
        return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            {r.l.images?.[0]?.url_75x75
              ? <img src={r.l.images[0].url_75x75} alt="" style={{ width: 60, height: 60, borderRadius: 11, objectFit: 'cover', flexShrink: 0, background: C.bone }} />
              : <div style={{ width: 60, height: 60, borderRadius: 11, background: C.bone, flexShrink: 0 }} />}
            <div style={{ minWidth: 0 }}>
              {/* Title opens the in-app detail panel (NOT Etsy) — the row click does
                  the same; only "See on Etsy" below leaves the app. */}
              <span title="Click for full details"
                style={{ display: 'block', fontSize: 17.5, color: C.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3, cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.color = C.orange)}
                onMouseLeave={e => (e.currentTarget.style.color = C.ink)}>
                {r.l.title}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 5 }}>
                <span style={{ fontSize: 15, color: C.stone, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{r.l.shop_name}</span>
                <a href={r.l.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                  style={{ fontSize: 13.5, color: C.orange, textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  See on Etsy <ExtIcon />
                </a>
              </div>
            </div>
          </div>
        )
      case 'age':    return <span key={c.id}>{num(r.ageDays)}</span>
      case 'views':  return <span key={c.id}>{num(r.l.views ?? 0, { color: '#2E6DB4' })}</span>
      case 'dviews': return <span key={c.id}>{num(r.dailyViews, { digits: 1, color: '#2E6DB4' })}</span>
      case 'fpv':    return <span key={c.id}>{r.fpv != null ? num(r.fpv, { digits: 1, color: r.fpv >= 4 ? D.good : C.ink, suffix: '%' }) : num(null)}</span>
      case 'hearts': return <span key={c.id}>{num(r.l.num_favorers ?? 0, { color: D.hard })}</span>
      case 'reviews': {
        const rc = reviews?.[r.l.listing_id]?.count
        if (rc === undefined && reviewsLoading) return <span key={c.id} className="shimmer" style={{ height: 15, width: 42, borderRadius: 4, background: '#e8e7e2', display: 'inline-block' }} />
        return <span key={c.id}>{num(rc ?? null, { color: (rc ?? 0) > 0 ? D.good : C.stone })}</span>
      }
      case 'rev30': {
        const v = reviews?.[r.l.listing_id]?.last30d
        if (v === undefined && reviewsLoading) return <span key={c.id} className="shimmer" style={{ height: 15, width: 42, borderRadius: 4, background: '#e8e7e2', display: 'inline-block' }} />
        return <span key={c.id}>{num(v ?? null, { color: (v ?? 0) > 0 ? D.good : C.stone })}</span>
      }
      case 'estSales': return <span key={c.id}>{estNum(estimates[r.l.listing_id]?.estMonthlySales ?? null, reviewsLoading && !reviews)}</span>
      case 'estRev': {
        // Show estimated revenue in USD when we have a live rate; otherwise fall
        // back to the listing's own currency (never a guessed conversion).
        const revLocal = estimates[r.l.listing_id]?.estMonthlyRevenue ?? null
        const rate = usdRates?.[(r.l.price.currency_code ?? 'USD').toUpperCase()]
        const revUsd = revLocal != null && rate != null ? Math.round(revLocal * rate) : null
        return <span key={c.id}>{revUsd != null
          ? estNum(revUsd, false, '$')
          : estNum(revLocal, reviewsLoading && !reviews, sym(r.l.price.currency_code))}</span>
      }
      case 'estTotal': return <span key={c.id}>{estNum(estimates[r.l.listing_id]?.estTotalSales ?? null, reviewsLoading && !reviews)}</span>
      case 'fpd':    return <span key={c.id}>{num(r.favsPerDay, { digits: 2 })}</span>
      case 'price': {
        // Show price in USD when a live rate is available (else the listing's own
        // currency — never a guessed conversion).
        const rate = usdRates?.[(r.l.price.currency_code ?? 'USD').toUpperCase()]
        const usd = rate != null ? r.price * rate : null
        return <span key={c.id} style={{ fontFamily: MONO, fontSize: 17.5, color: C.orange, fontWeight: 600 }}>{usd != null ? `$${usd.toFixed(2)}` : `${sym(r.l.price.currency_code)}${r.price.toFixed(2)}`}</span>
      }
      case 'qty':    return <span key={c.id}>{num(r.l.quantity ?? null)}</span>
      case 'ships':  return <span key={c.id} style={{ fontFamily: MONO, fontSize: 17.5, color: (r.l.processing_min != null || r.l.processing_max != null) ? C.ink : C.stone }}>{r.l.processing_min != null && r.l.processing_max != null ? `${r.l.processing_min}–${r.l.processing_max}` : (r.l.processing_min ?? r.l.processing_max ?? '—')}</span>
      case 'tags':   return <span key={c.id} style={{ fontFamily: MONO, fontSize: 17.5, color: (r.l.tags?.length ?? 0) > 0 ? C.ink : C.stone }}>{r.l.tags?.length ?? 0}</span>
      default:       return <span key={c.id} />
    }
  }

  const rowGrid = { display: 'grid', gridTemplateColumns: grid, gap: 15, alignItems: 'center', padding: '16px 20px', minWidth: minTableW } as const

  // Top-mounted horizontal scrollbar: a strip above the table mirrors its scroll,
  // so the control sits at the TOP. A lock avoids the mirror-echo feedback loop.
  const tableRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const lock = useRef(false)
  const onTopScroll = useCallback(() => {
    if (lock.current) { lock.current = false; return }
    if (tableRef.current && topRef.current) { lock.current = true; tableRef.current.scrollLeft = topRef.current.scrollLeft }
  }, [])
  const onTableScroll = useCallback(() => {
    if (lock.current) { lock.current = false; return }
    if (tableRef.current && topRef.current) { lock.current = true; topRef.current.scrollLeft = tableRef.current.scrollLeft }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Toolbar */}
      <div className="rwrap-sm" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: C.bone, padding: 10, borderRadius: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 100, padding: '10px 16px', flex: 1, minWidth: 190 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.graphite} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter listings…"
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 14.5, fontFamily: 'inherit', flex: 1, color: C.ink, minWidth: 0 }} />
        </div>
        <button onClick={() => { setAllTags(a => !a); setExpanded(allTags ? new Set() : new Set(view.map(r => r.l.listing_id))) }}
          style={{ ...ctrlBtn, height: 40 }}>{allTags ? 'Hide tags' : 'Show all tags'}</button>
        <Popover label="Columns" width={200}>
          {ALL_COLS.map(c => (
            <PopItem key={c.id} label={c.label || c.id} on={!hidden.has(c.id)} disabled={c.locked}
              onClick={() => { if (c.locked) return; setHidden(p => { const n = new Set(p); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n }) }} />
          ))}
        </Popover>
        <ExportBtn onClick={exportCsv} />
      </div>

      {/* Top-mounted horizontal scrollbar — mirrors the table's scroll so the
          control is visible at the TOP, not hidden at the bottom of a long table. */}
      <div ref={topRef} onScroll={onTopScroll} className="rtable-topscroll" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <div style={{ width: minTableW, height: 1 }} />
      </div>

      {/* Table — scrolls horizontally when the columns need more room than the
          container has; its own bottom bar is hidden (the top strip drives it). */}
      <div ref={tableRef} onScroll={onTableScroll} className="rtable rtable-hidescroll" style={{ ...tableCard, overflowX: 'auto' }}>
        {/* Header */}
        <div style={{ ...rowGrid, position: 'sticky', top: 0, background: C.canvas, borderBottom: `1px solid ${C.ash}`, zIndex: 1 }}>
          {cols.map(c => (
            <button key={c.id} onClick={() => c.key && handleSort(c.key)} disabled={!c.key}
              style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: c.num ? 'flex-end' : 'flex-start', background: 'none', border: 'none', cursor: c.key ? 'pointer' : 'default', padding: 0, fontFamily: MONO, fontSize: 13, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {c.label}
              {c.key && (sortKey === c.key ? (sortDir === 'asc' ? <AscIcon /> : <DescIcon />) : <BothIcon />)}
            </button>
          ))}
          <span />
        </div>

        {view.length === 0 ? (
          <div style={{ padding: '44px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: C.ink, fontWeight: 500 }}>No listings match</p>
            <p style={{ fontSize: 13.5, color: C.graphite, marginTop: 5 }}>Try clearing the filter.</p>
          </div>
        ) : view.map(r => {
          const open = expanded.has(r.l.listing_id)
          return (
            <div key={r.l.listing_id} style={{ borderBottom: `1px solid ${C.hair}`, minWidth: minTableW }}>
              <div style={{ ...rowGrid, cursor: 'pointer', transition: 'background 0.12s', background: open ? C.orangeFaint : 'transparent' }}
                onClick={() => setDetail(r)}
                onMouseEnter={e => { if (!open) e.currentTarget.style.background = C.rowHover }}
                onMouseLeave={e => (e.currentTarget.style.background = open ? C.orangeFaint : 'transparent')}>
                {cols.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: c.num ? 'flex-end' : 'flex-start', minWidth: 0 }}>{cell(c, r)}</div>
                ))}
                {/* Chevron peeks the tags inline without leaving; row/title click opens full detail. */}
                <button aria-label="Toggle tags" title="Quick-peek tags" onClick={e => { e.stopPropagation(); toggleRow(r.l.listing_id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.graphite, display: 'flex', justifyContent: 'center' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="6 9 12 15 18 9" /></svg>
                </button>
              </div>

              {open && (
                <div style={{ padding: '4px 16px 16px 16px', background: C.orangeFaint }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                    <span style={{ fontSize: 11, fontFamily: MONO, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Tags ({r.l.tags?.length ?? 0})
                    </span>
                    {(r.l.tags?.length ?? 0) > 0 && (
                      <button onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText((r.l.tags ?? []).join(', ')) }}
                        style={{ ...ctrlBtn, height: 28, fontSize: 11.5 }}>Copy Tags</button>
                    )}
                  </div>
                  {(r.l.tags?.length ?? 0) > 0 ? (
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      {(r.l.tags ?? []).map(t => (
                        <span key={t} onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(t) }}
                          title="Click to copy"
                          style={{ fontSize: 12, fontFamily: MONO, color: C.ink, background: C.paper, border: `1px solid ${C.ash}`, padding: '5px 11px', borderRadius: 100, cursor: 'pointer' }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : <span style={{ fontSize: 12.5, color: C.stone }}>This listing has no tags.</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer / honesty note */}
      <div className="rwrap-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.graphite }}>{view.length} listing{view.length === 1 ? '' : 's'}</span>
        <span style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.5, textAlign: 'right', maxWidth: 680 }}>
          Real columns are exact live fields or a ratio of two (Views/day = views ÷ age; Favs/View = hearts ÷ views).
          <strong style={{ color: C.graphite }}> Reviews</strong> is the real review count — a verified <em>units-sold floor</em>.
          The <strong style={{ color: D.mid }}>~ Sales / Revenue / Total</strong> columns are <em>estimates</em> — modelled from the
          strongest real signal (reviews, views × conversion, or favorites), since Etsy publishes no per-listing sales.
          Directional, not exact. Click a row for the full breakdown.
        </span>
      </div>

      {/* In-app detail drawer — opened by clicking a row/title (NOT Etsy). */}
      <ListingDetailPanel
        row={detail}
        reviewStats={detail ? (reviews?.[detail.l.listing_id] ?? null) : null}
        estimate={detail ? (estimates[detail.l.listing_id] ?? null) : null}
        onClose={() => setDetail(null)}
      />
    </div>
  )
})
