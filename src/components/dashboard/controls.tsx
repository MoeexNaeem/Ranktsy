'use client'
/**
 * Table + panel controls shared by the Keyword Tool surfaces:
 * star, checkbox, dropdown, toggle, column picker, CSV export.
 */
import React, { useEffect, useRef, useState } from 'react'
import { C, D } from '@/utils'
import { MONO } from './kit'

// ─── Star (favourite) ────────────────────────────────────────────────────────
export function Star({ on, onClick, size = 15 }: { on: boolean; onClick: () => void; size?: number }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      title={on ? 'Remove from Favorites' : 'Save to Favorites'}
      aria-label={on ? 'Remove from Favorites' : 'Save to Favorites'}
      aria-pressed={on}
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', lineHeight: 0, color: on ? '#E8A32B' : C.stone }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  )
}

// ─── Checkbox ────────────────────────────────────────────────────────────────
// The mark is a plain <span> so it can sit inside a parent <button> (as in
// PopItem) without nesting buttons — which is invalid HTML, and swallows the
// parent's click.
export function CheckMark({ on, indeterminate }: { on: boolean; indeterminate?: boolean }) {
  const active = on || indeterminate
  return (
    <span
      aria-hidden="true"
      style={{
        width: 17, height: 17, borderRadius: 5, flexShrink: 0,
        border: `1.5px solid ${active ? C.orange : C.lightGray}`,
        background: active ? C.orange : C.paper,
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s',
      }}>
      {indeterminate
        ? <span style={{ width: 8, height: 2, background: '#fff', borderRadius: 1 }} />
        : on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
    </span>
  )
}

/** Standalone, clickable checkbox. Don't nest this inside another button. */
export function Check({ on, onChange, indeterminate }: { on: boolean; onChange: () => void; indeterminate?: boolean }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange() }}
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : on}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
      <CheckMark on={on} indeterminate={indeterminate} />
    </button>
  )
}

// ─── Popover shell (click-outside + Esc to dismiss) ──────────────────────────
export function Popover({ label, children, width = 230 }: { label: React.ReactNode; children: React.ReactNode; width?: number }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ ...ctrlBtn, borderColor: open ? C.orange : C.ash, color: open ? C.orange : C.ink }}>
        {label}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 40, width,
          background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 12, padding: 8,
          boxShadow: '0 8px 28px rgba(61,62,59,0.13)', maxHeight: 320, overflowY: 'auto',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

export const ctrlBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: '0 15px',
  borderRadius: 100, border: `1px solid ${C.ash}`, background: C.paper, color: C.ink,
  fontSize: 13.5, fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer',
  whiteSpace: 'nowrap', transition: 'border-color 0.12s, color 0.12s',
}

export function PopItem({ on, label, onClick, disabled }: { on?: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px',
        borderRadius: 8, border: 'none', background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13.5, fontFamily: 'inherit', color: disabled ? C.stone : C.ink, textAlign: 'left',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = C.canvas }}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {on !== undefined && <CheckMark on={on} />}
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  )
}

// ─── Segmented toggle ────────────────────────────────────────────────────────
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
      <span style={{ width: 36, height: 21, borderRadius: 100, background: on ? C.orange : C.lightGray, position: 'relative', transition: 'background 0.16s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 2.5, left: on ? 17.5 : 2.5, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.16s' }} />
      </span>
      <span style={{ fontSize: 13.5, color: C.ink, whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

// ─── CSV export ──────────────────────────────────────────────────────────────
/** Quote every field — keywords legitimately contain commas and quotes. */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\r\n')
}

/** Filesystem-safe filename stem — keywords contain spaces, slashes and quotes. */
export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'export'
}

export function downloadCsv(filename: string, csv: string) {
  // \uFEFF (written as an escape, not a literal invisible character) so Excel
  // reads UTF-8 keywords — accents, emoji — instead of mojibake.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ExportBtn({ onClick, count }: { onClick: () => void; count?: number }) {
  return (
    <button onClick={onClick} style={ctrlBtn}
      onMouseEnter={e => (e.currentTarget.style.borderColor = C.orange)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = C.ash)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Export{count ? ` (${count})` : ''}
    </button>
  )
}

// ─── Heat pill — the shared green→amber→red data chip ────────────────────────
export function HeatPill({ score, label }: { score: number; label?: string }) {
  const fg = score < 20 ? D.good : score < 40 ? D.fair : score < 60 ? D.mid : score < 80 ? D.warm : D.hard
  const bg = score < 20 ? D.goodBg : score < 40 ? D.fairBg : score < 60 ? D.midBg : score < 80 ? D.warmBg : D.hardBg
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 100, fontSize: 13, fontWeight: 600, fontFamily: MONO, background: bg, color: fg, width: 'fit-content' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: fg, flexShrink: 0 }} />
      {label ?? score}
    </span>
  )
}
