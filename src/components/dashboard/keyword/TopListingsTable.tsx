'use client'
import { memo, useCallback, useMemo, useState } from 'react'
import { Popover, PopItem, ExportBtn, toCsv, downloadCsv, slugify, ctrlBtn } from '../controls'
import { useListingReviews } from '@/hooks/useListingReviews'
import { C, D, formatNumber } from '@/utils'
import { MONO, tableCard } from '../kit'
import type { EtsyListing } from '@/types'

// eRank shows Est. Sales / Est. Revenue — but Etsy publishes NO per-listing sales,
// so those are estimates (their own screenshot shows 1 sale × $22.99 = $0.00). We
// don't fabricate them. Every column here is a real Etsy field or a ratio of two
// real fields, and we add engagement/velocity columns eRank doesn't have.

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

type SortKey = 'rank' | 'ageDays' | 'views' | 'dailyViews' | 'fpv' | 'hearts' | 'favsPerDay' | 'price' | 'quantity' | 'tags' | 'reviews'

interface Col { id: string; label: string; width: string; key?: SortKey; locked?: boolean; num?: boolean }
const ALL_COLS: Col[] = [
  { id: 'rank',    label: '#',           width: '38px',  key: 'rank', locked: true },
  { id: 'listing', label: 'Listing',     width: '3.4fr', locked: true },
  { id: 'age',     label: 'Age (days)',  width: '0.9fr', key: 'ageDays',    num: true },
  { id: 'views',   label: 'Views',       width: '0.8fr', key: 'views',      num: true },
  { id: 'dviews',  label: 'Views / day', width: '0.9fr', key: 'dailyViews', num: true },
  { id: 'fpv',     label: 'Favs / View', width: '0.9fr', key: 'fpv',        num: true },
  { id: 'hearts',  label: 'Hearts',      width: '0.8fr', key: 'hearts',     num: true },
  { id: 'reviews', label: 'Reviews',     width: '0.85fr', key: 'reviews',   num: true },
  { id: 'fpd',     label: 'Favs / day',  width: '0.85fr', key: 'favsPerDay', num: true },
  { id: 'price',   label: 'Price',       width: '0.9fr', key: 'price',      num: true },
  { id: 'qty',     label: 'Qty',         width: '0.6fr', key: 'quantity',   num: true },
  { id: 'ships',   label: 'Ships (d)',   width: '0.8fr', num: true },
  { id: 'tags',    label: 'Tags',        width: '0.7fr', key: 'tags',       num: true },
]
const DEFAULT_HIDDEN = new Set(['fpd'])

const Arrow = ({ dir }: { dir?: 'asc' | 'desc' }) => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: dir ? 1 : 0.3 }}>
    {dir === 'asc' ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
  </svg>
)

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

  // Real per-listing review counts (a verified sold-floor) — fetched lazily so the
  // table paints immediately and the Reviews column fills in.
  const ids = useMemo(() => listings.map(l => l.listing_id), [listings])
  const reviewsQ = useListingReviews(ids)
  const reviews = reviewsQ.data
  const reviewsLoading = reviewsQ.isPending || reviewsQ.isFetching

  const cols = useMemo(() => ALL_COLS.filter(c => !hidden.has(c.id)), [hidden])
  const grid = useMemo(() => cols.map(c => c.width).join(' ') + ' 34px', [cols])

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
        case 'price': return r.price
        case 'quantity': return r.l.quantity ?? 0
        case 'tags': return r.l.tags?.length ?? 0
        case 'reviews': return reviews?.[r.l.listing_id] ?? null
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
  }, [rows, filter, sortKey, sortDir, reviews])

  const toggleRow = useCallback((id: number) => setExpanded(p => {
    const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n
  }), [])

  const exportCsv = useCallback(() => {
    downloadCsv(`top-listings-${slugify(query)}.csv`, toCsv(
      ['Rank', 'Title', 'Shop', 'URL', 'Age (days)', 'Views', 'Views/day', 'Favs/View %', 'Hearts', 'Reviews', 'Favs/day', 'Price', 'Currency', 'Quantity', 'Ships min (d)', 'Ships max (d)', 'Tag count', 'Tags'],
      view.map(r => [r.rank, r.l.title, r.l.shop_name, r.l.url, r.ageDays ?? '', r.l.views ?? 0, r.dailyViews != null ? r.dailyViews.toFixed(1) : '', r.fpv != null ? r.fpv.toFixed(1) : '', r.l.num_favorers ?? 0, reviews?.[r.l.listing_id] ?? '', r.favsPerDay != null ? r.favsPerDay.toFixed(2) : '', r.price.toFixed(2), r.l.price.currency_code, r.l.quantity ?? '', r.l.processing_min ?? '', r.l.processing_max ?? '', r.l.tags?.length ?? 0, (r.l.tags ?? []).join('; ')]),
    ))
  }, [view, query, reviews])

  const num = (v: number | null, opts?: { digits?: number; color?: string; suffix?: string }) =>
    v == null
      ? <span style={{ fontFamily: MONO, fontSize: 13, color: C.stone }}>—</span>
      : <span style={{ fontFamily: MONO, fontSize: 13, color: opts?.color ?? C.ink }}>{opts?.digits != null ? v.toFixed(opts.digits) : formatNumber(v)}{opts?.suffix ?? ''}</span>

  const cell = (c: Col, r: Row) => {
    switch (c.id) {
      case 'rank': {
        const podium = r.rank <= 3
        return <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 24, height: 22, padding: '0 6px', borderRadius: 7, background: podium ? C.orange : C.bone, color: podium ? '#fff' : C.graphite, fontSize: 11.5, fontFamily: MONO, fontWeight: 700 }}>{r.rank}</span>
      }
      case 'listing':
        return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            {r.l.images?.[0]?.url_75x75
              ? <img src={r.l.images[0].url_75x75} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: C.bone }} />
              : <div style={{ width: 44, height: 44, borderRadius: 8, background: C.bone, flexShrink: 0 }} />}
            <div style={{ minWidth: 0 }}>
              <a href={r.l.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                title={r.l.title}
                style={{ display: 'block', fontSize: 13, color: C.ink, fontWeight: 500, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}
                onMouseEnter={e => (e.currentTarget.style.color = C.orange)}
                onMouseLeave={e => (e.currentTarget.style.color = C.ink)}>
                {r.l.title}
              </a>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3 }}>
                <span style={{ fontSize: 11.5, color: C.stone, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{r.l.shop_name}</span>
                <a href={r.l.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                  style={{ fontSize: 11, color: C.orange, textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
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
        const rc = reviews?.[r.l.listing_id]
        if (rc === undefined && reviewsLoading) return <span key={c.id} className="shimmer" style={{ height: 12, width: 34, borderRadius: 4, background: '#e8e7e2', display: 'inline-block' }} />
        return <span key={c.id}>{num(rc ?? null, { color: (rc ?? 0) > 0 ? D.good : C.stone })}</span>
      }
      case 'fpd':    return <span key={c.id}>{num(r.favsPerDay, { digits: 2 })}</span>
      case 'price':  return <span key={c.id} style={{ fontFamily: MONO, fontSize: 13, color: C.orange, fontWeight: 600 }}>{sym(r.l.price.currency_code)}{r.price.toFixed(2)}</span>
      case 'qty':    return <span key={c.id}>{num(r.l.quantity ?? null)}</span>
      case 'ships':  return <span key={c.id} style={{ fontFamily: MONO, fontSize: 13, color: (r.l.processing_min != null || r.l.processing_max != null) ? C.ink : C.stone }}>{r.l.processing_min != null && r.l.processing_max != null ? `${r.l.processing_min}–${r.l.processing_max}` : (r.l.processing_min ?? r.l.processing_max ?? '—')}</span>
      case 'tags':   return <span key={c.id} style={{ fontFamily: MONO, fontSize: 13, color: (r.l.tags?.length ?? 0) > 0 ? C.ink : C.stone }}>{r.l.tags?.length ?? 0}</span>
      default:       return <span key={c.id} />
    }
  }

  const rowGrid = { display: 'grid', gridTemplateColumns: grid, gap: 12, alignItems: 'center', padding: '10px 14px' } as const

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

      {/* Table */}
      <div className="rtable" style={tableCard}>
        {/* Header */}
        <div style={{ ...rowGrid, position: 'sticky', top: 0, background: C.canvas, borderBottom: `1px solid ${C.ash}`, zIndex: 1 }}>
          {cols.map(c => (
            <button key={c.id} onClick={() => c.key && handleSort(c.key)} disabled={!c.key}
              style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: c.num ? 'flex-end' : 'flex-start', background: 'none', border: 'none', cursor: c.key ? 'pointer' : 'default', padding: 0, fontFamily: MONO, fontSize: 11, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {c.label}
              {c.key && <Arrow dir={sortKey === c.key ? sortDir : undefined} />}
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
            <div key={r.l.listing_id} style={{ borderBottom: `1px solid ${C.hair}` }}>
              <div style={{ ...rowGrid, cursor: 'pointer', transition: 'background 0.12s', background: open ? C.orangeFaint : 'transparent' }}
                onClick={() => toggleRow(r.l.listing_id)}
                onMouseEnter={e => { if (!open) e.currentTarget.style.background = C.rowHover }}
                onMouseLeave={e => (e.currentTarget.style.background = open ? C.orangeFaint : 'transparent')}>
                {cols.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: c.num ? 'flex-end' : 'flex-start', minWidth: 0 }}>{cell(c, r)}</div>
                ))}
                <button aria-label="Toggle tags" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.graphite, display: 'flex', justifyContent: 'center' }}>
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
        <span style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.5, textAlign: 'right', maxWidth: 640 }}>
          Every column is a real Etsy field or a ratio of two (Views/day = views ÷ age; Favs/View = hearts ÷ views).
          <strong style={{ color: C.graphite }}> Reviews</strong> is the real review count — a verified <em>units-sold floor</em>,
          shown instead of eRank’s invented “Est. Sales / Revenue” (Etsy publishes no per-listing sales).
        </span>
      </div>
    </div>
  )
})
