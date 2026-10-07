'use client'
/**
 * Small shared admin UI: a spinner, calm buttons, and a promise-based confirm
 * dialog that stays open with a spinner while the action runs.
 *
 *   const { confirm, dialog } = useConfirm()
 *   await confirm({ title: 'Delete user?', body: …, tone: 'danger', confirmLabel: 'Delete',
 *                   action: async () => { …; return 'error text' to keep it open } })
 *   …render {dialog} once in the component.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { C } from '@/utils'

const RED = '#C2362B'

/** Heartbeat line loader (the one admin loader). Width sets the size; 4:3 ratio. */
export function Loader({ width = 64, color = '#ff4d4f', label = 'Loading' }: { width?: number; color?: string; label?: string }) {
  const pts = '0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24'
  return (
    <svg className="rk-pulse" role="img" aria-label={label} width={width} height={width * 0.75} viewBox="-2 -2 68 52" style={{ color }}>
      <polyline className="rk-pulse-back" points={pts} />
      <polyline className="rk-pulse-front" points={pts} />
    </svg>
  )
}

/** Small loader for buttons and rows (same heartbeat, sized to a line of text). */
export function Spinner({ size = 14, color = '#ff4d4f' }: { size?: number; color?: string; width?: number }) {
  return <Loader width={Math.round(size * 1.9)} color={color} />
}

/** A centered loader for areas still loading (no text, label is for screen readers). */
export function LoadingBlock({ label = 'Loading', height = 160 }: { label?: string; height?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader />
    </div>
  )
}

export type BtnTone = 'plain' | 'danger' | 'good' | 'warn' | 'primary' | 'dark'
/** Compact, consistent admin button style (8px radius, no pill shapes). */
export function adminBtn(tone: BtnTone = 'plain', size: 'sm' | 'md' = 'sm'): React.CSSProperties {
  const t = {
    plain: { bg: C.paper, fg: C.ink, bd: C.ash },
    danger: { bg: C.paper, fg: RED, bd: 'rgba(194,54,43,0.35)' },
    good: { bg: C.paper, fg: '#1F7A42', bd: 'rgba(31,122,66,0.35)' },
    warn: { bg: C.paper, fg: '#A15C07', bd: 'rgba(183,110,0,0.35)' },
    primary: { bg: C.orange, fg: '#fff', bd: C.orange },
    dark: { bg: C.ink, fg: '#fff', bd: C.ink },
  }[tone]
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    background: t.bg, color: t.fg, border: `1px solid ${t.bd}`, borderRadius: 8,
    padding: size === 'sm' ? '6px 11px' : '9px 16px', fontSize: size === 'sm' ? 12.5 : 13.5, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1.2,
  }
}

/** Admin stat card: coloured strip on top, neutral number.
 *  Same props as the dashboard kit's StatCard, which stays loud for the user tools. */
export function StatCard({ label, value, sub, accent = C.ink }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 16, padding: '18px 18px 18px' }}>
      <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <p style={{ fontSize: 11.5, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{label}</p>
      <p style={{ fontSize: 27, fontWeight: 650, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: C.stone, marginTop: 7 }}>{sub}</p>}
    </div>
  )
}

export interface ConfirmOptions {
  title: string
  body?: React.ReactNode
  confirmLabel?: string
  busyLabel?: string
  tone?: 'danger' | 'primary'
  /** Runs while the dialog shows a spinner. Return a string to show it as an error and stay open. */
  action?: () => Promise<void | string | null | undefined>
}

export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>(resolve => {
    resolver.current = resolve
    setError(''); setBusy(false); setOpts(o)
  }), [])

  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok); resolver.current = null
    setOpts(null); setBusy(false); setError('')
  }, [])

  const run = useCallback(async () => {
    if (!opts) return
    if (!opts.action) { close(true); return }
    setBusy(true); setError('')
    try {
      const err = await opts.action()
      if (typeof err === 'string' && err) { setError(err); setBusy(false); return }
      close(true)
    } catch { setError('Something went wrong. Please try again.'); setBusy(false) }
  }, [opts, close])

  useEffect(() => {
    if (!opts) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) close(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [opts, busy, close])

  const dialog = opts ? (
    <ModalShell onClose={() => !busy && close(false)}>
      <h3 style={{ fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: 8, letterSpacing: '-0.01em' }}>{opts.title}</h3>
      {opts.body && <div style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.6 }}>{opts.body}</div>}
      {error && <p role="alert" style={{ fontSize: 13, color: RED, marginTop: 12 }}>{error}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button onClick={() => close(false)} disabled={busy} style={{ ...adminBtn('plain', 'md'), opacity: busy ? 0.5 : 1 }}>Cancel</button>
        <button onClick={run} disabled={busy} autoFocus
          style={{ ...adminBtn('primary', 'md'), ...(opts.tone === 'danger' ? { background: RED, borderColor: RED } : {}), cursor: busy ? 'wait' : 'pointer', minWidth: 110 }}>
          {busy ? <Spinner size={13} color="#fff" /> : (opts.confirmLabel ?? 'Confirm')}
        </button>
      </div>
    </ModalShell>
  ) : null

  return { confirm, dialog }
}

/** Centered modal frame used by the confirm dialog and custom admin dialogs. */
export function ModalShell({ children, onClose, width = 440 }: { children: React.ReactNode; onClose: () => void; width?: number }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,14,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 20 }}>
      <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
        style={{ background: C.paper, borderRadius: 14, padding: '22px 24px', maxWidth: width, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.22)', border: `1px solid ${C.ash}` }}>
        {children}
      </div>
    </div>
  )
}
