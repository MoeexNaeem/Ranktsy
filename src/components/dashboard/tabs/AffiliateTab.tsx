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
import { copyWithToast, toast } from '@/components/ui/toast'

interface Conversion { id: string; plan: string; commissionUsd: number; status: string; date: string | null }
interface CustomLink { id: string; code: string; link: string; label: string | null; clicks: number; signups: number; createdAt: string | null }
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
  maxCustomLinks?: number
  codeMin?: number
  codeMax?: number
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

// Mirrors CODE_RE in lib/affiliate.ts, so the field rejects what the API would
// reject rather than letting the user submit and fail.
const CODE_RE = /^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$/
/** What the user typed, turned into a candidate code (spaces become hyphens). */
const cleanCode = (v: string) => v.trim().toLowerCase().replace(/\s+/g, '-')

/**
 * Custom referral links.
 *
 * The affiliate's default link always works and is shown above; these are the
 * readable ones they create per channel. A code is unique across the whole
 * programme, so the API answers 409 for a clash and that message is shown
 * inline on the field. Deleting a link never affects referrals it already
 * brought in, because commission is attributed to the affiliate.
 */
function CustomLinks({ base, enabled }: { base: string; enabled: boolean }) {
  const [links, setLinks] = useState<CustomLink[] | null>(null)
  const [max, setMax] = useState(10)
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  // The link currently being renamed, plus its draft values.
  const [editId, setEditId] = useState<string | null>(null)
  const [editCode, setEditCode] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editErr, setEditErr] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/affiliate/links')
      const j = await r.json()
      if (j?.success) { setLinks(j.data?.links ?? []); setMax(j.data?.max ?? 10) }
      else setLinks([])
    } catch { setLinks([]) }
  }, [])
  useEffect(() => { if (enabled) load() }, [enabled, load])

  const field: React.CSSProperties = { border: `1px solid ${C.ash}`, borderRadius: 10, background: C.canvas, color: C.ink, fontSize: 14, fontFamily: 'inherit', padding: '11px 13px', outline: 'none', width: '100%' }
  const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: C.graphite, marginBottom: 6, display: 'block' }
  const ghostBtn: React.CSSProperties = { background: 'transparent', border: `1px solid ${C.ash}`, borderRadius: 8, color: C.graphite, fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', padding: '7px 13px', cursor: 'pointer' }

  const create = async () => {
    const c = cleanCode(code)
    setErr('')
    if (!CODE_RE.test(c)) {
      setErr('Use 3 to 40 characters: lowercase letters, numbers, hyphens or underscores, starting and ending with a letter or number.')
      return
    }
    setBusy(true)
    try {
      const r = await fetch('/api/affiliate/links', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c, label }),
      })
      const j = await r.json()
      if (r.ok && j?.success) {
        setLinks(j.data?.links ?? [])
        setCode(''); setLabel('')
        toast.success('Custom link created', j.data?.link?.link ?? '')
      } else {
        // 409 means the code is taken - the message is written for the user.
        setErr(j?.error || 'Could not create that link.')
      }
    } catch { setErr('Network error. Please try again.') }
    finally { setBusy(false) }
  }

  const startEdit = (l: CustomLink) => {
    setEditId(l.id); setEditCode(l.code); setEditLabel(l.label ?? ''); setEditErr(''); setConfirmId(null)
  }

  const saveEdit = async () => {
    if (!editId) return
    const c = cleanCode(editCode)
    setEditErr('')
    if (!CODE_RE.test(c)) {
      setEditErr('Use 3 to 40 characters: lowercase letters, numbers, hyphens or underscores.')
      return
    }
    setBusy(true)
    try {
      const r = await fetch('/api/affiliate/links', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editId, code: c, label: editLabel }),
      })
      const j = await r.json()
      if (r.ok && j?.success) {
        setLinks(j.data?.links ?? [])
        setEditId(null)
        toast.success('Custom link updated')
      } else {
        setEditErr(j?.error || 'Could not update that link.')
      }
    } catch { setEditErr('Network error. Please try again.') }
    finally { setBusy(false) }
  }

  const remove = async (id: string) => {
    setBusy(true)
    try {
      const r = await fetch(`/api/affiliate/links?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const j = await r.json()
      if (r.ok && j?.success) {
        setLinks(j.data?.links ?? [])
        setConfirmId(null)
        toast.success('Custom link deleted', 'Referrals it already brought in are unaffected.')
      } else {
        toast.error('Could not delete that link', j?.error || 'Please try again.')
      }
    } catch { toast.error('Could not delete that link', 'Network error. Please try again.') }
    finally { setBusy(false) }
  }

  const rows = links ?? []
  const atMax = rows.length >= max

  return (
    <Card>
      <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: '#808080' }}>{rows.length} of {max}</span>}>
        Your custom links
      </SectionTitle>
      <p style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.6, margin: '0 0 18px' }}>
        Make a readable link for each place you promote, so you can tell which one works. Every custom link points at
        the same account as your default link, and you can rename or delete one at any time without losing referrals it
        already brought in.
      </p>

      {/* Create */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.2fr) minmax(180px, 1fr) auto', gap: 12, alignItems: 'end', maxWidth: 760 }}>
        <div>
          <label style={labelStyle} htmlFor="rk-new-code">Link name</label>
          <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${err ? C.danger : C.ash}`, borderRadius: 10, background: C.canvas, overflow: 'hidden' }}>
            <span style={{ fontSize: 13, fontFamily: MONO, color: C.stone, padding: '11px 0 11px 12px', whiteSpace: 'nowrap' }}>{base}/?ref=</span>
            <input id="rk-new-code" value={code} onChange={e => { setCode(e.target.value); setErr('') }}
              onKeyDown={e => { if (e.key === 'Enter') create() }}
              placeholder="spring-video" maxLength={40} spellCheck={false}
              style={{ ...field, border: 'none', borderRadius: 0, padding: '11px 12px 11px 2px', fontFamily: MONO }} />
          </div>
        </div>
        <div>
          <label style={labelStyle} htmlFor="rk-new-label">Note (optional)</label>
          <input id="rk-new-label" value={label} onChange={e => setLabel(e.target.value)} placeholder="YouTube description" maxLength={60} style={field} />
        </div>
        <button onClick={create} disabled={busy || atMax}
          style={{ background: busy || atMax ? C.ash : C.orange, color: '#fff', border: 'none', borderRadius: 100, padding: '12px 22px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: busy || atMax ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
          {busy ? 'Working…' : 'Create link'}
        </button>
      </div>
      {err && <p style={{ fontSize: 13, color: C.danger, margin: '10px 0 0', maxWidth: 700, lineHeight: 1.5 }}>{err}</p>}
      {atMax && !err && <p style={{ fontSize: 13, color: C.graphite, margin: '10px 0 0' }}>You have reached the limit of {max} custom links. Delete one to add another.</p>}

      {/* List */}
      <div style={{ marginTop: 22, display: 'grid', gap: 10 }}>
        {links === null ? (
          <div className="shimmer" style={{ height: 58, borderRadius: 12, background: '#e8e7e2' }} />
        ) : rows.length === 0 ? (
          <p style={{ fontSize: 13.5, color: C.stone, margin: 0 }}>No custom links yet. Your default link above already works.</p>
        ) : rows.map(l => (
          <div key={l.id} style={{ border: `1px solid ${C.ash}`, borderRadius: 12, padding: '13px 15px', background: C.canvas }}>
            {editId === l.id ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1.2fr) minmax(160px, 1fr)', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Link name</label>
                    <input value={editCode} onChange={e => { setEditCode(e.target.value); setEditErr('') }}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit() }}
                      maxLength={40} spellCheck={false} style={{ ...field, fontFamily: MONO, borderColor: editErr ? C.danger : C.ash }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Note</label>
                    <input value={editLabel} onChange={e => setEditLabel(e.target.value)} maxLength={60} style={field} />
                  </div>
                </div>
                {editErr && <p style={{ fontSize: 13, color: C.danger, margin: 0, lineHeight: 1.5 }}>{editErr}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={saveEdit} disabled={busy}
                    style={{ background: busy ? C.ash : C.ink, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer' }}>
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditId(null)} style={ghostBtn}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <code style={{ fontSize: 13.5, fontFamily: MONO, color: C.ink, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.link}</code>
                  <span style={{ fontSize: 12, color: C.stone }}>
                    {l.label ? `${l.label} · ` : ''}{l.clicks} click{l.clicks === 1 ? '' : 's'} · {l.signups} signup{l.signups === 1 ? '' : 's'}
                  </span>
                </div>
                {confirmId === l.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: C.graphite }}>Delete this link?</span>
                    <button onClick={() => remove(l.id)} disabled={busy}
                      style={{ background: C.danger, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer' }}>
                      Delete
                    </button>
                    <button onClick={() => setConfirmId(null)} style={ghostBtn}>Keep</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => copyWithToast(l.link, 'Custom link')} style={ghostBtn}>Copy</button>
                    <button onClick={() => startEdit(l)} style={ghostBtn}>Edit</button>
                    <button onClick={() => setConfirmId(l.id)} style={{ ...ghostBtn, color: C.danger, borderColor: C.ash }}>Delete</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

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
    try {
      const r = await fetch('/api/affiliate', { method: 'POST' })
      const j = await r.json()
      apply(j)
      if (r.ok && j?.success !== false) toast.success('You’re in!', 'Your referral link is ready to share.')
      else toast.error('Could not join', j?.error || 'Please try again.')
    } catch { toast.error('Could not join', 'Network error. Please try again.') }
    finally { setBusy(false) }
  }
  const copy = () => {
    if (!data?.link) return
    copyWithToast(data.link, 'Referral link'); setCopied(true); setTimeout(() => setCopied(false), 1600)
  }
  const savePayout = async () => {
    if (busy) return
    setBusy(true); setNote(''); setSaved(false)
    try {
      const r = await fetch('/api/affiliate', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payoutMethod: method, payoutName: name, payoutNumber: number, payoutBank: bank }) })
      const j = await r.json()
      if (r.ok && j?.success) { apply(j); setSaved(true); setTimeout(() => setSaved(false), 2200); toast.success('Payout details saved') }
      else { setNote(j?.error || 'Could not save.'); toast.error('Payout details not saved', j?.error || 'Please try again.') }
    } catch { setNote('Network error.'); toast.error('Payout details not saved', 'Network error. Please try again.') } finally { setBusy(false) }
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
  // Derive the origin from the affiliate's own link, so the prefix shown beside
  // the input is the real one for this environment.
  const linkBase = (() => {
    try { return new URL(data.link ?? '').origin } catch { return '' }
  })()
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

      {/* Custom links the affiliate creates, edits and deletes themselves. */}
      <CustomLinks base={linkBase} enabled={data.status !== 'suspended'} />

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
