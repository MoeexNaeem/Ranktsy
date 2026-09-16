'use client'

/**
 * App-wide toasts, built on goey-toast (morphing blob toasts; Sonner + framer-motion
 * under the hood). <AppToaster /> is mounted once in the root layout.
 *
 *   toast.success('Saved', 'Your changes are live.')
 *   toast.error('Upload failed', 'Please try again.')
 *   toast.info / toast.warning / toast.promise(p, {...})
 *   toast.copied('Tags')                       - quick "Copied" confirmation
 *   pushToast({ title, body, link, onClick })  - notification toast with a "View" action
 *   errorToast(title, body)                    - red error toast
 *
 * Import from here, never from 'goey-toast' directly, so the look stays consistent.
 */

import { useEffect } from 'react'
import { GooeyToaster, gooeyToast, type GooeyPromiseData } from 'goey-toast'
import 'goey-toast/styles.css'

/** sessionStorage flag set before an OAuth redirect, read after the round-trip. */
export const AUTH_TOAST_KEY = 'rk_auth_toast'

export function AppToaster() {
  // A full-page OAuth sign-in lands here fresh; greet the user once. If the provider
  // bounced back with ?error=, the login form shows that error toast instead.
  useEffect(() => {
    let flag: string | null = null
    try { flag = sessionStorage.getItem(AUTH_TOAST_KEY); sessionStorage.removeItem(AUTH_TOAST_KEY) } catch { return }
    if (flag !== 'oauth') return
    if (new URLSearchParams(window.location.search).has('error')) return
    // Not cleared on cleanup: the flag is already consumed, so a StrictMode re-run can't repeat it.
    setTimeout(() => gooeyToast.success('Welcome!', { description: 'You are signed in to Rankkw.' }), 400)
  }, [])

  return (
    <GooeyToaster
      position="top-right"
      preset="smooth"
      gap={12}
      offset="24px"
      closeOnEscape
      showTimestamp={false}
      maxQueue={6}
    />
  )
}

export interface ToastOpts {
  title: string
  body?: string | null
  link?: string | null
  onClick?: () => void
  kind?: 'info' | 'success' | 'error' | 'warning' | 'default'
  duration?: number
  actionLabel?: string
}

/** Notification-style toast. When it has a link/onClick, a "View" action button is shown. */
export function pushToast(o: ToastOpts): string | number {
  const kind = o.kind ?? 'info'
  const clickable = !!(o.link || o.onClick)
  const opts = {
    description: o.body || undefined,
    duration: o.duration ?? (kind === 'error' ? 7000 : 6000),
    action: clickable ? {
      label: o.actionLabel ?? 'View',
      onClick: () => {
        if (o.onClick) o.onClick()
        if (o.link) window.location.assign(o.link)
      },
    } : undefined,
  }
  return kind === 'default' ? gooeyToast(o.title, opts) : gooeyToast[kind](o.title, opts)
}

/** Red error toast with a title + description. Use instead of a raw red box. */
export function errorToast(title: string, body?: string): string | number {
  return pushToast({ title, body, kind: 'error' })
}

const desc = (body?: string | null) => (body ? { description: body } : undefined)

export const toast = {
  show:    (title: string, body?: string | null) => gooeyToast(title, desc(body)),
  success: (title: string, body?: string | null) => gooeyToast.success(title, desc(body)),
  error:   (title: string, body?: string | null) => gooeyToast.error(title, { ...desc(body), duration: 7000 }),
  info:    (title: string, body?: string | null) => gooeyToast.info(title, desc(body)),
  warning: (title: string, body?: string | null) => gooeyToast.warning(title, desc(body)),
  promise: <T,>(p: Promise<T>, data: GooeyPromiseData<T>) => gooeyToast.promise(p, data),
  dismiss: gooeyToast.dismiss,
  /** Short confirmation after a clipboard copy. */
  copied:  (what = 'Text') => gooeyToast.success(`${what} copied`, { duration: 1800 }),
}

/** Copy text to the clipboard and confirm with a toast (or an error toast on failure). */
export function copyWithToast(text: string, what = 'Text') {
  if (!navigator.clipboard) { toast.error('Copy failed', 'Your browser blocked clipboard access.'); return }
  navigator.clipboard.writeText(text).then(
    () => { toast.copied(what) },
    () => { toast.error('Copy failed', 'Your browser blocked clipboard access.') },
  )
}
