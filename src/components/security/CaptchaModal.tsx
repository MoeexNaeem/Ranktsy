'use client'
/**
 * Global "I'm not a robot" check, shown every 25 new searches. Mounted once (in
 * Providers); driven by the captchaController. The solved token is verified by
 * the server before the modal closes, then the waiting searches continue.
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { C } from '@/utils'
import { Recaptcha } from './Recaptcha'
import { registerCaptchaModal, submitCaptcha } from './captchaController'

export function CaptchaModal() {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState(0)               // remount the widget each open / retry
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const resolver = useRef<((t: string) => void) | null>(null)
  const rejecter = useRef<((r?: unknown) => void) | null>(null)

  useEffect(() => {
    registerCaptchaModal((resolve, reject) => {
      resolver.current = resolve
      rejecter.current = reject
      setError('')
      setBusy(false)
      setKey(k => k + 1)
      setOpen(true)
    })
    return () => registerCaptchaModal(null)
  }, [])

  const close = useCallback(() => { setOpen(false); resolver.current = null; rejecter.current = null }, [])

  const onVerify = useCallback(async (token: string) => {
    setBusy(true)
    setError('')
    try {
      await submitCaptcha(token)
      resolver.current?.(token)
      close()
    } catch (e) {
      // Tokens are single-use: show a fresh widget to try again.
      setError(e instanceof Error ? e.message : 'Verification failed. Please try again.')
      setKey(k => k + 1)
    } finally {
      setBusy(false)
    }
  }, [close])

  const onCancel = useCallback(() => {
    rejecter.current?.(new Error('cancelled'))
    close()
  }, [close])

  if (!open) return null

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(17,24,39,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.paper, borderRadius: 16, padding: '28px 26px', maxWidth: 400, width: '100%', border: `1px solid ${C.ash}`, boxShadow: '0 20px 60px rgba(17,24,39,0.25)' }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: C.ink, marginBottom: 8 }}>Quick check to continue</h3>
        <p style={{ fontSize: 14, color: C.graphite, lineHeight: 1.5, marginBottom: 20 }}>
          Every 25 searches we ask you to confirm you&apos;re human. Your search continues as soon as you do.
        </p>
        <Recaptcha key={key} onVerify={token => { void onVerify(token) }} />
        {busy && <p style={{ fontSize: 13, color: C.graphite, marginTop: 12 }}>Checking…</p>}
        {error && <p style={{ fontSize: 13, color: '#B91C1C', marginTop: 12 }}>{error}</p>}
        <button onClick={onCancel}
          style={{ marginTop: 20, width: '100%', background: 'transparent', border: `1px solid ${C.ash}`, color: C.graphite, borderRadius: 10, padding: '10px', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
