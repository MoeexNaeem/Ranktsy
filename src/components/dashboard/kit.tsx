'use client'
/**
 * Shared dashboard UI kit — Huddle editorial language.
 * Flat surfaces, crisp 1px hairline borders (no shadows), pill buttons,
 * light headings, the orange Ranktsy accent. Purely presentational.
 */
import React from 'react'
import { C } from '@/utils'

export const MONO = "'IBM Plex Mono', monospace"

// ─── Base surfaces (flat, hairline) ─────────────────────────────────────────
export const cardStyle: React.CSSProperties = {
  background: C.paper,
  border: `1px solid ${C.hairInk}`,
  borderRadius: 8,
}

export function Card({ children, style, pad = 18 }: {
  children: React.ReactNode; style?: React.CSSProperties; pad?: number | string
}) {
  return <div style={{ ...cardStyle, padding: pad, ...style }}>{children}</div>
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <h3 style={{ fontSize: 15, fontWeight: 500, color: C.ink, letterSpacing: '-0.3px' }}>{children}</h3>
      {right}
    </div>
  )
}

// ─── Primary button (fully-rounded pill — Huddle) ───────────────────────────
export const primaryBtn: React.CSSProperties = {
  background: C.orange, color: '#fff', border: 'none', height: 42, padding: '0 24px',
  borderRadius: 1000, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
  whiteSpace: 'nowrap', transition: 'opacity 0.15s', letterSpacing: '-0.01em',
}

// ─── Search bar ─────────────────────────────────────────────────────────────
export function SearchBar({ value, onChange, onSubmit, placeholder, button = 'Search →', maxWidth = 520 }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void
  placeholder: string; button?: string; maxWidth?: number
}) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: C.paper, borderRadius: 100, border: `1px solid ${C.hair}`, maxWidth, overflow: 'hidden' }}>
        <span style={{ display: 'flex', paddingLeft: 16, color: '#a9a79f' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        </span>
        <input value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSubmit()}
          placeholder={placeholder}
          style={{ background: 'transparent', border: 'none', padding: '11px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', flex: 1, color: '#1a1a1a', minWidth: 0 }} />
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
export function StatCard({ label, value, sub, accent = C.ink, pct }: {
  label: string; value: string; sub?: string; accent?: string; pct?: number
}) {
  return (
    <Card pad="16px 18px">
      <p style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 400, color: accent, letterSpacing: '-0.8px', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11.5, color: '#a3a29a', marginTop: 5 }}>{sub}</p>}
      {typeof pct === 'number' && (
        <div style={{ height: 4, background: C.bone, borderRadius: 999, marginTop: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.max(0, Math.min(pct, 100))}%`, background: accent, borderRadius: 999, transition: 'width 0.7s ease' }} />
        </div>
      )}
    </Card>
  )
}

// ─── Competition / difficulty badge (semantic colors) ───────────────────────
const COMP: Record<string, { bg: string; color: string }> = {
  Low:  { bg: C.successBg, color: C.success },
  Med:  { bg: C.warnBg,    color: C.warn },
  High: { bg: C.dangerBg,  color: C.danger },
}
export function CompBadge({ level }: { level: 'Low' | 'Med' | 'High' }) {
  const s = COMP[level] ?? COMP.Med
  return (
    <span style={{ display: 'inline-flex', padding: '2px 11px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: s.bg, color: s.color, width: 'fit-content' }}>
      {level}
    </span>
  )
}

// ─── Tag pill (outlined — Huddle) ───────────────────────────────────────────
export function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, background: 'transparent', color: C.orange, border: `1px solid ${C.orange}`, padding: '2px 9px', borderRadius: 100, fontFamily: MONO, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

// ─── Table primitives ───────────────────────────────────────────────────────
export const tableCard: React.CSSProperties = { ...cardStyle, overflow: 'hidden' }

export function tableHead(grid: string): React.CSSProperties {
  return { display: 'grid', gridTemplateColumns: grid, gap: 8, padding: '10px 16px', background: C.bone, borderBottom: `1px solid ${C.hairInk}` }
}
export const th: React.CSSProperties = {
  fontSize: 9.5, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#808080',
}
export function tableRow(grid: string): React.CSSProperties {
  return { display: 'grid', gridTemplateColumns: grid, gap: 8, padding: '10px 16px', borderBottom: `1px solid ${C.hair}`, alignItems: 'center' }
}
export const tdMono: React.CSSProperties = { fontSize: 11.5, fontFamily: MONO, color: '#3a4444' }
export const tdTitle: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

// ─── Feedback blocks ────────────────────────────────────────────────────────
export function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div style={{ background: C.dangerBg, border: `1px solid ${C.danger}`, borderRadius: 8, padding: '13px 16px', color: C.danger, fontSize: 13 }}>⚠ {children}</div>
}
export function Loading({ label = 'Fetching from Etsy…' }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '28px 0', fontSize: 13, color: '#3a4444' }}>
      <span className="shimmer" style={{ width: 7, height: 7, borderRadius: '50%', background: C.orange }} />
      {label}
    </div>
  )
}
export function EmptyState({ icon = '🔎', title, sub }: { icon?: string; title: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: '#a9a79f' }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>{icon}</div>
      <p style={{ fontSize: 15, fontWeight: 500, color: C.ink }}>{title}</p>
      {sub && <p style={{ fontSize: 13, color: '#a3a29a', marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

// ─── Pagination (Huddle pills) ──────────────────────────────────────────────
export function Pagination({ page, pageCount, onChange, loading }: {
  page: number; pageCount: number; onChange: (p: number) => void; loading?: boolean
}) {
  if (pageCount <= 1) return null
  const start = Math.max(1, Math.min(page - 2, pageCount - 4))
  const end = Math.min(pageCount, start + 4)
  const pages: number[] = []
  for (let i = start; i <= end; i++) pages.push(i)

  const base: React.CSSProperties = {
    minWidth: 34, height: 34, padding: '0 10px', borderRadius: 100, fontSize: 13, fontFamily: MONO,
    cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: C.paper, border: `1px solid ${C.hair}`, color: '#3a4444', transition: 'all 0.12s',
  }
  const arrow = (disabled: boolean): React.CSSProperties => ({ ...base, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer' })

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: 18, opacity: loading ? 0.6 : 1 }}>
      <button style={arrow(page <= 1)} disabled={page <= 1 || loading} onClick={() => onChange(page - 1)}>‹</button>
      {start > 1 && <span style={{ color: '#b0b0a8', fontFamily: MONO, fontSize: 13 }}>…</span>}
      {pages.map(p => (
        <button key={p} onClick={() => onChange(p)} disabled={loading}
          style={{ ...base, ...(p === page ? { background: C.orange, border: `1px solid ${C.orange}`, color: '#fff' } : {}) }}>
          {p}
        </button>
      ))}
      {end < pageCount && <span style={{ color: '#b0b0a8', fontFamily: MONO, fontSize: 13 }}>…</span>}
      <button style={arrow(page >= pageCount)} disabled={page >= pageCount || loading} onClick={() => onChange(page + 1)}>›</button>
    </div>
  )
}
