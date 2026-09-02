'use client'
/* eslint-disable react-hooks/set-state-in-effect */
/**
 * Admin: full oversight of the affiliate program. The list shows every affiliate
 * with clicks, signups, sales and money owed. Opening one reveals the payout
 * details (where to send money), every referred user (emails included), and every
 * commission - each of which the admin can move to approved / paid / refunded.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { C } from '@/utils'
import { MONO, SectionTitle, StatCard, EmptyState, cardStyle, tableCard, tableHead, th, tableRow, tdMono, Pagination } from '@/components/dashboard/kit'

interface Row {
  id: string; code: string; link: string; ownerName: string; ownerEmail: string
  status: string; commissionRate: number; clicks: number; signups: number; conversions: number
  earnedTotal: number; paidTotal: number; pendingUsd: number; payoutMethod: string | null; hasPayout: boolean
}
interface RefUser { id: string; name: string; email: string; plan: string; subscriptionStatus: string | null; joinedAt: string | null }
interface Conv { id: string; email: string; name: string | null; plan: string; grossUsd: number; commissionUsd: number; status: string; date: string | null; paidAt: string | null }
interface Detail extends Row {
  payoutName: string | null; payoutNumber: string | null; payoutBank: string | null
  referredUsers: RefUser[]; conversionList: Conv[]
}

const PAGE = 15
const money = (n?: number | null) => `$${(n ?? 0).toFixed(2)}`
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  pending:  { bg: '#FDF0E1', fg: '#B4690E', label: 'Pending' },
  approved: { bg: '#E7F0FB', fg: '#1F5FA6', label: 'Approved' },
  paid:     { bg: '#E4F3E9', fg: '#1F7A44', label: 'Paid' },
  refunded: { bg: '#F0EFEA', fg: '#7A7A72', label: 'Refunded' },
}
const PLAN_LABEL: Record<string, string> = { free: 'Free', starter: 'Starter', basic: 'Basic', pro: 'Pro', 'pro-1yr': 'Pro · 1-Year', business: 'Business', agency: 'Agency', enterprise: 'Enterprise' }
const LIST_GRID = '2fr 0.7fr 0.8fr 0.6fr 0.9fr 0.9fr 0.7fr'
const CONV_GRID = '1.7fr 0.8fr 0.8fr 0.9fr auto'
const REF_GRID = '1.2fr 1.7fr 0.8fr 0.9fr'

export function AdminAffiliates() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [busy, setBusy] = useState(false)
  const [listPage, setListPage] = useState(1)
  const [convPage, setConvPage] = useState(1)
  const [refPage, setRefPage] = useState(1)

  const loadList = useCallback(async () => {
    try { const r = await fetch('/api/admin/affiliates'); const j = await r.json(); setRows(j?.success ? j.data : []) }
    catch { setRows([]) }
  }, [])
  useEffect(() => { loadList() }, [loadList])

  const openDetail = useCallback(async (id: string) => {
    setSel(id); setDetail(null); setConvPage(1); setRefPage(1)
    try { const r = await fetch(`/api/admin/affiliates/${id}`); const j = await r.json(); if (j?.success) setDetail(j.data) }
    catch { /* ignore */ }
  }, [])

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(true)
    try { await fetch(`/api/admin/affiliates/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }
    finally { setBusy(false); await openDetail(id); await loadList() }
  }

  const listPageCount = Math.max(1, Math.ceil((rows?.length ?? 0) / PAGE))
  const listRows = useMemo(() => (rows ?? []).slice((listPage - 1) * PAGE, listPage * PAGE), [rows, listPage])

  // ── Detail view ────────────────────────────────────────────────────────────
  if (sel) {
    if (!detail) return <div style={cardStyle}><div className="shimmer" style={{ height: 220, borderRadius: 8, background: '#e8e7e2' }} /></div>
    const owed = Math.max(0, detail.earnedTotal - detail.paidTotal)
    const convCount = Math.max(1, Math.ceil(detail.conversionList.length / PAGE))
    const refCount = Math.max(1, Math.ceil(detail.referredUsers.length / PAGE))
    const convRows = detail.conversionList.slice((convPage - 1) * PAGE, convPage * PAGE)
    const refRows = detail.referredUsers.slice((refPage - 1) * PAGE, refPage * PAGE)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <button onClick={() => { setSel(null); setDetail(null) }} style={{ alignSelf: 'flex-start', background: 'transparent', border: `1px solid ${C.ash}`, color: C.graphite, borderRadius: 8, padding: '7px 14px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>← All affiliates</button>

        {/* Header */}
        <div style={{ ...cardStyle, padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 19, fontWeight: 600, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>{detail.ownerName}</h3>
              <p style={{ fontSize: 13.5, color: C.graphite, margin: '4px 0 0' }}>{detail.ownerEmail}</p>
              <p style={{ fontSize: 12.5, fontFamily: MONO, color: C.stone, marginTop: 7 }}>code: {detail.code} · {Math.round(detail.commissionRate * 100)}% recurring · {detail.conversions} paying referral{detail.conversions === 1 ? '' : 's'} {detail.status === 'suspended' && <span style={{ color: C.danger }}>· suspended</span>}</p>
            </div>
            <button onClick={() => patch(detail.id, { affiliateStatus: detail.status === 'active' ? 'suspended' : 'active' })} disabled={busy}
              style={{ alignSelf: 'flex-start', background: detail.status === 'active' ? C.dangerBg : '#E4F3E9', color: detail.status === 'active' ? C.danger : '#1F7A44', border: `1px solid ${detail.status === 'active' ? C.danger : '#1F7A44'}`, borderRadius: 8, padding: '8px 16px', fontSize: 12.5, fontWeight: 600, fontFamily: MONO, cursor: 'pointer' }}>
              {detail.status === 'active' ? 'Suspend' : 'Reactivate'}
            </button>
          </div>
        </div>

        {/* Stat tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
          <StatCard label="Clicks" value={String(detail.clicks)} accent={C.ink} />
          <StatCard label="Signups" value={String(detail.signups)} accent="#2563EB" />
          <StatCard label="Sales" value={String(detail.conversions)} accent="#7C3AED" />
          <StatCard label="Earned" value={money(detail.earnedTotal)} accent={C.ink} />
          <StatCard label="Owed" value={money(owed)} accent={C.orange} />
          <StatCard label="Paid" value={money(detail.paidTotal)} accent="#1F7A44" />
        </div>

        {/* Payout details */}
        <div style={{ ...cardStyle, padding: 22 }}>
          <div style={{ fontSize: 12, fontFamily: MONO, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Payout details</div>
          {detail.payoutMethod ? (
            <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', fontSize: 14.5, color: C.ink, lineHeight: 1.5 }}>
              <div><div style={{ fontSize: 12, color: C.stone, marginBottom: 3 }}>Method</div>{detail.payoutMethod === 'bank' ? 'Bank account' : detail.payoutMethod === 'jazzcash' ? 'JazzCash' : 'Easypaisa'}</div>
              <div><div style={{ fontSize: 12, color: C.stone, marginBottom: 3 }}>Name</div>{detail.payoutName || '-'}</div>
              {detail.payoutBank && <div><div style={{ fontSize: 12, color: C.stone, marginBottom: 3 }}>Bank</div>{detail.payoutBank}</div>}
              <div><div style={{ fontSize: 12, color: C.stone, marginBottom: 3 }}>Number</div><span style={{ fontFamily: MONO }}>{detail.payoutNumber || '-'}</span></div>
            </div>
          ) : <p style={{ fontSize: 14, color: C.stone, margin: 0 }}>This affiliate has not added payout details yet.</p>}
          {owed > 0 && (
            <button onClick={() => patch(detail.id, { action: 'markAllPaid' })} disabled={busy}
              style={{ marginTop: 16, background: C.orange, color: '#fff', border: 'none', borderRadius: 100, padding: '10px 20px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
              {busy ? 'Working…' : `Mark all owed (${money(owed)}) as paid`}
            </button>
          )}
        </div>

        {/* Commissions */}
        <div>
          <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: '#808080' }}>{detail.conversionList.length} total</span>}>Commissions</SectionTitle>
          {detail.conversionList.length === 0 ? <EmptyState icon="💸" title="No commissions yet" sub="They appear when a referred user buys a paid plan." /> : (
            <>
              <div className="rtable" style={tableCard}>
                <div style={tableHead(CONV_GRID)}>{['Buyer', 'Plan', 'Commission', 'Status', 'Actions'].map((h, i) => <span key={i} style={th}>{h}</span>)}</div>
                {convRows.map((c, i) => {
                  const s = STATUS_STYLE[c.status] ?? STATUS_STYLE.pending
                  return (
                    <div key={c.id} style={{ ...tableRow(CONV_GRID), background: i % 2 ? C.canvas : 'transparent' }}>
                      <span style={{ fontSize: 14, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</span>
                      <span style={{ fontSize: 13.5, color: C.graphite }}>{PLAN_LABEL[c.plan] ?? c.plan}</span>
                      <span style={tdMono}>{money(c.commissionUsd)}</span>
                      <span style={{ justifySelf: 'start', fontSize: 11.5, fontWeight: 600, color: s.fg, background: s.bg, borderRadius: 100, padding: '4px 11px' }}>{s.label}</span>
                      <div style={{ display: 'flex', gap: 6, justifySelf: 'end', flexWrap: 'wrap' }}>
                        {c.status !== 'approved' && c.status !== 'paid' && <ActBtn label="Approve" onClick={() => patch(detail.id, { conversionId: c.id, status: 'approved' })} busy={busy} />}
                        {c.status !== 'paid' && <ActBtn label="Paid" primary onClick={() => patch(detail.id, { conversionId: c.id, status: 'paid' })} busy={busy} />}
                        {c.status !== 'refunded' && c.status !== 'paid' && <ActBtn label="Void" danger onClick={() => patch(detail.id, { conversionId: c.id, status: 'refunded' })} busy={busy} />}
                      </div>
                    </div>
                  )
                })}
              </div>
              <Pagination page={convPage} pageCount={convCount} onChange={setConvPage} />
            </>
          )}
        </div>

        {/* Referred users */}
        <div>
          <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: '#808080' }}>{detail.referredUsers.length} users</span>}>Referred users</SectionTitle>
          {detail.referredUsers.length === 0 ? <EmptyState icon="👥" title="No signups yet" sub="Nobody has registered through this link so far." /> : (
            <>
              <div className="rtable" style={tableCard}>
                <div style={tableHead(REF_GRID)}>{['Name', 'Email', 'Plan', 'Joined'].map((h, i) => <span key={i} style={th}>{h}</span>)}</div>
                {refRows.map((u, i) => (
                  <div key={u.id} style={{ ...tableRow(REF_GRID), background: i % 2 ? C.canvas : 'transparent' }}>
                    <span style={{ fontSize: 14, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                    <span style={{ fontSize: 13.5, color: C.graphite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: u.plan === 'free' ? C.stone : C.orange, textTransform: 'capitalize' }}>{PLAN_LABEL[u.plan] ?? u.plan}</span>
                    <span style={{ fontSize: 13, color: C.graphite }}>{fmtDate(u.joinedAt)}</span>
                  </div>
                ))}
              </div>
              <Pagination page={refPage} pageCount={refCount} onChange={setRefPage} />
            </>
          )}
        </div>
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────
  if (!rows) return <div style={cardStyle}><div className="shimmer" style={{ height: 200, borderRadius: 8, background: '#e8e7e2' }} /></div>
  if (rows.length === 0) return <EmptyState icon="🤝" title="No affiliates yet" sub="When a user joins the affiliate program from their dashboard, they show up here." />

  const totalOwed = rows.reduce((s, r) => s + r.pendingUsd, 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <StatCard label="Affiliates" value={String(rows.length)} accent={C.ink} />
        <StatCard label="Total owed" value={money(totalOwed)} accent={C.orange} sub="approved + pending" />
        <StatCard label="Total signups" value={String(rows.reduce((s, r) => s + r.signups, 0))} accent="#2563EB" />
        <StatCard label="Total sales" value={String(rows.reduce((s, r) => s + r.conversions, 0))} accent="#7C3AED" />
      </div>

      <div>
        <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: '#808080' }}>{rows.length} affiliates · page {listPage}/{listPageCount}</span>}>All affiliates</SectionTitle>
        <div className="rtable" style={tableCard}>
          <div style={tableHead(LIST_GRID)}>{['Affiliate', 'Clicks', 'Signups', 'Sales', 'Earned', 'Owed', ''].map((h, i) => <span key={i} style={th}>{h}</span>)}</div>
          {listRows.map((r, i) => (
            <div key={r.id} style={{ ...tableRow(LIST_GRID), background: i % 2 ? C.canvas : 'transparent' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.ownerName} {r.status === 'suspended' && <span style={{ fontSize: 11, color: C.danger, fontWeight: 500 }}>· suspended</span>}</div>
                <div style={{ fontSize: 12.5, color: C.stone, fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{r.ownerEmail} · {r.code}</div>
              </div>
              <span style={tdMono}>{r.clicks}</span>
              <span style={tdMono}>{r.signups}</span>
              <span style={tdMono}>{r.conversions}</span>
              <span style={tdMono}>{money(r.earnedTotal)}</span>
              <span style={{ ...tdMono, fontWeight: 600, color: r.pendingUsd > 0 ? C.orange : C.stone }}>{money(r.pendingUsd)}</span>
              <button onClick={() => openDetail(r.id)} style={{ justifySelf: 'end', background: C.ink, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 15px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>View</button>
            </div>
          ))}
        </div>
        <Pagination page={listPage} pageCount={listPageCount} onChange={setListPage} />
      </div>
    </div>
  )
}

function ActBtn({ label, onClick, busy, primary, danger }: { label: string; onClick: () => void; busy: boolean; primary?: boolean; danger?: boolean }) {
  const bg = primary ? C.orange : 'transparent'
  const fg = primary ? '#fff' : danger ? C.danger : C.graphite
  const bd = primary ? C.orange : danger ? C.danger : C.ash
  return (
    <button onClick={onClick} disabled={busy} style={{ background: bg, color: fg, border: `1px solid ${bd}`, borderRadius: 7, padding: '5px 11px', fontSize: 12, fontWeight: 600, fontFamily: MONO, cursor: busy ? 'default' : 'pointer' }}>{label}</button>
  )
}
