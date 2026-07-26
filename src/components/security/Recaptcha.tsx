'use client'
/**
 * Google reCAPTCHA v2 ("I'm not a robot") checkbox widget.
 *
 * Renders nothing when NEXT_PUBLIC_RECAPTCHA_SITE_KEY is absent, so forms keep
 * working in dev / before keys are added. Loads the reCAPTCHA script once and
 * renders explicitly so it plays nicely with React.
 */
import { useEffect, useRef } from 'react'

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? ''
/** Whether the widget is live — callers use this to require a token before submit. */
export const RECAPTCHA_ENABLED = !!SITE_KEY

interface Grecaptcha {
  render: (el: HTMLElement, opts: {
    sitekey: string
    callback: (token: string) => void
    'expired-callback'?: () => void
    'error-callback'?: () => void
  }) => number
  reset: (id?: number) => void
}
declare global { interface Window { grecaptcha?: Grecaptcha } }

let scriptPromise: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.grecaptcha?.render) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>(resolve => {
    const s = document.createElement('script')
    s.src = 'https://www.google.com/recaptcha/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    document.head.appendChild(s)
  })
  return scriptPromise
}

export function Recaptcha({ onVerify, onExpire }: { onVerify: (token: string) => void; onExpire?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<number | null>(null)

  useEffect(() => {
    if (!SITE_KEY) return
    let cancelled = false
    loadScript().then(() => {
      const render = () => {
        if (cancelled || widgetId.current !== null) return
        const g = window.grecaptcha
        if (!g?.render || !ref.current) { setTimeout(render, 120); return }
        try {
          widgetId.current = g.render(ref.current, {
            sitekey: SITE_KEY,
            callback: onVerify,
            'expired-callback': () => onExpire?.(),
            'error-callback': () => onExpire?.(),
          })
        } catch { /* already rendered */ }
      }
      render()
    })
    return () => { cancelled = true }
  }, [onVerify, onExpire])

  if (!SITE_KEY) return null
  return <div ref={ref} style={{ display: 'flex', justifyContent: 'center' }} />
}
