'use client'
/**
 * Market Activity (measured) - eHunt-style monthly Views / Favorites / Sales /
 * Reviews for a keyword, computed from OUR snapshot history (not search volume,
 * which we cannot observe). Each metric shows this-month, the window total, and a
 * real monthly sparkline. Until enough snapshots have accrued it shows only the
 * live sampled stats (no placeholder copy), and hides entirely if there is nothing.
 */
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Card, SectionTitle, MONO } from '../kit'
import { Sparkline, type SparkPoint } from '@/components/charts/pro'
import { C, formatNumber } from '@/utils'
import type { KeywordMarketHistory } from '@/lib/snapshots'
import { SampledStatsGrid } from './SampledStats'
import type { SearchAnalysis } from '@/types'

type MetricKey = 'views' | 'favorites' | 'sales' | 'reviews'
const METRICS: { key: MetricKey; label: string; color: string }[] = [
  { key: 'views',     label: 'Views',     color: '#2E6DB4' },
  { key: 'favorites', label: 'Favorites', color: '#DB2777' },
  { key: 'sales',     label: 'Sales',     color: '#16A34A' },
  { key: 'reviews',   label: 'Reviews',   color: '#C08A12' },
]

const fmtDay = (d: string) => {
  const [y, m, day] = d.split('-')
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(day))).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function MarketActivityPanel({ query, analysis }: { query: string; analysis?: SearchAnalysis }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['kw-market', query],
    queryFn: async () => (await axios.get(`/api/keywords/market-history?q=${encodeURIComponent(query)}`)).data.data as KeywordMarketHistory,
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 10,
    retry: false,
    // A side panel: when history is busy it just hides, no error toast.
    meta: { silent: true },
  })

  const spark = (k: MetricKey): SparkPoint[] => (data?.daily ?? []).slice(-30).map(d => ({ label: fmtDay(d.day), value: d[k] }))

  // No tracked history yet: show only the live sampled stats, with no filler text.
  // Nothing at all to show: hide the card rather than leave it empty.
  const hasMeasured = !isError && !!data && data.measuredListings > 0
  const hasSampled = !!analysis && analysis.listingsAnalyzed > 0
  if (!isLoading && !hasMeasured && !hasSampled) return null

  return (
    <Card>
      <SectionTitle right={<span style={{ fontSize: 10, fontFamily: MONO, color: C.stone }}>REAL · from our tracking</span>}>
        Market Activity (measured)
      </SectionTitle>

      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {METRICS.map(m => <div key={m.key} style={{ height: 118, borderRadius: 12, background: C.canvas }} />)}
        </div>
      )}

      {/* Sampled stats from the listings ranking right now. Shown above the tracked
          metrics and labelled separately, so a sampled figure is never mistaken for
          one of our own day-over-day measurements. */}
      {analysis && analysis.listingsAnalyzed > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: 600, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 9px' }}>
            Top {analysis.listingsAnalyzed} listings ranking now
          </p>
          <SampledStatsGrid analysis={analysis} />
        </div>
      )}

      {analysis && analysis.listingsAnalyzed > 0 && !isLoading && data && data.measuredListings > 0 && (
        <p style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: 600, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 9px' }}>
          Measured day over day
        </p>
      )}

      {!isLoading && data && data.measuredListings > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }} className="rgrid-4">
            {METRICS.map(m => {
              const total = data.totals[m.key]
              const l30 = data.last30[m.key]
              return (
                <div key={m.key} style={{ border: `1px solid ${C.hair}`, borderRadius: 12, padding: '12px 13px', background: C.paper, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 3, background: m.color }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.ink, lineHeight: 1.1 }}>{formatNumber(total)}</div>
                  <div style={{ fontSize: 11.5, color: C.stone, fontFamily: MONO }}>+{formatNumber(l30)} last 30 days{m.key === 'sales' ? ' (est.)' : ''}</div>
                  <div style={{ marginTop: 4 }}><Sparkline data={spark(m.key)} color={m.color} height={40} showDots name={m.label} /></div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}
