'use client'
/**
 * Admin Security section: everything unusual on Rankkw in one place.
 * Overview (threat level, what is happening and how to deal with it), the live
 * event feed, suspicious IPs (block / unblock), risky accounts (signup farms,
 * scrapers, targeted emails) and a health checklist with fixes.
 * Data: /api/admin/security. Event meanings and fixes: lib/security/catalog.ts.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { C, D } from '@/utils'
import { cardStyle, EmptyState, MONO, Pagination, SectionTitle, tableCard, tableHead, th, tableRow } from '@/components/dashboard/kit'
import { SECURITY_EVENTS, SECURITY_TYPES, type SecurityEventType, type Severity } from '@/lib/security/catalog'
import { toast } from '@/components/ui/toast'

type Range = '1h' | '24h' | '7d'
type Tab = 'overview' | 'events' | 'ips' | 'accounts' | 'health'

interface EventRow { _id: string; type: SecurityEventType; severity: Severity; ip: string; email: string | null; userId: string | null; path: string | null; detail: string | null; country: string | null; ua: string | null; count: number; first: string; last: string }
interface Overview {
  level: 'normal' | 'elevated' | 'under attack'; highLastHour: number
  severity: Record<Severity, number>
  counts: Record<string, { n: number; ips: number }>
  hours: { hour: string; info: number; warn: number; high: number }[]
  topIps: { ip: string; n: number; high: number; types: string[]; emails: string[]; country: string | null; last: string; blocked: boolean }[]
  countries: { country: string; n: number }[]
  recentHigh: EventRow[]
  totals: { blockedIps: number; restricted: number; tempMail: number; pending: number; signupFarms: number }
}
interface IpRow { ip: string; n: number; high: number; warn: number; types: string[]; emails: string[]; country: string | null; first: string; last: string; accounts: number; blocked: boolean }
interface BlockRow { _id: string; reason: string; by: string; at: string; until: string | null }
interface Accounts {
  farms: { ip: string; n: number; emails: string[]; last: string }[]
  heavy: { userEmail?: string; userId: string; etsyCalls: number; searches: number; googleCalls: number }[]
  targeted: { email: string; n: number; ips: string[]; last: string }[]
  restricted: { _id: string; email: string; name: string; plan: string; createdAt: string }[]
  tempMail: number
}
interface Check { id: string; label: string; status: 'ok' | 'warn' | 'bad' | 'manual'; detail: string; fix?: string }

const SEV: Record<Severity, { label: string; fg: string; bg: string }> = {
  high: { label: 'High', fg: '#B42318', bg: 'rgba(207,70,58,0.13)' },
  warn: { label: 'Warning', fg: '#9A5B00', bg: 'rgba(232,160,40,0.18)' },
  info: { label: 'Info', fg: '#475467', bg: 'rgba(71,84,103,0.10)' },
}
const LEVEL: Record<Overview['level'], { label: string; fg: string; bg: string; sub: string }> = {
  normal: { label: 'All quiet', fg: D.good, bg: D.goodBg, sub: 'No high-risk activity in the last hour.' },
  elevated: { label: 'Elevated', fg: '#9A5B00', bg: 'rgba(232,160,40,0.18)', sub: 'Some high-risk activity. Check the list below.' },
  'under attack': { label: 'Under attack', fg: '#B42318', bg: 'rgba(207,70,58,0.14)', sub: '50+ high-risk events in the last hour. Block the top IPs now.' },
}
const fmt = (d: string | null) => d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'
const n = (v: number) => v.toLocaleString('en-US')
const flag = (cc: string | null) => !cc || cc.length !== 2 || cc === 'XX' || cc === 'T1' ? '🌐' : String.fromCodePoint(...[...cc.toUpperCase()].map(ch => 127397 + ch.charCodeAt(0)))

function Pill({ sev }: { sev: Severity }) {
  const s = SEV[sev]
  return <span style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 700, fontFamily: MONO, color: s.fg, background: s.bg, padding: '3px 9px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{s.label}</span>
}
const btn = (bg: string, fg: string, border = bg): React.CSSProperties => ({ background: bg, color: fg, border: `1px solid ${border}`, borderRadius: 100, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' })

async function api<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-store', ...init })
    const d = await r.json().catch(() => null)
    if (!r.ok || !d?.success) { if (init?.method === 'POST') toast.error('Action failed', d?.error ?? 'Please try again.'); return null }
    return (d.data ?? true) as T
  } catch { return null }
}

export function AdminSecurity() {
  const [tab, setTab] = useState<Tab>('overview')
  const [range, setRange] = useState<Range>('24h')
  const [tick, setTick] = useState(0)                         // bump to reload the current tab
  const [blockFor, setBlockFor] = useState<{ ip: string; reason: string } | null>(null)
  const [eventFilter, setEventFilter] = useState<{ type: string; severity: string; q: string }>({ type: '', severity: '', q: '' })
  const reload = useCallback(() => setTick(t => t + 1), [])

  // Live: refresh every 30 s while open.
  useEffect(() => { const t = setInterval(reload, 30_000); return () => clearInterval(t) }, [reload])

  const showEvents = (f: Partial<typeof eventFilter>) => { setEventFilter({ type: '', severity: '', q: '', ...f }); setTab('events') }
  const unblock = async (ip: string) => { if (await api('/api/admin/security', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unblock', ip }) })) { toast.success('IP unblocked', ip); reload() } }

  const TABS: [Tab, string][] = [['overview', 'Overview'], ['events', 'Live events'], ['ips', 'IP addresses'], ['accounts', 'Risky accounts'], ['health', 'Health & fixes']]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              style={{ ...btn(tab === id ? C.ink : C.paper, tab === id ? '#fff' : C.ink, tab === id ? C.ink : C.ash), padding: '9px 16px', fontSize: 13.5 }}>{label}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['1h', '24h', '7d'] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)} style={{ ...btn(range === r ? `${C.orange}18` : C.paper, range === r ? C.orange : C.graphite, range === r ? C.orange : C.ash), padding: '6px 12px' }}>{r === '1h' ? 'Last hour' : r === '24h' ? '24 hours' : '7 days'}</button>
          ))}
          <button onClick={reload} title="Refresh now" style={{ ...btn(C.paper, C.ink, C.ash), padding: '6px 12px' }}>↻</button>
        </div>
      </div>

      {tab === 'overview' && <OverviewTab range={range} tick={tick} onEvents={showEvents} onBlock={(ip, reason) => setBlockFor({ ip, reason })} onUnblock={unblock} />}
      {tab === 'events' && <EventsTab range={range} tick={tick} filter={eventFilter} setFilter={setEventFilter} onBlock={(ip, reason) => setBlockFor({ ip, reason })} />}
      {tab === 'ips' && <IpsTab range={range} tick={tick} onEvents={showEvents} onBlock={(ip, reason) => setBlockFor({ ip, reason })} onUnblock={unblock} />}
      {tab === 'accounts' && <AccountsTab tick={tick} reload={reload} onBlock={(ip, reason) => setBlockFor({ ip, reason })} onEvents={showEvents} />}
      {tab === 'health' && <HealthTab tick={tick} />}

      {blockFor && <BlockModal ip={blockFor.ip} reason={blockFor.reason} onClose={() => setBlockFor(null)} onDone={() => { setBlockFor(null); reload() }} />}
    </div>
  )
}

// ─── Overview ──────────────────────────────────────────────────────────────────
function OverviewTab({ range, tick, onEvents, onBlock, onUnblock }: { range: Range; tick: number; onEvents: (f: { type?: string; severity?: string; q?: string }) => void; onBlock: (ip: string, reason: string) => void; onUnblock: (ip: string) => void }) {
  const [d, setD] = useState<Overview | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => { let alive = true; void api<Overview>(`/api/admin/security?view=overview&range=${range}`).then(x => { if (alive && x) setD(x) }); return () => { alive = false } }, [range, tick])
  if (!d) return <div className="shimmer" style={{ height: 420, borderRadius: 16, background: '#e8e7e2' }} />

  const lv = LEVEL[d.level]
  const active = SECURITY_TYPES.filter(t => d.counts[t]?.n).sort((a, b) => {
    const rank = { high: 0, warn: 1, info: 2 } as const
    return rank[SECURITY_EVENTS[a].severity] - rank[SECURITY_EVENTS[b].severity] || (d.counts[b]?.n ?? 0) - (d.counts[a]?.n ?? 0)
  })
  const maxBar = Math.max(1, ...d.hours.map(h => h.info + h.warn + h.high))
  const tiles: [string, number, string, string?][] = [
    ['High-risk events', d.severity.high, '#B42318'], ['Warnings', d.severity.warn, '#9A5B00'], ['Info', d.severity.info, '#475467'],
    ['Blocked IPs', d.totals.blockedIps, C.ink], ['Restricted accounts', d.totals.restricted, C.ink], ['Temp-mail accounts', d.totals.tempMail, '#9A3412', 'Delete them in Users: Email = Temp mail'],
    ['Signup farms (7 days)', d.totals.signupFarms, '#9A3412', 'Connections that made 3+ accounts this week'], ['Waiting for email code', d.totals.pending, C.graphite],
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...cardStyle, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: lv.bg, borderColor: `${lv.fg}40` }}>
        <span style={{ width: 14, height: 14, borderRadius: '50%', background: lv.fg, boxShadow: `0 0 0 6px ${lv.fg}22` }} />
        <div>
          <p style={{ fontSize: 22, fontWeight: 700, color: lv.fg, letterSpacing: '-0.02em' }}>{lv.label}</p>
          <p style={{ fontSize: 13.5, color: C.ink, marginTop: 2 }}>{lv.sub} <span style={{ color: C.graphite }}>({n(d.highLastHour)} high-risk in the last hour)</span></p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {tiles.map(([label, v, color, hint]) => (
          <div key={label} title={hint} style={{ ...cardStyle, padding: '14px 16px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.graphite }}>{label}</p>
            <p style={{ fontSize: 26, fontWeight: 700, color, marginTop: 6, letterSpacing: '-0.02em' }}>{n(v)}</p>
          </div>
        ))}
      </div>

      <div style={{ ...cardStyle, padding: 20 }}>
        <SectionTitle right={<span style={{ fontSize: 11.5, color: C.graphite, fontFamily: MONO }}>last 24 hours, by hour</span>}>Activity</SectionTitle>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
          {d.hours.map(h => {
            const total = h.info + h.warn + h.high
            return (
              <div key={h.hour} title={`${h.hour.slice(11)}:00 UTC  high ${h.high} · warnings ${h.warn} · info ${h.info}`}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', minWidth: 4 }}>
                <div style={{ height: `${(h.high / maxBar) * 100}%`, background: '#D92D20', borderRadius: '3px 3px 0 0' }} />
                <div style={{ height: `${(h.warn / maxBar) * 100}%`, background: '#F0A030' }} />
                <div style={{ height: `${(h.info / maxBar) * 100}%`, background: '#B6C2CF', borderRadius: total && !h.high && !h.warn ? '3px 3px 0 0' : 0 }} />
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.stone, fontFamily: MONO, marginTop: 6 }}><span>24h ago</span><span>now</span></div>
      </div>

      <div style={{ ...cardStyle, padding: 20 }}>
        <SectionTitle>What is happening, and what to do</SectionTitle>
        {!active.length ? <EmptyState title="Nothing unusual" sub="No security events in this time range." /> : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {active.map(t => {
              const info = SECURITY_EVENTS[t]
              const c = d.counts[t]
              const isOpen = open === t
              return (
                <div key={t} style={{ borderBottom: `1px solid ${C.hair}`, padding: '12px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setOpen(isOpen ? null : t)}>
                    <Pill sev={info.severity} />
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: C.ink }}>{info.label}</span>
                    <span style={{ fontSize: 13, color: C.graphite, fontFamily: MONO }}>{n(c.n)} time{c.n === 1 ? '' : 's'} · {n(c.ips)} IP{c.ips === 1 ? '' : 's'}</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      <button onClick={e => { e.stopPropagation(); onEvents({ type: t }) }} style={btn(C.paper, C.ink, C.ash)}>See events</button>
                      <span style={{ fontSize: 13, color: C.graphite, alignSelf: 'center' }}>{isOpen ? '▴' : '▾'}</span>
                    </span>
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                      <div style={{ background: C.canvas, borderRadius: 10, padding: '10px 12px' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, fontFamily: MONO, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>What it means</p>
                        <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.55 }}>{info.meaning}</p>
                      </div>
                      <div style={{ background: `${C.orange}0D`, borderRadius: 10, padding: '10px 12px' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, fontFamily: MONO, color: C.orange, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>What to do</p>
                        <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.55 }}>{info.fix}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div style={{ ...cardStyle, padding: 20 }}>
          <SectionTitle>Most suspicious IPs</SectionTitle>
          {!d.topIps.length ? <EmptyState title="No suspicious IPs" /> : d.topIps.map(ip => (
            <div key={ip.ip} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.hair}`, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16 }}>{flag(ip.country)}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <button onClick={() => onEvents({ q: ip.ip })} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: MONO, fontSize: 13.5, fontWeight: 600, color: C.ink, textDecoration: 'underline', textDecorationColor: C.ash }}>{ip.ip}</button>
                <p style={{ fontSize: 12, color: C.graphite, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n(ip.n)} events{ip.high ? `, ${n(ip.high)} high-risk` : ''} · {ip.types.map(t => SECURITY_EVENTS[t as SecurityEventType]?.label ?? t).slice(0, 2).join(', ')}{ip.emails.length ? ` · ${ip.emails.join(', ')}` : ''}
                </p>
              </div>
              {ip.blocked
                ? <button onClick={() => onUnblock(ip.ip)} style={btn(D.goodBg, D.good, D.good)}>Unblock</button>
                : <button onClick={() => onBlock(ip.ip, ip.types.map(t => SECURITY_EVENTS[t as SecurityEventType]?.label ?? t).join(', '))} style={btn(C.dangerBg, C.danger, C.danger)}>Block</button>}
            </div>
          ))}
        </div>
        <div style={{ ...cardStyle, padding: 20 }}>
          <SectionTitle>Where it comes from</SectionTitle>
          {!d.countries.length ? <EmptyState title="No events" /> : d.countries.map(c => {
            const max = d.countries[0].n || 1
            return (
              <div key={c.country} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
                <span style={{ fontSize: 16, width: 22 }}>{flag(c.country)}</span>
                <span style={{ width: 36, fontFamily: MONO, fontSize: 13, color: C.ink }}>{c.country}</span>
                <div style={{ flex: 1, height: 8, background: C.bone, borderRadius: 99 }}><div style={{ width: `${(c.n / max) * 100}%`, height: '100%', background: C.orange, borderRadius: 99 }} /></div>
                <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.graphite, width: 60, textAlign: 'right' }}>{n(c.n)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Live events ──────────────────────────────────────────────────────────────
function EventsTab({ range, tick, filter, setFilter, onBlock }: { range: Range; tick: number; filter: { type: string; severity: string; q: string }; setFilter: (f: { type: string; severity: string; q: string }) => void; onBlock: (ip: string, reason: string) => void }) {
  const [page, setPage] = useState(1)
  const [d, setD] = useState<{ rows: EventRow[]; total: number; pages: number } | null>(null)
  const [q, setQ] = useState(filter.q)
  const url = useMemo(() => `/api/admin/security?view=events&range=${range}&page=${page}&type=${filter.type}&severity=${filter.severity}&q=${encodeURIComponent(filter.q)}`, [range, page, filter])
  useEffect(() => { let alive = true; void api<{ rows: EventRow[]; total: number; pages: number }>(url).then(x => { if (alive && x) setD(x) }); return () => { alive = false } }, [url, tick])
  const GRID = '0.9fr 0.7fr 1.6fr 1.3fr 1.4fr 1.6fr 0.5fr 0.6fr'
  const sel: React.CSSProperties = { border: `1px solid ${C.ash}`, borderRadius: 100, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', background: C.paper, color: C.ink }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filter.type} onChange={e => { setPage(1); setFilter({ ...filter, type: e.target.value }) }} style={sel}>
          <option value="">All event types</option>
          {SECURITY_TYPES.map(t => <option key={t} value={t}>{SECURITY_EVENTS[t].label}</option>)}
        </select>
        <select value={filter.severity} onChange={e => { setPage(1); setFilter({ ...filter, severity: e.target.value }) }} style={sel}>
          <option value="">All severities</option><option value="high">High-risk</option><option value="warn">Warnings</option><option value="info">Info</option>
        </select>
        <form onSubmit={e => { e.preventDefault(); setPage(1); setFilter({ ...filter, q: q.trim() }) }} style={{ display: 'flex', gap: 6 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search email or IP…" style={{ ...sel, minWidth: 220 }} />
          <button type="submit" style={btn(C.ink, '#fff')}>Search</button>
        </form>
        {(filter.type || filter.severity || filter.q) && <button onClick={() => { setQ(''); setPage(1); setFilter({ type: '', severity: '', q: '' }) }} style={{ background: 'none', border: 'none', color: C.orange, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Clear</button>}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.graphite, fontFamily: MONO }}>{d ? `${n(d.total)} event groups` : ''}</span>
      </div>
      <div className="rtable" style={tableCard}>
        <div style={tableHead(GRID)}>{['When', 'Risk', 'Event', 'IP / country', 'Account', 'Details', 'Times', ''].map(h => <span key={h} style={th}>{h}</span>)}</div>
        {!d ? <div className="shimmer" style={{ height: 300, background: '#e8e7e2' }} />
          : !d.rows.length ? <EmptyState title="No events" sub="Nothing matches these filters in this time range." />
          : d.rows.map(r => (
            <div key={r._id} style={tableRow(GRID)}>
              <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.graphite }}>{fmt(r.last)}</span>
              <Pill sev={r.severity} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }} title={SECURITY_EVENTS[r.type]?.meaning}>{SECURITY_EVENTS[r.type]?.label ?? r.type}</span>
              <button onClick={() => { setQ(r.ip); setPage(1); setFilter({ ...filter, q: r.ip }) }} title="Show everything from this IP"
                style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: MONO, fontSize: 12.5, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{flag(r.country)} {r.ip}</button>
              <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.graphite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.email ?? ''}>{r.email ?? '-'}</span>
              <span style={{ fontSize: 12.5, color: C.graphite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={[r.detail, r.path, r.ua].filter(Boolean).join(' · ')}>{[r.detail, r.path].filter(Boolean).join(' · ') || '-'}</span>
              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: r.count > 10 ? C.danger : C.ink }}>{n(r.count)}</span>
              {r.ip !== 'unknown' && r.type !== 'admin_action'
                ? <button onClick={() => onBlock(r.ip, SECURITY_EVENTS[r.type]?.label ?? r.type)} style={{ ...btn(C.dangerBg, C.danger, C.danger), padding: '5px 10px' }}>Block</button>
                : <span />}
            </div>
          ))}
      </div>
      {d && <Pagination page={page} pageCount={d.pages} onChange={setPage} />}
    </div>
  )
}

// ─── IP addresses ─────────────────────────────────────────────────────────────
function IpsTab({ range, tick, onEvents, onBlock, onUnblock }: { range: Range; tick: number; onEvents: (f: { q?: string }) => void; onBlock: (ip: string, reason: string) => void; onUnblock: (ip: string) => void }) {
  const [d, setD] = useState<{ ips: IpRow[]; blocks: BlockRow[] } | null>(null)
  const [manual, setManual] = useState('')
  useEffect(() => { let alive = true; void api<{ ips: IpRow[]; blocks: BlockRow[] }>(`/api/admin/security?view=ips&range=${range}`).then(x => { if (alive && x) setD(x) }); return () => { alive = false } }, [range, tick])
  const GRID = '1.3fr 0.9fr 1.8fr 1.6fr 0.6fr 0.9fr 0.8fr'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...cardStyle, padding: 18, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Block an IP manually</span>
        <input value={manual} onChange={e => setManual(e.target.value)} placeholder="e.g. 77.239.124.77" style={{ border: `1px solid ${C.ash}`, borderRadius: 100, padding: '8px 14px', fontSize: 13.5, fontFamily: MONO, minWidth: 220, background: C.canvas, color: C.ink }} />
        <button onClick={() => manual.trim() && onBlock(manual.trim(), 'Blocked manually')} style={btn(C.danger, '#fff')}>Block…</button>
        <span style={{ fontSize: 12, color: C.graphite }}>Blocks the whole site (pages and API) for that address.</span>
      </div>

      <div className="rtable" style={tableCard}>
        <div style={tableHead(GRID)}>{['IP', 'Events', 'What it did', 'Accounts seen', 'Signups', 'Last seen', ''].map(h => <span key={h} style={th}>{h}</span>)}</div>
        {!d ? <div className="shimmer" style={{ height: 300, background: '#e8e7e2' }} />
          : !d.ips.length ? <EmptyState title="No suspicious IPs" sub="Nothing recorded in this time range." />
          : d.ips.map(r => (
            <div key={r.ip} style={{ ...tableRow(GRID), background: r.blocked ? 'rgba(207,70,58,0.05)' : undefined }}>
              <button onClick={() => onEvents({ q: r.ip })} title="Show this IP's events" style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: MONO, fontSize: 13, fontWeight: 600, color: C.ink }}>
                {flag(r.country)} {r.ip}{r.blocked && <span style={{ marginLeft: 6, fontSize: 10, color: C.danger, fontWeight: 700 }}>BLOCKED</span>}
              </button>
              <span style={{ fontFamily: MONO, fontSize: 12.5 }}>
                <b style={{ color: r.high ? '#B42318' : C.ink }}>{n(r.n)}</b>{r.high ? <span style={{ color: '#B42318' }}> · {n(r.high)} high</span> : null}{r.warn ? <span style={{ color: '#9A5B00' }}> · {n(r.warn)} warn</span> : null}
              </span>
              <span style={{ fontSize: 12.5, color: C.graphite }}>{r.types.map(t => SECURITY_EVENTS[t as SecurityEventType]?.label ?? t).join(', ')}</span>
              <span style={{ fontSize: 12, color: C.graphite, fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.emails.join('\n')}>{r.emails.length ? r.emails.slice(0, 3).join(', ') + (r.emails.length > 3 ? ` +${r.emails.length - 3}` : '') : '-'}</span>
              <span style={{ fontFamily: MONO, fontSize: 13, color: r.accounts >= 3 ? '#9A3412' : C.ink, fontWeight: r.accounts >= 3 ? 700 : 500 }}>{r.accounts || '-'}</span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: C.graphite }}>{fmt(r.last)}</span>
              {r.blocked ? <button onClick={() => onUnblock(r.ip)} style={btn(D.goodBg, D.good, D.good)}>Unblock</button>
                : <button onClick={() => onBlock(r.ip, r.types.map(t => SECURITY_EVENTS[t as SecurityEventType]?.label ?? t).join(', '))} style={btn(C.dangerBg, C.danger, C.danger)}>Block</button>}
            </div>
          ))}
      </div>

      <div style={{ ...cardStyle, padding: 20 }}>
        <SectionTitle right={<span style={{ fontSize: 12, color: C.graphite, fontFamily: MONO }}>{d ? `${d.blocks.length} total` : ''}</span>}>Blocked IPs</SectionTitle>
        {!d?.blocks.length ? <EmptyState title="No blocked IPs" /> : d.blocks.map(b => {
          const expired = !!b.until && new Date(b.until) < new Date()
          return (
            <div key={b._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.hair}`, flexWrap: 'wrap', opacity: expired ? 0.5 : 1 }}>
              <span style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 600, color: C.ink, minWidth: 150 }}>{b._id}</span>
              <span style={{ fontSize: 12.5, color: C.graphite, flex: 1, minWidth: 200 }}>{b.reason}</span>
              <span style={{ fontSize: 12, color: C.graphite, fontFamily: MONO }}>{expired ? 'expired' : b.until ? `until ${fmt(b.until)}` : 'forever'} · by {b.by}</span>
              <button onClick={() => onUnblock(b._id)} style={btn(D.goodBg, D.good, D.good)}>Unblock</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Risky accounts ───────────────────────────────────────────────────────────
function AccountsTab({ tick, reload, onBlock, onEvents }: { tick: number; reload: () => void; onBlock: (ip: string, reason: string) => void; onEvents: (f: { q?: string }) => void }) {
  const [d, setD] = useState<Accounts | null>(null)
  useEffect(() => { let alive = true; void api<Accounts>('/api/admin/security?view=accounts').then(x => { if (alive && x) setD(x) }); return () => { alive = false } }, [tick])
  const setRestricted = async (userId: string, restricted: boolean, email: string) => {
    if (!confirm(`${restricted ? 'Restrict' : 'Unrestrict'} ${email}?`)) return
    const ok = await api(`/api/admin/users/${userId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restricted }) })
    if (ok) { toast.success(restricted ? 'Account restricted' : 'Restriction lifted', email); reload() }
    else toast.error('Could not update', email)
  }
  if (!d) return <div className="shimmer" style={{ height: 420, borderRadius: 16, background: '#e8e7e2' }} />
  const card = (title: string, sub: string, children: React.ReactNode) => (
    <div style={{ ...cardStyle, padding: 20 }}>
      <SectionTitle>{title}</SectionTitle>
      <p style={{ fontSize: 12.5, color: C.graphite, marginTop: -8, marginBottom: 10 }}>{sub}</p>
      {children}
    </div>
  )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
      {card('Signup farms', 'One connection that created several accounts (usually to farm free credits). Recorded for signups from now on.',
        !d.farms.length ? <EmptyState title="None found" /> : d.farms.map(f => (
          <div key={f.ip} style={{ padding: '10px 0', borderBottom: `1px solid ${C.hair}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 600, color: C.ink }}>{f.ip}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: f.n >= 3 ? '#9A3412' : C.ink }}>{f.n} accounts</span>
              <button onClick={() => onBlock(f.ip, `Signup farm: ${f.n} accounts`)} style={{ ...btn(C.dangerBg, C.danger, C.danger), marginLeft: 'auto' }}>Block IP</button>
            </div>
            <p style={{ fontSize: 12, color: C.graphite, fontFamily: MONO, marginTop: 4, wordBreak: 'break-all' }}>{f.emails.join(', ')}</p>
          </div>
        )))}
      {card('Heaviest Etsy data users today', 'Over ~5,000 Etsy calls in a day is not normal use. Over 15,000 is blocked automatically (scraping).',
        !d.heavy.length ? <EmptyState title="No usage yet today" /> : d.heavy.map(h => (
          <div key={h.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${C.hair}` }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontFamily: MONO, fontSize: 13, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.userEmail ?? h.userId}</p>
              <p style={{ fontSize: 12, color: C.graphite }}>{n(h.searches)} searches · {n(h.googleCalls)} Google calls</p>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: h.etsyCalls >= 5000 ? '#B42318' : C.ink }}>{n(h.etsyCalls)}</span>
            {h.etsyCalls >= 5000 && h.userId && !h.userId.startsWith('system') && h.userId !== 'anonymous' &&
              <button onClick={() => setRestricted(h.userId, true, h.userEmail ?? h.userId)} style={btn('rgba(194,129,17,0.12)', '#C28111', '#C28111')}>Restrict</button>}
          </div>
        )))}
      {card('Emails under password attack', 'Accounts with many wrong-password attempts in the last 7 days.',
        !d.targeted.length ? <EmptyState title="None" /> : d.targeted.map(t => (
          <div key={t.email} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${C.hair}` }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontFamily: MONO, fontSize: 13, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.email}</p>
              <p style={{ fontSize: 12, color: C.graphite, fontFamily: MONO }}>from {t.ips.join(', ')}</p>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: t.n >= 10 ? '#B42318' : C.ink }}>{n(t.n)}</span>
            <button onClick={() => onEvents({ q: t.email })} style={btn(C.paper, C.ink, C.ash)}>Events</button>
          </div>
        )))}
      {card('Restricted accounts', `Refused on every tool request (checked on the server). Temp-mail accounts still active: ${n(d.tempMail)}.`,
        !d.restricted.length ? <EmptyState title="No restricted accounts" /> : d.restricted.map(u => (
          <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${C.hair}` }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 13.5, color: C.ink, fontWeight: 600 }}>{u.name}</p>
              <p style={{ fontFamily: MONO, fontSize: 12, color: C.graphite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email} · {u.plan}</p>
            </div>
            <button onClick={() => setRestricted(u._id, false, u.email)} style={btn(D.goodBg, D.good, D.good)}>Unrestrict</button>
          </div>
        )))}
    </div>
  )
}

// ─── Health & fixes ───────────────────────────────────────────────────────────
function HealthTab({ tick }: { tick: number }) {
  const [checks, setChecks] = useState<Check[] | null>(null)
  useEffect(() => { let alive = true; void api<{ checks: Check[] }>('/api/admin/security?view=health').then(x => { if (alive && x) setChecks(x.checks) }); return () => { alive = false } }, [tick])
  if (!checks) return <div className="shimmer" style={{ height: 420, borderRadius: 16, background: '#e8e7e2' }} />
  const ST = {
    ok: { icon: '✓', fg: D.good, bg: D.goodBg, label: 'Good' },
    warn: { icon: '!', fg: '#9A5B00', bg: 'rgba(232,160,40,0.18)', label: 'Needs attention' },
    bad: { icon: '✕', fg: '#B42318', bg: 'rgba(207,70,58,0.13)', label: 'Fix this' },
    manual: { icon: '?', fg: '#475467', bg: 'rgba(71,84,103,0.10)', label: 'Check yourself' },
  } as const
  const order = { bad: 0, warn: 1, manual: 2, ok: 3 } as const
  const sorted = [...checks].sort((a, b) => order[a.status] - order[b.status])
  const counts = checks.reduce((m, c) => ({ ...m, [c.status]: (m[c.status] ?? 0) + 1 }), {} as Record<string, number>)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(['bad', 'warn', 'manual', 'ok'] as const).map(s => (
          <span key={s} style={{ ...cardStyle, padding: '10px 14px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', background: ST[s].bg, color: ST[s].fg, fontWeight: 800, fontSize: 12 }}>{ST[s].icon}</span>
            <span style={{ fontSize: 13, color: C.ink }}>{ST[s].label}: <b>{counts[s] ?? 0}</b></span>
          </span>
        ))}
      </div>
      {sorted.map(c => (
        <div key={c.id} style={{ ...cardStyle, padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', background: ST[c.status].bg, color: ST[c.status].fg, fontWeight: 800 }}>{ST[c.status].icon}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{c.label}</p>
              <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.05em', color: ST[c.status].fg }}>{ST[c.status].label}</span>
            </div>
            <p style={{ fontSize: 13.5, color: C.graphite, marginTop: 4, lineHeight: 1.55, wordBreak: 'break-word' }}>{c.detail}</p>
            {c.fix && c.status !== 'ok' && <p style={{ fontSize: 13.5, color: C.ink, marginTop: 8, lineHeight: 1.55, background: `${C.orange}0D`, borderRadius: 8, padding: '8px 10px' }}><b style={{ color: C.orange }}>How to fix: </b>{c.fix}</p>}
          </div>
        </div>
      ))}
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
  const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.ash}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', background: C.canvas, color: C.ink, marginBottom: 14 }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,14,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 20 }} onClick={() => !busy && onClose()}>
      <div style={{ background: C.paper, borderRadius: 16, padding: '24px 26px', maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: C.ink, marginBottom: 6 }}>Block {ip}?</h3>
        <p style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.55, marginBottom: 16 }}>This address will get an &quot;Access blocked&quot; page for the whole site, including the API. Everyone sharing that connection is affected.</p>
        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: C.ink, marginBottom: 6 }}>Reason (for your records)</label>
        <input value={reason} onChange={e => setReason(e.target.value)} style={field} maxLength={300} />
        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: C.ink, marginBottom: 6 }}>For how long</label>
        <select value={hours} onChange={e => setHours(Number(e.target.value))} style={field}>
          <option value={1}>1 hour</option><option value={24}>24 hours</option><option value={24 * 7}>7 days</option><option value={24 * 30}>30 days</option><option value={0}>Forever</option>
        </select>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} disabled={busy} style={btn(C.paper, C.ink, C.hairInk)}>Cancel</button>
          <button onClick={submit} disabled={busy} style={btn(C.danger, '#fff')}>{busy ? 'Blocking…' : 'Block IP'}</button>
        </div>
      </div>
    </div>
  )
}
