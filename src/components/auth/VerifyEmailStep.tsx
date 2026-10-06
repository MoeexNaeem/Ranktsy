'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { C } from '@/utils'
import { toast } from '@/components/ui/toast'

/**
 * "Enter the 6-digit code we emailed you" - the last step of an email/password
 * signup (and of logging in to a new account that never confirmed its email).
 * The account opens, and the user is logged in, only after the right code.
 */
export function VerifyEmailStep({ email, redirect, initialCooldown = 60, codeSent = true, onBack }: {
  email: string
  redirect: string
  initialCooldown?: number
  codeSent?: boolean
  onBack: () => void
}) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState(codeSent ? '' : 'We couldn’t send the email just now. Press "Resend code".')
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(codeSent ? initialCooldown : 0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const verify = async (value = code) => {
    if (!/^\d{6}$/.test(value) || busy) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/auth/verify-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code: value }) })
      const json = await res.json().catch(() => ({}))
      if (!json.success) { setError(json.error ?? 'That code did not work. Please try again.'); setCode(''); inputRef.current?.focus(); return }
      toast.success('Email confirmed', 'Welcome to Rankkw! Let’s grow your Etsy shop.')
      router.push(redirect); router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    if (cooldown > 0) return
    setError('')
    try {
      const res = await fetch('/api/auth/send-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const json = await res.json().catch(() => ({}))
      if (!json.success) { setError(json.error ?? 'We couldn’t send the email. Please try again in a minute.'); return }
      setCooldown(json.cooldownSec ?? 60)
      toast.success('Code sent', `A new code is on its way to ${email}.`)
    } catch {
      setError('Network error. Please try again.')
    }
  }

  const ok = /^\d{6}$/.test(code)
  return (
    <div>
      <div style={{ background: C.canvas, borderRadius: 12, padding: '14px 16px', fontSize: 13.5, color: C.ink, lineHeight: 1.55, marginBottom: 18 }}>
        We sent a 6-digit code to <strong style={{ wordBreak: 'break-all' }}>{email}</strong>. Enter it below to open your account.
        <span style={{ display: 'block', color: '#6E6E64', fontSize: 12.5, marginTop: 6 }}>
          Can’t find it? Check your Spam or Promotions folder. The code works for 15 minutes.
        </span>
      </div>

      <label style={{ display: 'block', fontSize: 11, fontFamily: "'General Sans',monospace", fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6E6E64', marginBottom: 8 }}>
        Verification code
      </label>
      <input
        ref={inputRef}
        value={code}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        maxLength={6}
        onChange={e => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6)
          setCode(v); setError('')
          if (v.length === 6) void verify(v)   // pasting or typing the 6th digit submits
        }}
        onKeyDown={e => e.key === 'Enter' && verify()}
        style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${error ? '#D93025' : C.hair}`, borderRadius: 10, padding: '14px', fontSize: 26, letterSpacing: '0.5em', textAlign: 'center', fontFamily: "'General Sans',monospace", outline: 'none', background: C.canvas, color: '#1a1a1a' }}
      />
      {error && <p role="alert" style={{ fontSize: 12.5, color: '#D93025', marginTop: 8 }}>{error}</p>}

      <button onClick={() => verify()} disabled={!ok || busy}
        style={{ width: '100%', background: C.orange, color: '#fff', border: 'none', borderRadius: 28, padding: 14, fontSize: 15, fontWeight: 500, fontFamily: 'inherit', marginTop: 20, cursor: !ok || busy ? 'not-allowed' : 'pointer', opacity: !ok || busy ? 0.6 : 1 }}>
        {busy ? 'Checking…' : 'Confirm email →'}
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, gap: 12, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', padding: 0, color: C.ink, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          ← Use a different email
        </button>
        <button onClick={resend} disabled={cooldown > 0}
          style={{ background: 'none', border: 'none', padding: 0, color: cooldown > 0 ? '#999' : C.orange, fontSize: 13.5, fontWeight: 500, cursor: cooldown > 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </div>
  )
}
