'use client'
/* eslint-disable react-hooks/set-state-in-effect */
/**
 * Admin "Earnings": one source for every number on the page - the full record
 * (card payments from Lemon Squeezy's complete history + approved local bank /
 * JazzCash payments). Pick a year: totals, a monthly chart, month and year tables
 * (new / renewed / did not renew), and every paying customer, searchable and paged.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Spinner, LoadingBlock } from './ui'
import { C } from '@/utils'
import { MONO, SectionTitle, EmptyState, cardStyle, tableCard, tableHead, th, tableRow, Pagination } from '@/components/dashboard/kit'
import { Bars } from './AdminCharts'
import type { RevenueReport, CardMonth, LocalMonth, Customer } from '@/lib/revenue-report'

const usd = (n: number) => `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const usd0 = (n: number) => `$${Math.round(n ?? 0).toLocaleString('en-US')}`
const pkr = (n: number) => `Rs ${Math.round(n ?? 0).toLocaleString('en-US')}`
const monthName = (m: string) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }
const monthShort = (m: string) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'short' }) }
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const NUM: React.CSSProperties = { fontFamily: MONO, fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontSize: 13 }

const totalUsd = (card: CardMonth, local: LocalMonth, rate: number | null) => card.revenueUsd + (rate ? local.revenuePkr * rate : 0)

/** Equal-size summary tile: value never wraps, the sub line carries the split. */
function Tile({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ ...cardStyle, position: 'relative', padding: '16px 18px', minHeight: 108, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', minWidth: 0 }}>
      <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
      <p style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: 500, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 600, color, letterSpacing: '-0.02em', lineHeight: 1.1, margin: '10px 0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      <p style={{ fontSize: 12, color: C.graphite, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</p>
    </div>
  )
}

function Pill({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ height: 32, padding: '0 13px', borderRadius: 100, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
      border: `1px solid ${on ? C.ink : C.ash}`, background: on ? C.ink : C.paper, color: on ? '#fff' : C.ink }}>{children}</button>
  )
}
const ghostBtn: React.CSSProperties = { height: 32, padding: '0 13px', borderRadius: 100, border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }

async function download(url: string, name: string) {
  const r = await fetch(url)
  if (!r.ok) return
  const href = URL.createObjectURL(await r.blob())
  const a = document.createElement('a'); a.href = href; a.download = name; a.click()
  URL.revokeObjectURL(href)
}

const MONTH_GRID = 'minmax(150px,1.4fr) repeat(3, minmax(100px,1fr)) repeat(5, minmax(70px,0.75fr))'
const YEAR_GRID = 'minmax(80px,0.8fr) repeat(3, minmax(100px,1fr)) repeat(4, minmax(70px,0.75fr))'
const CUST_GRID = 'minmax(210px,2.2fr) 0.7fr 0.9fr 1fr 0.7fr 0.7fr 0.8fr 1fr'
const STATUS_STYLE: Record<Customer['status'], { label: string; bg: string; fg: string }> = {
  active:    { label: 'Active',    bg: '#E4F3E9', fg: '#1F7A44' },
  cancelled: { label: 'Cancelled', bg: '#FEF3C7', fg: '#92400E' },
  ended:     { label: 'Ended',     bg: '#F0EFEA', fg: '#6B6B63' },
}

export function AdminEarnings() {
  const [data, setData] = useState<RevenueReport | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [year, setYear] = useState('')

  const load = useCallback(async (fresh = false) => {
    setState('loading')
    try {
      const r = await fetch(`/api/admin/earnings/report${fresh ? '?fresh=1' : ''}`, { cache: 'no-store' })
      const j = await r.json()
      if (r.ok && j?.success) {
        setData(j.data)
        setYear(y => y || j.data.years[0]?.year || String(new Date().getFullYear()))
        setState('ok')
      } else setState('error')
    } catch { setState('error') }
  }, [])
  useEffect(() => { void load() }, [load])

  const rate = data?.pkrToUsd ?? null
  const yr = data?.years.find(y => y.year === year) ?? null
  const months = useMemo(() => (data?.months ?? []).filter(m => m.month.startsWith(year)), [data, year])
  const chart = useMemo(() => [...months].reverse().map(m => ({ label: monthShort(m.month), value: Math.round(totalUsd(m.card, m.local, rate) * 100) / 100 })), [months, rate])

  if (state === 'error' && !data) return <div style={cardStyle}><EmptyState icon="⚠️" title="Could not load earnings" sub="Please try again." /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toolbar: year + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: C.graphite, marginRight: 4 }}>Year</span>
        {(data?.years ?? []).map(y => <Pill key={y.year} on={year === y.year} onClick={() => setYear(y.year)}>{y.year}</Pill>)}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => void load(true)} disabled={state === 'loading'} style={ghostBtn}>{state === 'loading' ? <Spinner size={11} /> : 'Refresh'}</button>
          <button onClick={() => void download('/api/admin/earnings/report?format=csv', 'rankkw-earnings-by-month.csv')} disabled={!data} style={ghostBtn}>Export months (CSV)</button>
        </div>
      </div>

      {!data ? <LoadingBlock label="Loading earnings" height={220} /> : !yr ? (
        <div style={cardStyle}><EmptyState icon="💳" title="No payments yet" sub="Earnings appear here as soon as someone pays." /></div>
      ) : (
        <>
          {/* Summary: 8 equal tiles, two rows of four */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
            <Tile label={`${year} total earned`} color="#1F7A44"
              value={rate == null ? usd(yr.card.revenueUsd) : `≈ ${usd(totalUsd(yr.card, yr.local, rate))}`}
              sub={rate == null ? `card only; + ${pkr(yr.local.revenuePkr)} local` : `card + local at 1 PKR = $${rate.toFixed(5)}`} />
            <Tile label="Card payments" color="#2563EB" value={usd(yr.card.revenueUsd)} sub={`${yr.card.payments} payments · Lemon Squeezy`} />
            <Tile label="Local payments" color={C.orange} value={pkr(yr.local.revenuePkr)} sub={`${yr.local.payments} payments · bank / JazzCash`} />
            <Tile label="Active now" color="#0D9488" value={(data.current.activeCardSubs + data.current.activeLocal).toLocaleString()}
              sub={`${data.current.activeCardSubs} card · ${data.current.activeLocal} local`} />
            <Tile label="New customers" color="#4F46E5" value={(yr.card.newSubs + yr.local.newCustomers).toLocaleString()} sub={`${yr.card.newSubs} card · ${yr.local.newCustomers} local`} />
            <Tile label="Renewed" color="#7C3AED" value={(yr.card.renewals + yr.local.renewals).toLocaleString()} sub={`${yr.card.renewals} card · ${yr.local.renewals} local`} />
            <Tile label="Did not renew" color="#B91C1C" value={(yr.card.notRenewed + yr.local.notRenewed).toLocaleString()}
              sub={`${yr.card.notRenewed} card · ${yr.local.notRenewed} local${data.current.cancelledEndingLater ? ` · ${data.current.cancelledEndingLater} cancelling` : ''}`} />
            <Tile label="Refunds" color="#6B6B63" value={yr.card.refunds.toLocaleString()} sub={yr.card.refunds ? `${usd(yr.card.refundedUsd)} refunded` : 'none this year'} />
          </div>

          {/* Monthly chart */}
          <div style={{ ...cardStyle, padding: '18px 22px' }}>
            <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.stone }}>{year} · card + local, USD</span>}>Revenue by month</SectionTitle>
            <Bars data={chart} height={170} accent="#1F7A44" valueFormat={usd0} />
          </div>

          {/* Month by month */}
          <div>
            <SectionTitle>Month by month</SectionTitle>
            <div className="rtable" style={{ ...tableCard, overflowX: 'auto' }}>
              <div style={{ minWidth: 900 }}>
                <div style={tableHead(MONTH_GRID)}>
                  {['Month', 'Card', 'Local', 'Total', 'Payments', 'New', 'Renewed', 'Not renewed', 'Refunds'].map((h, i) =>
                    <span key={h} style={{ ...th, textAlign: i ? 'right' : 'left' }}>{h}</span>)}
                </div>
                {months.map((m, i) => {
                  const nr = m.card.notRenewed + m.local.notRenewed
                  return (
                    <div key={m.month} style={{ ...tableRow(MONTH_GRID), background: i % 2 ? C.canvas : 'transparent' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{monthName(m.month)}</span>
                      <span style={{ ...NUM, color: '#2563EB' }}>{usd(m.card.revenueUsd)}</span>
                      <span style={{ ...NUM, color: C.orange }}>{pkr(m.local.revenuePkr)}</span>
                      <span style={{ ...NUM, color: '#1F7A44', fontWeight: 600 }}>{usd(totalUsd(m.card, m.local, rate))}</span>
                      <span style={NUM}>{m.card.payments + m.local.payments}</span>
                      <span style={NUM}>{m.card.newSubs + m.local.newCustomers}</span>
                      <span style={{ ...NUM, color: '#7C3AED' }}>{m.card.renewals + m.local.renewals}</span>
                      <span style={{ ...NUM, color: nr ? '#B91C1C' : C.ink }}>{nr}</span>
                      <span style={NUM}>{m.card.refunds}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <p style={{ fontSize: 12, color: C.stone, marginTop: 8, lineHeight: 1.5 }}>
              Card = what buyers paid through Lemon Squeezy after refunds (before Lemon Squeezy&apos;s fee). Local = approved bank / JazzCash payments,
              by the day the user paid. Total converts local at today&apos;s rate. Renewed = a repeat payment by the same customer. Not renewed = the paid
              period ended that month and the customer did not pay again.
            </p>
          </div>

          {/* Year by year */}
          <div>
            <SectionTitle>Year by year</SectionTitle>
            <div className="rtable" style={{ ...tableCard, overflowX: 'auto' }}>
              <div style={{ minWidth: 780 }}>
                <div style={tableHead(YEAR_GRID)}>
                  {['Year', 'Card', 'Local', 'Total', 'Payments', 'New', 'Renewed', 'Not renewed'].map((h, i) =>
                    <span key={h} style={{ ...th, textAlign: i ? 'right' : 'left' }}>{h}</span>)}
                </div>
                {data.years.map((y, i) => (
                  <div key={y.year} style={{ ...tableRow(YEAR_GRID), background: i % 2 ? C.canvas : 'transparent' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{y.year}</span>
                    <span style={{ ...NUM, color: '#2563EB' }}>{usd(y.card.revenueUsd)}</span>
                    <span style={{ ...NUM, color: C.orange }}>{pkr(y.local.revenuePkr)}</span>
                    <span style={{ ...NUM, color: '#1F7A44', fontWeight: 600 }}>{usd(totalUsd(y.card, y.local, rate))}</span>
                    <span style={NUM}>{y.card.payments + y.local.payments}</span>
                    <span style={NUM}>{y.card.newSubs + y.local.newCustomers}</span>
                    <span style={{ ...NUM, color: '#7C3AED' }}>{y.card.renewals + y.local.renewals}</span>
                    <span style={{ ...NUM, color: y.card.notRenewed + y.local.notRenewed ? '#B91C1C' : C.ink }}>{y.card.notRenewed + y.local.notRenewed}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Customers />
        </>
      )}
    </div>
  )
}

/** Every paying customer (card + local), searchable, filterable, paged by the server. */
function Customers() {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [method, setMethod] = useState<'all' | 'card' | 'local'>('all')
  const [status, setStatus] = useState<'all' | 'active' | 'ended'>('all')
  const [page, setPage] = useState(1)
  const [res, setRes] = useState<{ rows: Customer[]; pages: number; total: number; limit: number } | null>(null)
  const [loading, setLoading] = useState(true)

  // Search as you type, without a request per keystroke.
  useEffect(() => { const t = setTimeout(() => { setQuery(q.trim()); setPage(1) }, 300); return () => clearTimeout(t) }, [q])

  useEffect(() => {
    let alive = true
    setLoading(true)
    const p = new URLSearchParams({ page: String(page), limit: '25', method, status, ...(query ? { q: query } : {}) })
    fetch(`/api/admin/earnings?${p}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (alive && j?.success) setRes(j.data) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [page, method, status, query])

  const csvUrl = `/api/admin/earnings?${new URLSearchParams({ format: 'csv', method, status, ...(query ? { q: query } : {}) })}`

  return (
    <div>
      <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.stone }}>{res ? `${res.total} customer${res.total === 1 ? '' : 's'}` : ''}</span>}>Paying customers</SectionTitle>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or email…"
          style={{ height: 34, flex: '1 1 220px', maxWidth: 320, padding: '0 14px', borderRadius: 100, border: `1px solid ${C.ash}`, background: C.paper, fontFamily: 'inherit', fontSize: 13, outline: 'none' }} />
        {(['all', 'card', 'local'] as const).map(m => <Pill key={m} on={method === m} onClick={() => { setMethod(m); setPage(1) }}>{m === 'all' ? 'All' : m === 'card' ? 'Card' : 'Local'}</Pill>)}
        <span style={{ width: 1, height: 20, background: C.ash, margin: '0 4px' }} />
        {(['all', 'active', 'ended'] as const).map(s => <Pill key={s} on={status === s} onClick={() => { setStatus(s); setPage(1) }}>{s === 'all' ? 'Any status' : s === 'active' ? 'Active' : 'Ended'}</Pill>)}
        <button onClick={() => void download(csvUrl, 'rankkw-customers.csv')} style={{ ...ghostBtn, marginLeft: 'auto' }}>Export customers (CSV)</button>
      </div>

      {!res && loading ? <LoadingBlock label="Loading customers" height={180} />
      : !res || res.rows.length === 0 ? <div style={cardStyle}><EmptyState title="No customers match" sub="Try another search or filter." /></div>
      : (
        <>
          <div className="rtable" style={{ ...tableCard, overflowX: 'auto', opacity: loading ? 0.6 : 1 }}>
            <div style={{ minWidth: 920 }}>
              <div style={tableHead(CUST_GRID)}>
                {['Customer', 'Paid by', 'Plan', 'Total paid', 'Payments', 'Renewals', 'Status', 'Last payment'].map((h, i) =>
                  <span key={h} style={{ ...th, textAlign: [3, 4, 5].includes(i) ? 'right' : 'left' }}>{h}</span>)}
              </div>
              {res.rows.map((c, i) => {
                const st = STATUS_STYLE[c.status]
                return (
                  <div key={c.key} style={{ ...tableRow(CUST_GRID), background: i % 2 ? C.canvas : 'transparent' }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || '(no name)'}</span>
                      <span style={{ display: 'block', fontSize: 12, color: C.graphite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.email}>{c.email}</span>
                    </span>
                    <span style={{ fontSize: 12.5, color: c.method === 'card' ? '#2563EB' : C.orange, fontWeight: 600 }}>{c.method === 'card' ? 'Card' : 'Local'}</span>
                    <span style={{ fontSize: 12.5, color: C.ink }}>{c.plan || '-'}</span>
                    <span style={{ ...NUM, color: '#1F7A44', fontWeight: 600 }}>{c.currency === 'USD' ? usd(c.amount) : pkr(c.amount)}</span>
                    <span style={NUM}>{c.payments}</span>
                    <span style={{ ...NUM, color: c.renewals ? '#7C3AED' : C.ink }}>{c.renewals}</span>
                    <span><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: st.bg, color: st.fg }}>{st.label}</span></span>
                    <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.graphite }}>{fmtDate(c.lastPaidAt)}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <p style={{ fontSize: 12, color: C.stone, fontFamily: MONO, marginTop: 8 }}>
            Showing {(page - 1) * res.limit + 1}-{Math.min(page * res.limit, res.total)} of {res.total}
          </p>
          <Pagination page={page} pageCount={res.pages} onChange={setPage} loading={loading} />
        </>
      )}
    </div>
  )
}
