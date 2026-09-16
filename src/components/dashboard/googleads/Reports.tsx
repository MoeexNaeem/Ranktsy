'use client'
/**
 * Google Ads reports for the connected account: Overview (account totals + daily
 * chart), Campaigns, Ads, Keywords (with first page / first position CPC estimates),
 * Search terms and Bidding strategies. Every number comes straight from the Google
 * Ads API for the user's own account.
 */
import { useEffect, useMemo, useState } from 'react'
import { C, D, formatNumber } from '@/utils'
import { Card, SectionTitle, EmptyState, MONO } from '../kit'
import { LineTrend } from '@/components/charts/pro'
import { toast } from '@/components/ui/toast'
import { EditCampaignPanel } from './EditCampaign'
import { ConversionsSection, CalloutsSection, AddKeywordsForm } from './AccountSetup'

export interface AdsAccount { customerId: string; name: string; currency: string | null; testAccount: boolean }

type Section = 'overview' | 'campaigns' | 'ads' | 'keywords' | 'search_terms' | 'bidding' | 'conversions' | 'callouts'
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'ads', label: 'Ads' },
  { id: 'keywords', label: 'Keywords' },
  { id: 'search_terms', label: 'Search terms' },
  { id: 'bidding', label: 'Bidding strategies' },
  { id: 'conversions', label: 'Conversion tracking' },
  { id: 'callouts', label: 'Callouts' },
]
const RANGES = [
  { id: 'TODAY', label: 'Today' },
  { id: 'YESTERDAY', label: 'Yesterday' },
  { id: 'LAST_7_DAYS', label: 'Last 7 days' },
  { id: 'LAST_14_DAYS', label: 'Last 14 days' },
  { id: 'LAST_30_DAYS', label: 'Last 30 days' },
  { id: 'THIS_MONTH', label: 'This month' },
  { id: 'LAST_MONTH', label: 'Last month' },
]

interface M { clicks: number; impressions: number; cost: number; conversions: number; allConversions: number }
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

// ─── Formatting ───────────────────────────────────────────────────────────────
const ACRONYMS = new Set(['cpc', 'cpa', 'cpm', 'cpv', 'roas', 'url', 'rsa'])
const pretty = (s?: string | null) => (s ? s.toLowerCase().split('_').map(w => (ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ') : '-')
const conv = (v: number) => formatNumber(Math.round(v * 100) / 100)
function moneyFmt(cur: string | null) {
  return (v: number | null | undefined) => {
    if (v == null) return '-'
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD', maximumFractionDigits: 2 }).format(v) }
    catch { return `${v.toFixed(2)} ${cur ?? ''}` }
  }
}
const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  ENABLED: { label: 'Enabled', color: D.good, bg: 'rgba(31,138,76,0.10)' },
  PAUSED:  { label: 'Paused', color: '#8A5A00', bg: '#FFF4DC' },
  REMOVED: { label: 'Removed', color: C.danger, bg: C.dangerBg },
}
function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: pretty(status), color: C.graphite, bg: C.canvas }
  return <span style={{ fontSize: 12, fontWeight: 600, color: s.color, background: s.bg, borderRadius: 100, padding: '3px 10px', whiteSpace: 'nowrap' }}>{s.label}</span>
}

// ─── Data hook ────────────────────────────────────────────────────────────────
function useReport(type: Section, range: string, campaignId: string, customerId: string, version = 0) {
  const [state, setState] = useState<{ loading: boolean; error: string | null; rows: any; forKey: string }>({ loading: true, error: null, rows: null, forKey: '' })
  const key = `${customerId}|${type}|${range}|${campaignId}|${version}`
  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(s => ({ ...s, loading: true, error: null }))
    const qs = new URLSearchParams({ type, range, ...(campaignId ? { campaignId } : {}) })
    fetch(`/api/google-ads/reports?${qs}`, { cache: 'no-store' })
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return
        if (ok && j?.success) setState({ loading: false, error: null, rows: j.data.rows, forKey: key })
        else setState({ loading: false, error: j?.error || 'Could not load this report.', rows: null, forKey: key })
      })
      .catch(() => { if (!cancelled) setState({ loading: false, error: 'Network error. Please try again.', rows: null, forKey: key }) })
    return () => { cancelled = true }
  }, [type, range, campaignId, customerId, version, key])
  // Never show another report's rows while the new one loads.
  return state.forKey === key ? state : { loading: true, error: null, rows: null, forKey: key }
}

// ─── Generic sortable table ───────────────────────────────────────────────────
interface Col { key: string; label: string; num?: boolean; width: string; render: (r: Row) => React.ReactNode; sort?: (r: Row) => number | string }

function ReportTable({ cols, rows, empty, initialSort }: { cols: Col[]; rows: Row[]; empty: { title: string; sub: string }; initialSort?: string }) {
  const [sortKey, setSortKey] = useState(initialSort ?? cols[0].key)
  const [desc, setDesc] = useState(true)
  const sorted = useMemo(() => {
    const col = cols.find(c => c.key === sortKey) ?? cols[0]
    const get = col.sort ?? ((r: Row) => r[col.key])
    return [...rows].sort((a, b) => {
      const va = get(a), vb = get(b)
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va ?? '').localeCompare(String(vb ?? ''))
      return desc ? -cmp : cmp
    })
  }, [rows, cols, sortKey, desc])

  if (!rows.length) return <Card><EmptyState icon="📊" title={empty.title} sub={empty.sub} /></Card>
  const grid = cols.map(c => c.width).join(' ')
  return (
    <div style={{ background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 16, overflowX: 'auto' }}>
      <div style={{ minWidth: 900 }}>
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 12, padding: '12px 18px', background: C.canvas, borderBottom: `1px solid ${C.ash}` }}>
          {cols.map(c => (
            <button key={c.key} onClick={() => { if (sortKey === c.key) setDesc(d => !d); else { setSortKey(c.key); setDesc(!!c.num) } }}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: sortKey === c.key ? C.ink : C.stone, textAlign: c.num ? 'right' : 'left' }}>
              {c.label}{sortKey === c.key ? (desc ? ' ↓' : ' ↑') : ''}
            </button>
          ))}
        </div>
        {sorted.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: grid, gap: 12, padding: '12px 18px', alignItems: 'center', borderBottom: `1px solid ${C.hair}`, background: i % 2 ? C.canvas : 'transparent' }}>
            {cols.map(c => (
              <div key={c.key} style={{ minWidth: 0, textAlign: c.num ? 'right' : 'left', fontSize: 13.5, color: C.ink, fontFamily: c.num ? MONO : 'inherit' }}>{c.render(r)}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

const two = (top: React.ReactNode, sub?: React.ReactNode) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{top}</div>
    {sub && <div style={{ fontSize: 11.5, color: C.stone, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
  </div>
)

function metricCols(money: (v: number | null | undefined) => string, opts: { allConv?: boolean } = {}): Col[] {
  const cols: Col[] = [
    { key: 'clicks', label: 'Clicks', num: true, width: '0.7fr', render: r => formatNumber(r.clicks) },
    { key: 'impressions', label: 'Impr.', num: true, width: '0.8fr', render: r => formatNumber(r.impressions) },
    { key: 'cost', label: 'Cost', num: true, width: '0.9fr', render: r => money(r.cost) },
    { key: 'conversions', label: 'Conv.', num: true, width: '0.7fr', render: r => conv(r.conversions) },
  ]
  if (opts.allConv) cols.push({ key: 'allConversions', label: 'All conv.', num: true, width: '0.8fr', render: r => conv(r.allConversions) })
  return cols
}

// ─── Panel ────────────────────────────────────────────────────────────────────
export function ReportsPanel({ account, initialSection = 'overview' }: { account: AdsAccount; initialSection?: Section }) {
  const [section, setSection] = useState<Section>(initialSection)
  const [range, setRange] = useState('LAST_30_DAYS')
  const [campaignId, setCampaignId] = useState('')
  const [version, setVersion] = useState(0)
  const [editing, setEditing] = useState<string | null>(null)
  const money = useMemo(() => moneyFmt(account.currency), [account.currency])
  const refresh = () => setVersion(v => v + 1)

  // Campaign list for the filter menu (cheap: cached server-side for 2 minutes).
  const campaigns = useReport('campaigns', range, '', account.customerId, version)

  if (editing) {
    return <EditCampaignPanel account={account} campaignId={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }} />
  }
  const filterable = section === 'ads' || section === 'keywords' || section === 'search_terms'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {account.testAccount && (
        <p style={{ margin: 0, fontSize: 12.5, color: '#8A5A00', background: '#FFF7E6', border: '1px solid #F2D8A7', borderRadius: 8, padding: '8px 12px' }}>
          This is a Google Ads <strong>test account</strong>: it can’t show ads or spend money, so clicks, cost and conversions stay at zero.
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div role="tablist" style={{ display: 'flex', gap: 4, background: C.bone, padding: 4, borderRadius: 12, flexWrap: 'wrap' }}>
          {SECTIONS.map(s => (
            <button key={s.id} role="tab" aria-selected={section === s.id} onClick={() => setSection(s.id)}
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '7px 13px', borderRadius: 9,
                background: section === s.id ? C.paper : 'transparent', color: section === s.id ? C.ink : C.graphite,
                boxShadow: section === s.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {s.label}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        {filterable && (
          <select value={campaignId} onChange={e => setCampaignId(e.target.value)} aria-label="Campaign filter" style={selectStyle}>
            <option value="">All campaigns</option>
            {(campaigns.rows ?? []).map((c: Row) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {section !== 'conversions' && section !== 'callouts' && (
          <select value={range} onChange={e => setRange(e.target.value)} aria-label="Date range" style={selectStyle}>
            {RANGES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        )}
      </div>

      {section === 'overview' && <OverviewSection account={account} range={range} money={money} />}
      {section === 'campaigns' && (
        <Loaded state={campaigns}>
          {rows => (
            <ReportTable rows={rows} initialSort="cost" empty={{ title: 'No campaigns yet', sub: 'This account has no enabled or paused campaigns.' }}
              cols={[
                { key: 'name', label: 'Campaign', width: 'minmax(200px,2fr)', render: r => (
                  <button onClick={() => { setCampaignId(r.id); setSection('keywords') }} title="See this campaign's keywords"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left', color: C.ink, width: '100%' }}>
                    {two(r.name, pretty(r.channel))}
                  </button>) },
                { key: 'status', label: 'Status', width: '0.8fr', render: r => <StatusPill status={r.status} /> },
                { key: 'dailyBudget', label: 'Budget/day', num: true, width: '0.9fr', render: r => money(r.dailyBudget) },
                { key: 'bidding', label: 'Bidding', width: '1fr', render: r => <span style={{ fontSize: 12.5, color: C.graphite }}>{pretty(r.bidding)}</span> },
                ...metricCols(money, { allConv: true }),
                { key: 'actions', label: '', width: '1.35fr', sort: () => 0, render: r => (
                  <RowActions kind="campaign" label={`campaign “${r.name}”`} status={r.status} item={{ campaignId: r.id }} onDone={refresh}
                    extra={<button onClick={() => setEditing(r.id)} style={actBtn}>Edit</button>} />) },
              ]} />
          )}
        </Loaded>
      )}
      {section === 'ads' && <AdsSection account={account} range={range} campaignId={campaignId} money={money} version={version} onChanged={refresh} />}
      {section === 'keywords' && <KeywordsSection account={account} range={range} campaignId={campaignId} money={money} version={version} onChanged={refresh} />}
      {section === 'search_terms' && <SearchTermsSection account={account} range={range} campaignId={campaignId} money={money} />}
      {section === 'bidding' && <BiddingSection account={account} range={range} money={money} version={version} onChanged={refresh} />}
      {section === 'conversions' && <ConversionsSection account={account} />}
      {section === 'callouts' && <CalloutsSection />}
    </div>
  )
}

const selectStyle: React.CSSProperties = { height: 36, borderRadius: 10, border: `1px solid ${C.ash}`, background: C.paper, fontSize: 13.5, fontFamily: 'inherit', padding: '0 10px', color: C.ink, maxWidth: 260 }

function Loaded({ state, children }: { state: { loading: boolean; error: string | null; rows: any }; children: (rows: any) => React.ReactNode }) {
  if (state.error) return <Card><EmptyState icon="🚫" title="Couldn’t load this report" sub={state.error} /></Card>
  if (state.loading || state.rows == null) return <Card><div className="shimmer" style={{ height: 180, borderRadius: 8, background: '#e8e7e2' }} /></Card>
  return <>{children(state.rows)}</>
}

type SectionProps = { account: AdsAccount; range: string; money: (v: number | null | undefined) => string; version?: number; onChanged?: () => void }

// ─── Row actions: pause / enable / remove ─────────────────────────────────────
const actBtn: React.CSSProperties = { height: 28, borderRadius: 8, border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', padding: '0 9px', cursor: 'pointer', whiteSpace: 'nowrap' }

function RowActions({ kind, label, status, item, onDone, extra }: {
  kind: 'campaign' | 'ad' | 'keyword'; label: string; status: string
  item: Record<string, string>; onDone: () => void; extra?: React.ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const act = async (next: 'ENABLED' | 'PAUSED' | 'REMOVED') => {
    if (next === 'REMOVED' && !window.confirm(`Remove ${label}? This is permanent in Google Ads and can't be undone.`)) return
    setBusy(true)
    try {
      const r = await fetch('/api/google-ads/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, status: next, items: [item] }) })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.success) {
        toast.success(next === 'REMOVED' ? 'Removed' : next === 'PAUSED' ? 'Paused' : 'Enabled', label.charAt(0).toUpperCase() + label.slice(1))
        onDone()
      } else toast.error('Change not saved', j?.error || 'Please try again.')
    } catch { toast.error('Network error', 'Please try again.') }
    finally { setBusy(false) }
  }
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', opacity: busy ? 0.5 : 1 }}>
      {extra}
      {status === 'ENABLED'
        ? <button disabled={busy} onClick={() => act('PAUSED')} style={actBtn}>Pause</button>
        : <button disabled={busy} onClick={() => act('ENABLED')} style={{ ...actBtn, color: D.good, borderColor: 'rgba(31,138,76,0.35)' }}>Enable</button>}
      <button disabled={busy} onClick={() => act('REMOVED')} style={{ ...actBtn, color: C.danger, borderColor: 'rgba(207,70,58,0.35)' }} aria-label={`Remove ${label}`}>Remove</button>
    </div>
  )
}

function OverviewSection({ account, range, money }: SectionProps) {
  const rep = useReport('overview', range, '', account.customerId)
  const [metric, setMetric] = useState<keyof M>('clicks')
  return (
    <Loaded state={rep}>
      {(d: { totals: M & { avgCpc: number | null; costPerConversion: number | null }; series: (M & { date: string })[] }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
            {[
              { label: 'Clicks', value: formatNumber(d.totals.clicks) },
              { label: 'Impressions', value: formatNumber(d.totals.impressions) },
              { label: 'Cost', value: money(d.totals.cost) },
              { label: 'Conversions', value: conv(d.totals.conversions) },
              { label: 'All conversions', value: conv(d.totals.allConversions) },
              { label: 'Avg. CPC', value: money(d.totals.avgCpc) },
            ].map(k => (
              <Card key={k.label} pad={16}>
                <p style={{ fontSize: 11.5, color: C.stone, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{k.label}</p>
                <p style={{ fontSize: 22, fontWeight: 600, color: C.ink, fontFamily: MONO, margin: '6px 0 0' }}>{k.value}</p>
              </Card>
            ))}
          </div>
          <Card>
            <SectionTitle right={
              <select value={metric} onChange={e => setMetric(e.target.value as keyof M)} aria-label="Chart metric" style={selectStyle}>
                <option value="clicks">Clicks</option><option value="impressions">Impressions</option>
                <option value="cost">Cost</option><option value="conversions">Conversions</option>
              </select>
            }>Daily performance · {account.name}</SectionTitle>
            {d.series.length
              ? <LineTrend data={d.series.map(p => ({ label: p.date.slice(5), value: Math.round(Number(p[metric]) * 100) / 100 }))} color="#1A73E8" height={240} name={metric} />
              : <EmptyState icon="📈" title="No activity in this date range" sub="Daily numbers appear once ads get impressions." />}
          </Card>
        </div>
      )}
    </Loaded>
  )
}

function AdsSection({ account, range, campaignId, money, version, onChanged }: SectionProps & { campaignId: string }) {
  const rep = useReport('ads', range, campaignId, account.customerId, version)
  return (
    <Loaded state={rep}>
      {rows => (
        <ReportTable rows={rows} initialSort="impressions" empty={{ title: 'No ads yet', sub: 'Ads you create in this account appear here with their performance.' }}
          cols={[
            { key: 'headline', label: 'Ad', width: 'minmax(240px,2.4fr)', sort: r => r.headlines?.[0] ?? '', render: r => two(
              r.headlines?.length ? r.headlines.slice(0, 3).join(' | ') : pretty(r.type),
              r.finalUrl ?? pretty(r.type)) },
            { key: 'adGroupName', label: 'Ad group', width: '1.2fr', render: r => two(r.adGroupName, r.campaignName) },
            { key: 'status', label: 'Status', width: '0.8fr', render: r => <StatusPill status={r.status} /> },
            { key: 'approval', label: 'Review', width: '0.9fr', render: r => <span style={{ fontSize: 12.5, color: C.graphite }}>{pretty(r.approval)}</span> },
            ...metricCols(money),
            { key: 'actions', label: '', width: '1fr', sort: () => 0, render: r => (
              <RowActions kind="ad" label={`ad in “${r.adGroupName}”`} status={r.status} item={{ adGroupId: r.adGroupId, adId: r.id }} onDone={() => onChanged?.()} />) },
          ]} />
      )}
    </Loaded>
  )
}

const MATCH: Record<string, string> = { EXACT: '[exact]', PHRASE: '"phrase"', BROAD: 'broad' }

function KeywordsSection({ account, range, campaignId, money, version, onChanged }: SectionProps & { campaignId: string }) {
  const rep = useReport('keywords', range, campaignId, account.customerId, version)
  const [adding, setAdding] = useState(false)
  return (
    <Loaded state={rep}>
      {rows => (<>
        {adding
          ? <AddKeywordsForm campaignId={campaignId || undefined} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); onChanged?.() }} />
          : <div><button onClick={() => setAdding(true)} style={{ ...actBtn, height: 34, background: '#1A73E8', borderColor: '#1A73E8', color: '#fff' }}>+ Add keywords</button></div>}
        <ReportTable rows={rows} initialSort="impressions" empty={{ title: 'No keywords yet', sub: 'Keywords in your ad groups appear here with bid estimates and performance.' }}
          cols={[
            { key: 'text', label: 'Keyword', width: 'minmax(180px,1.8fr)', render: r => two(r.text, `${MATCH[r.matchType] ?? pretty(r.matchType)} · ${r.adGroupName}`) },
            { key: 'status', label: 'Status', width: '0.8fr', render: r => <StatusPill status={r.status} /> },
            { key: 'qualityScore', label: 'QS', num: true, width: '0.45fr', sort: r => r.qualityScore ?? -1, render: r => r.qualityScore ?? '-' },
            { key: 'firstPageCpc', label: 'First page CPC', num: true, width: '1fr', sort: r => r.firstPageCpc ?? -1, render: r => money(r.firstPageCpc) },
            { key: 'firstPositionCpc', label: 'First position CPC', num: true, width: '1.1fr', sort: r => r.firstPositionCpc ?? -1, render: r => money(r.firstPositionCpc) },
            ...metricCols(money),
            { key: 'actions', label: '', width: '1fr', sort: () => 0, render: r => (
              <RowActions kind="keyword" label={`keyword “${r.text}”`} status={r.status} item={{ adGroupId: r.adGroupId, criterionId: r.id }} onDone={() => onChanged?.()} />) },
          ]} />
      </>)}
    </Loaded>
  )
}

function SearchTermsSection({ account, range, campaignId, money }: SectionProps & { campaignId: string }) {
  const rep = useReport('search_terms', range, campaignId, account.customerId)
  return (
    <Loaded state={rep}>
      {rows => (
        <ReportTable rows={rows} initialSort="impressions" empty={{ title: 'No search terms in this date range', sub: 'The real searches that triggered your ads show up here once ads get impressions.' }}
          cols={[
            { key: 'term', label: 'Search term', width: 'minmax(200px,2fr)', render: r => two(r.term, `${r.campaignName} · ${r.adGroupName}`) },
            { key: 'matchType', label: 'Match type', width: '1fr', render: r => <span style={{ fontSize: 12.5, color: C.graphite }}>{pretty(r.matchType)}</span> },
            { key: 'status', label: 'Added / excluded', width: '1fr', render: r => <span style={{ fontSize: 12.5, color: C.graphite }}>{r.status && r.status !== 'NONE' ? pretty(r.status) : 'None'}</span> },
            ...metricCols(money),
          ]} />
      )}
    </Loaded>
  )
}

function BiddingSection({ account, range, money, version, onChanged }: SectionProps) {
  const rep = useReport('bidding', range, '', account.customerId, version)
  const [editingStrategy, setEditingStrategy] = useState<Row | null>(null)
  return (
    <Loaded state={rep}>
      {rows => (<>
        {editingStrategy && <PortfolioTargetEditor account={account} strategy={editingStrategy} onClose={() => setEditingStrategy(null)} onSaved={() => { setEditingStrategy(null); onChanged?.() }} />}
        <ReportTable rows={rows} initialSort="cost" empty={{ title: 'No bidding strategies yet', sub: 'Strategies used by your campaigns appear here with their performance.' }}
          cols={[
            { key: 'type', label: 'Strategy', width: 'minmax(190px,1.7fr)', render: r => two(pretty(r.type), r.kind === 'portfolio' ? r.name : 'Campaign-level (standard)') },
            { key: 'status', label: 'Status', width: '0.8fr', render: r => <StatusPill status={r.status} /> },
            { key: 'campaignCount', label: 'Campaigns', num: true, width: '0.8fr', render: r => formatNumber(r.campaignCount) },
            { key: 'clicks', label: 'Clicks', num: true, width: '0.7fr', render: r => formatNumber(r.clicks) },
            { key: 'impressions', label: 'Impr.', num: true, width: '0.8fr', render: r => formatNumber(r.impressions) },
            { key: 'avgCpc', label: 'Avg. CPC', num: true, width: '0.8fr', sort: r => r.avgCpc ?? -1, render: r => money(r.avgCpc) },
            { key: 'cost', label: 'Cost', num: true, width: '0.9fr', render: r => money(r.cost) },
            { key: 'conversions', label: 'Conv.', num: true, width: '0.7fr', render: r => conv(r.conversions) },
            { key: 'costPerConversion', label: 'Cost / conv.', num: true, width: '0.9fr', sort: r => r.costPerConversion ?? -1, render: r => money(r.costPerConversion) },
            { key: 'actions', label: '', width: '0.9fr', sort: () => 0, render: r => (
              r.kind === 'portfolio' && (r.type === 'TARGET_CPA' || r.type === 'TARGET_ROAS')
                ? <div style={{ textAlign: 'right' }}><button onClick={() => setEditingStrategy(r)} style={actBtn}>Edit target</button></div>
                : r.kind === 'standard' ? <span style={{ fontSize: 11.5, color: C.stone }}>Edit in campaign</span> : null) },
          ]} />
      </>)}
    </Loaded>
  )
}

function PortfolioTargetEditor({ account, strategy, onClose, onSaved }: { account: AdsAccount; strategy: Row; onClose: () => void; onSaved: () => void }) {
  const isCpa = strategy.type === 'TARGET_CPA'
  const [name, setName] = useState<string>(strategy.name ?? '')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    const v = Number(value)
    if (!(v > 0)) { toast.error('Enter a target', isCpa ? 'Target CPA must be above 0.' : 'Target ROAS must be above 0.'); return }
    setBusy(true)
    try {
      const r = await fetch(`/api/google-ads/bidding-strategies/${strategy.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: strategy.type, ...(isCpa ? { targetCpa: v } : { targetRoasPercent: v }), ...(name.trim() && name.trim() !== strategy.name ? { name: name.trim() } : {}) }),
      })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.success) { toast.success('Portfolio strategy updated', `${name || strategy.name}: ${isCpa ? moneyFmt(account.currency)(v) : `${v}%`}`); onSaved() }
      else toast.error('Strategy not updated', j?.error || 'Please try again.')
    } catch { toast.error('Network error', 'Please try again.') }
    finally { setBusy(false) }
  }
  const field: React.CSSProperties = { height: 38, border: `1px solid ${C.ash}`, borderRadius: 10, padding: '0 10px', fontSize: 14, fontFamily: 'inherit', background: C.paper, color: C.ink }
  return (
    <Card>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 600, color: C.graphite }}>Name
          <input value={name} onChange={e => setName(e.target.value)} style={{ ...field, minWidth: 220 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 600, color: C.graphite }}>
          {isCpa ? `New target CPA (${account.currency || 'USD'})` : 'New target ROAS (%)'}
          <input type="number" min="0.01" step={isCpa ? '0.01' : '1'} value={value} onChange={e => setValue(e.target.value)} style={{ ...field, width: 160 }} />
        </label>
        <button onClick={save} disabled={busy} style={{ ...actBtn, height: 38, background: '#1A73E8', borderColor: '#1A73E8', color: '#fff' }}>{busy ? 'Saving…' : 'Save'}</button>
        <button onClick={onClose} style={{ ...actBtn, height: 38 }}>Cancel</button>
      </div>
    </Card>
  )
}
