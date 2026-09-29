'use client'
/**
 * Google reCAPTCHA v2 ("I'm not a robot") checkbox widget.
 *
 * Renders nothing when NEXT_PUBLIC_RECAPTCHA_SITE_KEY is absent, so forms keep
 * working in dev / before keys are added. Loads the reCAPTCHA script once and
 * renders explicitly so it plays nicely with React.
 *
 * Built to never leave an empty box: it shows "Loading the check…" at once,
 * loads the script from google.com and falls back to Google's recaptcha.net
 * mirror (for networks where google.com is blocked or slow), and if neither
 * arrives within the timeout it says so with a "Try again" button instead of
 * waiting forever.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? ''
/** Whether the widget is live - callers use this to require a token before submit. */
export const RECAPTCHA_ENABLED = !!SITE_KEY

interface Grecaptcha {
  render: (el: HTMLElement, opts: {
    sitekey: string
    callback: (token: string) => void
    'expired-callback'?: () => void
    'error-callback'?: () => void
  }) => number
  reset: (id?: number) => void
  ready?: (cb: () => void) => void
}
declare global { interface Window { grecaptcha?: Grecaptcha } }

const SOURCES = [
  'https://www.google.com/recaptcha/api.js?render=explicit',
  'https://www.recaptcha.net/recaptcha/api.js?render=explicit',
]
const LOAD_TIMEOUT_MS = 12_000

/** Resolves once `grecaptcha.render` is usable; rejects if it never becomes usable. */
function waitForRender(timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      if (window.grecaptcha?.render) { resolve(); return }
      if (Date.now() - start > timeoutMs) { reject(new Error('reCAPTCHA did not load')); return }
      setTimeout(tick, 150)
    }
    tick()
  })
}

function injectScript(src: string): void {
  if (document.querySelector(`script[src="${src}"]`)) return
  const s = document.createElement('script')
  s.src = src
  s.async = true
  s.defer = true
  document.head.appendChild(s)
}

let scriptPromise: Promise<void> | null = null
/** Load the script (google.com, then the recaptcha.net mirror). Retryable after a failure. */
function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.grecaptcha?.render) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = (async () => {
    for (const src of SOURCES) {
      injectScript(src)
      try { await waitForRender(LOAD_TIMEOUT_MS / SOURCES.length); return } catch { /* try the next source */ }
    }
    throw new Error('reCAPTCHA did not load')
  })()
  scriptPromise.catch(() => { scriptPromise = null })   // allow "Try again"
  return scriptPromise
}

export function Recaptcha({ onVerify, onExpire }: { onVerify: (token: string) => void; onExpire?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<number | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [attempt, setAttempt] = useState(0)

  // Latest callbacks in refs: the widget is rendered once, and a parent re-render
  // (new inline callback) must not tear it down or re-run the loader.
  const verifyRef = useRef(onVerify)
  const expireRef = useRef(onExpire)
  useEffect(() => { verifyRef.current = onVerify; expireRef.current = onExpire }, [onVerify, onExpire])

  useEffect(() => {
    if (!SITE_KEY) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || widgetId.current !== null || !ref.current) return
        const g = window.grecaptcha!
        const doRender = () => {
          if (cancelled || widgetId.current !== null || !ref.current) return
          try {
            widgetId.current = g.render(ref.current, {
              sitekey: SITE_KEY,
              callback: t => verifyRef.current(t),
              'expired-callback': () => expireRef.current?.(),
              'error-callback': () => expireRef.current?.(),
            })
            setStatus('ready')
          } catch {
            // Already rendered into this element (fast re-mount): it is showing.
            setStatus('ready')
          }
        }
        if (g.ready) g.ready(doRender); else doRender()
      })
      .catch(() => { if (!cancelled) setStatus('failed') })
    return () => { cancelled = true }
  }, [attempt])

  const retry = useCallback(() => {
    widgetId.current = null
    if (ref.current) ref.current.innerHTML = ''
    setStatus('loading')
    setAttempt(a => a + 1)
  }, [])

  if (!SITE_KEY) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div ref={ref} style={{ display: 'flex', justifyContent: 'center', minHeight: status === 'ready' ? 78 : 0 }} />
      {status === 'loading' && (
        <div style={{ width: 304, maxWidth: '100%', height: 78, borderRadius: 4, border: '1px solid #d3d3d3', background: '#f9f9f9',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#555', fontFamily: 'inherit' }}>
          Loading the check…
        </div>
      )}
      {status === 'failed' && (
        <div style={{ width: 304, maxWidth: '100%', borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', padding: '12px 14px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#991B1B', margin: '0 0 8px', lineHeight: 1.45 }}>
            The &ldquo;I&apos;m not a robot&rdquo; check couldn&apos;t load. Check your internet connection, or turn off an ad blocker or VPN for rankkw.com.
          </p>
          <button type="button" onClick={retry}
            style={{ height: 32, padding: '0 16px', borderRadius: 100, border: 'none', background: '#B91C1C', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
