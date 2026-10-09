'use client'
/* eslint-disable react-hooks/set-state-in-effect */
/**
 * Admin → Earnings → Local payments: every bank / JazzCash payment with its proof
 * screenshot, filtered by customer, plan, status, method and date, to match against
 * the bank statement. Warnings flag reused Transaction IDs, reused screenshots and
 * amounts that differ from the plan price. Exports to CSV and PDF (with screenshots).
 */
import { useEffect, useMemo, useState } from 'react'
import { Spinner, LoadingBlock, ModalShell, StatCard } from './ui'
import { C } from '@/utils'
import { MONO, EmptyState, cardStyle, tableCard, tableHead, th, tableRow, Pagination } from '@/components/dashboard/kit'
import { LOCAL_PLANS } from '@/lib/local-payments'
import type { AuditRow, AuditSummary, AuditFlag } from '@/lib/local-payment-audit'

interface Payer { userId: string; name: string; email: string; payments: number }
interface Res { rows: AuditRow[]; total: number; pages: number; page: number; limit: number; summary: AuditSummary }

const pkr = (n: number) => `Rs ${Math.round(n ?? 0).toLocaleString('en-US')}`
const pktDate = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
const pktTime = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
const pktDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(d)

const FLAG: Record<AuditFlag, { label: string; color: string }> = {
  'duplicate-tid': { label: 'TID used twice', color: '#B91C1C' },
  'duplicate-screenshot': { label: 'Same screenshot', color: '#B91C1C' },
  'amount-mismatch': { label: 'Amount ≠ plan price', color: '#C2410C' },
  'no-proof': { label: 'No screenshot', color: '#6B6B63' },
}
const STATUS: Record<AuditRow['status'], { bg: string; fg: string }> = {
  approved: { bg: '#E4F3E9', fg: '#1F7A44' },
  pending: { bg: '#FEF3C7', fg: '#92400E' },
  rejected: { bg: '#FDE8E8', fg: '#B91C1C' },
}

function Pill({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ height: 32, padding: '0 13px', borderRadius: 100, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
      border: `1px solid ${on ? C.ink : C.ash}`, background: on ? C.ink : C.paper, color: on ? '#fff' : C.ink }}>{children}</button>
  )
}
const ghostBtn: React.CSSProperties = { height: 32, padding: '0 13px', borderRadius: 100, border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }
const field: React.CSSProperties = { height: 34, padding: '0 12px', borderRadius: 10, border: `1px solid ${C.ash}`, background: C.paper, fontFamily: 'inherit', fontSize: 13, color: C.ink, outline: 'none' }

const GRID = 'minmax(118px,0.9fr) minmax(200px,1.7fr) minmax(96px,0.8fr) minmax(76px,0.6fr) minmax(92px,0.7fr) minmax(130px,1fr) minmax(84px,0.6fr) minmax(130px,1fr) 64px'

/** Customer picker: search people who have paid locally, pick several. */
function PayerPicker({ picked, onChange }: { picked: Payer[]; onChange: (p: Payer[]) => void }) {
  const [text, setText] = useState('')
  const [opts, setOpts] = useState<Payer[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    let alive = true
    setBusy(true)
    const t = setTimeout(() => {
      fetch(`/api/admin/local-payments/audit?payers=${encodeURIComponent(text.trim())}`, { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (alive && j?.success) setOpts(j.data) }).catch(() => {})
        .finally(() => { if (alive) setBusy(false) })
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [text, open])
  const ids = new Set(picked.map(p => p.userId))
  return (
    <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 420 }}>
      <div style={{ ...field, height: 'auto', minHeight: 34, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, padding: '4px 8px' }}>
        {picked.map(p => (
          <span key={p.userId} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '2px 6px 2px 9px', borderRadius: 100, background: C.canvas, border: `1px solid ${C.ash}`, maxWidth: 200 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.email}>{p.name || p.email}</span>
            <button aria-label={`Remove ${p.email}`} onClick={() => onChange(picked.filter(x => x.userId !== p.userId))}
              style={{ border: 0, background: 'transparent', cursor: 'pointer', color: C.graphite, fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
          </span>
        ))}
        <input value={text} onChange={e => setText(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={picked.length ? 'Add another customer…' : 'All customers (search to pick)'}
          style={{ flex: '1 1 140px', minWidth: 120, border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 13, height: 24 }} />
      </div>
      {open && (
        <div style={{ position: 'absolute', zIndex: 30, top: 'calc(100% + 4px)', left: 0, right: 0, background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', maxHeight: 280, overflowY: 'auto' }}>
          {busy && !opts.length ? <div style={{ padding: 12 }}><Spinner size={12} /></div>
            : !opts.length ? <p style={{ margin: 0, padding: '10px 12px', fontSize: 12.5, color: C.graphite }}>No customer found.</p>
            : opts.map(o => (
              <button key={o.userId} onMouseDown={e => e.preventDefault()} onClick={() => { if (!ids.has(o.userId)) onChange([...picked, o]); setText('') }}
                style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 10, padding: '8px 12px', border: 0, borderBottom: `1px solid ${C.hair}`, background: ids.has(o.userId) ? C.canvas : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name || '(no name)'}</span>
                  <span style={{ display: 'block', fontSize: 12, color: C.graphite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.email}</span>
                </span>
                <span style={{ fontSize: 11.5, fontFamily: MONO, color: C.stone, whiteSpace: 'nowrap' }}>{o.payments} paid{ids.has(o.userId) ? ' ✓' : ''}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

function ProofThumb({ row, onOpen }: { row: AuditRow; onOpen: () => void }) {
  if (!row.hasProof) return <span style={{ fontSize: 11.5, color: C.stone }}>none</span>
  if (row.proofType === 'application/pdf') {
    return <a href={`/api/admin/local-payments/${row.id}/proof`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, fontWeight: 700, color: '#2563EB' }}>PDF ↗</a>
  }
  return (
    <button onClick={onOpen} title="View screenshot" style={{ padding: 0, border: `1px solid ${C.ash}`, borderRadius: 8, background: C.canvas, cursor: 'zoom-in', width: 44, height: 44, overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/admin/local-payments/${row.id}/proof`} alt="Payment screenshot" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </button>
  )
}

export function AdminLocalAudit() {
  const [users, setUsers] = useState<Payer[]>([])
  const [plan, setPlan] = useState('')
  const [status, setStatus] = useState<'approved' | 'pending' | 'rejected' | 'all'>('approved')
  const [method, setMethod] = useState<'all' | 'bank' | 'jazzcash'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [flagged, setFlagged] = useState(false)
  const [page, setPage] = useState(1)
  const [res, setRes] = useState<Res | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<AuditRow | null>(null)
  const [exporting, setExporting] = useState<'' | 'csv' | 'pdf'>('')
  const [exportErr, setExportErr] = useState('')

  const params = useMemo(() => {
    const p = new URLSearchParams({ status, method })
    if (users.length) p.set('users', users.map(u => u.userId).join(','))
    if (plan) p.set('plan', plan)
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    if (flagged) p.set('flagged', '1')
    return p
  }, [users, plan, status, method, from, to, flagged])

  // Any filter change starts again from the first page.
  useEffect(() => { setPage(1) }, [params])

  useEffect(() => {
    let alive = true
    setLoading(true)
    const p = new URLSearchParams(params)
    p.set('page', String(page)); p.set('limit', '25')
    fetch(`/api/admin/local-payments/audit?${p}`, { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive && j?.success) setRes(j.data) }).catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [params, page])

  const preset = (k: 'this' | 'last') => {
    const now = new Date()
    const [y, m] = pktDay(now).split('-').map(Number)
    const first = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}-01`
    const lastDay = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}-${String(new Date(Date.UTC(yy, mm, 0)).getUTCDate()).padStart(2, '0')}`
    if (k === 'this') { setFrom(first(y, m)); setTo(pktDay(now)) }
    else { const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; setFrom(first(py, pm)); setTo(lastDay(py, pm)) }
  }

  async function exportFile(kind: 'csv' | 'pdf') {
    setExporting(kind); setExportErr('')
    try {
      const p = new URLSearchParams(params); p.set('format', kind)
      const r = await fetch(`/api/admin/local-payments/audit?${p}`, { cache: 'no-store' })
      if (!r.ok) { const j = await r.json().catch(() => null); setExportErr(j?.error ?? 'Export failed, please try again.'); return }
      const href = URL.createObjectURL(await r.blob())
      const a = document.createElement('a')
      a.href = href; a.download = `rankkw-local-payments-${pktDay(new Date())}.${kind}`; a.click()
      URL.revokeObjectURL(href)
    } catch { setExportErr('Export failed, please try again.') } finally { setExporting('') }
  }

  const s = res?.summary
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filters */}
      <div style={{ ...cardStyle, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <PayerPicker picked={users} onChange={setUsers} />
          <select value={plan} onChange={e => setPlan(e.target.value)} aria-label="Plan" style={{ ...field, cursor: 'pointer' }}>
            <option value="">All plans</option>
            {LOCAL_PLANS.map(p => <option key={p.slug} value={p.slug}>{p.label} ({pkr(p.pkr)})</option>)}
          </select>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.graphite }}>
            From <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} style={field} />
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.graphite }}>
            To <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} style={field} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['approved', 'pending', 'rejected', 'all'] as const).map(v => <Pill key={v} on={status === v} onClick={() => setStatus(v)}>{v === 'all' ? 'Any status' : v[0].toUpperCase() + v.slice(1)}</Pill>)}
          <span style={{ width: 1, height: 20, background: C.ash, margin: '0 4px' }} />
          {(['all', 'bank', 'jazzcash'] as const).map(v => <Pill key={v} on={method === v} onClick={() => setMethod(v)}>{v === 'all' ? 'Bank + JazzCash' : v === 'bank' ? 'Bank' : 'JazzCash'}</Pill>)}
          <span style={{ width: 1, height: 20, background: C.ash, margin: '0 4px' }} />
          <button onClick={() => preset('this')} style={ghostBtn}>This month</button>
          <button onClick={() => preset('last')} style={ghostBtn}>Last month</button>
          {(from || to) && <button onClick={() => { setFrom(''); setTo('') }} style={ghostBtn}>All dates</button>}
          <Pill on={flagged} onClick={() => setFlagged(f => !f)}>⚠ Only with warnings</Pill>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => void exportFile('csv')} disabled={!!exporting || !res?.total} style={ghostBtn}>{exporting === 'csv' ? <Spinner size={11} /> : null}Export CSV</button>
            <button onClick={() => void exportFile('pdf')} disabled={!!exporting || !res?.total} style={ghostBtn}>{exporting === 'pdf' ? <Spinner size={11} /> : null}Export PDF (with screenshots)</button>
          </div>
        </div>
        {exportErr && <p style={{ margin: 0, fontSize: 12.5, color: '#B91C1C' }}>{exportErr}</p>}
      </div>

      {/* Summary */}
      {s && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          <StatCard label="Payments" value={s.payments.toLocaleString()} sub={flagged ? 'with warnings only' : 'matching the filters'} accent={C.ink} />
          <StatCard label="Total received" value={pkr(s.totalPkr)} sub="bank + JazzCash" accent="#1F7A44" />
          <StatCard label="Bank transfer" value={pkr(s.bankPkr)} sub="to match with the bank statement" accent="#2563EB" />
          <StatCard label="JazzCash" value={pkr(s.jazzcashPkr)} sub="to match with JazzCash history" accent={C.orange} />
          <StatCard label="With warnings" value={s.flagged.toLocaleString()} sub="reused TID or screenshot, odd amount" accent="#B91C1C" />
        </div>
      )}

      {/* Table */}
      {!res && loading ? <LoadingBlock label="Loading local payments" height={200} />
      : !res || !res.rows.length ? <div style={cardStyle}><EmptyState icon="🧾" title="No local payments match" sub="Change the customers, plan, dates or status." /></div>
      : (
        <>
          <div className="rtable" style={{ ...tableCard, overflowX: 'auto', opacity: loading ? 0.6 : 1 }}>
            <div style={{ minWidth: 1180 }}>
              <div style={tableHead(GRID)}>
                {['Paid (PKT)', 'Customer', 'Plan', 'Method', 'Amount', 'Transaction ID', 'Status', 'Warnings', 'Proof'].map((h, i) =>
                  <span key={h} style={{ ...th, textAlign: i === 4 ? 'right' : 'left' }}>{h}</span>)}
              </div>
              {res.rows.map((r, i) => {
                const tidDup = r.flags.includes('duplicate-tid')
                const odd = r.flags.includes('amount-mismatch')
                return (
                  <div key={r.id} style={{ ...tableRow(GRID), alignItems: 'center', background: r.flags.some(f => f !== 'no-proof') ? 'rgba(185,28,28,0.04)' : i % 2 ? C.canvas : 'transparent' }}>
                    <span style={{ fontSize: 12.5, color: C.ink }}>{pktDate(r.paidAt)}<span style={{ display: 'block', fontSize: 11.5, fontFamily: MONO, color: C.stone }}>{pktTime(r.paidAt)}</span></span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || '(no name)'}</span>
                      <span style={{ display: 'block', fontSize: 12, color: C.graphite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.email}>{r.email}</span>
                    </span>
                    <span style={{ fontSize: 12.5, color: C.ink }}>{r.planLabel}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: r.method === 'bank' ? '#2563EB' : C.orange }}>{r.method === 'bank' ? 'Bank' : 'JazzCash'}</span>
                    <span style={{ fontFamily: MONO, fontSize: 13, textAlign: 'right', fontWeight: 600, color: odd ? '#C2410C' : C.ink }} title={odd && r.planPricePkr ? `Plan price is ${pkr(r.planPricePkr)}` : undefined}>{pkr(r.amountPkr)}</span>
                    <span style={{ fontFamily: MONO, fontSize: 12.5, color: tidDup ? '#B91C1C' : C.ink, fontWeight: tidDup ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.reference}>{r.reference || '-'}</span>
                    <span><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: STATUS[r.status].bg, color: STATUS[r.status].fg }}>{r.status[0].toUpperCase() + r.status.slice(1)}</span></span>
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {r.flags.map(f => <span key={f} style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 6, color: FLAG[f].color, background: f === 'no-proof' ? C.canvas : 'rgba(185,28,28,0.08)' }}>{FLAG[f].label}</span>)}
                    </span>
                    <ProofThumb row={r} onOpen={() => setView(r)} />
                  </div>
                )
              })}
            </div>
          </div>
          <p style={{ fontSize: 12, color: C.stone, fontFamily: MONO, margin: 0 }}>
            Showing {(res.page - 1) * res.limit + 1}-{Math.min(res.page * res.limit, res.total)} of {res.total}
          </p>
          <Pagination page={res.page} pageCount={res.pages} onChange={setPage} loading={loading} />
        </>
      )}

      {view && (
        <ModalShell onClose={() => setView(null)} width={620}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.ink }}>{view.name || '(no name)'} · {pkr(view.amountPkr)}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: C.graphite }}>
                {view.email} · {view.method === 'bank' ? 'Bank' : 'JazzCash'} · TID <span style={{ fontFamily: MONO }}>{view.reference || '-'}</span> · {pktDate(view.paidAt)} {pktTime(view.paidAt)} PKT
              </p>
            </div>
            <a href={`/api/admin/local-payments/${view.id}/proof`} target="_blank" rel="noopener noreferrer" style={{ ...ghostBtn, textDecoration: 'none' }}>Open full size ↗</a>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/admin/local-payments/${view.id}/proof`} alt="Payment screenshot" style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', margin: '0 auto', borderRadius: 8, border: `1px solid ${C.ash}` }} />
        </ModalShell>
      )}
    </div>
  )
}
