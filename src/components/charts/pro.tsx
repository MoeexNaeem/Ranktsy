'use client'

/**
 * Professional chart kit (Recharts) - replaces the flat custom-SVG "cartoonish"
 * visuals across the dashboard and powers the eHunt-style monthly sparklines.
 *
 *   <Sparkline data={[…]} />          tiny monthly trend for a table cell
 *   <TrendArea series={[…]} />        full multi-series area chart with axes/tooltip
 *   <HistogramBars data={[…]} />      distribution bars (price bands, ages, …)
 *
 * Everything is theme-aware via the `C` tokens and responsive (ResponsiveContainer).
 */
import { memo, useId } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts'
import { C, formatNumber } from '@/utils'

const AXIS = '#9a9a92'
const GRID = 'rgba(0,0,0,0.06)'

// ─── Shared tooltip ───────────────────────────────────────────────────────────
// Recharts injects { active, payload, label } at runtime; its exported generic
// type shifts between versions, so we type our own loose shape and wire it via
// the render-function form of `content` below.
interface TipItem { name?: string; value?: number | string; color?: string }
interface TipProps { active?: boolean; payload?: TipItem[]; label?: string | number; unit?: string }
function ProContent({ active, payload, label, unit }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.hair}`, borderRadius: 10, boxShadow: '0 8px 28px rgba(20,18,14,0.14)', padding: '9px 12px', fontFamily: 'General Sans, system-ui, sans-serif' }}>
      {label != null && label !== '' && <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, marginBottom: 5 }}>{String(label)}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: C.graphite, lineHeight: 1.7 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color ?? C.orange, flexShrink: 0 }} />
          {p.name ? <span style={{ flex: 1 }}>{p.name}</span> : null}
          <strong style={{ color: C.ink }}>{formatNumber(Number(p.value))}{unit ?? ''}</strong>
        </div>
      ))}
    </div>
  )
}
function tip(unit?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const TipRender = (props: any) => <ProContent {...props} unit={unit} />
  TipRender.displayName = 'ProTip'
  return TipRender
}

// ─── Sparkline (eHunt-style mini monthly trend) ───────────────────────────────
export interface SparkPoint { label: string; value: number }
export const Sparkline = memo(function Sparkline({
  data, color = C.orange, height = 40, showDots = false,
}: { data: SparkPoint[]; color?: string; height?: number; showDots?: boolean }) {
  const id = useId().replace(/:/g, '')
  if (!data?.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, color: C.stone }}>no data yet</div>

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 3, right: 2, bottom: 0, left: 2 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Tooltip content={tip()} cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '3 3' }} />
        <Area type="monotone" dataKey="value" name="" stroke={color} strokeWidth={2} fill={`url(#${id})`}
          dot={showDots ? { r: 2, fill: color, strokeWidth: 0 } : false} activeDot={{ r: 3.5, fill: color, stroke: '#fff', strokeWidth: 1.5 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
})

// ─── Full trend area (multi-series) ───────────────────────────────────────────
export interface TrendSeries { key: string; name: string; color: string }
export const TrendArea = memo(function TrendArea({
  data, series, height = 260, xKey = 'label', unit,
}: { data: Record<string, number | string>[]; series: TrendSeries[]; height?: number; xKey?: string; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <defs>
          {series.map(s => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={16} />
        <YAxis tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => formatNumber(Number(v))} />
        <Tooltip content={tip(unit)} />
        {series.map(s => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.4} fill={`url(#g-${s.key})`} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 1.5 }} isAnimationActive={false} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
})

// ─── Simple single-series line (for compact trends) ───────────────────────────
export const LineTrend = memo(function LineTrend({
  data, color = C.orange, height = 220, xKey = 'label', name = '', unit,
}: { data: Record<string, number | string>[]; color?: string; height?: number; xKey?: string; name?: string; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={16} />
        <YAxis tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => formatNumber(Number(v))} />
        <Tooltip content={tip(unit)} />
        <Line type="monotone" dataKey="value" name={name} stroke={color} strokeWidth={2.6} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 1.5 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
})

// ─── Histogram / distribution bars ────────────────────────────────────────────
export interface BarDatum { label: string; value: number; highlight?: boolean }
export const HistogramBars = memo(function HistogramBars({
  data, color = C.orange, highlightColor = C.ink, height = 200, unit,
}: { data: BarDatum[]; color?: string; highlightColor?: string; height?: number; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barCategoryGap="18%">
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} interval={0} angle={data.length > 8 ? -30 : 0} textAnchor={data.length > 8 ? 'end' : 'middle'} height={data.length > 8 ? 46 : 24} />
        <YAxis tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={38} tickFormatter={(v) => formatNumber(Number(v))} allowDecimals={false} />
        <Tooltip content={tip(unit)} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Bar dataKey="value" name="Listings" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={i} fill={d.highlight ? highlightColor : color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
})
