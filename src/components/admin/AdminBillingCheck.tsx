'use client'
/**
 * Admin > Earnings > Billing check: every Lemon Squeezy subscription against the
 * Rankkw account it should have upgraded. Problems first, each with a one-click
 * fix (asks to confirm) that gives the account the plan it paid for.
 */
import { useCallback, useEffect, useState } from 'react'
import { Spinner, LoadingBlock, StatCard, adminBtn, useConfirm } from './ui'
import { C } from '@/utils'
import { MONO, cardStyle } from '@/components/dashboard/kit'
import type { BillingCheck, CheckRow, Problem } from '@/lib/billing-check'

const PROBLEM: Record<Problem, { label: string; help: string; fg: string; bg: string }> = {
  paid_no_access:     { label: 'Paid, no access', help: 'Active subscription, but the account is on Free.', fg: '#B42318', bg: '#FEE4E2' },
  not_linked:         { label: 'Not linked', help: 'No account carries this subscription; matched only by email. The webhook never applied it.', fg: '#B54708', bg: '#FEF0C7' },
  no_account:         { label: 'No account', help: 'Active subscription, no account with its email, subscription or customer id. The buyer may use another email.', fg: '#6B6B63', bg: '#F0EFEA' },
  wrong_plan:         { label: 'Wrong plan', help: 'The account has a LOWER plan than the one bought.', fg: '#B54708', bg: '#FEF0C7' },
  paying_twice:       { label: 'Paying twice', help: 'The account has a higher plan (usually Pro 1-Year paid by bank / JazzCash) while this card subscription keeps renewing every month. Nothing to fix here: tell the customer to cancel the card subscription, or refund it in Lemon Squeezy.', fg: '#175CD3', bg: '#D1E9FF' },
  ended_still_access: { label: 'Ended, still has access', help: 'The subscription ended but the account still has the paid plan.', fg: '#6941C6', bg: '#F4EBFF' },
}
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' }) : '-')

export function AdminBillingCheck() {
  const [data, setData] = useState<BillingCheck | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const { confirm, dialog } = useConfirm()

  const fetchCheck = useCallback(async (fresh: boolean) => {
    try {
      const r = await fetch(`/api/admin/billing-check${fresh ? '?fresh=1' : ''}`, { cache: 'no-store' })
      const j = await r.json()
      if (!j.success) throw new Error(j.error || 'Failed')
      setData(j.data); setErr('')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed') }
    setLoading(false)
  }, [])
  const load = useCallback(async (fresh = false) => { setLoading(true); await fetchCheck(fresh) }, [fetchCheck])
  useEffect(() => {
    let alive = true
    fetch('/api/admin/billing-check', { cache: 'no-store' }).then(r => r.json())
      .then(j => { if (!alive) return; if (j?.success) setData(j.data); else setErr(j?.error || 'Failed') })
      .catch(() => { if (alive) setErr('Failed') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const endAccess = (r: CheckRow) => {
    if (!r.user) return
    void confirm({
      title: `End ${r.user.email}'s paid access?`,
      body: <>Lemon Squeezy says this subscription is <strong>{r.status}</strong> (the card payment failed and was not recovered, or it ended), but the account still has <strong>{r.user.effectivePlan}</strong>. The account goes to Free. They can subscribe again any time.</>,
      confirmLabel: 'End access', busyLabel: 'Saving…', tone: 'danger',
      action: async () => {
        const res = await fetch('/api/admin/billing-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subId: r.subId, userId: r.user!.id }) })
        const j = await res.json().catch(() => ({}))
        if (!j.success) return j.error || 'Could not apply'
        await load(true)
      },
    })
  }

  const fix = (r: CheckRow) => {
    if (!r.user) return
    void confirm({
      title: `Give ${r.user.email} the ${r.plan ?? 'paid'} plan?`,
      body: <>Lemon Squeezy subscription <code style={{ fontFamily: MONO }}>{r.subId}</code> ({r.product}, {r.status}, paid by {r.email}) will be linked to this account and its plan set from Lemon Squeezy. Only do this if this account is the buyer.</>,
      confirmLabel: 'Give plan', busyLabel: 'Saving…', tone: 'primary',
      action: async () => {
        const res = await fetch('/api/admin/billing-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subId: r.subId, userId: r.user!.id }) })
        const j = await res.json().catch(() => ({}))
        if (!j.success) return j.error || 'Could not apply'
        await load(true)
      },
    })
  }

  if (loading && !data) return <LoadingBlock label="Checking every Lemon Squeezy subscription" />
  if (err && !data) return <div style={{ ...cardStyle, padding: 18, color: C.danger }}>{err}</div>
  if (!data) return null
  const totalProblems = Object.values(data.problems).reduce((a, b) => a + b, 0)
  const rows = showAll ? data.rows : data.rows.filter(r => r.problem)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {dialog}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 13, color: C.graphite, flex: 1, minWidth: 240 }}>
          Every card subscription in Lemon Squeezy, matched to the Rankkw account by the subscription and customer ids our webhook saves (email only as a last resort). Checked {new Date(data.checkedAt).toLocaleTimeString()}.
        </p>
        <button onClick={() => load(true)} disabled={loading} style={adminBtn('plain', 'md')}>{loading ? <Spinner /> : 'Run again'}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        <StatCard label="Subscriptions" value={String(data.subscriptions)} sub={`${data.live} giving access now`} />
        <StatCard label="Working" value={String(data.ok)} sub="paid and on the right plan" accent="#1F7A44" />
        <StatCard label="Need a look" value={String(totalProblems)} sub={totalProblems ? 'see the list below' : 'nothing to fix'} accent={totalProblems ? '#B42318' : '#1F7A44'} />
      </div>
      {totalProblems > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(Object.keys(PROBLEM) as Problem[]).filter(p => data.problems[p]).map(p => (
            <span key={p} title={PROBLEM[p].help} style={{ fontSize: 12.5, fontWeight: 600, color: PROBLEM[p].fg, background: PROBLEM[p].bg, borderRadius: 100, padding: '4px 12px' }}>{PROBLEM[p].label}: {data.problems[p]}</span>
          ))}
        </div>
      )}
      <div style={{ ...cardStyle, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880, fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.headerBg, textAlign: 'left' }}>
              {['Problem', 'Paid by (Lemon Squeezy)', 'Product', 'Status', 'Started', 'Rankkw account', 'Account plan', ''].map(h => (
                <th key={h} style={{ padding: '10px 12px', fontSize: 11, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.graphite, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} style={{ padding: 18, color: '#1F7A44', fontWeight: 600 }}>Every active subscription gives its buyer the plan they paid for.</td></tr>}
            {rows.map(r => (
              <tr key={r.subId} style={{ borderTop: `1px solid ${C.hair}` }}>
                <td style={{ padding: '10px 12px' }}>{r.problem
                  ? <span title={PROBLEM[r.problem].help} style={{ fontSize: 11.5, fontWeight: 700, color: PROBLEM[r.problem].fg, background: PROBLEM[r.problem].bg, borderRadius: 100, padding: '3px 10px', whiteSpace: 'nowrap' }}>{PROBLEM[r.problem].label}</span>
                  : <span style={{ color: '#1F7A44', fontWeight: 600 }}>OK</span>}</td>
                <td style={{ padding: '10px 12px' }}>{r.email}</td>
                <td style={{ padding: '10px 12px' }}>{r.product}</td>
                <td style={{ padding: '10px 12px', textTransform: 'capitalize' }}>{r.status.replace(/_/g, ' ')}{r.endsAt ? <span style={{ color: C.stone }}> · ends {fmt(r.endsAt)}</span> : null}</td>
                <td style={{ padding: '10px 12px', fontFamily: MONO }}>{fmt(r.createdAt)}</td>
                <td style={{ padding: '10px 12px' }}>{r.user ? <>{r.user.email}<span style={{ color: C.stone, fontSize: 11.5 }}> · by {r.matchedBy}</span></> : <span style={{ color: C.stone }}>none found</span>}</td>
                <td style={{ padding: '10px 12px', fontFamily: MONO }}>{r.user ? `${r.user.effectivePlan}${r.user.subscriptionStatus ? ` (${r.user.subscriptionStatus})` : ''}` : '-'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  {r.user && (r.problem === 'paid_no_access' || r.problem === 'not_linked' || r.problem === 'wrong_plan') && (
                    <button onClick={() => fix(r)} style={adminBtn('primary')}>Give plan</button>
                  )}
                  {r.user && r.problem === 'ended_still_access' && (
                    <button onClick={() => endAccess(r)} style={adminBtn('danger')}>End access</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => setShowAll(s => !s)} style={{ ...adminBtn('plain'), alignSelf: 'flex-start' }}>{showAll ? 'Show problems only' : `Show all ${data.rows.length} subscriptions`}</button>
      <p style={{ fontSize: 12, color: C.stone, lineHeight: 1.6 }}>
        &ldquo;No account&rdquo; usually means the buyer paid with a different email from their Rankkw login: search Users for their name, then use the subscription id with them. Fixes are logged on the server.
      </p>
    </div>
  )
}
