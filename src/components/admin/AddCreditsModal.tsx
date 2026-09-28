'use client'
/**
 * Admin "Add Credits" dialog: grant a user a one-time pool of bonus credits valid
 * for N days, on top of their plan. The pool never resets daily, is spent only
 * after the day's plan credits run out, and disappears on its own when it expires.
 */
import { useState } from 'react'
import { C } from '@/utils'
import { MONO } from '@/components/dashboard/kit'
import { toast } from '@/components/ui/toast'

export interface BonusInfo { remaining: number; granted: number; expiresAt: string }

interface Props {
  user: { id: string; name: string; email: string; creditsLimit: number; bonus?: BonusInfo | null }
  onClose: () => void
  onSaved: () => void
}

const CREDIT_PRESETS = [50, 100, 250, 500]
const DAY_PRESETS = [3, 7, 15, 30]

const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
export const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))

export function AddCreditsModal({ user, onClose, onSaved }: Props) {
  const [credits, setCredits] = useState('100')
  const [days, setDays] = useState('7')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // When the dialog opened: a stable "now" for the expiry preview.
  const [openedAt] = useState(() => Date.now())

  const c = Math.floor(Number(credits))
  const d = Math.floor(Number(days))
  const valid = c >= 1 && c <= 100_000 && d >= 1 && d <= 365
  const until = valid ? new Date(openedAt + d * 86_400_000) : null
  const current = user.bonus ?? null

  const save = async () => {
    if (!valid || busy) return
    setBusy(true); setErr('')
    try {
      const r = await fetch(`/api/admin/users/${user.id}/credits`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credits: c, days: d }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok || !j?.success) { setErr(j?.error || 'Could not add credits. Please try again.'); return }
      toast.success('Credits added', `${c.toLocaleString('en-US')} bonus credits for ${user.email}, valid ${d} day${d === 1 ? '' : 's'}.`)
      onSaved(); onClose()
    } catch { setErr('Network error. Please try again.') } finally { setBusy(false) }
  }

  const remove = async () => {
    if (busy || !window.confirm(`Remove ${user.email}'s remaining bonus credits now?`)) return
    setBusy(true); setErr('')
    try {
      const r = await fetch(`/api/admin/users/${user.id}/credits`, { method: 'DELETE' })
      const j = await r.json().catch(() => null)
      if (!r.ok || !j?.success) { setErr(j?.error || 'Could not remove bonus credits.'); return }
      toast.success('Bonus credits removed', user.email)
      onSaved(); onClose()
    } catch { setErr('Network error. Please try again.') } finally { setBusy(false) }
  }

  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, fontFamily: MONO, color: C.ink, outline: 'none' }
  const chip = (on: boolean): React.CSSProperties => ({ background: on ? C.orangeFaint : 'transparent', border: `1px solid ${on ? C.orange : C.ash}`, color: on ? '#9A3A05' : C.graphite, borderRadius: 100, padding: '5px 11px', fontSize: 12, fontFamily: MONO, cursor: 'pointer' })
  const label: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: C.ink, marginBottom: 6 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,14,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 20 }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="add-credits-title" style={{ background: C.paper, borderRadius: 16, padding: '26px 28px', maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
        <h3 id="add-credits-title" style={{ fontSize: 18, fontWeight: 600, color: C.ink, marginBottom: 6 }}>Add bonus credits</h3>
        <p style={{ fontSize: 13, color: C.graphite, lineHeight: 1.55, marginBottom: 16 }}>
          For <strong style={{ color: C.ink }}>{user.name || user.email}</strong>. A one-time pool on top of their plan&apos;s {user.creditsLimit.toLocaleString('en-US')} daily credits. It does not reset, is used after the daily credits run out, and is removed automatically when it expires.
        </p>

        {current && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'rgba(46,125,70,0.08)', border: '1px solid rgba(46,125,70,0.35)', borderRadius: 10, padding: '9px 12px', marginBottom: 16 }}>
            <span style={{ fontSize: 12.5, fontFamily: MONO, color: '#1F6B3A' }}>
              Active: {current.remaining.toLocaleString('en-US')} of {current.granted.toLocaleString('en-US')} left · {daysLeft(current.expiresAt)}d left
            </span>
            <button onClick={remove} disabled={busy} style={{ background: 'transparent', border: 'none', color: C.danger, fontSize: 12.5, fontFamily: MONO, cursor: 'pointer', padding: 0 }}>Remove</button>
          </div>
        )}

        <label style={label} htmlFor="bonus-credits">Credits</label>
        <input id="bonus-credits" type="number" min={1} max={100000} value={credits} onChange={e => setCredits(e.target.value)} style={input} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0 16px' }}>
          {CREDIT_PRESETS.map(p => <button key={p} type="button" onClick={() => setCredits(String(p))} style={chip(c === p)}>+{p}</button>)}
        </div>

        <label style={label} htmlFor="bonus-days">Valid for (days)</label>
        <input id="bonus-days" type="number" min={1} max={365} value={days} onChange={e => setDays(e.target.value)} style={input} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0 14px' }}>
          {DAY_PRESETS.map(p => <button key={p} type="button" onClick={() => setDays(String(p))} style={chip(d === p)}>{p} days</button>)}
        </div>

        <p style={{ fontSize: 12.5, color: valid ? C.graphite : C.danger, fontFamily: MONO, lineHeight: 1.55, marginBottom: err ? 8 : 20 }}>
          {valid && until
            ? current
              ? `Adds ${c.toLocaleString('en-US')} to the active pool (${(current.remaining + c).toLocaleString('en-US')} total) and sets expiry to ${fmt(until)}.`
              : `${c.toLocaleString('en-US')} credits, expiring ${fmt(until)}.`
            : 'Enter 1 to 100,000 credits and 1 to 365 days.'}
        </p>
        {err && <p style={{ fontSize: 12.5, color: C.danger, marginBottom: 14 }}>{err}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${C.hairInk}`, color: C.ink, borderRadius: 100, padding: '9px 18px', fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={!valid || busy} style={{ background: C.orange, border: 'none', color: '#fff', borderRadius: 100, padding: '9px 18px', fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit', cursor: valid && !busy ? 'pointer' : 'not-allowed', opacity: valid && !busy ? 1 : 0.55 }}>
            {busy ? 'Saving…' : 'Add credits'}
          </button>
        </div>
      </div>
    </div>
  )
}
