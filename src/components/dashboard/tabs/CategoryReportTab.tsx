'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { BarChart } from '@/components/charts/BarChart'
import { SearchBar, Card, StatCard, SectionTitle, ErrorBox, Loading, EmptyState, CompBadge, MONO } from '../kit'
import { AiInsights } from '../AiInsights'
import { C, D, formatNumber } from '@/utils'
import type { EtsyListing, AiFact } from '@/types'

function money(l: EtsyListing): number {
  return (l.price?.amount ?? 0) / (l.price?.divisor || 100)
}

const CUR: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$', NZD: 'NZ$', JPY: '¥' }
const symOf = (c?: string) => CUR[c ?? 'USD'] ?? ((c ?? '') + ' ')

export function CategoryReportTab() {
  const [input, setInput] = useState('macrame wall hanging')
  const [query, setQuery] = useState('macrame wall hanging')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['category-report', query.toLowerCase()],
    queryFn: async () => {
      const { data } = await axios.get(`/api/etsy/search?q=${encodeURIComponent(query)}&limit=100`)
      return { listings: (data.data ?? []) as EtsyListing[], count: Number(data.count ?? 0) }
    },
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 30,
    placeholderData: prev => prev,
  })

  const go = useCallback(() => { const v = input.trim(); if (v.length >= 2) setQuery(v) }, [input])

  const report = useMemo(() => {
    const listings = data?.listings ?? []
    if (!listings.length) return null

    const cur = symOf(listings.find(l => l.price?.currency_code)?.price.currency_code)
    const allPrices = listings.map(money).filter(p => p > 0).sort((a, b) => a - b)
    const avgViews = Math.round(listings.reduce((s, l) => s + (l.views ?? 0), 0) / listings.length)
    const avgFaves = Math.round(listings.reduce((s, l) => s + (l.num_favorers ?? 0), 0) / listings.length)

    // Median price — robust to the joke/placeholder listings (e.g. £1M) that skew a mean.
    const pct = (q: number) => allPrices[Math.min(allPrices.length - 1, Math.max(0, Math.floor(allPrices.length * q)))] ?? 0
    const median = allPrices.length ? allPrices[Math.floor((allPrices.length - 1) / 2)] : 0

    // Price histogram — 6 buckets over the trimmed (p5–p95) range so a single
    // absurd listing can't collapse every real listing into one bucket.
    const prices = allPrices.filter(p => p >= pct(0.02) && p <= pct(0.95))
    const min = prices[0] ?? 0, max = prices[prices.length - 1] ?? 1
    const span = Math.max(max - min, 1)
    const BUCKETS = 6
    const step = span / BUCKETS
    const hist = Array.from({ length: BUCKETS }, () => 0)
    const labels = Array.from({ length: BUCKETS }, (_, i) =>
      `${cur}${Math.round(min + step * i)}–${Math.round(min + step * (i + 1))}`)
    for (const p of prices) {
      const idx = Math.min(BUCKETS - 1, Math.floor((p - min) / step))
      hist[idx]++
    }

    // Top tags across the category
    const tagCount: Record<string, number> = {}
    for (const l of listings) for (const t of l.tags ?? []) {
      const k = t.toLowerCase().trim()
      if (k.length > 2) tagCount[k] = (tagCount[k] ?? 0) + 1
    }
    const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 12)

    // Competition level from Etsy's total match count
    const total = data?.count ?? listings.length
    const comp: 'Low' | 'Med' | 'High' = total > 50000 ? 'High' : total > 8000 ? 'Med' : 'Low'

    const samples = [...listings].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 6)

    // Two more real signals: median engagement, and how concentrated the market is.
    const engRatios = listings.filter(l => (l.views ?? 0) > 0).map(l => (l.num_favorers ?? 0) / (l.views as number) * 100).sort((a, b) => a - b)
    const engagementPct = engRatios.length ? parseFloat(engRatios[Math.floor((engRatios.length - 1) / 2)].toFixed(1)) : 0
    const uniqueShops = new Set(listings.map(l => l.shop_name).filter(Boolean)).size
    const priceP25 = pct(0.25), priceP75 = pct(0.75)

    return { cur, median, avgViews, avgFaves, hist, labels, topTags, total, comp, samples, sampled: listings.length, engagementPct, uniqueShops, priceP25, priceP75 }
  }, [data])

  // Real category facts for the AI market read.
  const aiFacts = useMemo<AiFact[]>(() => {
    if (!report) return []
    return [
      { label: 'Live listings on Etsy', value: formatNumber(report.total), hint: `${report.comp} competition` },
      { label: 'Median price', value: `${report.cur}${report.median.toFixed(0)}`, hint: `typical ${report.cur}${report.priceP25.toFixed(0)}–${report.priceP75.toFixed(0)}` },
      { label: 'Avg views (lifetime)', value: formatNumber(report.avgViews) },
      { label: 'Avg favorites', value: formatNumber(report.avgFaves) },
      { label: 'Median engagement', value: `${report.engagementPct}%`, hint: 'favorites ÷ views; ~1–3% typical' },
      { label: 'Unique shops', value: `${report.uniqueShops} of ${report.sampled}`, hint: 'market concentration' },
      ...report.topTags.slice(0, 3).map(([t, c], i) => ({ label: `Defining tag ${i + 1}`, value: t, hint: `used by ${c} of ${report.sampled}` })),
    ]
  }, [report])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <SearchBar value={input} onChange={setInput} onSubmit={go}
          placeholder="Analyze a category or niche — e.g. macrame wall hanging" button="Analyze →" />
        <p style={{ fontSize: 13, color: C.graphite, marginTop: 10, fontFamily: MONO }}>
          A market snapshot from the top live listings: pricing, demand signals, and the tags that define this niche.
        </p>
      </div>

      {isLoading && <Loading label="Analyzing the category…" />}
      {isError && <ErrorBox>Couldn&apos;t load category data from Etsy. Please try again.</ErrorBox>}
      {data && !isLoading && !report && <EmptyState icon="🗂️" title="No listings found" sub="Try a broader term." />}

      {report && (
        <>
          {/* Headline stats */}
          <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <StatCard label="Live listings" value={formatNumber(report.total)} accent={D.series[1]} sub="total on Etsy" />
            <StatCard label="Median price" value={`${report.cur}${report.median.toFixed(0)}`} accent={D.series[0]} sub={`typical ${report.cur}${report.priceP25.toFixed(0)}–${report.priceP75.toFixed(0)}`} />
            <StatCard label="Avg views" value={formatNumber(report.avgViews)} accent={D.series[4]} sub={`${report.engagementPct}% engagement`} />
            <StatCard label="Competition" value={report.comp} accent={report.comp === 'Low' ? D.good : report.comp === 'High' ? D.hard : D.mid} sub={`${report.uniqueShops} unique shops`} />
          </div>

          <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            {/* Price distribution */}
            <Card>
              <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>listings by price</span>}>Price distribution</SectionTitle>
              <BarChart axis="x" height={240} color={C.orange} labels={report.labels} values={report.hist} />
              <p style={{ fontSize: 12.5, color: C.graphite, marginTop: 12, fontFamily: MONO }}>
                Most-common price band helps you position competitively (outliers trimmed).
              </p>
            </Card>

            {/* Top tags */}
            <Card>
              <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>most-used tags</span>}>Defining tags</SectionTitle>
              <BarChart axis="y" height={260} highlightMax
                labels={report.topTags.map(([t]) => t)} values={report.topTags.map(([, c]) => c)} />
            </Card>
          </div>

          {/* Sample top listings */}
          <Card>
            <SectionTitle right={<CompBadge level={report.comp} />}>Top listings in &ldquo;{query}&rdquo;</SectionTitle>
            <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {report.samples.map(l => (
                <a key={l.listing_id} href={l.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', textDecoration: 'none', border: `1px solid ${C.hair}`, borderRadius: 8, overflow: 'hidden', background: C.paper, transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = C.orange)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = C.hair)}>
                  {l.images?.[0]?.url_570xN
                    ? <img src={l.images[0].url_570xN} alt={l.title} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                    : <div style={{ width: '100%', height: 120, background: C.bone }} />}
                  <div style={{ padding: '10px 12px' }}>
                    <p style={{ fontSize: 12, color: C.ink, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 6 }}>{l.title}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: MONO, color: '#8a8a82' }}>
                      <span style={{ color: C.orange, fontWeight: 500 }}>{report.cur}{money(l).toFixed(0)}</span>
                      <span>{formatNumber(l.views ?? 0)} views</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </Card>

          {/* AI market-opportunity read over the real category snapshot. */}
          {aiFacts.length >= 2 && (
            <AiInsights
              tool="Category Report"
              subject={query}
              facts={aiFacts}
              notes="A market snapshot measured from the top live Etsy listings for this niche — prices, views, favorites and tag adoption are all real. Interpret saturation, pricing headroom, engagement, and where an opening exists. Etsy publishes no search volume."
            />
          )}
        </>
      )}
    </div>
  )
}
