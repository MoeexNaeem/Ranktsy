'use client'
/**
 * Small, dependency-free chart + motion primitives for the admin dashboard.
 * All animate ONCE on mount (count-up numbers, growing bars, sweeping donut) —
 * lively but not distracting. Colours come from the app's `C`/`D` tokens.
 */
import { useEffect, useRef, useState } from 'react'
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
export function Kpi({ label, value, accent = C.ink, sub, format, delay = 0 }: {
  label: string; value: number; accent?: string; sub?: string; format?: (n: number) => string; delay?: number
}) {
  const [shown, setShown] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShown(true), delay); return () => clearTimeout(t) }, [delay])
  return (
    <div style={{
      ...cardStyle, position: 'relative', padding: '18px 20px 20px', overflow: 'hidden',
      transform: shown ? 'translateY(0)' : 'translateY(10px)', opacity: shown ? 1 : 0,
      transition: 'transform 0.5s cubic-bezier(.2,.7,.2,1), opacity 0.5s',
    }}>
      <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <p style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: 500, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>{label}</p>
      <p style={{ fontSize: 34, fontWeight: 700, color: accent, letterSpacing: '-0.03em', lineHeight: 1 }}>
        <AnimatedNumber value={value} format={format} />
      </p>
      {sub && <p style={{ fontSize: 12.5, color: C.graphite, marginTop: 7 }}>{sub}</p>}
    </div>
  )
}

// ─── Vertical bar chart ───────────────────────────────────────────────────────
export function Bars({ data, height = 150, accent = C.orange, valueFormat = (n) => n.toLocaleString('en-US') }: {
  data: { label: string; value: number }[]; height?: number; accent?: string; valueFormat?: (n: number) => string
}) {
  const [grown, setGrown] = useState(false)
  useEffect(() => { const t = setTimeout(() => setGrown(true), 60); return () => clearTimeout(t) }, [])
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height, paddingTop: 8 }}>
      {data.map((d, i) => {
        const h = grown ? Math.max(2, (d.value / max) * (height - 24)) : 2
        return (
          <div key={i} title={`${d.label}: ${valueFormat(d.value)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 10, fontFamily: MONO, color: C.graphite, opacity: grown ? 1 : 0, transition: 'opacity 0.5s' }}>{d.value > 0 ? valueFormat(d.value) : ''}</span>
            <div style={{ width: '100%', maxWidth: 34, height: h, background: `linear-gradient(180deg, ${accent}, ${accent}bb)`, borderRadius: '6px 6px 3px 3px', transition: `height 0.7s cubic-bezier(.2,.7,.2,1) ${i * 30}ms` }} />
            <span style={{ fontSize: 9.5, fontFamily: MONO, color: '#9a9a92', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{d.label}</span>
          </div>
        )
      })}
    </div>
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
