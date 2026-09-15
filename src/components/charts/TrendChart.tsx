'use client'
/**
 * Search Trends (12 months) - real monthly search volume per platform (Google
 * when configured; Etsy publishes none). Rebuilt on Recharts: a dot per month,
 * soft gradient area, real axes and a per-month tooltip that names each platform.
 * Same props as before so KeywordsTab is unchanged.
 */
import { memo, useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { C, formatNumber } from '@/utils'
import type { TrendData, TrendPlatform } from '@/types'

const COLORS: Record<TrendPlatform, string> = {
  etsy:   '#FB5E09',
  google: '#2E6DB4',
  amazon: '#C08A12',
  ebay:   '#7A4FB5',
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const shortMonth = (m: string) => {
  // m may be 'YYYY-MM' or already a label; render a short month when parseable.
  const parts = m.split('-')
  if (parts.length === 2) return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, 1)).toLocaleDateString('en-US', { month: 'short' })
  return m
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.hair}`, borderRadius: 10, boxShadow: '0 8px 28px rgba(20,18,14,0.14)', padding: '9px 12px', fontFamily: 'General Sans, system-ui, sans-serif' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, marginBottom: 5 }}>{shortMonth(String(label))}</div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: C.graphite, lineHeight: 1.7 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{p.name}</span>
          <strong style={{ color: C.ink }}>{formatNumber(Number(p.value))}<span style={{ fontWeight: 400, color: C.stone }}> /mo</span></strong>
        </div>
      ))}
    </div>
  )
}

interface Props { data: TrendData[]; activePlatforms: TrendPlatform[] }

export const TrendChart = memo(function TrendChart({ data, activePlatforms }: Props) {
  const series = useMemo(() => data.filter(d => activePlatforms.includes(d.platform)), [data, activePlatforms])
  const rows = useMemo(() => {
    const months = data[0]?.points.map(p => p.month) ?? []
    return months.map((m, i) => {
      const row: Record<string, number | string> = { label: m }
      for (const s of series) row[s.platform] = s.points[i]?.value ?? 0
      return row
    })
  }, [data, series])

  if (!rows.length || !series.length) return null

  return (
    <ResponsiveContainer width="100%" height={224}>
      <AreaChart data={rows} margin={{ top: 10, right: 12, bottom: 2, left: 0 }}>
        <defs>
          {series.map(s => (
            <linearGradient key={s.platform} id={`tr-${s.platform}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS[s.platform]} stopOpacity={0.26} />
              <stop offset="95%" stopColor={COLORS[s.platform]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis dataKey="label" tickFormatter={shortMonth} tick={{ fontSize: 11, fill: '#9a9a92' }} tickLine={false} axisLine={{ stroke: 'rgba(0,0,0,0.06)' }} minTickGap={8} />
        <YAxis tick={{ fontSize: 11, fill: '#9a9a92' }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatNumber(Number(v))} />
        <Tooltip content={<Tip />} />
        {series.map(s => (
          <Area key={s.platform} type="monotone" dataKey={s.platform} name={cap(s.platform)} stroke={COLORS[s.platform]} strokeWidth={2.4}
            fill={`url(#tr-${s.platform})`} dot={{ r: 2.5, fill: COLORS[s.platform], strokeWidth: 0 }} activeDot={{ r: 4.5, stroke: '#fff', strokeWidth: 1.5 }} isAnimationActive={false} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
})
