'use client'
/**
 * Chart + motion primitives for the admin dashboard: count-up KPI cards, a
 * donut, and Recharts bar charts (axis, gridlines, hover tooltip). Colours come
 * from the app's `C`/`D` tokens.
 */
import { useEffect, useRef, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { C } from '@/utils'
import { cardStyle, MONO } from '@/components/dashboard/kit'

// ─── Count-up number ──────────────────────────────────────────────────────────
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString('en-US'), durationMs = 900 }: {
  value: number; format?: (n: number) => string; durationMs?: number
}) {
  const [n, setN] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const start = performance.now()
    const a = from.current, b = value
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)   // easeOutCubic
      setN(a + (b - a) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = b
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, durationMs])
  return <>{format(n)}</>
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
// Coloured strip on top (the owner likes it), neutral number.
export function Kpi({ label, value, accent = C.ink, sub, format, delay = 0 }: {
  // null = not known yet (still being computed): shown as "-", never as a fake 0.
  label: string; value: number | null; accent?: string; sub?: string; format?: (n: number) => string; delay?: number
}) {
  const [shown, setShown] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShown(true), delay); return () => clearTimeout(t) }, [delay])
  return (
    <div style={{
      ...cardStyle, position: 'relative', overflow: 'hidden', padding: '18px 18px 18px',
      transform: shown ? 'translateY(0)' : 'translateY(6px)', opacity: shown ? 1 : 0,
      transition: 'transform 0.4s cubic-bezier(.2,.7,.2,1), opacity 0.4s',
    }}>
      <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <p style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{label}</p>
      <p style={{ fontSize: 27, fontWeight: 650, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value == null ? '-' : <AnimatedNumber value={value} format={format} />}
      </p>
      {sub && <p style={{ fontSize: 12, color: C.stone, marginTop: 7 }}>{sub}</p>}
    </div>
  )
}

// ─── Bar charts (Recharts) ────────────────────────────────────────────────────
const AXIS = '#9a9a92'
const GRID = 'rgba(0,0,0,0.07)'
const compact = (n: number) => Math.abs(n) >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : String(Math.round(n))

interface TipRow { name?: string; value?: number; color?: string; fill?: string }
function ChartTip({ active, payload, label, format, showTotal }: { active?: boolean; payload?: TipRow[]; label?: string; format: (n: number) => string; showTotal?: boolean }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((t, p) => t + (Number(p.value) || 0), 0)
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.ash}`, borderRadius: 10, boxShadow: '0 8px 28px rgba(20,18,14,0.12)', padding: '9px 12px', minWidth: 140 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.graphite, lineHeight: 1.75 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: p.color ?? p.fill, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{p.name}</span>
          <strong style={{ color: C.ink, fontWeight: 600 }}>{format(Number(p.value) || 0)}</strong>
        </div>
      ))}
      {showTotal && payload.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: `1px solid ${C.hair}`, marginTop: 4, paddingTop: 4, fontSize: 12.5, color: C.ink, fontWeight: 600 }}>
          <span>Total</span><span>{format(total)}</span>
        </div>
      )}
    </div>
  )
}

/** Single-series bar chart with a y-axis, gridlines and a hover tooltip. */
export function Bars({ data, height = 200, accent = C.orange, valueFormat = (n) => n.toLocaleString('en-US'), name = 'Value' }: {
  data: { label: string; value: number }[]; height?: number; accent?: string; valueFormat?: (n: number) => string; name?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11.5, fill: AXIS }} tickLine={false} axisLine={{ stroke: C.ash }} interval="preserveStartEnd" minTickGap={8} />
        <YAxis tick={{ fontSize: 11.5, fill: AXIS }} tickLine={false} axisLine={false} width={46} allowDecimals={false} tickFormatter={v => compact(Number(v))} />
        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={(p) => <ChartTip active={p.active} payload={p.payload as unknown as TipRow[]} label={String(p.label ?? '')} format={valueFormat} />} />
        <Bar dataKey="value" name={name} fill={accent} radius={[5, 5, 0, 0]} maxBarSize={44} animationDuration={600} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Stacked bars for several series (e.g. card + local revenue), with a legend. */
export function StackedBars({ data, series, height = 240, valueFormat = (n) => n.toLocaleString('en-US') }: {
  data: Record<string, number | string>[]; series: { key: string; name: string; color: string }[]; height?: number; valueFormat?: (n: number) => string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }} barCategoryGap="26%">
        <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11.5, fill: AXIS }} tickLine={false} axisLine={{ stroke: C.ash }} interval={0} />
        <YAxis tick={{ fontSize: 11.5, fill: AXIS }} tickLine={false} axisLine={false} width={52} tickFormatter={v => valueFormat(Number(v)).replace(/\.\d+$/, '')} />
        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={(p) => <ChartTip active={p.active} payload={p.payload as unknown as TipRow[]} label={String(p.label ?? '')} format={valueFormat} showTotal />} />
        <Legend verticalAlign="top" align="right" height={28} iconType="square" iconSize={9} wrapperStyle={{ fontSize: 12, color: C.graphite }} />
        {series.map((sr, i) => (
          <Bar key={sr.key} dataKey={sr.key} name={sr.name} stackId="s" fill={sr.color} maxBarSize={44} animationDuration={600}
            radius={i === series.length - 1 ? [5, 5, 0, 0] : [0, 0, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Donut (distribution) ─────────────────────────────────────────────────────
export function Donut({ segments, size = 168, thickness = 22 }: {
  segments: { label: string; value: number; color: string }[]; size?: number; thickness?: number
}) {
  const [swept, setSwept] = useState(false)
  useEffect(() => { const t = setTimeout(() => setSwept(true), 80); return () => clearTimeout(t) }, [])
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0))
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  const active = segments.filter(s => s.value > 0)
  // Cumulative start offset per arc, without mutating a variable during render.
  const arcs = active.map((s, i) => ({
    ...s,
    len: (s.value / total) * circ,
    start: active.slice(0, i).reduce((sum, x) => sum + (x.value / total) * circ, 0),
  }))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.bone} strokeWidth={thickness} />
        {arcs.map((s, i) => {
          const dash = swept ? `${s.len} ${circ - s.len}` : `0 ${circ}`
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
              strokeDasharray={dash} strokeDashoffset={-s.start} strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: `stroke-dasharray 0.9s cubic-bezier(.2,.7,.2,1) ${i * 90}ms` }} />
          )
        })}
        <text x="50%" y="47%" textAnchor="middle" style={{ fontSize: 26, fontWeight: 700, fill: C.ink, fontFamily: MONO }}>{total.toLocaleString('en-US')}</text>
        <text x="50%" y="60%" textAnchor="middle" style={{ fontSize: 10, fill: C.graphite, fontFamily: MONO, letterSpacing: '0.06em' }}>TOTAL</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 120 }}>
        {segments.filter(s => s.value > 0).map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: C.ink, flex: 1 }}>{s.label}</span>
            <span style={{ fontFamily: MONO, color: C.graphite }}>{s.value.toLocaleString('en-US')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
