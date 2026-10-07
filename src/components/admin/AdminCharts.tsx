'use client'
/**
 * Small, dependency-free chart + motion primitives for the admin dashboard.
 * All animate ONCE on mount (count-up numbers, growing bars, sweeping donut) -
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
// Calm on purpose: neutral number, the accent only as a small dot by the label.
export function Kpi({ label, value, accent = C.ink, sub, format, delay = 0 }: {
  // null = not known yet (still being computed): shown as "-", never as a fake 0.
  label: string; value: number | null; accent?: string; sub?: string; format?: (n: number) => string; delay?: number
}) {
  const [shown, setShown] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShown(true), delay); return () => clearTimeout(t) }, [delay])
  return (
    <div style={{
      ...cardStyle, padding: '16px 18px 18px',
      transform: shown ? 'translateY(0)' : 'translateY(6px)', opacity: shown ? 1 : 0,
      transition: 'transform 0.4s cubic-bezier(.2,.7,.2,1), opacity 0.4s',
    }}>
      <p style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontFamily: MONO, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        <span style={{ width: 7, height: 7, borderRadius: 2, background: accent, flexShrink: 0 }} />{label}
      </p>
      <p style={{ fontSize: 27, fontWeight: 650, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value == null ? '-' : <AnimatedNumber value={value} format={format} />}
      </p>
      {sub && <p style={{ fontSize: 12, color: C.stone, marginTop: 7 }}>{sub}</p>}
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
  const gap = 'clamp(4px, 1.6%, 14px)'
  return (
    <div>
    <div style={{ display: 'flex', alignItems: 'flex-end', gap, height, paddingTop: 8, borderBottom: `1px solid ${C.ash}` }}>
      {data.map((d, i) => {
        const h = grown ? Math.max(2, (d.value / max) * (height - 34)) : 2
        return (
          <div key={i} title={`${d.label}: ${valueFormat(d.value)}`} style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 0 }}>
            <span style={{ fontSize: 10.5, fontFamily: MONO, color: C.graphite, opacity: grown ? 1 : 0, transition: 'opacity 0.5s', whiteSpace: 'nowrap' }}>{d.value > 0 ? valueFormat(d.value) : ''}</span>
            <div style={{ width: '100%', maxWidth: 44, height: h, background: accent, opacity: d.value > 0 ? 0.85 : 0.2, borderRadius: '4px 4px 0 0', transition: `height 0.6s cubic-bezier(.2,.7,.2,1) ${i * 25}ms` }} />
          </div>
        )
      })}
    </div>
    <div style={{ display: 'flex', gap, marginTop: 6 }}>
      {data.map((d, i) => (
        <span key={i} style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', fontSize: 10.5, fontFamily: MONO, color: C.stone, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</span>
      ))}
    </div>
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
