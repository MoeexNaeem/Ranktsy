'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { C, D, formatNumber } from '@/utils'
import { SearchBar, Card, StatCard, SectionTitle, ErrorBox, Pagination, tableCard, tableHead, th, tableRow, tdMono, tdTitle, TagPill, MONO } from '../kit'
import { AiInsights } from '../AiInsights'
import { BubbleChart } from '@/components/charts/InsightCharts'
import { BarChart } from '@/components/charts/BarChart'
import type { EtsyListing, AiFact } from '@/types'

const GRID = '2.6fr 1fr 0.85fr 0.75fr 0.8fr 1.3fr'
const FETCH = 48        // fetched once from Etsy
const PER_PAGE = 12     // paginated client-side

function priceStr(l: EtsyListing) {
  if (!l.price?.amount) return '—'
  // Currency code shown explicitly: a keyword search returns listings priced in
  // many currencies with no FX rate, so a bare number would invite comparing
  // 410,000 VND against $410.
  return `${l.price.currency_code} ${(l.price.amount / (l.price.divisor || 100)).toFixed(2)}`
}

export function CompetitorsTab() {
  const [search, setSearch] = useState('silver necklace')
  const [query,  setQuery]  = useState('silver necklace')
  const [page,   setPage]   = useState(1)

  const { data: listings, isLoading, isError } = useQuery({
    queryKey: ['competitors', query],
    queryFn: async () => {
      const { data } = await axios.get(`/api/etsy/search?q=${encodeURIComponent(query)}&limit=${FETCH}`)
      return (data.data ?? []) as EtsyListing[]
    },
    staleTime: 1000 * 60 * 30,
  })

  const go = useCallback(() => {
    const v = search.trim(); if (v.length < 2) return; setPage(1); setQuery(v)
  }, [search])

  const sorted = useMemo(
    () => (listings ? [...listings].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)) : []),
    [listings]
  )
  const pageCount = Math.ceil(sorted.length / PER_PAGE) || 1
  const pageRows = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const charts = useMemo(() => {
    const ls = sorted.slice(0, 40)
    const ratios = ls.map(l => (l.num_favorers ?? 0) / Math.max(l.views ?? 1, 1))
    const maxRatio = Math.max(...ratios, 0.001)
    const bubble = ls.map((l, i) => ({
      x: l.views ?? 0, y: l.num_favorers ?? 0, r: 9,
      label: l.title.slice(0, 42), color: ratios[i] >= maxRatio * 0.5 ? C.orange : C.charcoal,
    }))
    const tagMap = new Map<string, number>()
    sorted.forEach(l => (l.tags ?? []).forEach(t => { const k = t.toLowerCase().trim(); if (k.length > 2) tagMap.set(k, (tagMap.get(k) ?? 0) + 1) }))
    const tags = [...tagMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
    return { bubble, tags }
  }, [sorted])

  // Currency-agnostic market signals (price is deliberately omitted — a cross-shop
  // search mixes currencies with no FX rate).
  const market = useMemo(() => {
    if (!sorted.length) return null
    const avgViews = Math.round(sorted.reduce((s, l) => s + (l.views ?? 0), 0) / sorted.length)
    const avgFaves = Math.round(sorted.reduce((s, l) => s + (l.num_favorers ?? 0), 0) / sorted.length)
    const engRatios = sorted.filter(l => (l.views ?? 0) > 0).map(l => (l.num_favorers ?? 0) / (l.views as number) * 100).sort((a, b) => a - b)
    const engagementPct = engRatios.length ? parseFloat(engRatios[Math.floor((engRatios.length - 1) / 2)].toFixed(1)) : 0
    const uniqueShops = new Set(sorted.map(l => l.shop_name).filter(Boolean)).size
    return { avgViews, avgFaves, engagementPct, uniqueShops }
  }, [sorted])

  const aiFacts = useMemo<AiFact[]>(() => {
    if (!market) return []
    const f: AiFact[] = [
      { label: 'Competitors sampled', value: String(sorted.length), hint: 'top listings by views' },
      { label: 'Avg views', value: formatNumber(market.avgViews), hint: 'lifetime' },
      { label: 'Avg favorites', value: formatNumber(market.avgFaves) },
      { label: 'Median engagement', value: `${market.engagementPct}%`, hint: 'favorites ÷ views; ~1–3% typical' },
      { label: 'Unique shops', value: `${market.uniqueShops} of ${sorted.length}`, hint: 'concentration' },
    ]
    charts.tags.slice(0, 3).forEach(([t, c], i) => f.push({ label: `Top tag ${i + 1}`, value: t, hint: `used by ${c} listings` }))
    return f
  }, [market, sorted.length, charts.tags])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SearchBar value={search} onChange={setSearch} onSubmit={go} placeholder="Analyze competition for any keyword…" button="Analyze →" />

      {isLoading && <div className="shimmer" style={{ height: 400, borderRadius: 8, background: '#e8e7e2' }} />}
      {isError && <ErrorBox>Failed to load competitor data from Etsy. Please try again.</ErrorBox>}

      {sorted.length > 0 && !isLoading && (
        <>
          <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <StatCard label="Competitors" value={sorted.length.toString()} accent={D.series[1]} sub="sampled by views" />
            <StatCard label="Avg. Views" value={formatNumber(market?.avgViews ?? 0)} accent={D.series[4]} sub={`${market?.engagementPct ?? 0}% engagement`} />
            <StatCard label="Avg. Favorites" value={formatNumber(market?.avgFaves ?? 0)} accent={D.series[3]} />
            <StatCard label="Unique Shops" value={String(market?.uniqueShops ?? 0)} accent={D.series[2]} sub="market concentration" />
          </div>

          {/* Competitive landscape + tag analysis */}
          <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            <Card>
              <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>top 40</span>}>Competitive landscape</SectionTitle>
              <p style={{ fontSize: 13, color: C.graphite, marginTop: -8, marginBottom: 10 }}>Each bubble is a listing — <strong style={{ color: C.orange }}>orange</strong> ones convert views to favorites best.</p>
              <BubbleChart points={charts.bubble} xLabel="Views" yLabel="Favorites" />
            </Card>
            <Card>
              <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>{sorted.length} listings</span>}>Most-used tags</SectionTitle>
              <BarChart axis="y" height={340} highlightMax labels={charts.tags.map(t => t[0])} values={charts.tags.map(t => t[1])} />
            </Card>
          </div>

          {/* AI read of the competitive field. */}
          {aiFacts.length >= 2 && (
            <AiInsights
              tool="Competitor Analysis"
              subject={query}
              facts={aiFacts}
              notes="A sample of the top listings ranking for this keyword. Views/favorites are real lifetime figures; engagement is favorites ÷ views (not CTR). Price is omitted because a cross-shop search mixes currencies. Interpret how strong the competition is, who to differentiate against, and which tags are table stakes vs openings."
            />
          )}

          <div>
            <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>Top {sorted.length} by views · page {page}/{pageCount}</span>}>
              Top listings for &ldquo;{query}&rdquo;
            </SectionTitle>
            <div className="rtable" style={tableCard}>
              <div style={tableHead(GRID)}>
                {['Title', 'Shop', 'Price', 'Views', 'Favorites', 'Tags'].map(h => <span key={h} style={th}>{h}</span>)}
              </div>
              {pageRows.map((l, idx) => (
                <div key={l.listing_id}
                  style={{ ...tableRow(GRID), transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontFamily: MONO, fontWeight: 500, color: C.stone, width: 26, flexShrink: 0 }}>#{(page - 1) * PER_PAGE + idx + 1}</span>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ ...tdTitle, textDecoration: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.color = C.orange)}
                      onMouseLeave={e => (e.currentTarget.style.color = C.ink)}>{l.title}</a>
                  </div>
                  {/* Who you're actually up against — the obvious next question,
                      and the jump-off point into Shop Analytics. */}
                  {l.shop_name ? (
                    <a href={`https://www.etsy.com/shop/${encodeURIComponent(l.shop_name)}`} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 13.5, color: C.graphite, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      onMouseEnter={e => (e.currentTarget.style.color = C.orange)}
                      onMouseLeave={e => (e.currentTarget.style.color = C.graphite)}>{l.shop_name}</a>
                  ) : <span style={{ fontSize: 13.5, color: C.stone }}>—</span>}
                  <span style={{ ...tdMono, color: C.ink, fontWeight: 500 }}>{priceStr(l)}</span>
                  <span style={{ ...tdMono, color: '#2E6DB4' }}>{formatNumber(l.views ?? 0)}</span>
                  <span style={{ ...tdMono, color: D.hard }}>{formatNumber(l.num_favorers ?? 0)}</span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(l.tags ?? []).slice(0, 3).map(tag => <TagPill key={tag}>{tag}</TagPill>)}
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  )
}
