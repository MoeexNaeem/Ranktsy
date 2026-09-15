'use client'

/**
 * App-wide toast helpers, built on the react-hot-toast <Toaster> already mounted
 * in layout.tsx (so no extra dependency, and nothing heavy loads on every page).
 *
 *   pushToast({ title, body, link })   - a clickable notification/message toast
 *   errorToast(title, body)            - a red error toast (replaces the ugly boxes)
 *
 * Clicking the toast follows `link` (or runs `onClick`) and dismisses it.
 */

import toast from 'react-hot-toast'
import { C } from '@/utils'

export interface ToastOpts {
  title: string
  body?: string | null
  link?: string | null
  onClick?: () => void
  kind?: 'info' | 'success' | 'error'
  duration?: number
}

export function pushToast(o: ToastOpts): string {
  const accent = o.kind === 'error' ? '#CF463A' : o.kind === 'success' ? '#16A34A' : C.orange
  const clickable = !!(o.link || o.onClick)
  return toast.custom((t) => (
    <div
      role="alert"
      onClick={() => {
        if (o.onClick) o.onClick()
        if (o.link) window.location.assign(o.link)
        toast.dismiss(t.id)
      }}
      style={{
        pointerEvents: 'auto', cursor: clickable ? 'pointer' : 'default',
        maxWidth: 380, width: 'min(380px, 92vw)', boxSizing: 'border-box',
        background: '#fff', color: C.ink, border: `1px solid ${C.hair}`, borderLeft: `4px solid ${accent}`,
        borderRadius: 12, boxShadow: '0 12px 40px rgba(20,18,14,0.18)', padding: '12px 14px',
        display: 'flex', gap: 10, alignItems: 'flex-start',
        opacity: t.visible ? 1 : 0, transform: t.visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity .18s ease, transform .18s ease',
        fontFamily: 'General Sans, system-ui, sans-serif',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0, lineHeight: 1.35 }}>{o.title}</p>
        {o.body && <p style={{ fontSize: 12.5, color: C.graphite, margin: '3px 0 0', lineHeight: 1.5, wordBreak: 'break-word' }}>{o.body}</p>}
        {clickable && <p style={{ fontSize: 11.5, color: accent, margin: '6px 0 0', fontWeight: 700 }}>View →</p>}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id) }}
        aria-label="Dismiss"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.stone, fontSize: 17, lineHeight: 1, padding: 0, flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  ), { duration: o.duration ?? (o.kind === 'error' ? 7000 : 6000) })
}

/** Red error toast with a title + description. Use instead of a raw red box. */
export function errorToast(title: string, body?: string): string {
  return pushToast({ title, body, kind: 'error' })
}
