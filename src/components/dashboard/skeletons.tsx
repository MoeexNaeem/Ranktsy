'use client'
/**
 * Loading states.
 *
 * A cold keyword takes ~13s to fully measure (33 live Etsy calls behind an
 * 8/sec rate gate). The page paints from the fast core in ~1–2s and the
 * expensive stages fill in behind it — so the UI has to say WHICH part is still
 * measuring, not just spin.
 *
 * Skeletons mirror the real layout (same heights, same column grid) so nothing
 * jumps when data lands.
 */
import React from 'react'
import { C, D } from '@/utils'
import { MONO, cardStyle, tableHead, th } from './kit'

// ─── Primitives ──────────────────────────────────────────────────────────────
export function Shimmer({ h = 16, w = '100%', r = 6, style }: {
  h?: number | string; w?: number | string; r?: number; style?: React.CSSProperties
}) {
  return <div className="shimmer" style={{ height: h, width: w, borderRadius: r, background: '#e8e7e2', ...style }} />
}

/** Deterministic pseudo-random width — varied bars read as content, not a grid. */
function widthFor(seed: number, min = 45, max = 90): string {
  const n = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1
  return `${Math.round(min + n * (max - min))}%`
}

// ─── Stat cards ──────────────────────────────────────────────────────────────
export function StatCardSkeleton() {
  return (
    <div style={{ ...cardStyle, padding: '20px 22px' }}>
      <Shimmer h={10} w="55%" r={3} />
      <div style={{ height: 14 }} />
      <Shimmer h={30} w="70%" r={5} />
      <div style={{ height: 10 }} />
      <Shimmer h={9} w="40%" r={3} />
      <div style={{ height: 12 }} />
      <Shimmer h={7} r={999} />
    </div>
  )
}

export function StatRowSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: `repeat(${n},1fr)`, gap: 12 }}>
      {Array.from({ length: n }, (_, i) => <StatCardSkeleton key={i} />)}
    </div>
  )
}

// ─── Table ───────────────────────────────────────────────────────────────────
/**
 * Table skeleton on the REAL column grid, so the header stays put and only the
 * cells resolve.
 */
export function TableSkeleton({ grid, columns, rows = 8, label }: {
  grid: string; columns: string[]; rows?: number; label?: string
}) {
  return (
    <div style={{ ...cardStyle, overflow: 'hidden' }}>
      <div style={tableHead(grid)}>
        {columns.map((c, i) => <span key={i} style={th}>{c}</span>)}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: 'grid', gridTemplateColumns: grid, gap: 10, padding: '15px 20px', borderBottom: `1px solid ${C.hair}`, alignItems: 'center' }}>
          {columns.map((_, c) => <Shimmer key={c} h={13} w={widthFor(r * 31 + c)} r={4} />)}
        </div>
      ))}
      {label && (
        <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 9, background: C.canvas }}>
          <Dot />
          <span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>{label}</span>
        </div>
      )}
    </div>
  )
}

// ─── Card / chart ────────────────────────────────────────────────────────────
export function CardSkeleton({ h = 240, title }: { h?: number; title?: string }) {
  return (
    <div style={{ ...cardStyle, padding: 22 }}>
      {title
        ? <p style={{ fontSize: 19, fontWeight: 500, color: C.ink, letterSpacing: '-0.02em', marginBottom: 16 }}>{title}</p>
        : <><Shimmer h={16} w="42%" r={4} /><div style={{ height: 18 }} /></>}
      <Shimmer h={h} r={10} />
    </div>
  )
}

export function GridSkeleton({ n = 8, h = 190 }: { n?: number; h?: number }) {
  return (
    <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ ...cardStyle, overflow: 'hidden' }}>
          <Shimmer h={140} r={0} />
          <div style={{ padding: '10px 12px' }}>
            <Shimmer h={11} w="95%" r={3} />
            <div style={{ height: 6 }} />
            <Shimmer h={11} w={widthFor(i)} r={3} />
            <div style={{ height: 10 }} />
            <Shimmer h={12} w="45%" r={3} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Live status ─────────────────────────────────────────────────────────────
function Dot({ color = C.orange }: { color?: string }) {
  return <span className="shimmer" style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
}

export interface Stage { label: string; done: boolean; failed?: boolean }

/**
 * Per-stage progress. Names what's still being measured and roughly why it
 * takes a moment — "Measuring 24 keywords against Etsy" is a reason to wait;
 * an anonymous spinner is not.
 */
export function LoadingStages({ stages, note }: { stages: Stage[]; note?: string }) {
  const done = stages.filter(s => s.done).length
  const pct = Math.round((done / Math.max(stages.length, 1)) * 100)

  return (
    <div style={{ ...cardStyle, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {done < stages.length && <Dot />}
        <span style={{ fontSize: 13.5, fontWeight: 500, color: C.ink }}>
          {done < stages.length ? 'Measuring against the live Etsy API…' : 'All data measured'}
        </span>
        <span style={{ fontSize: 11.5, fontFamily: MONO, color: C.stone, marginLeft: 'auto' }}>{done}/{stages.length}</span>
      </div>

      <div style={{ height: 4, background: C.bone, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: D.good, borderRadius: 999, transition: 'width 0.5s ease' }} />
      </div>

      <div style={{ display: 'flex', gap: '6px 18px', flexWrap: 'wrap' }}>
        {stages.map(s => (
          <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: s.done ? C.graphite : C.ink }}>
            {s.failed
              ? <span style={{ color: D.hard, fontSize: 11 }}>✕</span>
              : s.done
                ? <span style={{ color: D.good, fontSize: 11 }}>✓</span>
                : <Dot />}
            {s.label}
          </span>
        ))}
      </div>

      {note && <p style={{ fontSize: 11.5, color: C.stone, lineHeight: 1.5 }}>{note}</p>}
    </div>
  )
}

/** Small inline "still working" chip for a section that's filling in late. */
export function Measuring({ label = 'measuring…' }: { label?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontFamily: MONO, color: C.orange }}>
      <Dot />{label}
    </span>
  )
}
