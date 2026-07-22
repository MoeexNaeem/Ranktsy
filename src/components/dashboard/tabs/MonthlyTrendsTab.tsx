'use client'
import { useState, useCallback, useMemo } from 'react'
import { useTrends } from '@/hooks/useKeywords'
import { BarChart } from '@/components/charts/BarChart'
import { AiInsights } from '../AiInsights'
import { Card, SearchBar, SectionTitle, ErrorBox, Loading, StatCard, MONO } from '../kit'
import { C, D, formatNumber } from '@/utils'
import type { TrendData, TrendPoint, ListingMarketStats, AiFact } from '@/types'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function prepMonth(peak?: string): string {
  if (!peak) return '—'
  const i = MONTHS.indexOf(peak)
  if (i < 0) return '—'
  return MONTHS[(i - 2 + 12) % 12]   // ~6 weeks ahead
}

/**
 * Monthly Trends — the seasonal + market picture for a keyword.
 *
 * Every figure is measured, none modelled: Google Ads monthly volume (real
 * demand) when configured, Etsy's listing-creation distribution (real, but
 * seller behaviour), and a full market snapshot (price/views/favorites/tags)
 * from a live 100-listing sample. Gemini then reads those real numbers into a
 * narrative — it interprets, never invents. When a signal genuinely doesn't
 * exist (Etsy publishes no search volume), the tab says so.
 */
export function MonthlyTrendsTab() {
  const [input, setInput] = useState('christmas ornament')
  const [query, setQuery] = useState('christmas ornament')
  const { data: tr, isLoading, isError } = useTrends(query)

  const go = useCallback(() => { const v = input.trim(); if (v.length >= 2) setQuery(v) }, [input])

  const google = useMemo<TrendPoint[]>(() => {
    const g = tr?.trends?.find((t: TrendData) => t.platform === 'google')
    return g?.points ?? []
  }, [tr])

  const supply = useMemo<{ month: string; value: number }[]>(() => tr?.supplyByMonth ?? [], [tr])
  const market = useMemo<ListingMarketStats | null>(() => (tr?.market as ListingMarketStats | null) ?? null, [tr])

  const demand = useMemo(() => {
    if (!google.length) return null
    const vals = google.map(p => p.value)
    const max = Math.max(...vals), min = Math.min(...vals)
    if (max === 0) return null
    return {
      peak: google.find(p => p.value === max) ?? null,
      low: google.find(p => p.value === min) ?? null,
      labels: google.map(p => p.month),
      values: vals,
      colors: google.map(p => (p.value === max ? C.orange : p.value === min ? 'rgba(207,70,58,0.3)' : 'rgba(46,109,180,0.45)')),
    }
  }, [google])

  const supplyChart = useMemo(() => {
    if (!supply.length) return null
    const vals = supply.map(p => p.value)
    const max = Math.max(...vals)
    if (max === 0) return null
    return {
      peak: supply.find(p => p.value === max) ?? null,
      labels: supply.map(p => p.month),
      values: vals,
      colors: supply.map(p => (p.value === max ? D.good : 'rgba(31,138,76,0.35)')),
    }
  }, [supply])

  const cur = market?.currency ?? 'USD'

  // Real facts handed to Gemini for interpretation — nothing modelled.
  const aiFacts = useMemo<AiFact[]>(() => {
    const f: AiFact[] = []
    if (demand?.peak) f.push({ label: 'Peak search month', value: demand.peak.month, hint: 'highest Google Ads volume' })
    if (demand?.low) f.push({ label: 'Quietest search month', value: demand.low.month, hint: 'lowest Google Ads volume' })
    if (supplyChart?.peak) f.push({ label: 'Sellers list most in', value: supplyChart.peak.month, hint: 'listing-creation timing, seller behaviour not demand' })
    if (market) {
      f.push({ label: 'Competing listings', value: String(market.sample), hint: 'live sample analysed' })
      f.push({ label: 'Median price', value: `${cur} ${market.priceMedian}`, hint: `range ${cur} ${market.priceP25}–${market.priceP75}` })
      f.push({ label: 'Median views', value: formatNumber(market.viewsMedian) })
      f.push({ label: 'Median favorites', value: formatNumber(market.favMedian) })
      f.push({ label: 'Engagement (fav/view)', value: `${market.engagementPct}%`, hint: 'median across the sample' })
      f.push({ label: 'Unique shops', value: `${market.uniqueShops} of ${market.sample}`, hint: 'market concentration' })
      if (market.ageMonthsMedian != null) f.push({ label: 'Median listing age', value: `${market.ageMonthsMedian} months` })
      if (market.topTags[0]) f.push({ label: 'Most-used tag', value: market.topTags[0].tag, hint: `${market.topTags[0].pct}% of listings use it` })
    }
    return f
  }, [demand, supplyChart, market, cur])

  const aiNotes =
    'Prices/views/favorites are real medians from a live Etsy listing sample. Search-month data (if present) is real Google Ads volume. ' +
    '"Sellers list most in" is listing-creation timing — seller behaviour, not buyer demand. Etsy itself publishes no search volume or history.'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <SearchBar value={input} onChange={setInput} onSubmit={go}
          placeholder="Analyze a keyword's season & market… e.g. christmas ornament" button="Analyze →" />
      </div>

      {isLoading && <Loading label="Mapping the season & market…" />}
      {isError && <ErrorBox>Couldn&apos;t load data for this keyword. Please try again.</ErrorBox>}

      {tr && !isLoading && (
        <>
          {/* ── Market snapshot — real medians from the live sample ── */}
          {market && (
            <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              <StatCard label="Competing" value={formatNumber(market.sample)} accent={D.series[1]} sub="listings analysed" />
              <StatCard label="Median price" value={`${cur} ${market.priceMedian}`} accent={D.series[0]} sub={`typical ${cur} ${market.priceP25}–${market.priceP75}`} />
              <StatCard label="Median views" value={formatNumber(market.viewsMedian)} accent={D.series[4]} sub={`top listing ${formatNumber(market.viewsMax)}`} />
              <StatCard label="Engagement" value={`${market.engagementPct}%`} accent={D.series[2]} sub="favorites ÷ views (median)" />
            </div>
          )}

          {/* ── Seasonal demand — only real via Google ── */}
          {demand ? (
            <>
              <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                <StatCard label="Peak month" value={demand.peak?.month ?? '—'} accent={C.orange} sub="Highest Google search volume" />
                <StatCard label="Quietest month" value={demand.low?.month ?? '—'} accent={C.graphite} sub="Lowest search volume" />
                <StatCard label="Prep by" value={prepMonth(demand.peak?.month)} accent={D.good} sub="List ~6 weeks before peak" />
              </div>
              <Card>
                <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: '#2E6DB4' }}>Google · real volume</span>}>
                  Search demand — &ldquo;{query}&rdquo;
                </SectionTitle>
                <BarChart axis="x" height={240} labels={demand.labels} values={demand.values} colors={demand.colors} />
                <p style={{ fontSize: 11.5, color: C.stone, marginTop: 8 }}>
                  Real monthly search volume from the Google Ads Keyword Planner. Etsy publishes no search volume of its own.
                </p>
              </Card>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 12, padding: '16px 18px', background: D.midBg, borderRadius: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 17, lineHeight: 1.35 }}>⚠️</span>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: C.ink, marginBottom: 6 }}>
                  Buyer-demand seasonality isn&apos;t available for &ldquo;{query}&rdquo;
                </p>
                <p style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.65, maxWidth: 660 }}>
                  Etsy&apos;s API publishes no search volume and no history, so there is no honest way to chart when Etsy
                  shoppers search for this. Connecting <strong style={{ color: C.ink }}>Google Ads</strong> fills this in
                  with real monthly volume. Below is what Etsy <em>does</em> tell us — a full market snapshot.
                </p>
              </div>
            </div>
          )}

          {/* ── Two-up: seller-supply season + price distribution ── */}
          <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
            {supplyChart && (
              <Card>
                <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: D.good }}>Etsy · real</span>}>
                  When sellers list
                </SectionTitle>
                <p style={{ fontSize: 12.5, color: C.graphite, marginTop: -8, marginBottom: 12, lineHeight: 1.5 }}>
                  Month each competing listing went live — <strong style={{ color: C.ink }}>seller behaviour, not buyer demand</strong>. A spike marks when the category gears up.
                </p>
                <BarChart axis="x" height={220} labels={supplyChart.labels} values={supplyChart.values} colors={supplyChart.colors} />
                {supplyChart.peak && (
                  <p style={{ fontSize: 12, color: C.graphite, marginTop: 10, lineHeight: 1.5 }}>
                    Most listings went live in <strong style={{ color: D.good }}>{supplyChart.peak.month}</strong>. List earlier to get indexed before the crowd.
                  </p>
                )}
              </Card>
            )}

            {market && market.priceBands.length > 0 && (
              <Card>
                <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: D.series[0] }}>Etsy · real</span>}>
                  Price distribution
                </SectionTitle>
                <p style={{ fontSize: 12.5, color: C.graphite, marginTop: -8, marginBottom: 12, lineHeight: 1.5 }}>
                  How the {market.sample} competing listings are priced ({cur}). Cluster your price where buyers already are — or deliberately stand apart.
                </p>
                <BarChart axis="x" height={220} labels={market.priceBands.map(b => b.band)} values={market.priceBands.map(b => b.count)} color={D.series[0]} />
                <p style={{ fontSize: 12, color: C.graphite, marginTop: 10, lineHeight: 1.5 }}>
                  Median <strong style={{ color: C.ink }}>{cur} {market.priceMedian}</strong> · full range {cur} {market.priceMin}–{market.priceMax}.
                </p>
              </Card>
            )}
          </div>

          {/* ── Top competing tags ── */}
          {market && market.topTags.length > 0 && (
            <Card>
              <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: C.graphite }}>adoption across {market.sample}</span>}>
                Tags the market relies on
              </SectionTitle>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {market.topTags.map(t => (
                  <span key={t.tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontFamily: MONO, color: C.ink, background: C.bone, border: `1px solid ${C.hair}`, padding: '5px 12px', borderRadius: 100 }}>
                    {t.tag}
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent, #FB5E09)' }}>{t.pct}%</span>
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* ── Top competing listings ── */}
          {market && market.topListings.length > 0 && (
            <Card pad={0}>
              <div style={{ padding: '16px 18px 12px' }}>
                <SectionTitle>Top listings by views</SectionTitle>
              </div>
              {market.topListings.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderTop: `1px solid ${C.hair}`, textDecoration: 'none' }}>
                  <span style={{ fontSize: 13, fontFamily: MONO, fontWeight: 700, color: 'var(--accent, #FB5E09)', width: 18, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13.5, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</span>
                  {l.price != null && <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.graphite, flexShrink: 0 }}>{cur} {l.price}</span>}
                  <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.graphite, width: 78, textAlign: 'right', flexShrink: 0 }}>👁 {formatNumber(l.views)}</span>
                  <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.graphite, width: 64, textAlign: 'right', flexShrink: 0 }}>♥ {formatNumber(l.favorites)}</span>
                </a>
              ))}
            </Card>
          )}

          {/* ── AI reads all of the above ── */}
          {aiFacts.length >= 2 && (
            <AiInsights tool="Monthly Trends" subject={query} facts={aiFacts} notes={aiNotes} />
          )}

          {tr?.note && (
            <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.6 }}>{tr.note}</p>
          )}
        </>
      )}
    </div>
  )
}
