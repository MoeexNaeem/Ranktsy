'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import axios from 'axios'
import { C, D, formatNumber } from '@/utils'
import { SearchBar, ErrorBox, Pagination, StatCard, cardStyle, MONO } from '../kit'
import { AiInsights } from '../AiInsights'
import type { EtsyListing, AiFact } from '@/types'

const PAGE_SIZE = 24

function priceStr(listing: EtsyListing): string {
  if (!listing.price?.amount) return '—'
  return `${listing.price.currency_code} ${(listing.price.amount / (listing.price.divisor || 100)).toFixed(2)}`
}

function ListingCard({ listing }: { listing: EtsyListing }) {
  const img = listing.images?.[0]?.url_570xN
  return (
    <a href={listing.url} target="_blank" rel="noopener noreferrer"
      style={{ ...cardStyle, display: 'block', overflow: 'hidden', textDecoration: 'none', transition: 'transform 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none' }}>
      <div style={{ height: 172, background: C.canvas, overflow: 'hidden' }}>
        {img
          ? <img src={img} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c8c8c0', fontSize: 30 }}>🛍</div>
        }
      </div>
      <div style={{ padding: '14px 16px' }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: C.ink, marginBottom: 7, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, minHeight: 39 }}>
          {listing.title}
        </p>
        <p style={{ fontSize: 15, color: C.orange, fontWeight: 600, marginBottom: 9, fontFamily: MONO }}>{priceStr(listing)}</p>
        <div style={{ display: 'flex', gap: 14, fontSize: 12.5, color: C.graphite, fontFamily: MONO }}>
          <span>👁 {formatNumber(listing.views ?? 0)}</span>
          <span>♥ {formatNumber(listing.num_favorers ?? 0)}</span>
        </div>
        {listing.shop_name && (
          <p style={{ fontSize: 12, color: C.stone, marginTop: 7 }}>by {listing.shop_name}</p>
        )}
      </div>
    </a>
  )
}

type SortKey = 'score' | 'price' | 'created' | 'updated'
const SORT_LABEL: Record<SortKey, string> = { score: 'Relevance', price: 'Price', created: 'Newest', updated: 'Recently updated' }

export function ListingsTab() {
  const [search, setSearch] = useState('handmade jewelry')
  const [minP, setMinP] = useState('')
  const [maxP, setMaxP] = useState('')
  const [sort, setSort] = useState<SortKey>('score')
  const [cat, setCat] = useState('')
  const [applied, setApplied] = useState({ q: 'handmade jewelry', min: '', max: '', sort: 'score' as SortKey, cat: '' })
  const [page, setPage] = useState(1)

  // Etsy seller taxonomy — the "browse by category" picker (top 2 levels).
  const { data: taxo } = useQuery({
    queryKey: ['taxonomy'],
    queryFn: async () => {
      const { data } = await axios.get('/api/etsy/taxonomy')
      return (data.data ?? []) as { id: number; name: string; fullPath: string; level: number }[]
    },
    staleTime: 1000 * 60 * 60 * 24,
  })
  const categories = (taxo ?? []).filter(t => t.level <= 2).sort((a, b) => a.fullPath.localeCompare(b.fullPath))

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['listings', applied, page],
    queryFn: async () => {
      const p = new URLSearchParams({ q: applied.q, limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE), sort: applied.sort })
      if (applied.min) p.set('minPrice', applied.min)
      if (applied.max) p.set('maxPrice', applied.max)
      if (applied.cat) p.set('taxonomyId', applied.cat)
      const { data } = await axios.get(`/api/etsy/search?${p.toString()}`)
      return data as { data: EtsyListing[]; count: number }
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 30,
  })

  const go = useCallback(() => {
    const v = search.trim(); if (v.length < 2) return
    setPage(1); setApplied({ q: v, min: minP, max: maxP, sort, cat })
  }, [search, minP, maxP, sort, cat])

  const onSort = useCallback((s: SortKey) => {
    setSort(s); setPage(1); setApplied(a => ({ ...a, sort: s }))
  }, [])

  const listings  = data?.data ?? []
  const total     = data?.count ?? 0
  const pageCount = Math.min(Math.ceil(total / PAGE_SIZE) || 1, 500)

  // Turn the raw result set into a quick market read. Median price is scoped to
  // the dominant currency (an Etsy search mixes currencies with no FX rate).
  const summary = useMemo(() => {
    if (!listings.length) return null
    const byCur = new Map<string, number[]>()
    for (const l of listings) {
      if (!l.price?.amount) continue
      const arr = byCur.get(l.price.currency_code) ?? []
      arr.push(l.price.amount / (l.price.divisor || 100))
      byCur.set(l.price.currency_code, arr)
    }
    const dom = [...byCur.entries()].sort((a, b) => b[1].length - a[1].length)[0]
    const cur = dom?.[0] ?? 'USD'
    const prices = (dom?.[1] ?? []).sort((a, b) => a - b)
    const median = prices.length ? prices[Math.floor((prices.length - 1) / 2)] : 0
    const avgViews = Math.round(listings.reduce((s, l) => s + (l.views ?? 0), 0) / listings.length)
    const engR = listings.filter(l => (l.views ?? 0) > 0).map(l => (l.num_favorers ?? 0) / (l.views as number) * 100).sort((a, b) => a - b)
    const engagementPct = engR.length ? parseFloat(engR[Math.floor((engR.length - 1) / 2)].toFixed(1)) : 0
    const uniqueShops = new Set(listings.map(l => l.shop_name).filter(Boolean)).size
    return { cur, median, avgViews, engagementPct, uniqueShops }
  }, [listings])

  const aiFacts = useMemo<AiFact[]>(() => {
    if (!summary) return []
    return [
      { label: 'Total results on Etsy', value: formatNumber(total) },
      { label: 'Median price (this page)', value: `${summary.cur} ${summary.median.toFixed(2)}`, hint: 'dominant currency of the sample' },
      { label: 'Avg views', value: formatNumber(summary.avgViews), hint: 'lifetime' },
      { label: 'Median engagement', value: `${summary.engagementPct}%`, hint: 'favorites ÷ views; ~1–3% typical' },
      { label: 'Unique shops (this page)', value: `${summary.uniqueShops} of ${listings.length}` },
    ]
  }, [summary, total, listings.length])

  const ctrl: React.CSSProperties = { background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 100, padding: '9px 14px', fontSize: 14, fontFamily: 'inherit', color: C.ink, outline: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SearchBar value={search} onChange={setSearch} onSubmit={go} placeholder="Search Etsy listings…" />

      {/* Advanced filters */}
      <div className="rwrap-sm" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filters</span>
        <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...ctrl, cursor: 'pointer', maxWidth: 230 }}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.fullPath}</option>)}
        </select>
        <input value={minP} onChange={e => setMinP(e.target.value.replace(/[^\d.]/g, ''))} onKeyDown={e => e.key === 'Enter' && go()} placeholder="Min $" inputMode="decimal" style={{ ...ctrl, width: 96 }} />
        <input value={maxP} onChange={e => setMaxP(e.target.value.replace(/[^\d.]/g, ''))} onKeyDown={e => e.key === 'Enter' && go()} placeholder="Max $" inputMode="decimal" style={{ ...ctrl, width: 96 }} />
        <select value={sort} onChange={e => onSort(e.target.value as SortKey)} style={{ ...ctrl, cursor: 'pointer' }}>
          {(Object.keys(SORT_LABEL) as SortKey[]).map(k => <option key={k} value={k}>Sort: {SORT_LABEL[k]}</option>)}
        </select>
        <button onClick={go} style={{ background: 'transparent', border: `1px solid ${C.orange}`, color: C.orange, borderRadius: 100, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Apply</button>
      </div>

      {isLoading && (
        <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="shimmer" style={{ height: 268, borderRadius: 8, background: '#e8e7e2' }} />
          ))}
        </div>
      )}
      {isError && <ErrorBox>Failed to load listings from Etsy. Please try again.</ErrorBox>}
      {!isLoading && !isError && (
        <>
          <p style={{ fontSize: 13.5, color: C.graphite, fontFamily: MONO }}>
            {formatNumber(total)} results for &ldquo;{applied.q}&rdquo; · page {page} of {formatNumber(pageCount)}
          </p>

          {/* Market read of the current results */}
          {summary && (
            <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              <StatCard label="Median price" value={`${summary.cur} ${summary.median.toFixed(0)}`} accent={D.series[0]} sub="dominant currency" />
              <StatCard label="Avg views" value={formatNumber(summary.avgViews)} accent={D.series[4]} sub={`${summary.engagementPct}% engagement`} />
              <StatCard label="Unique shops" value={String(summary.uniqueShops)} accent={D.series[2]} sub={`of ${listings.length} shown`} />
              <StatCard label="Total results" value={formatNumber(total)} accent={D.series[1]} sub="live on Etsy" />
            </div>
          )}

          <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, opacity: isFetching ? 0.55 : 1, transition: 'opacity 0.15s' }}>
            {listings.map(l => <ListingCard key={l.listing_id} listing={l} />)}
          </div>
          <Pagination page={page} pageCount={pageCount} loading={isFetching}
            onChange={p => setPage(p)} />

          {/* AI read of the search results */}
          {aiFacts.length >= 2 && (
            <AiInsights
              tool="Listings Search"
              subject={applied.q}
              facts={aiFacts}
              notes="A page of live Etsy search results. Median price is scoped to the dominant currency (Etsy mixes currencies with no FX rate). Views/favorites are lifetime; engagement is favorites ÷ views. Interpret the market — pricing, demand, competition — and how a seller should position."
            />
          )}
        </>
      )}
    </div>
  )
}
