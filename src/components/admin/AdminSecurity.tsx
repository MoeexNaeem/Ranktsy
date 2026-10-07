'use client'
/**
 * Admin Security section: everything unusual on Rankkw in one place.
 * Overview (threat level, what is happening and how to deal with it), the live
 * event feed, suspicious IPs (block / unblock), risky accounts (signup farms,
 * scrapers, targeted emails) and a health checklist with fixes.
 * Every list is paginated on the server (/api/admin/security). Event meanings and
 * fixes live in lib/security/catalog.ts.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { C, D } from '@/utils'
import { cardStyle, EmptyState, MONO, Pagination, tableCard, tableHead, th, tableRow } from '@/components/dashboard/kit'
import { SECURITY_EVENTS, SECURITY_TYPES, type SecurityEventType, type Severity } from '@/lib/security/catalog'
import { toast } from '@/components/ui/toast'
import { useConfirm, Spinner } from './ui'

type Range = '1h' | '24h' | '7d'
type Tab = 'overview' | 'events' | 'ips' | 'accounts' | 'health'
interface Paged<T> { rows: T[]; total: number; page: number; pages: number }

interface EventRow { _id: string; type: SecurityEventType; severity: Severity; ip: string; email: string | null; userId: string | null; path: string | null; detail: string | null; country: string | null; ua: string | null; count: number; first: string; last: string }
interface Overview {
  level: 'normal' | 'elevated' | 'under attack'; highLastHour: number
  severity: Record<Severity, number>
  counts: Record<string, { n: number; ips: number }>
  hours: { hour: string; info: number; warn: number; high: number }[]
  topIps: { ip: string; n: number; high: number; types: string[]; emails: string[]; country: string | null; last: string; blocked: boolean }[]
  countries: { country: string; n: number }[]
  totals: { blockedIps: number; restricted: number; tempMail: number; pending: number; signupFarms: number }
}
interface IpRow { ip: string; n: number; high: number; warn: number; types: string[]; emails: string[]; country: string | null; first: string; last: string; accounts: number; blocked: boolean }
interface BlockRow { _id: string; reason: string; by: string; at: string; until: string | null }
interface Check { id: string; label: string; status: 'ok' | 'warn' | 'bad' | 'manual'; detail: string; fix?: string }

// ── Visual language: neutral surfaces, colour only for meaning ────────────────
const RED = '#C2362B', AMBER = '#B76E00', SLATE = '#64748B'
const SEV: Record<Severity, { label: string; fg: string; bg: string; bar: string }> = {
  high: { label: 'High', fg: RED, bg: 'rgba(194,54,43,0.10)', bar: '#D84B3F' },
  warn: { label: 'Warning', fg: AMBER, bg: 'rgba(214,140,20,0.13)', bar: '#E8A33A' },
  info: { label: 'Info', fg: SLATE, bg: 'rgba(100,116,139,0.10)', bar: '#AEB9C7' },
}
const LEVEL = {
  normal: { label: 'All quiet', color: D.good, sub: 'No high-risk activity in the last hour.' },
  elevated: { label: 'Elevated', color: AMBER, sub: 'Some high-risk activity. Review the list below.' },
  'under attack': { label: 'Under attack', color: RED, sub: '50+ high-risk events in the last hour. Block the top IPs now.' },
} as const

const fmt = (d: string | null) => d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'
const n = (v: number) => v.toLocaleString('en-US')
const flag = (cc: string | null) => !cc || cc.length !== 2 || cc === 'XX' || cc === 'T1' ? '🌐' : String.fromCodePoint(...[...cc.toUpperCase()].map(ch => 127397 + ch.charCodeAt(0)))
const label = (t: string) => SECURITY_EVENTS[t as SecurityEventType]?.label ?? t

const card: React.CSSProperties = { ...cardStyle, padding: 20 }
const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 600, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.graphite }
const btn = (tone: 'plain' | 'danger' | 'good' | 'dark' = 'plain', small = false): React.CSSProperties => {
  const t = {
    plain: { bg: C.paper, fg: C.ink, bd: C.ash },
    danger: { bg: 'rgba(194,54,43,0.08)', fg: RED, bd: 'rgba(194,54,43,0.35)' },
    good: { bg: D.goodBg, fg: D.good, bd: `${D.good}55` },
    dark: { bg: C.ink, fg: '#fff', bd: C.ink },
  }[tone]
  return { background: t.bg, color: t.fg, border: `1px solid ${t.bd}`, borderRadius: 8, padding: small ? '5px 10px' : '7px 13px', fontSize: small ? 12 : 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1.2 }
}

function SevTag({ sev }: { sev: Severity }) {
  const s = SEV[sev]
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: s.fg, background: s.bg, padding: '3px 9px', borderRadius: 6, whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: s.fg }} />{s.label}</span>
}

function CardHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
      <div>
        <h3 style={{ fontSize: 15.5, fontWeight: 600, color: C.ink, letterSpacing: '-0.01em' }}>{title}</h3>
        {sub && <p style={{ fontSize: 12.5, color: C.graphite, marginTop: 3, lineHeight: 1.45 }}>{sub}</p>}
      </div>
      {right}
    </div>
  )
}

/** Small "‹ 2 / 5 ›" pager for lists inside cards. */
function MiniPager({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null
  const b = (disabled: boolean): React.CSSProperties => ({ ...btn('plain', true), opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer', minWidth: 30 })
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 10 }}>
      <span style={{ fontSize: 12, color: C.graphite, fontFamily: MONO }}>{n(total)} total</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={b(page <= 1)} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">‹</button>
        <span style={{ fontSize: 12.5, color: C.ink, fontFamily: MONO }}>{page} / {pages}</span>
        <button style={b(page >= pages)} disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">›</button>
      </div>
    </div>
  )
}

async function api<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-store', ...init })
    const d = await r.json().catch(() => null)
    if (!r.ok || !d?.success) { if (init?.method && init.method !== 'GET') toast.error('Action failed', d?.error ?? 'Please try again.'); return null }
    return (d.data ?? true) as T
  } catch { return null }
}

/** Load one page of a server-paginated list; reloads on url/page/tick change. */
function usePaged<T>(baseUrl: string, tick: number) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paged<T> | null>(null)
  useEffect(() => { setPage(1) }, [baseUrl])   // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => {
    let alive = true
    void api<Paged<T>>(`${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${page}`).then(x => { if (alive && x) setData(x) })
    return () => { alive = false }
  }, [baseUrl, page, tick])
  return { data, page, setPage }
}

const Loading = ({ h = 260 }: { h?: number }) => (
  <div role="status" style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.graphite, fontSize: 13.5 }}><Spinner size={17} color={C.orange} /> Loading…</div>
)

// ─── Shell ────────────────────────────────────────────────────────────────────
export function AdminSecurity() {
  const [tab, setTab] = useState<Tab>('overview')
  const [range, setRange] = useState<Range>('24h')
  const [tick, setTick] = useState(0)
  const [blockFor, setBlockFor] = useState<{ ip: string; reason: string } | null>(null)
  const [eventFilter, setEventFilter] = useState({ type: '', severity: '', q: '' })
  const reload = useCallback(() => setTick(t => t + 1), [])
  useEffect(() => { const t = setInterval(reload, 30_000); return () => clearInterval(t) }, [reload])

  const showEvents = (f: Partial<typeof eventFilter>) => { setEventFilter({ type: '', severity: '', q: '', ...f }); setTab('events') }
  const onBlock = (ip: string, reason: string) => setBlockFor({ ip, reason })
  const unblock = async (ip: string) => {
    if (await api('/api/admin/security', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unblock', ip }) })) { toast.success('IP unblocked', ip); reload() }
  }

  const TABS: [Tab, string][] = [['overview', 'Overview'], ['events', 'Events'], ['ips', 'IP addresses'], ['accounts', 'Risky accounts'], ['health', 'Health & fixes']]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Tab strip + time range */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: `1px solid ${C.ash}` }}>
        <div role="tablist" style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {TABS.map(([id, text]) => {
            const on = tab === id
            return (
              <button key={id} role="tab" aria-selected={on} onClick={() => setTab(id)}
                style={{ background: 'none', border: 'none', borderBottom: `2px solid ${on ? C.orange : 'transparent'}`, marginBottom: -1, padding: '10px 14px', fontSize: 14, fontWeight: on ? 600 : 500, color: on ? C.ink : C.graphite, cursor: 'pointer', fontFamily: 'inherit' }}>
                {text}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
          <div style={{ display: 'inline-flex', background: C.bone, borderRadius: 9, padding: 3 }}>
            {(['1h', '24h', '7d'] as Range[]).map(r => (
              <button key={r} onClick={() => setRange(r)}
                style={{ border: 'none', borderRadius: 7, padding: '5px 11px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', background: range === r ? C.paper : 'transparent', color: range === r ? C.ink : C.graphite, boxShadow: range === r ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>
                {r === '1h' ? '1 hour' : r === '24h' ? '24 hours' : '7 days'}
              </button>
            ))}
          </div>
          <button onClick={reload} title="Refresh now (auto-refreshes every 30 s)" style={btn('plain', true)}>↻ Refresh</button>
        </div>
      </div>

      {tab === 'overview' && <OverviewTab range={range} tick={tick} onEvents={showEvents} onBlock={onBlock} onUnblock={unblock} onTab={setTab} />}
      {tab === 'events' && <EventsTab range={range} tick={tick} filter={eventFilter} setFilter={setEventFilter} onBlock={onBlock} />}
      {tab === 'ips' && <IpsTab range={range} tick={tick} onEvents={showEvents} onBlock={onBlock} onUnblock={unblock} />}
      {tab === 'accounts' && <AccountsTab tick={tick} reload={reload} onBlock={onBlock} onEvents={showEvents} />}
      {tab === 'health' && <HealthTab tick={tick} />}

      {blockFor && <BlockModal ip={blockFor.ip} reason={blockFor.reason} onClose={() => setBlockFor(null)} onDone={() => { setBlockFor(null); reload() }} />}
    </div>
  )
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function OverviewTab({ range, tick, onEvents, onBlock, onUnblock, onTab }: { range: Range; tick: number; onEvents: (f: { type?: string; q?: string }) => void; onBlock: (ip: string, reason: string) => void; onUnblock: (ip: string) => void; onTab: (t: Tab) => void }) {
  const [d, setD] = useState<Overview | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => { let alive = true; void api<Overview>(`/api/admin/security?view=overview&range=${range}`).then(x => { if (alive && x) setD(x) }); return () => { alive = false } }, [range, tick])
  const chart = useMemo(() => (d?.hours ?? []).map(h => ({ ...h, label: `${h.hour.slice(11)}:00` })), [d])
  if (!d) return <Loading h={460} />

  const lv = LEVEL[d.level]
  const active = SECURITY_TYPES.filter(t => d.counts[t]?.n).sort((a, b) => {
    const rank = { high: 0, warn: 1, info: 2 } as const
    return rank[SECURITY_EVENTS[a].severity] - rank[SECURITY_EVENTS[b].severity] || (d.counts[b]?.n ?? 0) - (d.counts[a]?.n ?? 0)
  })
  const rangeText = range === '1h' ? 'last hour' : range === '24h' ? 'last 24 hours' : 'last 7 days'
  const stats: { label: string; value: number; tone?: string; hint: string; go?: Tab }[] = [
    { label: 'High-risk events', value: d.severity.high, tone: d.severity.high ? RED : undefined, hint: rangeText, go: 'events' },
    { label: 'Warnings', value: d.severity.warn, tone: d.severity.warn ? AMBER : undefined, hint: rangeText, go: 'events' },
    { label: 'Info events', value: d.severity.info, hint: rangeText, go: 'events' },
    { label: 'Blocked IPs', value: d.totals.blockedIps, hint: 'currently blocked', go: 'ips' },
    { label: 'Restricted accounts', value: d.totals.restricted, hint: 'refused on every tool', go: 'accounts' },
    { label: 'Temp-mail accounts', value: d.totals.tempMail, tone: d.totals.tempMail ? AMBER : undefined, hint: 'delete in Users: Email = Temp mail' },
    { label: 'Signup farms', value: d.totals.signupFarms, tone: d.totals.signupFarms ? AMBER : undefined, hint: 'IPs with 3+ accounts this week', go: 'accounts' },
    { label: 'Waiting for email code', value: d.totals.pending, hint: 'deleted after 3 days' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Status line */}
      <div style={{ ...cardStyle, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderLeft: `4px solid ${lv.color}` }}>
        <span style={{ position: 'relative', width: 10, height: 10, borderRadius: '50%', background: lv.color, boxShadow: `0 0 0 4px ${lv.color}22`, flexShrink: 0 }} />
        <span style={{ fontSize: 15.5, fontWeight: 650, color: C.ink }}>{lv.label}</span>
        <span style={{ fontSize: 13.5, color: C.graphite }}>{lv.sub}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: C.graphite, fontFamily: MONO }}>{n(d.highLastHour)} high-risk in the last hour</span>
      </div>

      {/* Numbers: one panel, 2 even rows of 4 */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1, background: C.ash }}>
          {stats.map(s => (
            <button key={s.label} onClick={() => s.go && onTab(s.go)} disabled={!s.go}
              style={{ background: C.paper, border: 'none', textAlign: 'left', padding: '16px 18px', cursor: s.go ? 'pointer' : 'default', fontFamily: 'inherit' }}>
              <p style={eyebrow}>{s.label}</p>
              <p style={{ fontSize: 26, fontWeight: 650, color: s.tone ?? C.ink, marginTop: 8, letterSpacing: '-0.02em', lineHeight: 1 }}>{n(s.value)}</p>
              <p style={{ fontSize: 12, color: C.stone, marginTop: 6 }}>{s.hint}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Activity chart */}
      <div style={card}>
        <CardHead title="Activity" sub="Security events per hour, last 24 hours (UTC)"
          right={<div style={{ display: 'flex', gap: 12 }}>{(['high', 'warn', 'info'] as Severity[]).map(s => <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.graphite }}><span style={{ width: 10, height: 10, borderRadius: 3, background: SEV[s].bar }} />{SEV[s].label}</span>)}</div>} />
        <div style={{ height: 210 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke={C.hair} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.stone }} tickLine={false} axisLine={{ stroke: C.ash }} interval={2} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.stone }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ borderRadius: 10, border: `1px solid ${C.ash}`, fontSize: 12.5 }} labelFormatter={l => `${l} UTC`} />
              <Bar dataKey="info" name="Info" stackId="s" fill={SEV.info.bar} />
              <Bar dataKey="warn" name="Warnings" stackId="s" fill={SEV.warn.bar} />
              <Bar dataKey="high" name="High-risk" stackId="s" fill={SEV.high.bar} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* What is happening */}
      <div style={card}>
        <CardHead title="What is happening, and what to do" sub={`Every kind of event in the ${rangeText}. Click one for an explanation and the fix.`} />
        {!active.length ? <EmptyState title="Nothing unusual" sub="No security events in this time range." /> : (
          <div style={{ border: `1px solid ${C.ash}`, borderRadius: 12, overflow: 'hidden' }}>
            {active.map((t, i) => {
              const info = SECURITY_EVENTS[t]
              const c = d.counts[t]
              const isOpen = open === t
              return (
                <div key={t} style={{ borderTop: i ? `1px solid ${C.hair}` : 'none', background: isOpen ? C.canvas : C.paper }}>
                  <div onClick={() => setOpen(isOpen ? null : t)} style={{ display: 'grid', gridTemplateColumns: '96px 1fr auto auto', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer' }}>
                    <SevTag sev={info.severity} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{info.label}</span>
                    <span style={{ fontSize: 12.5, color: C.graphite, fontFamily: MONO, whiteSpace: 'nowrap' }}>{n(c.n)}× · {n(c.ips)} IP{c.ips === 1 ? '' : 's'}</span>
                    <span style={{ fontSize: 12, color: C.stone, width: 14, textAlign: 'center' }}>{isOpen ? '−' : '+'}</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '0 14px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                      <div style={{ background: C.paper, border: `1px solid ${C.hair}`, borderRadius: 10, padding: '10px 12px' }}>
                        <p style={{ ...eyebrow, marginBottom: 5 }}>What it means</p>
                        <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.55 }}>{info.meaning}</p>
                      </div>
                      <div style={{ background: C.paper, border: `1px solid ${C.hair}`, borderLeft: `3px solid ${C.orange}`, borderRadius: 10, padding: '10px 12px' }}>
                        <p style={{ ...eyebrow, color: C.orange, marginBottom: 5 }}>What to do</p>
                        <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.55 }}>{info.fix}</p>
                        <button onClick={() => onEvents({ type: t })} style={{ ...btn('plain', true), marginTop: 10 }}>See these events →</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        <div style={card}>
          <CardHead title="Most suspicious IPs" sub="Top 10 by high-risk events." right={<button onClick={() => onTab('ips')} style={btn('plain', true)}>All IPs →</button>} />
          {!d.topIps.length ? <EmptyState title="No suspicious IPs" /> : d.topIps.map((ip, i) => (
            <div key={ip.ip} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? `1px solid ${C.hair}` : 'none' }}>
              <span style={{ fontSize: 15, width: 20 }}>{flag(ip.country)}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <button onClick={() => onEvents({ q: ip.ip })} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: MONO, fontSize: 13.5, fontWeight: 600, color: C.ink }}>{ip.ip}</button>
                <p style={{ fontSize: 12, color: C.graphite, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n(ip.n)} events{ip.high ? ` · ${n(ip.high)} high-risk` : ''} · {ip.types.map(label).slice(0, 2).join(', ')}
                </p>
              </div>
              {ip.blocked ? <button onClick={() => onUnblock(ip.ip)} style={btn('good', true)}>Unblock</button>
                : <button onClick={() => onBlock(ip.ip, ip.types.map(label).join(', '))} style={btn('danger', true)}>Block</button>}
            </div>
          ))}
        </div>
        <div style={card}>
          <CardHead title="Where it comes from" sub="Events by country." />
          {!d.countries.length ? <EmptyState title="No events" /> : d.countries.map(c => {
            const max = d.countries[0].n || 1
            return (
              <div key={c.country} style={{ display: 'grid', gridTemplateColumns: '22px 34px 1fr 64px', alignItems: 'center', gap: 10, padding: '7px 0' }}>
                <span style={{ fontSize: 15 }}>{flag(c.country)}</span>
                <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.ink }}>{c.country}</span>
                <div style={{ height: 6, background: C.bone, borderRadius: 99 }}><div style={{ width: `${(c.n / max) * 100}%`, height: '100%', background: C.ink, opacity: 0.75, borderRadius: 99 }} /></div>
                <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.graphite, textAlign: 'right' }}>{n(c.n)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Events ───────────────────────────────────────────────────────────────────
function EventsTab({ range, tick, filter, setFilter, onBlock }: { range: Range; tick: number; filter: { type: string; severity: string; q: string }; setFilter: (f: { type: string; severity: string; q: string }) => void; onBlock: (ip: string, reason: string) => void }) {
  const [q, setQ] = useState(filter.q)
  const base = `/api/admin/security?view=events&range=${range}&type=${filter.type}&severity=${filter.severity}&q=${encodeURIComponent(filter.q)}`
  const { data: d, page, setPage } = usePaged<EventRow>(base, tick)
  const GRID = '118px 92px 1.4fr 1.25fr 1.3fr 1.5fr 56px 70px'
  const sel: React.CSSProperties = { border: `1px solid ${C.ash}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', background: C.paper, color: C.ink }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })} style={sel}>
          <option value="">All event types</option>
          {SECURITY_TYPES.map(t => <option key={t} value={t}>{SECURITY_EVENTS[t].label}</option>)}
        </select>
        <select value={filter.severity} onChange={e => setFilter({ ...filter, severity: e.target.value })} style={sel}>
          <option value="">All risk levels</option><option value="high">High-risk</option><option value="warn">Warnings</option><option value="info">Info</option>
        </select>
        <form onSubmit={e => { e.preventDefault(); setFilter({ ...filter, q: q.trim() }) }} style={{ display: 'flex', gap: 6 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search email or IP" style={{ ...sel, minWidth: 220 }} />
          <button type="submit" style={btn('dark')}>Search</button>
        </form>
        {(filter.type || filter.severity || filter.q) && <button onClick={() => { setQ(''); setFilter({ type: '', severity: '', q: '' }) }} style={{ ...btn('plain', true), border: 'none', color: C.orange }}>Clear filters</button>}
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: C.graphite, fontFamily: MONO }}>{d ? `${n(d.total)} results` : ''}</span>
      </div>
      <div className="rtable" style={tableCard}>
        <div style={tableHead(GRID)}>{['When', 'Risk', 'Event', 'IP', 'Account', 'Details', 'Times', ''].map(h => <span key={h} style={th}>{h}</span>)}</div>
        {!d ? <Loading h={320} />
          : !d.rows.length ? <EmptyState title="No events" sub="Nothing matches these filters in this time range." />
          : d.rows.map(r => (
            <div key={r._id} style={tableRow(GRID)}>
              <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.graphite }}>{fmt(r.last)}</span>
              <SevTag sev={r.severity} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }} title={SECURITY_EVENTS[r.type]?.meaning}>{label(r.type)}</span>
              <button onClick={() => { setQ(r.ip); setFilter({ ...filter, q: r.ip }) }} title="Show everything from this IP"
                style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: MONO, fontSize: 12.5, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{flag(r.country)} {r.ip}</button>
              <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.graphite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.email ?? ''}>{r.email ?? '-'}</span>
              <span style={{ fontSize: 12.5, color: C.graphite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={[r.detail, r.path, r.ua].filter(Boolean).join(' · ')}>{[r.detail, r.path].filter(Boolean).join(' · ') || '-'}</span>
              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: r.count > 10 ? RED : C.ink }}>{n(r.count)}</span>
              {r.ip !== 'unknown' && r.type !== 'admin_action' ? <button onClick={() => onBlock(r.ip, label(r.type))} style={btn('danger', true)}>Block</button> : <span />}
            </div>
          ))}
      </div>
      {d && <Pagination page={page} pageCount={d.pages} onChange={setPage} />}
    </div>
  )
}

// ─── IP addresses ─────────────────────────────────────────────────────────────
function IpsTab({ range, tick, onEvents, onBlock, onUnblock }: { range: Range; tick: number; onEvents: (f: { q?: string }) => void; onBlock: (ip: string, reason: string) => void; onUnblock: (ip: string) => void }) {
  const ips = usePaged<IpRow>(`/api/admin/security?view=ips&range=${range}`, tick)
  const blocks = usePaged<BlockRow>('/api/admin/security?view=blocks', tick)
  const [manual, setManual] = useState('')
  const GRID = '1.25fr 0.95fr 1.8fr 1.6fr 0.6fr 0.95fr 84px'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...card, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Block an IP</span>
        <input value={manual} onChange={e => setManual(e.target.value)} placeholder="e.g. 77.239.124.77" style={{ border: `1px solid ${C.ash}`, borderRadius: 8, padding: '8px 12px', fontSize: 13.5, fontFamily: MONO, minWidth: 220, background: C.canvas, color: C.ink }} />
        <button onClick={() => manual.trim() && onBlock(manual.trim(), 'Blocked manually')} style={btn('danger')}>Block…</button>
        <span style={{ fontSize: 12.5, color: C.graphite }}>The address gets an &quot;Access blocked&quot; page on the whole site, API included.</span>
      </div>

      <div>
        <div className="rtable" style={tableCard}>
          <div style={tableHead(GRID)}>{['IP', 'Events', 'What it did', 'Accounts seen', 'Signups', 'Last seen', ''].map(h => <span key={h} style={th}>{h}</span>)}</div>
          {!ips.data ? <Loading h={320} />
            : !ips.data.rows.length ? <EmptyState title="No suspicious IPs" sub="Nothing recorded in this time range." />
            : ips.data.rows.map(r => (
              <div key={r.ip} style={{ ...tableRow(GRID), background: r.blocked ? 'rgba(194,54,43,0.04)' : undefined }}>
                <button onClick={() => onEvents({ q: r.ip })} title="Show this IP's events" style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: MONO, fontSize: 13, fontWeight: 600, color: C.ink }}>
                  {flag(r.country)} {r.ip}{r.blocked && <span style={{ marginLeft: 6, fontSize: 10.5, color: RED, fontWeight: 700 }}>BLOCKED</span>}
                </button>
                <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.ink }}>
                  {n(r.n)}{r.high ? <span style={{ color: RED }}> · {n(r.high)} high</span> : null}{r.warn ? <span style={{ color: AMBER }}> · {n(r.warn)} warn</span> : null}
                </span>
                <span style={{ fontSize: 12.5, color: C.graphite }}>{r.types.map(label).join(', ')}</span>
                <span style={{ fontSize: 12, color: C.graphite, fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.emails.join('\n')}>{r.emails.length ? r.emails.slice(0, 2).join(', ') + (r.emails.length > 2 ? ` +${r.emails.length - 2}` : '') : '-'}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, color: r.accounts >= 3 ? AMBER : C.ink, fontWeight: r.accounts >= 3 ? 700 : 500 }}>{r.accounts || '-'}</span>
                <span style={{ fontFamily: MONO, fontSize: 12, color: C.graphite }}>{fmt(r.last)}</span>
                {r.blocked ? <button onClick={() => onUnblock(r.ip)} style={btn('good', true)}>Unblock</button>
                  : <button onClick={() => onBlock(r.ip, r.types.map(label).join(', '))} style={btn('danger', true)}>Block</button>}
              </div>
            ))}
        </div>
        {ips.data && <Pagination page={ips.page} pageCount={ips.data.pages} onChange={ips.setPage} />}
      </div>

      <div style={card}>
        <CardHead title="Blocked IPs" sub="Expired blocks are shown faded and no longer apply." />
        {!blocks.data ? <Loading h={120} /> : !blocks.data.rows.length ? <EmptyState title="No blocked IPs" /> : blocks.data.rows.map((b, i) => {
          const expired = !!b.until && new Date(b.until) < new Date()
          return (
            <div key={b._id} style={{ display: 'grid', gridTemplateColumns: '170px 1fr auto auto', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? `1px solid ${C.hair}` : 'none', opacity: expired ? 0.5 : 1 }}>
              <span style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 600, color: C.ink }}>{b._id}</span>
              <span style={{ fontSize: 12.5, color: C.graphite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.reason}>{b.reason}</span>
              <span style={{ fontSize: 12, color: C.graphite, fontFamily: MONO, whiteSpace: 'nowrap' }}>{expired ? 'expired' : b.until ? `until ${fmt(b.until)}` : 'forever'}</span>
              <button onClick={() => onUnblock(b._id)} style={btn('good', true)}>Unblock</button>
            </div>
          )
        })}
        {blocks.data && <MiniPager page={blocks.page} pages={blocks.data.pages} total={blocks.data.total} onChange={blocks.setPage} />}
      </div>
    </div>
  )
}

// ─── Risky accounts ───────────────────────────────────────────────────────────
interface Farm { ip: string; n: number; emails: string[]; last: string }
interface Heavy { userEmail?: string; userId: string; etsyCalls: number; searches: number; googleCalls: number }
interface Targeted { email: string; n: number; ips: string[]; last: string }
interface Restricted { _id: string; email: string; name: string; plan: string }

function AccountsTab({ tick, reload, onBlock, onEvents }: { tick: number; reload: () => void; onBlock: (ip: string, reason: string) => void; onEvents: (f: { q?: string }) => void }) {
  const farms = usePaged<Farm>('/api/admin/security?view=accounts&list=farms', tick)
  const heavy = usePaged<Heavy>('/api/admin/security?view=accounts&list=heavy', tick)
  const targeted = usePaged<Targeted>('/api/admin/security?view=accounts&list=targeted', tick)
  const restricted = usePaged<Restricted>('/api/admin/security?view=accounts&list=restricted', tick)
  const { confirm, dialog: confirmDialog } = useConfirm()
  const setRestricted = (userId: string, value: boolean, email: string) => void confirm({
    title: value ? 'Restrict this account?' : 'Lift the restriction?', tone: value ? 'danger' : 'primary',
    confirmLabel: value ? 'Restrict' : 'Unrestrict', busyLabel: 'Saving…',
    body: value ? `${email} is refused on every tool and the dashboard until you lift it.` : `${email} gets full access again right away.`,
    action: async () => {
      const ok = await api(`/api/admin/users/${userId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restricted: value }) })
      if (!ok) return 'Could not save. Please try again.'
      toast.success(value ? 'Account restricted' : 'Restriction lifted', email); reload()
    },
  })
  const row = (i: number, children: React.ReactNode) => <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? `1px solid ${C.hair}` : 'none' }}>{children}</div>
  const body = <T,>(p: { data: Paged<T> | null; page: number; setPage: (n: number) => void }, empty: string, render: (r: T, i: number) => React.ReactNode) => (
    <>
      {!p.data ? <Loading h={140} /> : !p.data.rows.length ? <EmptyState title={empty} /> : p.data.rows.map(render)}
      {p.data && <MiniPager page={p.page} pages={p.data.pages} total={p.data.total} onChange={p.setPage} />}
    </>
  )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
      {confirmDialog}
      <div style={card}>
        <CardHead title="Signup farms" sub="One connection that created several accounts, usually to farm free credits. Recorded for signups from 7 Oct on." />
        {body(farms, 'None found', (f, i) => (
          <div key={f.ip} style={{ padding: '10px 0', borderTop: i ? `1px solid ${C.hair}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 600, color: C.ink }}>{f.ip}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: f.n >= 3 ? AMBER : C.graphite }}>{f.n} accounts</span>
              <button onClick={() => onBlock(f.ip, `Signup farm: ${f.n} accounts`)} style={{ ...btn('danger', true), marginLeft: 'auto' }}>Block IP</button>
            </div>
            <p style={{ fontSize: 12, color: C.graphite, fontFamily: MONO, marginTop: 4, wordBreak: 'break-all', lineHeight: 1.5 }}>{f.emails.join(', ')}</p>
          </div>
        ))}
      </div>
      <div style={card}>
        <CardHead title="Heaviest Etsy data users today" sub="Over ~5,000 Etsy calls a day is not normal use. 15,000 is blocked automatically." />
        {body(heavy, 'No usage yet today', (h, i) => row(i, <>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontFamily: MONO, fontSize: 13, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.userEmail ?? h.userId}</p>
            <p style={{ fontSize: 12, color: C.graphite }}>{n(h.searches)} searches · {n(h.googleCalls)} Google calls</p>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 650, color: h.etsyCalls >= 5000 ? RED : C.ink }}>{n(h.etsyCalls)}</span>
          {h.etsyCalls >= 5000 && h.userId && !h.userId.startsWith('system') && h.userId !== 'anonymous'
            ? <button onClick={() => setRestricted(h.userId, true, h.userEmail ?? h.userId)} style={btn('danger', true)}>Restrict</button> : null}
        </>))}
      </div>
      <div style={card}>
        <CardHead title="Emails under password attack" sub="Accounts with wrong-password attempts in the last 7 days." />
        {body(targeted, 'None', (t, i) => row(i, <>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontFamily: MONO, fontSize: 13, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.email}</p>
            <p style={{ fontSize: 12, color: C.graphite, fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>from {t.ips.join(', ')}</p>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 650, color: t.n >= 10 ? RED : C.ink }}>{n(t.n)}</span>
          <button onClick={() => onEvents({ q: t.email })} style={btn('plain', true)}>Events</button>
        </>))}
      </div>
      <div style={card}>
        <CardHead title="Restricted accounts" sub="Refused on every tool request (checked on the server)." />
        {body(restricted, 'No restricted accounts', (u, i) => row(i, <>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 13.5, color: C.ink, fontWeight: 600 }}>{u.name}</p>
            <p style={{ fontFamily: MONO, fontSize: 12, color: C.graphite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email} · {u.plan}</p>
          </div>
          <button onClick={() => setRestricted(u._id, false, u.email)} style={btn('good', true)}>Unrestrict</button>
        </>))}
      </div>
    </div>
  )
}

// ─── Health & fixes ───────────────────────────────────────────────────────────
function HealthTab({ tick }: { tick: number }) {
  const [checks, setChecks] = useState<Check[] | null>(null)
  useEffect(() => { let alive = true; void api<{ checks: Check[] }>('/api/admin/security?view=health').then(x => { if (alive && x) setChecks(x.checks) }); return () => { alive = false } }, [tick])
  if (!checks) return <Loading h={460} />
  const ST = {
    bad: { icon: '✕', fg: RED, bg: 'rgba(194,54,43,0.10)', label: 'Fix this' },
    warn: { icon: '!', fg: AMBER, bg: 'rgba(214,140,20,0.13)', label: 'Needs attention' },
    manual: { icon: '?', fg: SLATE, bg: 'rgba(100,116,139,0.10)', label: 'Check yourself' },
    ok: { icon: '✓', fg: D.good, bg: D.goodBg, label: 'Good' },
  } as const
  const order = { bad: 0, warn: 1, manual: 2, ok: 3 } as const
  const sorted = [...checks].sort((a, b) => order[a.status] - order[b.status])
  const counts = checks.reduce<Record<string, number>>((m, c) => ({ ...m, [c.status]: (m[c.status] ?? 0) + 1 }), {})
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1, background: C.ash }}>
          {(['bad', 'warn', 'manual', 'ok'] as const).map(s => (
            <div key={s} style={{ background: C.paper, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', background: ST[s].bg, color: ST[s].fg, fontWeight: 800, fontSize: 12.5 }}>{ST[s].icon}</span>
              <div><p style={eyebrow}>{ST[s].label}</p><p style={{ fontSize: 20, fontWeight: 650, color: C.ink }}>{counts[s] ?? 0}</p></div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        {sorted.map((c, i) => (
          <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '30px 1fr', gap: 14, padding: '16px 18px', borderTop: i ? `1px solid ${C.hair}` : 'none' }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', background: ST[c.status].bg, color: ST[c.status].fg, fontWeight: 800, fontSize: 13 }}>{ST[c.status].icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <p style={{ fontSize: 14.5, fontWeight: 600, color: C.ink }}>{c.label}</p>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: ST[c.status].fg }}>{ST[c.status].label}</span>
              </div>
              <p style={{ fontSize: 13.5, color: C.graphite, marginTop: 3, lineHeight: 1.55, wordBreak: 'break-word' }}>{c.detail}</p>
              {c.fix && c.status !== 'ok' && (
                <p style={{ fontSize: 13.5, color: C.ink, marginTop: 8, lineHeight: 1.55, borderLeft: `3px solid ${C.orange}`, background: C.canvas, borderRadius: '0 8px 8px 0', padding: '8px 12px' }}>
                  <b style={{ color: C.orange }}>How to fix: </b>{c.fix}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Block IP modal ───────────────────────────────────────────────────────────
function BlockModal({ ip, reason: initialReason, onClose, onDone }: { ip: string; reason: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState(initialReason)
  const [hours, setHours] = useState<number>(24 * 7)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    const ok = await api('/api/admin/security', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'block', ip, reason, hours: hours || null }) })
    setBusy(false)
    if (ok) { toast.success('IP blocked', `${ip} can no longer open Rankkw.`); onDone() }
  }
  const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.ash}`, borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', background: C.canvas, color: C.ink, marginBottom: 14 }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,14,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 20 }} onClick={() => !busy && onClose()}>
      <div style={{ background: C.paper, borderRadius: 14, padding: '22px 24px', maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: 6 }}>Block <span style={{ fontFamily: MONO }}>{ip}</span>?</h3>
        <p style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.55, marginBottom: 16 }}>This address gets an &quot;Access blocked&quot; page for the whole site, API included. Everyone sharing that connection is affected.</p>
        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: C.ink, marginBottom: 6 }}>Reason (for your records)</label>
        <input value={reason} onChange={e => setReason(e.target.value)} style={field} maxLength={300} />
        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: C.ink, marginBottom: 6 }}>For how long</label>
        <select value={hours} onChange={e => setHours(Number(e.target.value))} style={field}>
          <option value={1}>1 hour</option><option value={24}>24 hours</option><option value={24 * 7}>7 days</option><option value={24 * 30}>30 days</option><option value={0}>Forever</option>
        </select>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} disabled={busy} style={btn('plain')}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{ ...btn('danger'), background: RED, color: '#fff', borderColor: RED }}>{busy ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Spinner size={12} color="#fff" /> Blocking…</span> : 'Block IP'}</button>
        </div>
      </div>
    </div>
  )
}
