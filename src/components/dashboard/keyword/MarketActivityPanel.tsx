'use client'
/**
 * Market Activity (measured) - eHunt-style monthly Views / Favorites / Sales /
 * Reviews for a keyword, computed from OUR snapshot history (not search volume,
 * which we cannot observe). Each metric shows this-month, the window total, and a
 * real monthly sparkline. Honest about coverage via a sample badge, and gracefully
 * says "still gathering" until enough snapshots have accrued.
 */
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Card, SectionTitle, MONO } from '../kit'
import { Sparkline, type SparkPoint } from '@/components/charts/pro'
import { C, formatNumber } from '@/utils'
import type { KeywordMarketHistory, KeywordMonth } from '@/lib/snapshots'

const METRICS: { key: keyof Omit<KeywordMonth, 'month'>; label: string; color: string }[] = [
  { key: 'views',     label: 'Views',     color: '#2E6DB4' },
  { key: 'favorites', label: 'Favorites', color: '#DB2777' },
  { key: 'sales',     label: 'Sales',     color: '#16A34A' },
  { key: 'reviews',   label: 'Reviews',   color: '#C08A12' },
]

const fmtMonth = (m: string) => {
  const [y, mo] = m.split('-')
  return new Date(Date.UTC(Number(y), Number(mo) - 1, 1)).toLocaleDateString('en-US', { month: 'short' })
}

export function MarketActivityPanel({ query }: { query: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['kw-market', query],
    queryFn: async () => (await axios.get(`/api/keywords/market-history?q=${encodeURIComponent(query)}`)).data.data as KeywordMarketHistory,
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 10,
    retry: false,
  })

  const badge = data
    ? `measured from ${formatNumber(data.measuredListings)} of ${formatNumber(data.sampledListings)} tracked listings`
    : ''

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

      {!isLoading && (isError || !data || data.measuredListings === 0) && (
        <div style={{ padding: '22px 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: 13.5, color: C.ink, fontWeight: 600 }}>Still gathering data for this keyword</p>
          <p style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.6, maxWidth: 620 }}>
            Measured monthly views, favorites, sales and reviews appear here as our tracking accrues for the listings that rank for &ldquo;{query}&rdquo;. The more they are seen, the richer this gets, and it is real data, never an estimate of search volume.
          </p>
        </div>
      )}

      {!isLoading && data && data.measuredListings > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }} className="rgrid-4">
            {METRICS.map(m => {
              const spark: SparkPoint[] = data.months.map(x => ({ label: fmtMonth(x.month), value: x[m.key] }))
              const total = data.totals[m.key]
              const month = data.thisMonth[m.key]
              return (
                <div key={m.key} style={{ border: `1px solid ${C.hair}`, borderRadius: 12, padding: '12px 13px', background: C.paper, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 3, background: m.color }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.ink, lineHeight: 1.1 }}>{formatNumber(total)}</div>
                  <div style={{ fontSize: 11.5, color: C.stone, fontFamily: MONO }}>+{formatNumber(month)} this month{m.key === 'sales' ? ' (est.)' : ''}</div>
                  <div style={{ marginTop: 4 }}><Sparkline data={spark} color={m.color} height={38} /></div>
                </div>
              )
            })}
          </div>
          <p style={{ fontSize: 11, color: C.stone, marginTop: 10, lineHeight: 1.5 }}>
            {badge}{data.fromMonth ? ` · since ${data.fromMonth}` : ''}. Totals are the summed monthly gains over the window; sales are estimated from real review growth.
          </p>
        </>
      )}
    </Card>
  )
}
