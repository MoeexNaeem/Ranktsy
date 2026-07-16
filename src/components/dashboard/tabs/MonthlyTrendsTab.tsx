'use client'
import { useState, useCallback, useMemo } from 'react'
import { useTrends } from '@/hooks/useKeywords'
import { BarChart } from '@/components/charts/BarChart'
import { Card, SearchBar, SectionTitle, ErrorBox, Loading, StatCard, MONO } from '../kit'
import { C, D } from '@/utils'
import type { TrendData, TrendPoint } from '@/types'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function prepMonth(peak?: string): string {
  if (!peak) return '—'
  const i = MONTHS.indexOf(peak)
  if (i < 0) return '—'
  return MONTHS[(i - 2 + 12) % 12]   // ~6 weeks ahead
}

/**
 * Monthly Trends.
 *
 * This tab used to render a hardcoded seasonality curve scaled by view count —
 * every keyword got the same shape and the same peak month, and the UI told
 * sellers when to list based on it. That curve is gone (see buildTrendData).
 *
 * What's left is only what's real: Google Ads monthly volumes if configured, and
 * Etsy's listing-creation distribution, which is genuine but measures sellers,
 * not buyers. When neither answers the demand question, the tab says so rather
 * than inventing an answer.
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <SearchBar value={input} onChange={setInput} onSubmit={go}
          placeholder="See a keyword's seasonal shape… e.g. christmas ornament" button="Chart it →" />
      </div>

      {isLoading && <Loading label="Mapping the seasons…" />}
      {isError && <ErrorBox>Couldn&apos;t load seasonal data. Please try again.</ErrorBox>}

      {tr && !isLoading && (
        <>
          {/* Real buyer demand — only exists via Google. */}
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
              {demand.peak && (
                <div style={{ background: C.orange, borderRadius: 12, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 18 }}>🗓️</span>
                  <p style={{ fontSize: 12.5, color: C.snow, lineHeight: 1.5 }}>
                    Searches for &ldquo;{query}&rdquo; peak in <strong>{demand.peak.month}</strong>. Have listings live and
                    optimized by <strong>{prepMonth(demand.peak.month)}</strong> so they gain traction before the rush.
                  </p>
                </div>
              )}
            </>
          ) : (
            /* No Google credentials → we genuinely cannot answer "when does demand
               peak". Saying so beats the old fabricated curve. */
            <div style={{ display: 'flex', gap: 12, padding: '16px 18px', background: D.midBg, borderRadius: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 17, lineHeight: 1.35 }}>⚠️</span>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: C.ink, marginBottom: 6 }}>
                  Buyer-demand seasonality isn&apos;t available for &ldquo;{query}&rdquo;
                </p>
                <p style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.65, maxWidth: 660 }}>
                  Etsy&apos;s API publishes no search volume and no history, so there is no honest way to chart when Etsy
                  shoppers search for this. Connecting <strong style={{ color: C.ink }}>Google Ads</strong> fills this in
                  with real monthly volume. Below is what Etsy <em>does</em> tell us.
                </p>
              </div>
            </div>
          )}

          {/* Real, Etsy-only — but it measures sellers, not buyers. Labelled as such. */}
          {supplyChart && (
            <Card>
              <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: D.good }}>Etsy · real</span>}>
                When sellers list for &ldquo;{query}&rdquo;
              </SectionTitle>
              <p style={{ fontSize: 13, color: C.graphite, marginTop: -8, marginBottom: 12, lineHeight: 1.55 }}>
                The month each of the top {supply.reduce((s, p) => s + p.value, 0)} competing listings was created.
                Sellers list <em>ahead</em>{' '}of the season they&apos;re chasing, so a spike marks when the category gears up —
                this is <strong style={{ color: C.ink }}>seller behaviour, not buyer demand</strong>.
              </p>
              <BarChart axis="x" height={240} labels={supplyChart.labels} values={supplyChart.values} colors={supplyChart.colors} />
              {supplyChart.peak && (
                <p style={{ fontSize: 12.5, color: C.graphite, marginTop: 10, lineHeight: 1.55 }}>
                  Most competing listings went live in <strong style={{ color: D.good }}>{supplyChart.peak.month}</strong>.
                  Listing meaningfully earlier is how you get indexed before the crowd arrives.
                </p>
              )}
            </Card>
          )}

          {tr?.note && (
            <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.6 }}>{tr.note}</p>
          )}
        </>
      )}
    </div>
  )
}
