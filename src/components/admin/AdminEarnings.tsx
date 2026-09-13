'use client'
/* eslint-disable react-hooks/set-state-in-effect */
/**
 * Admin: "Earnings" - real revenue from Lemon Squeezy payments. Total earned,
 * a per-month breakdown, and every paying customer with whether they renewed.
 * Payments are recorded by the LS webhook, so this reflects money going forward.
 */
import { useCallback, useEffect, useState } from 'react'
import { C } from '@/utils'
import { MONO, SectionTitle, StatCard, EmptyState, cardStyle, tableCard, tableHead, th, tableRow } from '@/components/dashboard/kit'
import { Bars } from './AdminCharts'

interface MonthRow { month: string; total: number; count: number }
interface BuyerRow { userId: string; email: string; plan: string; total: number; payments: number; renewed: boolean; firstPaidAt: string | null; lastPaidAt: string | null }
interface Payload { totalEarned: number; thisMonth: number; payingCustomers: number; renewals: number; months: MonthRow[]; buyers: BuyerRow[] }

const usd = (n: number) => `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const usd0 = (n: number) => `$${Math.round(n ?? 0).toLocaleString('en-US')}`
const monthLabel = (m: string) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) }
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const PLAN_LABEL: Record<string, string> = { free: 'Free', starter: 'Starter', basic: 'Basic', pro: 'Pro', 'pro-1yr': 'Pro 1-Year', business: 'Business', agency: 'Agency', enterprise: 'Enterprise', custom: 'Custom' }
const GRID = '2.2fr 1fr 1fr 0.8fr 0.9fr 1.1fr'

export function AdminEarnings() {
  const [data, setData]   = useState<Payload | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setState('loading')
    try {
      const r = await fetch('/api/admin/earnings')
      const j = await r.json()
      if (r.ok && j?.success) { setData(j.data); setState('ok') }
      else setState('error')
    } catch { setState('error') }
  }, [])
  useEffect(() => { load() }, [load])

  const exportCsv = useCallback(async () => {
    setExporting(true)
    try {
      const r = await fetch('/api/admin/earnings?format=csv')
      if (!r.ok) return
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'earnings-buyers.csv'; a.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }, [])

  const buyers = data?.buyers ?? []
  // Chart wants chronological order (oldest → newest); the API returns newest-first.
  const chart = [...(data?.months ?? [])].reverse().map(m => ({ label: monthLabel(m.month), value: m.total }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
        <StatCard label="Total earned" value={usd0(data?.totalEarned ?? 0)} accent="#1F7A44" />
        <StatCard label="This month" value={usd0(data?.thisMonth ?? 0)} accent={C.orange} />
        <StatCard label="Paying customers" value={(data?.payingCustomers ?? 0).toLocaleString()} accent="#2563EB" />
        <StatCard label="Renewed" value={(data?.renewals ?? 0).toLocaleString()} accent="#7C3AED" />
      </div>

      {state === 'loading' && <p style={{ fontSize: 13, color: '#808080', padding: '18px 2px' }}>Loading…</p>}
      {state === 'error' && <EmptyState icon="⚠️" title="Could not load earnings" sub="Please try again." />}

      {state === 'ok' && (data?.payingCustomers ?? 0) === 0 ? (
        <EmptyState icon="💳" title="No paid payments yet" sub="Revenue appears here as soon as the first Lemon Squeezy payment comes in. Past payments before this feature are not shown." />
      ) : state === 'ok' && (
        <>
          {/* Monthly revenue */}
          <div style={{ ...cardStyle, padding: '20px 22px' }}>
            <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: '#808080' }}>USD / month</span>}>Revenue by month</SectionTitle>
            {chart.length > 0
              ? <Bars data={chart} height={170} accent="#1F7A44" valueFormat={usd0} />
              : <p style={{ fontSize: 13, color: '#808080', padding: '20px 2px' }}>No monthly data yet.</p>}
          </div>

          {/* Buyers */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
              <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: '#808080' }}>{buyers.length} customer{buyers.length === 1 ? '' : 's'}</span>}>Paying customers</SectionTitle>
              <button onClick={exportCsv} disabled={exporting || !buyers.length}
                style={{ marginLeft: 'auto', height: 36, padding: '0 15px', borderRadius: 100, border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit', cursor: (exporting || !buyers.length) ? 'not-allowed' : 'pointer', opacity: (exporting || !buyers.length) ? 0.6 : 1 }}>
                {exporting ? 'Exporting…' : 'Export CSV'}
              </button>
            </div>
            {buyers.length > 0 && (
              <div className="rtable" style={tableCard}>
                <div style={tableHead(GRID)}>
                  {['Customer', 'Plan', 'Total paid', 'Payments', 'Renewed', 'Last payment'].map((h, i) => <span key={i} style={th}>{h}</span>)}
                </div>
                {buyers.map((b, i) => (
                  <div key={b.userId || b.email || i} style={{ ...tableRow(GRID), background: i % 2 ? C.canvas : 'transparent' }}>
                    <span style={{ fontSize: 12.5, color: C.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.email}>{b.email || '-'}</span>
                    <span style={{ fontSize: 12.5, color: '#555' }}>{PLAN_LABEL[b.plan] ?? b.plan}</span>
                    <span style={{ fontSize: 13, fontFamily: MONO, color: '#1F7A44', fontWeight: 600 }}>{usd(b.total)}</span>
                    <span style={{ fontSize: 12.5, fontFamily: MONO, color: '#666' }}>{b.payments}</span>
                    <span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 8px', borderRadius: 999, background: b.renewed ? '#E4F3E9' : '#F0EFEA', color: b.renewed ? '#1F7A44' : '#7A7A72' }}>
                        {b.renewed ? 'Renewed' : 'One-time'}
                      </span>
                    </span>
                    <span style={{ fontSize: 12.5, fontFamily: MONO, color: '#808080' }}>{fmtDate(b.lastPaidAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
