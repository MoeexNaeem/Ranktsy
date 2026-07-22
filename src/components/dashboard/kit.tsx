'use client'
/**
 * Shared dashboard UI kit — readable, data-dense, eRank-inspired.
 * Bigger type, higher contrast, colorful stat/chart accents. Orange brand.
 */
import React from 'react'
import { C, compColor } from '@/utils'

export const MONO = "'General Sans', sans-serif"

// ─── Base surfaces (flat, hairline) ─────────────────────────────────────────
export const cardStyle: React.CSSProperties = {
  background: C.paper,
  border: `1px solid ${C.ash}`,
  borderRadius: 16,
}

export function Card({ children, style, pad = 22 }: {
  children: React.ReactNode; style?: React.CSSProperties; pad?: number | string
}) {
  return <div style={{ ...cardStyle, padding: pad, ...style }}>{children}</div>
}

export function SectionTitle({ children, right, dot = true }: { children: React.ReactNode; right?: React.ReactNode; dot?: boolean }) {
  return (
    <div className="rsectitle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 19, fontWeight: 600, color: C.ink, letterSpacing: '-0.02em' }}>
        {dot && <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--accent, #FB5E09)', flexShrink: 0 }} />}
        {children}
      </h3>
      {right}
    </div>
  )
}

// ─── Primary button (rounded) ───────────────────────────────────────────────
// Fills with the active tool's accent (set as `--accent` on the dashboard
// content wrapper); falls back to brand orange anywhere the var isn't set.
export const primaryBtn: React.CSSProperties = {
  background: 'var(--accent, #FB5E09)', color: '#fff', border: 'none', height: 46, padding: '0 26px',
  borderRadius: 28, fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
  whiteSpace: 'nowrap', transition: 'opacity 0.15s, background 0.2s', letterSpacing: '-0.01em',
}

// ─── Search bar ─────────────────────────────────────────────────────────────
export function SearchBar({ value, onChange, onSubmit, placeholder, button = 'Search →', maxWidth = 560 }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void
  placeholder: string; button?: string; maxWidth?: number
}) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: C.paper, borderRadius: 100, border: `1px solid ${C.ash}`, maxWidth, overflow: 'hidden' }}>
        <span style={{ display: 'flex', paddingLeft: 18, color: 'var(--accent, #FB5E09)' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        </span>
        <input value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSubmit()}
          placeholder={placeholder}
          style={{ background: 'transparent', border: 'none', padding: '14px 16px', fontSize: 16, fontFamily: 'inherit', outline: 'none', flex: 1, color: C.ink, minWidth: 0 }} />
      </div>
      <button onClick={onSubmit} style={primaryBtn}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
        {button}
      </button>
    </div>
  )
}

// ─── Stat card ──────────────────────────────────────────────────────────────
// `accent` colours the value, the progress fill and the top cap. It defaults to
// the active tool's hue (`--accent`), so a tab's stat row reads in that tool's
// colour; pass an explicit colour for a semantic stat (e.g. C.danger).
export function StatCard({ label, value, sub, accent = 'var(--accent, #FB5E09)', pct, icon }: {
  label: string; value: string; sub?: string; accent?: string; pct?: number; icon?: React.ReactNode
}) {
  return (
    <div style={{ ...cardStyle, position: 'relative', padding: '18px 22px 20px', overflow: 'hidden' }}>
      {/* Accent cap — a thin coloured strip across the card top */}
      <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <p style={{ fontSize: 12, fontFamily: MONO, fontWeight: 500, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
        {icon && (
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'var(--accent-soft, rgba(251,94,9,0.10))', color: accent, flexShrink: 0, marginTop: -2 }}>{icon}</span>
        )}
      </div>
      <p style={{ fontSize: 36, fontWeight: 600, color: accent, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 13, color: C.graphite, marginTop: 7 }}>{sub}</p>}
      {typeof pct === 'number' && (
        <div style={{ height: 7, background: C.bone, borderRadius: 999, marginTop: 14, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.max(0, Math.min(pct, 100))}%`, background: accent, borderRadius: 999, transition: 'width 0.7s ease' }} />
        </div>
      )}
    </div>
  )
}

// ─── Competition / difficulty badge ─────────────────────────────────────────
// Green→amber→red: this is a data signal, so it uses the `D` data palette, not
// the brand's no-green chrome rule. Low competition is good news → green.
export function CompBadge({ level }: { level: 'Low' | 'Med' | 'High' }) {
  const { fg, bg } = compColor(level)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 13px', borderRadius: 100, fontSize: 12.5, fontWeight: 600, background: bg, color: fg, width: 'fit-content' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: fg }} />
      {level}
    </span>
  )
}

// ─── Tag pill (outlined — orange) ───────────────────────────────────────────
export function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 12.5, background: C.orangeFaint, color: C.orange, border: `1px solid ${C.orange}`, padding: '3px 12px', borderRadius: 100, fontFamily: MONO, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

// ─── Table primitives ───────────────────────────────────────────────────────
export const tableCard: React.CSSProperties = { ...cardStyle, overflow: 'hidden' }

export function tableHead(grid: string): React.CSSProperties {
  return { display: 'grid', gridTemplateColumns: grid, gap: 10, padding: '14px 20px', background: C.headerBg, borderBottom: `1px solid ${C.ash}` }
}
export const th: React.CSSProperties = {
  fontSize: 11.5, fontFamily: MONO, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.graphite,
}
export function tableRow(grid: string): React.CSSProperties {
  return { display: 'grid', gridTemplateColumns: grid, gap: 10, padding: '15px 20px', borderBottom: `1px solid ${C.hair}`, alignItems: 'center' }
}
export const tdMono: React.CSSProperties = { fontSize: 14.5, fontFamily: MONO, fontWeight: 500, color: C.ink }
export const tdTitle: React.CSSProperties = { fontSize: 15, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

// ─── Feedback blocks ────────────────────────────────────────────────────────
export function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div style={{ background: C.dangerBg, border: `1px solid ${C.danger}`, borderRadius: 12, padding: '15px 18px', color: C.danger, fontSize: 14.5 }}>⚠ {children}</div>
}
export function Loading({ label = 'Fetching from Etsy…' }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '34px 0', fontSize: 15, color: C.graphite }}>
      <span className="shimmer" style={{ width: 8, height: 8, borderRadius: '50%', background: C.orange }} />
      {label}
    </div>
  )
}
export function EmptyState({ icon = '🔎', title, sub }: { icon?: string; title: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 0', color: C.graphite }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <p style={{ fontSize: 17, fontWeight: 500, color: C.ink }}>{title}</p>
      {sub && <p style={{ fontSize: 14.5, color: C.graphite, marginTop: 6 }}>{sub}</p>}
    </div>
  )
}

// ─── Pagination (pills) ─────────────────────────────────────────────────────
export function Pagination({ page, pageCount, onChange, loading }: {
  page: number; pageCount: number; onChange: (p: number) => void; loading?: boolean
}) {
  if (pageCount <= 1) return null
  const start = Math.max(1, Math.min(page - 2, pageCount - 4))
  const end = Math.min(pageCount, start + 4)
  const pages: number[] = []
  for (let i = start; i <= end; i++) pages.push(i)

  const base: React.CSSProperties = {
    minWidth: 38, height: 38, padding: '0 12px', borderRadius: 100, fontSize: 14, fontFamily: MONO,
    cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: C.paper, border: `1px solid ${C.ash}`, color: C.ink, transition: 'all 0.12s',
  }
  const arrow = (disabled: boolean): React.CSSProperties => ({ ...base, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer' })

  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'center', justifyContent: 'center', marginTop: 22, opacity: loading ? 0.6 : 1 }}>
      <button style={arrow(page <= 1)} disabled={page <= 1 || loading} onClick={() => onChange(page - 1)}>‹</button>
      {start > 1 && <span style={{ color: C.stone, fontFamily: MONO, fontSize: 14 }}>…</span>}
      {pages.map(p => (
        <button key={p} onClick={() => onChange(p)} disabled={loading}
          style={{ ...base, ...(p === page ? { background: C.orange, border: `1px solid ${C.orange}`, color: '#fff' } : {}) }}>
          {p}
        </button>
      ))}
      {end < pageCount && <span style={{ color: C.stone, fontFamily: MONO, fontSize: 14 }}>…</span>}
      <button style={arrow(page >= pageCount)} disabled={page >= pageCount || loading} onClick={() => onChange(page + 1)}>›</button>
    </div>
  )
}
