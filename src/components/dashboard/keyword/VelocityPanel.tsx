'use client'
import { memo, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { BarChart } from '@/components/charts/BarChart'
import { Card, SectionTitle, MONO } from '../kit'
import { C, D, formatNumber } from '@/utils'
import type { ApiResponse, ShopVelocity } from '@/types'

export function useVelocity(shop: string | number, enabled = true, days = 90) {
  return useQuery({
    queryKey: ['velocity', String(shop), days],
    queryFn: async ({ signal }) => {
      const { data } = await axios.get<ApiResponse<ShopVelocity>>(
        `/api/etsy/velocity?shop=${encodeURIComponent(String(shop))}&days=${days}`, { signal })
      if (!data.success || !data.data) throw new Error(data.error ?? 'Failed to load velocity')
      return data.data
    },
    enabled: enabled && !!shop,
    staleTime: 1000 * 60 * 30,
  })
}

// Time-range filter for the sales-history chart (real daily snapshots).
const RANGES: { label: string; days: number }[] = [
  { label: '1 week', days: 7 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
]

const fmtDay = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })

function Metric({ label, value, sub, color = C.ink }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ flex: '1 1 120px', minWidth: 110 }}>
      <p style={{ fontSize: 11, fontFamily: MONO, fontWeight: 500, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 500, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11.5, color: C.stone, marginTop: 5 }}>{sub}</p>}
    </div>
  )
}

/**
 * Sales velocity from our own snapshot history.
 *
 * The honest part: Etsy publishes a lifetime total and no series, and history
 * can't be backfilled. Before there are two days of snapshots there is no
 * velocity — so this renders a "tracking started" state rather than a zero,
 * which would read as "this shop sold nothing".
 */
export const VelocityPanel = memo(function VelocityPanel({
  shopId, shopName,
}: { shopId: number; shopName: string }) {
  const [days, setDays] = useState(30)
  const [nowMs] = useState(() => Date.now())  // captured once — avoids Date.now() during render
  // Fetch the full 90-day window so the summary metrics (last 7 / last 30) stay
  // accurate; the range toggle slices only the CHART, client-side, so switching
  // ranges is instant and never re-queries.
  const { data: v, isLoading } = useVelocity(shopId || shopName, !!(shopId || shopName), 90)

  const chart = useMemo(() => {
    if (!v) return null
    const cutoffMs = nowMs - days * 86_400_000
    const pts = (v.points.filter(p => p.sold != null) as { day: string; sold: number }[])
      .filter(p => Date.parse(p.day + 'T00:00:00Z') >= cutoffMs)
    if (!pts.length) return null
    const max = Math.max(...pts.map(p => p.sold))
    return {
      labels: pts.map(p => fmtDay(p.day)),
      values: pts.map(p => p.sold),
      colors: pts.map(p => (p.sold === max ? C.orange : 'rgba(31,138,76,0.55)')),
    }
  }, [v, days, nowMs])

  if (isLoading) return <div className="shimmer" style={{ height: 150, borderRadius: 16, background: '#e8e7e2' }} />
  if (!v) return null

  const hasVelocity = chart !== null

  return (
    <Card>
      <SectionTitle right={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ display: 'inline-flex', gap: 3, background: C.bone, padding: 3, borderRadius: 100 }}>
            {RANGES.map(r => {
              const on = days === r.days
              return (
                <button key={r.days} onClick={() => setDays(r.days)}
                  style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: on ? 600 : 400, padding: '4px 11px', borderRadius: 100, cursor: 'pointer', border: 'none',
                    background: on ? C.paper : 'transparent', color: on ? C.ink : C.graphite, boxShadow: on ? `0 0 0 1px ${C.ash}` : 'none' }}>
                  {r.label}
                </button>
              )
            })}
          </div>
          <span style={{ fontSize: 11, fontFamily: MONO, color: C.stone }}>
            {v.trackedSince ? `tracking since ${fmtDay(v.trackedSince)}` : 'not tracked yet'}
          </span>
        </div>
      }>Sales Velocity</SectionTitle>

      {hasVelocity ? (
        <>
          <div className="rwrap-sm" style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 0', marginBottom: 18 }}>
            <Metric label="Sold yesterday" value={v.soldYesterday != null ? formatNumber(v.soldYesterday) : '—'} color={D.good} sub="units" />
            <Metric label="Last 7 days" value={v.soldLast7 != null ? formatNumber(v.soldLast7) : '—'} color={D.good} sub="units" />
            <Metric label="Last 30 days" value={v.soldLast30 != null ? formatNumber(v.soldLast30) : '—'} color="#2E6DB4" sub="units" />
            <Metric label="Avg / day" value={v.avgPerDay != null ? String(v.avgPerDay) : '—'} sub="across tracked days" />
            <Metric label="Lifetime" value={v.latestSales != null ? formatNumber(v.latestSales) : '—'} sub="total sales" />
          </div>
          <BarChart labels={chart.labels} values={chart.values} colors={chart.colors} height={210} />
          <p style={{ fontSize: 11.5, color: C.stone, marginTop: 8, lineHeight: 1.55 }}>
            Units sold per day, derived by differencing Etsy&apos;s lifetime sales total between our daily snapshots.
            Gaps in tracking are averaged across the elapsed days rather than shown as spikes.
          </p>
        </>
      ) : (
        <div style={{ display: 'flex', gap: 12, padding: '16px 18px', background: C.canvas, borderRadius: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 17, lineHeight: 1.3 }}>📈</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: C.ink, marginBottom: 5 }}>
              Tracking started {v.trackedSince ? fmtDay(v.trackedSince) : 'today'} — no velocity yet
            </p>
            <p style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.6, maxWidth: 620 }}>
              Etsy publishes a shop&apos;s <strong>lifetime</strong>{' '}sales total and no history, and it can&apos;t be
              backfilled. We now record this shop daily, so units-sold-per-day appears from
              tomorrow. Lifetime sales so far: <strong style={{ color: D.good }}>{v.latestSales != null ? formatNumber(v.latestSales) : '—'}</strong>.
            </p>
          </div>
        </div>
      )}
    </Card>
  )
})
