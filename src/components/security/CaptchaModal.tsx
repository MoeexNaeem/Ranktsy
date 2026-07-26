'use client'
/**
 * Global reCAPTCHA modal shown when a user hits the hourly search limit. Mounted
 * once (in Providers); driven by the captchaController. Solving it returns the
 * token to the pending search request, which retries automatically.
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { C } from '@/utils'
import { Recaptcha } from './Recaptcha'
import { registerCaptchaModal } from './captchaController'

export function CaptchaModal() {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState(0)               // remount the widget each open
  const resolver = useRef<((t: string) => void) | null>(null)
  const rejecter = useRef<((r?: unknown) => void) | null>(null)

  useEffect(() => {
    registerCaptchaModal((resolve, reject) => {
      resolver.current = resolve
      rejecter.current = reject
      setKey(k => k + 1)
      setOpen(true)
    })
    return () => registerCaptchaModal(null)
  }, [])

  const close = useCallback(() => { setOpen(false); resolver.current = null; rejecter.current = null }, [])

  const onVerify = useCallback((token: string) => {
    resolver.current?.(token)
    close()
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
          You’ve run 25 searches this hour. Please confirm you’re human to keep searching.
        </p>
        <Recaptcha key={key} onVerify={onVerify} />
        <button onClick={onCancel}
          style={{ marginTop: 20, width: '100%', background: 'transparent', border: `1px solid ${C.ash}`, color: C.graphite, borderRadius: 10, padding: '10px', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
