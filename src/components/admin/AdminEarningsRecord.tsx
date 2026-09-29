'use client'
/* eslint-disable react-hooks/set-state-in-effect */
/**
 * Admin Earnings: the full record. Pick a year to see its totals and every month:
 * card revenue (Lemon Squeezy, complete history), local revenue (bank / JazzCash,
 * PKR), new customers, renewals, and customers who did NOT renew. Plus a
 * year-by-year comparison and a CSV of every month.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { C } from '@/utils'
import { MONO, SectionTitle, StatCard, EmptyState, cardStyle, tableCard, tableHead, th, tableRow } from '@/components/dashboard/kit'
import type { RevenueReport, ReportMonth, CardMonth, LocalMonth } from '@/lib/revenue-report'

const usd = (n: number) => `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pkr = (n: number) => `Rs ${Math.round(n ?? 0).toLocaleString('en-US')}`
const monthName = (m: string) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }

const MONTH_GRID = '1.3fr 1fr 1fr 1fr 0.8fr 0.7fr 0.8fr 0.9fr 0.7fr'
const YEAR_GRID = '0.8fr 1fr 1fr 1fr 0.8fr 0.8fr 0.9fr 0.8fr'

function combined(card: CardMonth, local: LocalMonth, rate: number | null): number | null {
  return rate == null ? null : card.revenueUsd + local.revenuePkr * rate
}

function Cell({ v, color, strong }: { v: string | number; color?: string; strong?: boolean }) {
  return <span style={{ fontSize: 13, fontFamily: MONO, color: color ?? C.ink, fontWeight: strong ? 600 : 400, textAlign: 'right' }}>{v}</span>
}

export function AdminEarningsRecord() {
  const [data, setData] = useState<RevenueReport | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [year, setYear] = useState<string>('')
  const [downloading, setDownloading] = useState(false)

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

  const csv = useCallback(async () => {
    setDownloading(true)
    try {
      const r = await fetch('/api/admin/earnings/report?format=csv')
      if (!r.ok) return
      const url = URL.createObjectURL(await r.blob())
      const a = document.createElement('a'); a.href = url; a.download = 'rankkw-earnings-by-month.csv'; a.click()
      URL.revokeObjectURL(url)
    } finally { setDownloading(false) }
  }, [])

  const rate = data?.pkrToUsd ?? null
  const yr = data?.years.find(y => y.year === year)
  const months: ReportMonth[] = useMemo(() => (data?.months ?? []).filter(m => m.month.startsWith(year)), [data, year])

  if (state === 'error') return <div style={cardStyle}><EmptyState icon="⚠️" title="Could not load the earnings record" sub="Please try again." /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: '#808080' }}>
          {data ? `card from Lemon Squeezy${data.cardSource === 'unavailable' ? ' (unavailable right now)' : ''} · local from approved payments` : ''}
        </span>}>Full earnings record</SectionTitle>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(data?.years ?? []).map(y => (
            <button key={y.year} onClick={() => setYear(y.year)}
              style={{ height: 34, padding: '0 14px', borderRadius: 100, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${year === y.year ? C.ink : C.ash}`, background: year === y.year ? C.ink : C.paper, color: year === y.year ? '#fff' : C.ink }}>
              {y.year}
            </button>
          ))}
          <button onClick={() => void load(true)} disabled={state === 'loading'}
            style={{ height: 34, padding: '0 14px', borderRadius: 100, border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}>
            {state === 'loading' ? 'Loading…' : 'Refresh'}
          </button>
          <button onClick={() => void csv()} disabled={downloading || !data}
            style={{ height: 34, padding: '0 14px', borderRadius: 100, border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}>
            {downloading ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {!data && state === 'loading' && <p style={{ fontSize: 13, color: '#808080' }}>Loading the full record…</p>}

      {yr && (
        <>
          {/* The selected year at a glance */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 12 }}>
            <StatCard label={`${year} total earned`} accent="#1F7A44"
              value={rate == null ? `${usd(yr.card.revenueUsd)} + ${pkr(yr.local.revenuePkr)}` : `≈ ${usd(combined(yr.card, yr.local, rate) ?? 0)}`}
              sub={rate == null ? 'PKR rate unavailable' : `local converted at 1 PKR = $${rate.toFixed(5)}`} />
            <StatCard label="Card payments" value={usd(yr.card.revenueUsd)} sub={`${yr.card.payments} payments`} accent="#2563EB" />
            <StatCard label="Local payments" value={pkr(yr.local.revenuePkr)} sub={`${yr.local.payments} payments`} accent={C.orange} />
            <StatCard label="New customers" value={(yr.card.newSubs + yr.local.newCustomers).toLocaleString()} sub={`${yr.card.newSubs} card · ${yr.local.newCustomers} local`} accent="#0D9488" />
            <StatCard label="Renewed" value={(yr.card.renewals + yr.local.renewals).toLocaleString()} sub={`${yr.card.renewals} card · ${yr.local.renewals} local`} accent="#7C3AED" />
            <StatCard label="Did not renew" value={(yr.card.notRenewed + yr.local.notRenewed).toLocaleString()} sub={`${yr.card.notRenewed} card · ${yr.local.notRenewed} local`} accent="#B91C1C" />
          </div>
          {data && (
            <p style={{ fontSize: 12.5, color: C.graphite, marginTop: -4 }}>
              Right now: <strong>{data.current.activeCardSubs}</strong> active card subscriptions
              {data.current.cancelledEndingLater ? <> (<strong>{data.current.cancelledEndingLater}</strong> cancelled, ending later)</> : null}
              {' '}and <strong>{data.current.activeLocal}</strong> active local plans.
              {yr.card.refunds ? <> Refunds in {year}: {yr.card.refunds} ({usd(yr.card.refundedUsd)}).</> : null}
            </p>
          )}

          {/* Month by month */}
          <div className="rtable" style={{ ...tableCard, overflowX: 'auto' }}>
            <div style={{ minWidth: 860 }}>
              <div style={tableHead(MONTH_GRID)}>
                {['Month', 'Card', 'Local', 'Total', 'Payments', 'New', 'Renewed', 'Not renewed', 'Refunds'].map((h, i) =>
                  <span key={h} style={{ ...th, textAlign: i ? 'right' : 'left' }}>{h}</span>)}
              </div>
              {months.map((m, i) => {
                const total = combined(m.card, m.local, rate)
                const quiet = !m.card.payments && !m.local.payments && !m.card.notRenewed && !m.local.notRenewed
                return (
                  <div key={m.month} style={{ ...tableRow(MONTH_GRID), background: i % 2 ? C.canvas : 'transparent', opacity: quiet ? 0.55 : 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{monthName(m.month)}</span>
                    <Cell v={usd(m.card.revenueUsd)} color="#2563EB" />
                    <Cell v={pkr(m.local.revenuePkr)} color={C.orange} />
                    <Cell v={total == null ? '-' : `≈ ${usd(total)}`} color="#1F7A44" strong />
                    <Cell v={m.card.payments + m.local.payments} />
                    <Cell v={m.card.newSubs + m.local.newCustomers} />
                    <Cell v={m.card.renewals + m.local.renewals} color="#7C3AED" />
                    <Cell v={m.card.notRenewed + m.local.notRenewed} color={m.card.notRenewed + m.local.notRenewed ? '#B91C1C' : undefined} />
                    <Cell v={m.card.refunds ? `${m.card.refunds} (${usd(m.card.refundedUsd)})` : 0} />
                  </div>
                )
              })}
            </div>
          </div>
          <p style={{ fontSize: 12, color: C.stone, marginTop: -6, lineHeight: 1.5 }}>
            Card = Lemon Squeezy, what buyers paid after refunds (before Lemon Squeezy&apos;s fee). Local = approved bank / JazzCash payments in PKR,
            by the day the user paid. Renewed = a repeat payment by the same customer. Not renewed = the paid period ended that month and
            the customer did not pay again.
          </p>

          {/* Year by year */}
          {(data?.years.length ?? 0) > 0 && (
            <div>
              <SectionTitle>Year by year</SectionTitle>
              <div className="rtable" style={{ ...tableCard, overflowX: 'auto' }}>
                <div style={{ minWidth: 760 }}>
                  <div style={tableHead(YEAR_GRID)}>
                    {['Year', 'Card', 'Local', 'Total', 'Payments', 'New', 'Renewed', 'Not renewed'].map((h, i) =>
                      <span key={h} style={{ ...th, textAlign: i ? 'right' : 'left' }}>{h}</span>)}
                  </div>
                  {data!.years.map((y, i) => {
                    const total = combined(y.card, y.local, rate)
                    return (
                      <div key={y.year} style={{ ...tableRow(YEAR_GRID), background: i % 2 ? C.canvas : 'transparent' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{y.year}</span>
                        <Cell v={usd(y.card.revenueUsd)} color="#2563EB" />
                        <Cell v={pkr(y.local.revenuePkr)} color={C.orange} />
                        <Cell v={total == null ? '-' : `≈ ${usd(total)}`} color="#1F7A44" strong />
                        <Cell v={y.card.payments + y.local.payments} />
                        <Cell v={y.card.newSubs + y.local.newCustomers} />
                        <Cell v={y.card.renewals + y.local.renewals} color="#7C3AED" />
                        <Cell v={y.card.notRenewed + y.local.notRenewed} color={y.card.notRenewed + y.local.notRenewed ? '#B91C1C' : undefined} />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
