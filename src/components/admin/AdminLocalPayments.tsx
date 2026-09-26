'use client'
/**
 * Admin "Local Payments": bank transfer / JazzCash payments users submitted from
 * /local-payment with a screenshot. Review the proof, then Approve (grants the plan
 * until the paid period ends, after which the user reverts to free automatically),
 * Reject (user is notified with the reason) or move back to Pending.
 */
import { useCallback, useEffect, useState } from 'react'
import { C } from '@/utils'
import { cardStyle, EmptyState, MONO } from '@/components/dashboard/kit'
import { toast } from '@/components/ui/toast'
import { PLAN_LABELS, PLAN_SLUGS, type PlanSlug } from '@/lib/plans'
import { formatPkr, localPlanFor, METHOD_LABELS, type LocalMethod } from '@/lib/local-payments'

type Filter = 'pending' | 'approved' | 'expired' | 'rejected' | 'all'
interface Row {
  id: string; userId: string; userName: string; userEmail: string
  plan: string; method: LocalMethod; amountPkr: number; reference: string | null; hasProof: boolean
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  adminNote: string | null; grantedPlan: string | null; grantedUntil: string | null
  reviewedAt: string | null; createdAt: string; currentPlan: string | null; currentPlanUntil: string | null
}
interface Counts { pending: number; approved: number; expired: number; rejected: number }

const STATUS: Record<Row['status'], { label: string; bg: string; fg: string }> = {
  pending:  { label: 'Pending',  bg: '#FEF3C7', fg: '#92400E' },
  approved: { label: 'Approved', bg: '#DCFCE7', fg: '#166534' },
  expired:  { label: 'Expired',  bg: '#E5E7EB', fg: '#374151' },
  rejected: { label: 'Rejected', bg: '#FEE2E2', fg: '#991B1B' },
}
const PAID_PLANS = PLAN_SLUGS.filter(p => p !== 'free')
const fmt = (d: string | null) => d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'
const fmtDay = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'
const planName = (s: string | null) => s ? (PLAN_LABELS[s as PlanSlug] ?? s) : '-'

const btn = (bg: string, fg: string, border = bg): React.CSSProperties => ({
  background: bg, color: fg, border: `1px solid ${border}`, borderRadius: 9, padding: '7px 12px',
  fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
})

function Modal({ onClose, children, width = 460 }: { onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,20,20,0.55)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ background: C.paper, borderRadius: 16, width: `min(${width}px, 100%)`, maxHeight: '90vh', overflowY: 'auto', padding: 22, boxShadow: '0 30px 80px rgba(0,0,0,0.35)' }}>
        {children}
      </div>
    </div>
  )
}

export function AdminLocalPayments() {
  const [filter, setFilter] = useState<Filter>('pending')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [proof, setProof] = useState<Row | null>(null)
  const [approving, setApproving] = useState<Row | null>(null)
  const [rejecting, setRejecting] = useState<Row | null>(null)
  const [plan, setPlan] = useState<string>('pro')
  const [months, setMonths] = useState(1)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/local-payments?status=${filter}`, { cache: 'no-store' })
      const j = await r.json()
      if (j?.success) { setRows(j.data.rows); setCounts(j.data.counts) }
      else setRows([])
    } catch { setRows([]) }
  }, [filter])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setRows(null); void load() }, [load])

  const act = async (row: Row, body: Record<string, unknown>, ok: string) => {
    setBusy(true)
    try {
      const r = await fetch(`/api/admin/local-payments/${row.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => null)
      if (!r.ok || !j?.success) { toast.error('Could not update', j?.error || 'Please try again.'); return false }
      toast.success(ok)
      setApproving(null); setRejecting(null); setNote('')
      void load()
      return true
    } catch { toast.error('Could not update', 'Network error.'); return false } finally { setBusy(false) }
  }

  const openApprove = (row: Row) => {
    setPlan(row.plan)
    setMonths(localPlanFor(row.plan)?.months ?? 1)
    setNote('')
    setApproving(row)
  }

  const pills: { id: Filter; label: string; n?: number }[] = [
    { id: 'pending', label: 'Pending', n: counts?.pending },
    { id: 'approved', label: 'Approved (active)', n: counts?.approved },
    { id: 'expired', label: 'Expired', n: counts?.expired },
    { id: 'rejected', label: 'Rejected', n: counts?.rejected },
    { id: 'all', label: 'All' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: C.ink }}>Local Payments</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: C.graphite, maxWidth: 720, lineHeight: 1.5 }}>
          Bank transfer and JazzCash payments with the user&apos;s screenshot. Approving turns the plan on until the paid period ends
          (1 month, or 12 for Pro 1-Year); the user then drops back to Free and sees a &ldquo;plan expired&rdquo; popup.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {pills.map(p => (
          <button key={p.id} onClick={() => setFilter(p.id)}
            style={{ ...btn(filter === p.id ? C.ink : C.paper, filter === p.id ? '#fff' : C.ink, filter === p.id ? C.ink : C.ash), borderRadius: 100, padding: '7px 14px' }}>
            {p.label}{p.n != null ? ` (${p.n})` : ''}
          </button>
        ))}
        <button onClick={() => void load()} style={{ ...btn(C.paper, C.graphite, C.ash), borderRadius: 100, marginLeft: 'auto' }}>Refresh</button>
      </div>

      {rows == null ? (
        <p style={{ fontSize: 13, color: C.graphite }}>Loading…</p>
      ) : rows.length === 0 ? (
        <div style={cardStyle}><EmptyState title={filter === 'pending' ? 'No payments waiting' : 'Nothing here'} sub={filter === 'pending' ? 'New local payments show up here (you also get a notification).' : undefined} /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(r => {
            const st = STATUS[r.status]
            return (
              <div key={r.id} style={{ ...cardStyle, padding: 16, display: 'grid', gridTemplateColumns: 'minmax(200px,1.4fr) minmax(170px,1fr) minmax(170px,1fr) auto', gap: 14, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.userName || '(no name)'}</p>
                  <p style={{ fontSize: 12.5, color: C.graphite, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.userEmail}</p>
                  <p style={{ fontSize: 11.5, color: C.stone, fontFamily: MONO, marginTop: 2 }}>sent {fmt(r.createdAt)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{localPlanFor(r.plan)?.label ?? planName(r.plan)} · {formatPkr(r.amountPkr)}</p>
                  <p style={{ fontSize: 12.5, color: C.graphite }}>{METHOD_LABELS[r.method]}{r.reference ? ` · TID ${r.reference}` : ''}</p>
                  <button onClick={() => setProof(r)} disabled={!r.hasProof}
                    style={{ ...btn(C.paper, r.hasProof ? '#2563EB' : C.stone, C.ash), marginTop: 6, padding: '4px 10px' }}>
                    {r.hasProof ? '🖼 View proof' : 'No proof attached'}
                  </button>
                </div>
                <div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 100, background: st.bg, color: st.fg }}>{st.label}</span>
                  <p style={{ fontSize: 12.5, color: C.graphite, marginTop: 6 }}>
                    Now on <strong style={{ color: C.ink }}>{planName(r.currentPlan)}</strong>
                    {r.currentPlan && r.currentPlan !== 'free' && r.currentPlanUntil ? ` until ${fmtDay(r.currentPlanUntil)}` : ''}
                  </p>
                  {r.grantedUntil && <p style={{ fontSize: 11.5, color: C.stone }}>granted {planName(r.grantedPlan)} until {fmtDay(r.grantedUntil)}</p>}
                  {r.adminNote && <p style={{ fontSize: 11.5, color: C.stone }}>note: {r.adminNote}</p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {r.status !== 'approved' && <button onClick={() => openApprove(r)} style={btn('#16A34A', '#fff')}>{r.status === 'expired' ? 'Renew' : 'Approve'}</button>}
                  {r.status === 'approved' && <button onClick={() => openApprove(r)} style={btn(C.paper, C.ink, C.ash)}>Change plan</button>}
                  {r.status !== 'rejected' && r.status !== 'expired' && <button onClick={() => { setNote(''); setRejecting(r) }} style={btn(C.paper, '#B91C1C', '#FCA5A5')}>Reject</button>}
                  {r.status !== 'pending' && r.status !== 'expired' && <button disabled={busy} onClick={() => void act(r, { action: 'pending' }, 'Moved back to pending')} style={btn(C.paper, C.graphite, C.ash)}>Set pending</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {proof && (
        <Modal onClose={() => setProof(null)} width={760}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>Proof from {proof.userName || proof.userEmail} · {formatPkr(proof.amountPkr)}</p>
            <a href={`/api/admin/local-payments/${proof.id}/proof`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#2563EB' }}>Open full size</a>
          </div>
          {/* Images render inline; a PDF opens via the link above. */}
          <img src={`/api/admin/local-payments/${proof.id}/proof`} alt="Payment proof"
            style={{ width: '100%', borderRadius: 10, border: `1px solid ${C.ash}`, background: C.canvas }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          <p style={{ fontSize: 12.5, color: C.stone, marginTop: 8 }}>If nothing shows above, the proof is a PDF: use &ldquo;Open full size&rdquo;.</p>
        </Modal>
      )}

      {approving && (
        <Modal onClose={() => setApproving(null)}>
          <p style={{ fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: 4 }}>Approve payment</p>
          <p style={{ fontSize: 13, color: C.graphite, marginBottom: 14 }}>{approving.userName || approving.userEmail} paid {formatPkr(approving.amountPkr)} for {localPlanFor(approving.plan)?.label ?? planName(approving.plan)}.</p>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>Plan to give</label>
          <select value={plan} onChange={e => setPlan(e.target.value)}
            style={{ width: '100%', margin: '6px 0 12px', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.ash}`, background: C.paper, fontFamily: 'inherit', fontSize: 14 }}>
            {PAID_PLANS.map(p => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
          </select>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>For how many months</label>
          <input type="number" min={1} max={24} value={months} onChange={e => setMonths(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
            style={{ width: '100%', boxSizing: 'border-box', margin: '6px 0 4px', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.ash}`, fontFamily: 'inherit', fontSize: 14 }} />
          <p style={{ fontSize: 12, color: C.stone, marginBottom: 12 }}>The plan ends exactly {months} month{months === 1 ? '' : 's'} from now, then the user returns to Free.</p>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>Note (optional, internal)</label>
          <input value={note} onChange={e => setNote(e.target.value)} maxLength={500}
            style={{ width: '100%', boxSizing: 'border-box', margin: '6px 0 16px', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.ash}`, fontFamily: 'inherit', fontSize: 14 }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setApproving(null)} style={btn(C.paper, C.ink, C.ash)}>Cancel</button>
            <button disabled={busy} onClick={() => void act(approving, { action: 'approve', plan, months, note }, `${PLAN_LABELS[plan as PlanSlug]} plan activated`)} style={btn('#16A34A', '#fff')}>
              {busy ? 'Saving…' : `Approve and give ${PLAN_LABELS[plan as PlanSlug]}`}
            </button>
          </div>
        </Modal>
      )}

      {rejecting && (
        <Modal onClose={() => setRejecting(null)}>
          <p style={{ fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: 4 }}>Reject payment</p>
          <p style={{ fontSize: 13, color: C.graphite, marginBottom: 12 }}>The user gets a notification with this reason. Their plan is not changed.</p>
          <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={3} placeholder="e.g. Amount does not match / payment not received"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.ash}`, fontFamily: 'inherit', fontSize: 14, marginBottom: 14, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setRejecting(null)} style={btn(C.paper, C.ink, C.ash)}>Cancel</button>
            <button disabled={busy} onClick={() => void act(rejecting, { action: 'reject', note }, 'Payment rejected')} style={btn('#B91C1C', '#fff')}>{busy ? 'Saving…' : 'Reject payment'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
