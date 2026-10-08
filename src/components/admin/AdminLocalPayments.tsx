'use client'
/**
 * Admin "Local Payments": bank transfer / JazzCash payments users submitted from
 * /local-payment with a screenshot. Review the proof, then Approve (grants the plan
 * until the paid period ends, after which the user reverts to free automatically),
 * Reject (user is notified with the reason) or move back to Pending.
 */
import { useCallback, useEffect, useState } from 'react'
import { Spinner, LoadingBlock } from './ui'
import { C } from '@/utils'
import { cardStyle, EmptyState, MONO, Pagination, SectionTitle, tableCard, tableHead, th, tableRow } from '@/components/dashboard/kit'
import type { RevenueReport } from '@/lib/revenue-report'
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
const PAGE_SIZE = 20
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
  const [page, setPage] = useState(1)
  const [paging, setPaging] = useState<{ pages: number; total: number; limit: number }>({ pages: 1, total: 0, limit: PAGE_SIZE })
  const [rows, setRows] = useState<Row[] | null>(null)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [proof, setProof] = useState<Row | null>(null)
  const [approving, setApproving] = useState<Row | null>(null)
  const [rejecting, setRejecting] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)
  const [plan, setPlan] = useState<string>('pro')
  const [months, setMonths] = useState(1)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  // Search by email / Transaction ID (TID) / name, in whichever tab is open.
  // `search` is what's typed; `q` is the debounced value sent to the server.
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const next = search.trim()
    if (next === q) return
    const t = setTimeout(() => { setQ(next); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search, q])

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ status: filter, page: String(page), limit: String(PAGE_SIZE) })
      if (q) qs.set('q', q)
      const r = await fetch(`/api/admin/local-payments?${qs}`, { cache: 'no-store' })
      const j = await r.json()
      if (j?.success) {
        setRows(j.data.rows); setCounts(j.data.counts)
        setPaging({ pages: j.data.pages ?? 1, total: j.data.total ?? j.data.rows.length, limit: j.data.limit ?? PAGE_SIZE })
        // The server clamps an out-of-range page (e.g. after deleting the last row on it).
        if (j.data.page && j.data.page !== page) setPage(j.data.page)
      }
      else setRows([])
    } catch { setRows([]) }
  }, [filter, page, q])
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

  const remove = async (row: Row) => {
    setBusy(true)
    try {
      const r = await fetch(`/api/admin/local-payments/${row.id}`, { method: 'DELETE' })
      const j = await r.json().catch(() => null)
      if (!r.ok || !j?.success) { toast.error('Could not delete', j?.error || 'Please try again.'); return }
      toast.success('Request deleted')
      setDeleting(null)
      void load()
    } catch { toast.error('Could not delete', 'Network error.') } finally { setBusy(false) }
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
          <button key={p.id} onClick={() => { setFilter(p.id); setPage(1) }}
            style={{ ...btn(filter === p.id ? C.ink : C.paper, filter === p.id ? '#fff' : C.ink, filter === p.id ? C.ink : C.ash), borderRadius: 100, padding: '7px 14px' }}>
            {p.label}{p.n != null ? ` (${p.n})` : ''}
          </button>
        ))}
        <button onClick={() => void load()} style={{ ...btn(C.paper, C.graphite, C.ash), borderRadius: 100, marginLeft: 'auto' }}>Refresh</button>
      </div>

      <div style={{ position: 'relative', maxWidth: 460 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.stone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input type="search" value={search} onChange={e => setSearch(e.target.value)} maxLength={100}
          placeholder="Search by email or Transaction ID (TID)" aria-label="Search local payments by email or Transaction ID"
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 36px 10px 38px', fontSize: 14, fontFamily: 'inherit', color: C.ink, background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 10, outline: 'none' }} />
        {search && (
          <button type="button" onClick={() => setSearch('')} aria-label="Clear search"
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 24, height: 24, borderRadius: '50%', border: 'none', background: C.bone, color: C.graphite, cursor: 'pointer', fontSize: 14, lineHeight: '24px', padding: 0 }}>×</button>
        )}
      </div>

      {rows != null && paging.total > 0 && (
        <p style={{ fontSize: 12.5, color: C.stone, fontFamily: MONO, margin: 0 }}>
          Showing {(page - 1) * paging.limit + 1}-{Math.min(page * paging.limit, paging.total)} of {paging.total}{q ? ` matching "${q}"` : ''}
        </p>
      )}

      {rows == null ? (
        <LoadingBlock label="Loading payments" height={220} />
      ) : rows.length === 0 ? (
        <div style={cardStyle}>{q
          ? <EmptyState title={`No payments match "${q}"`} sub="Search looks at the email, Transaction ID (TID) and name in this tab. Try All to search every payment." />
          : <EmptyState title={filter === 'pending' ? 'No payments waiting' : 'Nothing here'} sub={filter === 'pending' ? 'New local payments show up here (you also get a notification).' : undefined} />}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(r => {
            const st = STATUS[r.status]
            return (
              // Columns come from .lp-row (globals.css): 4 on desktop, 2 on tablets, 1 on phones.
              <div key={r.id} className="lp-row" style={{ ...cardStyle, padding: 16, display: 'grid', gap: 14, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, overflowWrap: 'anywhere' }}>{r.userName || '(no name)'}</p>
                  <p style={{ fontSize: 12.5, color: C.graphite, overflowWrap: 'anywhere' }}>{r.userEmail}</p>
                  <p style={{ fontSize: 11.5, color: C.stone, fontFamily: MONO, marginTop: 2 }}>sent {fmt(r.createdAt)}</p>
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{localPlanFor(r.plan)?.label ?? planName(r.plan)} · {formatPkr(r.amountPkr)}</p>
                  <p style={{ fontSize: 12.5, color: C.graphite, overflowWrap: 'anywhere' }}>{METHOD_LABELS[r.method]}{r.reference ? ` · TID ${r.reference}` : ''}</p>
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
                <div className="lp-actions" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {r.status !== 'approved' && <button onClick={() => openApprove(r)} style={btn('#16A34A', '#fff')}>{r.status === 'expired' ? 'Renew' : 'Approve'}</button>}
                  {r.status === 'approved' && <button onClick={() => openApprove(r)} style={btn(C.paper, C.ink, C.ash)}>Change plan</button>}
                  {r.status !== 'rejected' && r.status !== 'expired' && <button onClick={() => { setNote(''); setRejecting(r) }} style={btn(C.paper, '#B91C1C', '#FCA5A5')}>Reject</button>}
                  {r.status !== 'pending' && r.status !== 'expired' && <button disabled={busy} onClick={() => void act(r, { action: 'pending' }, 'Moved back to pending')} style={btn(C.paper, C.graphite, C.ash)}>Set pending</button>}
                  <button onClick={() => setDeleting(r)} style={btn(C.paper, C.stone, C.ash)} title="Delete this request">🗑 Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Pagination page={page} pageCount={paging.pages} onChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} loading={rows == null} />

      <LocalMonthlyEarnings />

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
          <select value={plan} onChange={e => { setPlan(e.target.value); setMonths(localPlanFor(e.target.value)?.months ?? 1) }}
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
              {busy ? <Spinner size={12} color="#fff" /> : `Approve and give ${PLAN_LABELS[plan as PlanSlug]}`}
            </button>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal onClose={() => setDeleting(null)}>
          <p style={{ fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: 6 }}>Delete this request?</p>
          <p style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.55, marginBottom: 16 }}>
            {deleting.userName || deleting.userEmail} · {localPlanFor(deleting.plan)?.label ?? planName(deleting.plan)} · {formatPkr(deleting.amountPkr)}.
            The request and its screenshot are removed permanently.
            {deleting.status === 'approved' && ' The plan it granted stays on the user until it expires; change it in Users if it should end now.'}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setDeleting(null)} style={btn(C.paper, C.ink, C.ash)}>Cancel</button>
            <button disabled={busy} onClick={() => void remove(deleting)} style={btn('#B91C1C', '#fff')}>{busy ? <Spinner size={12} color="#fff" /> : 'Delete request'}</button>
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
            <button disabled={busy} onClick={() => void act(rejecting, { action: 'reject', note }, 'Payment rejected')} style={btn('#B91C1C', '#fff')}>{busy ? <Spinner size={12} color="#fff" /> : 'Reject payment'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** Local (bank / JazzCash) earnings per month, from the same report as Admin Earnings. */
const LM_GRID = '1.4fr 0.8fr 1.1fr 0.7fr 0.8fr 0.9fr'
function LocalMonthlyEarnings() {
  const [report, setReport] = useState<RevenueReport | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    fetch('/api/admin/earnings/report', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j?.success) setReport(j.data); else setFailed(true) })
      .catch(() => setFailed(true))
  }, [])
  const months = (report?.months ?? []).filter(m => m.local.payments || m.local.notRenewed)
  const monthName = (m: string) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) }
  const total = months.reduce((n, m) => n + m.local.revenuePkr, 0)
  return (
    <div style={{ marginTop: 18 }}>
      <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.stone }}>approved payments · {formatPkr(total)} total</span>}>Local earnings by month</SectionTitle>
      {failed ? <p style={{ fontSize: 13, color: C.graphite }}>Could not load the monthly record.</p>
      : !report ? <LoadingBlock label="Loading report" height={160} />
      : months.length === 0 ? <p style={{ fontSize: 13, color: C.graphite }}>No approved local payments yet.</p>
      : (
        <div className="rtable" style={{ ...tableCard, overflowX: 'auto' }}>
          <div style={{ minWidth: 620 }}>
            <div style={tableHead(LM_GRID)}>
              {['Month', 'Payments', 'Earned', 'New', 'Renewed', 'Not renewed'].map((h, i) => <span key={h} style={{ ...th, textAlign: i ? 'right' : 'left' }}>{h}</span>)}
            </div>
            {months.map((m, i) => (
              <div key={m.month} style={{ ...tableRow(LM_GRID), background: i % 2 ? C.canvas : 'transparent' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{monthName(m.month)}</span>
                <span style={{ fontSize: 13, fontFamily: MONO, textAlign: 'right' }}>{m.local.payments}</span>
                <span style={{ fontSize: 13, fontFamily: MONO, textAlign: 'right', color: '#1F7A44', fontWeight: 600 }}>{formatPkr(m.local.revenuePkr)}</span>
                <span style={{ fontSize: 13, fontFamily: MONO, textAlign: 'right' }}>{m.local.newCustomers}</span>
                <span style={{ fontSize: 13, fontFamily: MONO, textAlign: 'right', color: '#7C3AED' }}>{m.local.renewals}</span>
                <span style={{ fontSize: 13, fontFamily: MONO, textAlign: 'right', color: m.local.notRenewed ? '#B91C1C' : C.ink }}>{m.local.notRenewed}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

