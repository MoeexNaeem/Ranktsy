'use client'
/**
 * Admin → Settings → "SEBT NEXT": full control of the education cohort, so a new
 * batch never needs a code change again.
 *
 *  Batch & registration - set the batch number, open or close the signup link.
 *                         While open, /register/sebtnext is live and every signup
 *                         is stamped with that number.
 *  Enterprise trial     - turn the free grant on/off and set its length in days.
 *                         New signups get it automatically; "Grant now" applies it
 *                         to students who already signed up.
 */
import { useCallback, useEffect, useState } from 'react'
import { C } from '@/utils'
import { MONO, StatCard, cardStyle } from '@/components/dashboard/kit'
import { errorToast, toast, copyWithToast } from '@/components/ui/toast'

interface Config {
  batch: number
  registrationOpen: boolean
  trialEnabled: boolean
  trialDays: number
  batchStudents: number
  totalStudents: number
  activeTrials: number
  usedBatches: number[]
}

type Tab = 'batch' | 'trial'

/** Fired after a bulk grant so the Overview stats re-read instead of showing a
 *  snapshot from page load. AdminDashboard listens for it. */
export const ADMIN_STATS_REFRESH = 'rk-admin-stats-refresh'

const BTN: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, fontFamily: MONO, borderRadius: 100,
  padding: '9px 17px', cursor: 'pointer', border: `1px solid ${C.orange}`,
  color: C.orange, background: C.orangeFaint,
}

function Toggle({ on, busy, onClick, label }: { on: boolean; busy: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} disabled={busy} role="switch" aria-checked={on} aria-label={label}
      style={{ position: 'relative', width: 58, height: 32, borderRadius: 100, border: 'none', flexShrink: 0, cursor: busy ? 'wait' : 'pointer', background: on ? C.orange : C.ash, transition: 'background 0.18s', opacity: busy ? 0.6 : 1 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 29 : 3, width: 26, height: 26, borderRadius: '50%', background: '#fff', transition: 'left 0.18s', boxShadow: '0 2px 5px rgba(0,0,0,0.25)' }} />
    </button>
  )
}

function NumberField({ label, hint, value, min, max, disabled, onChange }: {
  label: string; hint: string; value: number; min: number; max: number; disabled?: boolean; onChange: (v: number) => void
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: C.ink, marginBottom: 6 }}>{label}</span>
      <input type="number" value={value} min={min} max={max} disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: 120, fontSize: 18, fontWeight: 700, fontFamily: MONO, color: C.ink, background: disabled ? C.bone : C.paper, border: `1.5px solid ${C.ash}`, borderRadius: 10, padding: '10px 12px', outline: 'none' }} />
      <span style={{ display: 'block', fontSize: 11.5, color: C.stone, marginTop: 6, lineHeight: 1.5 }}>{hint}</span>
    </label>
  )
}

function StatusPill({ on, onText, offText }: { on: boolean; onText: string; offText: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, fontFamily: MONO, padding: '6px 13px', borderRadius: 999, background: on ? 'rgba(31,122,68,0.10)' : C.bone, color: on ? '#1F7A44' : C.graphite, border: `1px solid ${on ? 'rgba(31,122,68,0.35)' : C.ash}` }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: on ? '#1F7A44' : C.stone }} />
      {on ? onText : offText}
    </span>
  )
}

export function AdminSebtSettings() {
  const [cfg, setCfg]     = useState<Config | null>(null)
  const [tab, setTab]     = useState<Tab>('batch')
  const [busy, setBusy]   = useState(false)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  // Draft values so typing a batch number does not fire a save per keystroke.
  const [batchDraft, setBatchDraft] = useState(1)
  const [daysDraft, setDaysDraft]   = useState(7)
  const [confirmGrant, setConfirmGrant] = useState<'batch' | 'all' | null>(null)

  const apply = useCallback((d: Config) => {
    setCfg(d); setBatchDraft(d.batch); setDaysDraft(d.trialDays); setState('ok')
  }, [])

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/sebt-config')
      const j = await r.json()
      if (r.ok && j?.success) apply(j.data)
      else setState('error')
    } catch { setState('error') }
  }, [apply])

  // load() only setStates after its fetch resolves, never synchronously.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const save = useCallback(async (patch: Record<string, unknown>, okMsg?: string) => {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/sebt-config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.success) {
        apply(j.data)
        if (okMsg) toast.success(okMsg)
        return j.data as Config & { affected?: number }
      }
      errorToast('Could not save', j?.error || 'Please try again.')
      return null
    } catch { errorToast('Could not save', 'Network error. Please try again.'); return null }
    finally { setBusy(false) }
  }, [apply])

  const runGrant = useCallback(async (scope: 'batch' | 'all') => {
    setConfirmGrant(null)
    const d = await save({ applyToAll: true, scope })
    if (d) {
      const n = d.affected ?? 0
      // Thousands of plans may have just changed; nudge the Overview to re-read.
      if (n) window.dispatchEvent(new Event(ADMIN_STATS_REFRESH))
      toast.success(
        n ? `${n.toLocaleString()} student${n === 1 ? '' : 's'} updated` : 'No students needed updating',
        n ? `Enterprise for ${d.trialDays} days, starting now.` : 'Everyone matching is already on a paid plan.',
      )
    }
  }, [save])

  if (state === 'loading') return <div style={{ ...cardStyle, padding: 24, fontSize: 13.5, color: C.graphite }}>Loading SEBT settings…</div>
  if (state === 'error' || !cfg) {
    return (
      <div style={{ ...cardStyle, padding: 24, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 13.5, color: C.danger, flex: 1 }}>Could not load SEBT settings.</p>
        <button onClick={load} style={BTN}>Retry</button>
      </div>
    )
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const signupUrl = `${origin}/register/sebtnext`
  const loginUrl  = `${origin}/login/sebtnext`
  const batchDirty = batchDraft !== cfg.batch
  const daysDirty  = daysDraft !== cfg.trialDays
  const batchInUse = cfg.usedBatches.includes(batchDraft) && batchDirty

  return (
    <div style={{ ...cardStyle, padding: 0, maxWidth: 780, overflow: 'hidden' }}>
      {/* Header + live status */}
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: 0 }}>SEBT NEXT</h3>
          <StatusPill on={cfg.registrationOpen} onText={`Batch ${cfg.batch} open`} offText={`Batch ${cfg.batch} closed`} />
          <StatusPill on={cfg.trialEnabled} onText={`Trial ${cfg.trialDays}d`} offText="Trial off" />
        </div>
        <p style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.6, margin: '0 0 16px' }}>
          Control the student cohort without a deploy: open a numbered batch, and set how long its free Enterprise access lasts.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
          <StatCard label={`In batch ${cfg.batch}`} value={cfg.batchStudents.toLocaleString()} accent="#4F46E5" />
          <StatCard label="All students" value={cfg.totalStudents.toLocaleString()} accent="#2E6DB4" />
          <StatCard label="Trials live" value={cfg.activeTrials.toLocaleString()} accent="#1F7A44" />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.hair}` }}>
          {([['batch', 'Batch & registration'], ['trial', 'Enterprise trial']] as [Tab, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', color: tab === id ? C.ink : C.graphite, background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === id ? C.orange : 'transparent'}`, padding: '11px 14px', marginBottom: -1, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '22px 24px 24px' }}>
        {tab === 'batch' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 22, flexWrap: 'wrap' }}>
              <NumberField label="Batch number" min={1} max={9999} value={batchDraft} onChange={setBatchDraft}
                hint={batchInUse ? `Batch ${batchDraft} already has students` : 'Stamped on every signup in this batch'} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: '0 0 4px' }}>Registration link</p>
                <p style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.6, margin: 0 }}>
                  {cfg.registrationOpen
                    ? <>Live now. Students who sign up join <strong style={{ color: C.ink }}>batch {cfg.batch}</strong>.</>
                    : <>Closed. The link shows a &ldquo;Batch {cfg.batch} has ended&rdquo; screen.</>}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 22 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: cfg.registrationOpen ? '#1F7A44' : C.graphite, fontFamily: MONO }}>
                  {cfg.registrationOpen ? 'OPEN' : 'CLOSED'}
                </span>
                <Toggle on={cfg.registrationOpen} busy={busy} label="Registration open"
                  onClick={() => save(
                    { registrationOpen: !cfg.registrationOpen, batch: batchDraft },
                    !cfg.registrationOpen ? `Batch ${batchDraft} is now open` : `Batch ${cfg.batch} closed`,
                  )} />
              </div>
            </div>

            {batchDirty && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: C.orangeFaint, border: `1px solid ${C.orange}`, borderRadius: 12, padding: '12px 15px' }}>
                <p style={{ fontSize: 12.5, color: C.ink, flex: 1, minWidth: 200, lineHeight: 1.55, margin: 0 }}>
                  {batchInUse
                    ? <>Batch <strong>{batchDraft}</strong> already has students. New signups will be added to it.</>
                    : <>Save batch <strong>{batchDraft}</strong>? New signups will be stamped with it.</>}
                </p>
                <button onClick={() => setBatchDraft(cfg.batch)} disabled={busy}
                  style={{ ...BTN, color: C.graphite, background: 'transparent', borderColor: C.ash }}>Cancel</button>
                <button onClick={() => save({ batch: batchDraft }, `Batch set to ${batchDraft}`)} disabled={busy}
                  style={{ ...BTN, background: C.orange, color: '#fff' }}>Save batch</button>
              </div>
            )}

            <div style={{ borderTop: `1px solid ${C.hair}`, paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([['Sign up', signupUrl], ['Log in', loginUrl]] as [string, string][]).map(([label, url]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.graphite, width: 54, flexShrink: 0 }}>{label}</span>
                  <code style={{ flex: 1, minWidth: 200, fontSize: 12.5, fontFamily: MONO, color: cfg.registrationOpen ? C.ink : C.stone, background: C.bone, border: `1px solid ${C.hair}`, borderRadius: 8, padding: '8px 11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: cfg.registrationOpen ? 'none' : 'line-through' }}>{url}</code>
                  <button onClick={() => copyWithToast(url, `${label} link`)} style={{ ...BTN, padding: '8px 14px' }}>Copy</button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 22, flexWrap: 'wrap' }}>
              <NumberField label="Trial length (days)" min={1} max={365} value={daysDraft} onChange={setDaysDraft}
                disabled={!cfg.trialEnabled} hint="Counted from each student's own signup" />
              <div style={{ flex: 1, minWidth: 220 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: '0 0 4px' }}>Free Enterprise access</p>
                <p style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.6, margin: 0 }}>
                  {cfg.trialEnabled
                    ? <>Every SEBT signup gets Enterprise for <strong style={{ color: C.ink }}>{cfg.trialDays} days</strong>, then drops to free automatically.</>
                    : <>Off. SEBT signups join on the free plan and keep the student badge.</>}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 22 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: cfg.trialEnabled ? '#1F7A44' : C.graphite, fontFamily: MONO }}>
                  {cfg.trialEnabled ? 'ON' : 'OFF'}
                </span>
                <Toggle on={cfg.trialEnabled} busy={busy} label="Enterprise trial"
                  onClick={() => save({ trialEnabled: !cfg.trialEnabled }, !cfg.trialEnabled ? 'Enterprise trial on' : 'Enterprise trial off')} />
              </div>
            </div>

            {daysDirty && cfg.trialEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: C.orangeFaint, border: `1px solid ${C.orange}`, borderRadius: 12, padding: '12px 15px' }}>
                <p style={{ fontSize: 12.5, color: C.ink, flex: 1, minWidth: 200, lineHeight: 1.55, margin: 0 }}>
                  Save <strong>{daysDraft} days</strong>? This applies to new signups. Existing students keep the clock they already have.
                </p>
                <button onClick={() => setDaysDraft(cfg.trialDays)} disabled={busy}
                  style={{ ...BTN, color: C.graphite, background: 'transparent', borderColor: C.ash }}>Cancel</button>
                <button onClick={() => save({ trialDays: daysDraft }, `Trial set to ${daysDraft} days`)} disabled={busy}
                  style={{ ...BTN, background: C.orange, color: '#fff' }}>Save days</button>
              </div>
            )}

            {/* Retroactive grant: the only thing here that rewrites live accounts. */}
            <div style={{ borderTop: `1px solid ${C.hair}`, paddingTop: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: '0 0 4px' }}>Grant to students who already signed up</p>
              <p style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.6, margin: '0 0 14px' }}>
                Starts a fresh {cfg.trialDays}-day Enterprise clock from now. Students who have since bought a paid plan are skipped.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => setConfirmGrant('batch')} disabled={busy || !cfg.trialEnabled || !cfg.batchStudents} style={{ ...BTN, opacity: busy || !cfg.trialEnabled || !cfg.batchStudents ? 0.5 : 1 }}>
                  Batch {cfg.batch} ({cfg.batchStudents.toLocaleString()})
                </button>
                <button onClick={() => setConfirmGrant('all')} disabled={busy || !cfg.trialEnabled || !cfg.totalStudents} style={{ ...BTN, opacity: busy || !cfg.trialEnabled || !cfg.totalStudents ? 0.5 : 1 }}>
                  All students ({cfg.totalStudents.toLocaleString()})
                </button>
              </div>
              {!cfg.trialEnabled && <p style={{ fontSize: 12, color: C.stone, marginTop: 10 }}>Turn the trial on to use these.</p>}
            </div>
          </div>
        )}
      </div>

      {confirmGrant && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,14,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 20 }} onClick={() => setConfirmGrant(null)}>
          <div style={{ background: C.paper, borderRadius: 16, padding: '26px 28px', maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: C.ink, marginBottom: 10 }}>Grant Enterprise for {cfg.trialDays} days?</h3>
            <p style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.6, marginBottom: 22 }}>
              This updates up to <strong style={{ color: C.ink }}>{(confirmGrant === 'batch' ? cfg.batchStudents : cfg.totalStudents).toLocaleString()}</strong>
              {confirmGrant === 'batch' ? <> students in batch {cfg.batch}</> : <> SEBT students</>}, restarting their trial from today. Anyone on a paid subscription is left alone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setConfirmGrant(null)} style={{ background: 'transparent', border: `1px solid ${C.hairInk}`, color: C.ink, borderRadius: 100, padding: '9px 18px', fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => runGrant(confirmGrant)} style={{ background: C.orange, border: 'none', color: '#fff', borderRadius: 100, padding: '9px 18px', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>Grant now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
