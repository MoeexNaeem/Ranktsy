'use client'
/**
 * One-time popup when a local-payment / admin-granted plan has run out and the user
 * is back on Free. /api/plan returns `expired` until the user dismisses it here
 * (POST /api/plan/expiry-notice), so it shows once per expiry, not on every visit.
 */
import { useState } from 'react'
import Link from 'next/link'
import { C } from '@/utils'
import { localPlanFor } from '@/lib/local-payments'

export interface ExpiredPlan { plan: string; label: string; at: string | null }

export function PlanExpiredModal({ expired, onClose }: { expired: ExpiredPlan; onClose: () => void }) {
  const [closing, setClosing] = useState(false)
  const dismiss = () => {
    if (closing) return
    setClosing(true)
    void fetch('/api/plan/expiry-notice', { method: 'POST' }).catch(() => {})
    onClose()
  }
  const when = expired.at ? new Date(expired.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  const localPlan = localPlanFor(expired.plan)

  return (
    <div onClick={dismiss} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(20,20,20,0.55)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="plan-expired-title"
        style={{ background: C.paper, borderRadius: 22, width: 'min(440px, 100%)', padding: '30px 26px 24px', textAlign: 'center', boxShadow: '0 30px 80px rgba(0,0,0,0.35)' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.orangeFaint, color: C.orange, display: 'grid', placeItems: 'center', fontSize: 26, margin: '0 auto 14px' }}>⏰</div>
        <h2 id="plan-expired-title" style={{ fontSize: 22, fontWeight: 600, color: C.ink, letterSpacing: '-0.02em', marginBottom: 8 }}>
          Your {expired.label} plan has expired
        </h2>
        <p style={{ fontSize: 14.5, color: C.graphite, lineHeight: 1.6, marginBottom: 22 }}>
          {when ? `It ended on ${when}, and` : 'It has ended, and'} your account is now on the Free plan.
          Upgrade to get your {expired.label} tools and limits back.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link href="/pricing" onClick={dismiss}
            style={{ background: C.orange, color: '#fff', padding: '13px 18px', borderRadius: 100, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
            Upgrade now
          </Link>
          <Link href={`/local-payment${localPlan ? `?plan=${localPlan.slug}` : ''}`} onClick={dismiss}
            style={{ background: C.paper, color: '#16A34A', border: '1px solid #16A34A', padding: '12px 18px', borderRadius: 100, fontWeight: 600, fontSize: 14.5, textDecoration: 'none' }}>
            Pay in PKR (bank / JazzCash)
          </Link>
          <button onClick={dismiss}
            style={{ background: 'transparent', border: 'none', color: C.graphite, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', padding: 6 }}>
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
