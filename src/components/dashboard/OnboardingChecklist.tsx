'use client'
/* eslint-disable react-hooks/set-state-in-effect */
/**
 * Get-started checklist shown on the dashboard overview until the user finishes the
 * core actions (or dismisses it). Progress is real, derived from /api/onboarding.
 */
import { useEffect, useState } from 'react'
import { C } from '@/utils'
import { Card } from './kit'

interface Step { id: string; label: string; done: boolean; tab: string }
const KEY = 'rankkw_onboarding_dismissed_v1'

export function OnboardingChecklist({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [steps, setSteps] = useState<Step[] | null>(null)
  const [complete, setComplete] = useState(false)
  const [dismissed, setDismissed] = useState(true) // default hidden until we know

  useEffect(() => {
    let seen = false
    try { seen = !!localStorage.getItem(KEY) } catch { /* ignore */ }
    setDismissed(seen)
    if (seen) return
    fetch('/api/onboarding')
      .then(r => r.json())
      .then(j => { if (j?.success) { setSteps(j.data.steps); setComplete(j.data.complete) } })
      .catch(() => {})
  }, [])

  const dismiss = () => { try { localStorage.setItem(KEY, '1') } catch { /* ignore */ } setDismissed(true) }

  if (dismissed || complete || !steps) return null
  const doneCount = steps.filter(s => s.done).length
  const pct = Math.round((doneCount / steps.length) * 100)

  return (
    <Card style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>Get started with Rankkw</p>
          <p style={{ fontSize: 13, color: C.graphite, marginTop: 2 }}>{doneCount} of {steps.length} done. A few quick steps to get the most out of your account.</p>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" style={{ background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: 15, color: C.graphite, lineHeight: 1, flexShrink: 0 }}>×</button>
      </div>

      <div style={{ height: 6, background: C.ash, borderRadius: 100, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: C.orange, transition: 'width 0.3s' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map(s => (
          <button key={s.id} onClick={() => { if (!s.done) onNavigate(s.tab) }}
            disabled={s.done}
            style={{
              display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
              padding: '11px 13px', borderRadius: 10, border: `1px solid ${s.done ? 'transparent' : C.ash}`,
              background: s.done ? C.canvas : C.paper, cursor: s.done ? 'default' : 'pointer', fontFamily: 'inherit',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => { if (!s.done) e.currentTarget.style.borderColor = C.orange }}
            onMouseLeave={e => { if (!s.done) e.currentTarget.style.borderColor = C.ash }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: s.done ? '#1F8A4C' : 'transparent', border: s.done ? 'none' : `2px solid ${C.ash}`, color: '#fff', fontSize: 12 }}>{s.done ? '✓' : ''}</span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: s.done ? C.graphite : C.ink, textDecoration: s.done ? 'line-through' : 'none' }}>{s.label}</span>
            {!s.done && <span style={{ fontSize: 13, fontWeight: 600, color: C.orange }}>Start →</span>}
          </button>
        ))}
      </div>
    </Card>
  )
}
