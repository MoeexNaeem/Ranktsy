'use client'
/* eslint-disable react-hooks/set-state-in-effect */
/**
 * Affiliate / Refer & Earn. The user gets a referral link, watches their clicks,
 * signups and commissions, and sets where they want to be paid (bank / JazzCash /
 * Easypaisa). Buyers' emails are never shown here - that stays admin-only.
 */
import { useEffect, useState, useCallback } from 'react'
import { C } from '@/utils'
import { Card, SectionTitle, StatCard, EmptyState, MONO, tableCard, tableHead, th, tableRow, tdMono } from '../kit'

interface Conversion { id: string; plan: string; commissionUsd: number; status: string; date: string | null }
interface AffiliateData {
  enrolled: boolean
  payoutMin: number
  code?: string
  link?: string
  commissionRate?: number
  status?: string
  clicks?: number
  signups?: number
  conversions?: number
  earnedTotal?: number
  paidTotal?: number
  payoutMethod?: string | null
  payoutName?: string | null
  payoutNumber?: string | null
  payoutBank?: string | null
  payingReferrals?: number
  tierThreshold?: number
  bonusWindowEnd?: number
  baseRate?: number
  bonusRate?: number
  recurringMonths?: number
  conversionList?: Conversion[]
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  pending:  { bg: '#FDF0E1', fg: '#B4690E', label: 'Pending' },
  approved: { bg: '#E7F0FB', fg: '#1F5FA6', label: 'Approved' },
  paid:     { bg: '#E4F3E9', fg: '#1F7A44', label: 'Paid' },
  refunded: { bg: '#F0EFEA', fg: '#7A7A72', label: 'Refunded' },
}
const money = (n?: number | null) => `$${(n ?? 0).toFixed(2)}`
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const PLAN_LABEL: Record<string, string> = { starter: 'Starter', basic: 'Basic', pro: 'Pro', 'pro-1yr': 'Pro · 1-Year', business: 'Business', agency: 'Agency', enterprise: 'Enterprise' }
const CONV_GRID = '1.4fr 1fr 1.2fr auto'

export function AffiliateTab() {
  const [data, setData] = useState<(AffiliateData & { convList?: Conversion[] }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [method, setMethod] = useState('')
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [bank, setBank] = useState('')
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  const apply = useCallback((j: { data?: AffiliateData }) => {
    const d = j.data
    if (!d) return
    setData({ ...d, convList: d.conversionList })
    setMethod(d.payoutMethod || '')
    setName(d.payoutName || '')
    setNumber(d.payoutNumber || '')
    setBank(d.payoutBank || '')
  }, [])

  const load = useCallback(async () => {
    try { const r = await fetch('/api/affiliate'); apply(await r.json()) }
    catch { setData({ enrolled: false, payoutMin: 50 }) }
  }, [apply])
  useEffect(() => { load() }, [load])

  const enroll = async () => {
    setBusy(true)
    try { const r = await fetch('/api/affiliate', { method: 'POST' }); apply(await r.json()) }
    finally { setBusy(false) }
  }
  const copy = () => {
    if (!data?.link) return
    navigator.clipboard?.writeText(data.link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }
  const savePayout = async () => {
    if (busy) return
    setBusy(true); setNote(''); setSaved(false)
    try {
      const r = await fetch('/api/affiliate', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payoutMethod: method, payoutName: name, payoutNumber: number, payoutBank: bank }) })
      const j = await r.json()
      if (r.ok && j?.success) { apply(j); setSaved(true); setTimeout(() => setSaved(false), 2200) }
      else setNote(j?.error || 'Could not save.')
    } catch { setNote('Network error.') } finally { setBusy(false) }
  }

  if (!data) return <Card><div className="shimmer" style={{ height: 180, borderRadius: 8, background: '#e8e7e2' }} /></Card>

  // Not enrolled yet - a simple opt-in.
  if (!data.enrolled) {
    return (
      <div style={{ maxWidth: 680 }}>
        <Card>
          <SectionTitle>Refer &amp; earn</SectionTitle>
          <p style={{ fontSize: 14.5, color: C.graphite, lineHeight: 1.65, margin: '4px 0 14px' }}>
            Share Rankkw with a link and earn <strong style={{ color: C.ink }}>30% recurring commission</strong> on every plan a person you refer buys, for up to 12 months. You get a unique link, live stats on clicks and signups, and you choose how you want to be paid (bank, JazzCash or Easypaisa).
          </p>
          <p style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.6, margin: '0 0 20px', padding: '10px 14px', background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 10 }}>
            <strong style={{ color: C.orange }}>Bonus:</strong> once you reach 100 paying referrals, referrals 101 to 200 earn <strong style={{ color: C.ink }}>50%</strong>.
          </p>
          <button onClick={enroll} disabled={busy} style={{ background: busy ? C.ash : C.orange, color: '#fff', border: 'none', borderRadius: 100, padding: '13px 26px', fontSize: 15, fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer' }}>
            {busy ? 'Setting up…' : 'Join the affiliate program'}
          </button>
        </Card>
      </div>
    )
  }

  const pending = Math.max(0, (data.earnedTotal ?? 0) - (data.paidTotal ?? 0))
  const rate = Math.round((data.commissionRate ?? 0.3) * 100)
  const paying = data.payingReferrals ?? 0
  const threshold = data.tierThreshold ?? 100
  const windowEnd = data.bonusWindowEnd ?? 200
  const bonusNote = paying < threshold
    ? `${threshold - paying} more paying referral${threshold - paying === 1 ? '' : 's'} unlock a 50% bonus on referrals ${threshold + 1} to ${windowEnd}.`
    : paying < windowEnd
      ? `50% bonus active: you are on referral ${paying + 1} of the ${threshold + 1} to ${windowEnd} bonus window.`
      : `Bonus window complete. New referrals earn ${Math.round((data.baseRate ?? 0.3) * 100)}%.`
  const convs = data.convList ?? []
  const field: React.CSSProperties = { border: `1px solid ${C.ash}`, borderRadius: 10, background: C.canvas, color: C.ink, fontSize: 14, fontFamily: 'inherit', padding: '11px 13px', outline: 'none', width: '100%' }
  const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: C.graphite, marginBottom: 6, display: 'block' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1080 }}>
      {/* Link + commission */}
      <Card>
        <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, fontWeight: 600, color: C.orange, background: C.orangeFaint, padding: '4px 12px', borderRadius: 100 }}>{rate}% recurring</span>}>Your referral link</SectionTitle>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
          <code style={{ flex: 1, minWidth: 240, fontSize: 14, fontFamily: MONO, color: C.ink, background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 10, padding: '12px 15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.link}</code>
          <button onClick={copy} style={{ background: C.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 22px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>{copied ? 'Copied' : 'Copy link'}</button>
        </div>
        <p style={{ fontSize: 13, color: C.stone, marginTop: 11 }}>Share this anywhere. Anyone who signs up through it is tied to you for 60 days, and you earn on their payments for up to 12 months.</p>
        <p style={{ fontSize: 12.5, color: C.graphite, marginTop: 8, padding: '9px 13px', background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 9 }}>{bonusNote}</p>
      </Card>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))', gap: 14 }}>
        <StatCard label="Clicks" value={String(data.clicks ?? 0)} accent={C.ink} />
        <StatCard label="Signups" value={String(data.signups ?? 0)} accent="#2563EB" />
        <StatCard label="Sales" value={String(data.conversions ?? 0)} accent="#7C3AED" />
        <StatCard label="Pending" value={money(pending)} accent={C.orange} sub="owed to you" />
        <StatCard label="Paid out" value={money(data.paidTotal)} accent="#1F7A44" />
      </div>

      {/* Payout details */}
      <Card>
        <SectionTitle>Payout details</SectionTitle>
        <p style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.6, margin: '0 0 18px' }}>
          Tell us where to send your earnings. We pay out once your approved balance passes {money(data.payoutMin)}. Your details are private and only visible to the Rankkw admin.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, maxWidth: 760 }}>
          <div>
            <label style={label}>Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} style={{ ...field, cursor: 'pointer' }}>
              <option value="">Select…</option>
              <option value="bank">Bank account</option>
              <option value="jazzcash">JazzCash</option>
              <option value="easypaisa">Easypaisa</option>
            </select>
          </div>
          <div>
            <label style={label}>Account holder name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" maxLength={80} style={field} />
          </div>
          {method === 'bank' && (
            <div>
              <label style={label}>Bank name</label>
              <input value={bank} onChange={e => setBank(e.target.value)} placeholder="e.g. Meezan Bank" maxLength={60} style={field} />
            </div>
          )}
          <div>
            <label style={label}>{method === 'bank' ? 'Account number / IBAN' : method === 'jazzcash' ? 'JazzCash number' : method === 'easypaisa' ? 'Easypaisa number' : 'Account / wallet number'}</label>
            <input value={number} onChange={e => setNumber(e.target.value)} placeholder={method === 'bank' ? 'PKxx xxxx …' : '03xx xxxxxxx'} maxLength={60} style={field} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18 }}>
          <button onClick={savePayout} disabled={busy} style={{ background: busy ? C.ash : C.orange, color: '#fff', border: 'none', borderRadius: 100, padding: '12px 24px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer' }}>{busy ? 'Saving…' : 'Save payout details'}</button>
          {saved && <span style={{ fontSize: 13, color: '#1F7A44', fontWeight: 600 }}>Saved</span>}
          {note && <span style={{ fontSize: 13, color: C.danger }}>{note}</span>}
        </div>
      </Card>

      {/* Commissions */}
      <div>
        <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: '#808080' }}>{convs.length} total</span>}>Your commissions</SectionTitle>
        {convs.length === 0 ? (
          <EmptyState icon="💸" title="No commissions yet" sub="When someone buys a paid plan through your link, it shows up here as pending, then approved, then paid." />
        ) : (
          <div className="rtable" style={tableCard}>
            <div style={tableHead(CONV_GRID)}>
              {['Plan', 'Commission', 'Date', 'Status'].map((h, i) => <span key={i} style={th}>{h}</span>)}
            </div>
            {convs.map((c, i) => {
              const s = STATUS_STYLE[c.status] ?? STATUS_STYLE.pending
              return (
                <div key={c.id} style={{ ...tableRow(CONV_GRID), background: i % 2 ? C.canvas : 'transparent' }}>
                  <span style={{ fontSize: 14.5, fontWeight: 500, color: C.ink }}>{PLAN_LABEL[c.plan] ?? c.plan}</span>
                  <span style={tdMono}>{money(c.commissionUsd)}</span>
                  <span style={{ fontSize: 13.5, color: C.graphite }}>{fmtDate(c.date)}</span>
                  <span style={{ justifySelf: 'start', fontSize: 12, fontWeight: 600, color: s.fg, background: s.bg, borderRadius: 100, padding: '5px 13px' }}>{s.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
