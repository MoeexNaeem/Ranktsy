'use client'
/**
 * Admin Settings: Maintenance mode switch. While ON, every visitor except admins
 * sees the "We are updating Rankkw" page, all non-admin API calls get 503, and
 * the Etsy-spending crons pause (src/proxy.ts), so the Etsy/Google quotas can
 * recover while fixes are deployed. Admins keep full access to test.
 */
import { useCallback, useEffect, useState } from 'react'
import { C } from '@/utils'
import { MONO, tableCard } from '@/components/dashboard/kit'
import { toast } from '@/components/ui/toast'

interface State { on: boolean; message: string; since: string | null; by: string | null }

export function AdminMaintenance() {
  const [state, setState] = useState<State | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/maintenance', { cache: 'no-store' })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.success) { setState(j.data); setMessage(j.data.message) }
    } catch { /* leave as loading */ }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  const apply = useCallback(async (on: boolean) => {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/maintenance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on, message }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok || !j?.success) { toast.error('Could not change maintenance mode', j?.error || 'Please try again.'); return }
      setState(j.data); setMessage(j.data.message); setConfirm(false)
      if (on) toast.info('Maintenance mode ON', 'Visitors now see the update page. You (admin) still have full access.')
      else toast.success('Maintenance mode OFF', 'Rankkw is open to everyone again.')
    } catch { toast.error('Could not change maintenance mode', 'Network error. Please try again.') }
    finally { setBusy(false) }
  }, [message])

  const on = !!state?.on
  const since = state?.since ? new Date(state.since).toLocaleString() : null

  return (
    <div style={{ ...tableCard, padding: '20px 24px', maxWidth: 640, borderColor: on ? C.danger : C.ash, background: on ? 'rgba(207,70,58,0.05)' : C.paper }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.ink, margin: '0 0 6px' }}>Maintenance mode</h3>
          <p style={{ fontSize: 13, color: C.graphite, lineHeight: 1.6, margin: 0 }}>
            Takes Rankkw offline for everyone except admins. Visitors and the browser extension see an &ldquo;updating&rdquo; page,
            no Etsy or Google calls are made for them, and the Etsy data crons pause so the API quota can recover.
            Payments keep working and you stay signed in to test.
          </p>
          {on && (
            <p style={{ fontSize: 12.5, color: C.danger, fontFamily: MONO, fontWeight: 600, margin: '10px 0 0' }}>
              ON{since ? ` since ${since}` : ''}{state?.by ? ` · by ${state.by}` : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => (on ? apply(false) : setConfirm(true))}
          disabled={busy || !state}
          role="switch" aria-checked={on} aria-label="Maintenance mode"
          title={on ? 'Turn off: reopen the site' : 'Turn on: close the site to non-admins'}
          style={{ position: 'relative', width: 58, height: 32, borderRadius: 100, border: 'none', cursor: busy ? 'wait' : 'pointer', background: on ? C.danger : C.ash, transition: 'background 0.18s', opacity: busy || !state ? 0.6 : 1, flexShrink: 0 }}>
          <span style={{ position: 'absolute', top: 3, left: on ? 29 : 3, width: 26, height: 26, borderRadius: '50%', background: '#fff', transition: 'left 0.18s', boxShadow: '0 2px 5px rgba(0,0,0,0.25)' }} />
        </button>
      </div>

      <label htmlFor="maint-msg" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: C.ink, margin: '16px 0 6px' }}>Message shown to visitors</label>
      <textarea id="maint-msg" value={message} onChange={e => setMessage(e.target.value)} rows={3} maxLength={600}
        style={{ width: '100%', boxSizing: 'border-box', background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 10, padding: '10px 12px', fontSize: 13.5, color: C.ink, fontFamily: 'inherit', lineHeight: 1.55, resize: 'vertical', outline: 'none' }} />
      {on && (
        <button onClick={() => apply(true)} disabled={busy} style={{ marginTop: 10, background: 'transparent', border: `1px solid ${C.hairInk}`, color: C.ink, borderRadius: 100, padding: '7px 16px', fontSize: 12.5, cursor: 'pointer' }}>
          Update message
        </button>
      )}

      {confirm && (
        <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 12, background: 'rgba(207,70,58,0.08)', border: `1px solid ${C.danger}55` }}>
          <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.55, margin: '0 0 12px' }}>
            Close Rankkw for all users now? Everyone except admins will see the update page until you turn this off.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirm(false)} style={{ background: 'transparent', border: `1px solid ${C.hairInk}`, color: C.ink, borderRadius: 100, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => apply(true)} disabled={busy} style={{ background: C.danger, border: 'none', color: '#fff', borderRadius: 100, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {busy ? 'Turning on…' : 'Turn on maintenance'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
