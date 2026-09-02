'use client'
import { Icon } from '@/components/ui/Icon'
import { NavButton } from '@/components/ui/NavButton'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { C } from '@/utils'
import { SectionTitle, Pagination, tableCard, tableHead, th, tableRow, tdMono, EmptyState, MONO, cardStyle } from '@/components/dashboard/kit'
import { AnimIcon, ICON } from '@/components/ui/AnimIcon'
import { Kpi, Bars, Donut } from './AdminCharts'
import { UserDetailPanel } from './UserDetailPanel'
import { AdminMessages } from './AdminMessages'
import { AdminAffiliates } from './AdminAffiliates'
import { RealtimeProvider, NotificationBell } from '@/components/dashboard/Realtime'

interface AUser {
  id: string; name: string; email: string; role: 'user' | 'admin'; plan: string
  isVerified: boolean; createdAt: string | null; searches: number; lastActive: string | null; connectedShops: number
  subscriptionStatus: string | null; imagesThisMonth: number; restricted: boolean; paidViaLemonSqueezy: boolean
  compExpiresAt: string | null
  creditsUsedToday: number; creditsLimit: number; creditsRemaining: number; creditsUsedTotal: number
}
type ConfirmAction = { user: AUser; kind: 'delete' | 'restrict' | 'unrestrict' }
const isRealPaid = (u: AUser) => u.paidViaLemonSqueezy && u.plan !== 'free'
interface Stats { total: number; admins: number; verified: number; searches: number }

interface TrackStats {
  trackedListings: number
  listingSnapshots: number
  snapshotsToday: number
  shopSnapshots: number
  measuredListings: number
  recent: { listingId: number; title: string; observeCount: number; lastSeenAt: string }[]
}
interface UsageUser { userId: string; userEmail: string | null; etsyCalls: number; googleCalls: number; searches: number; cacheHits: number; apiHits: number; imageCalls: number; imageTokens: number; imageCostUsd: number; creditsSpent: number }
interface UsageData {
  today: { day: string; totals: { etsyCalls: number; googleCalls: number; searches: number; cacheHits: number; apiHits: number; imageCalls: number; imageTokens: number; imageCostUsd: number; creditsSpent: number }; perUser: UsageUser[] }
  last7Days: { day: string; etsyCalls: number; googleCalls: number; searches: number; imageCalls: number; imageCostUsd: number; creditsSpent: number }[]
}

const GRID = '0.4fr 1.5fr 0.6fr 0.8fr 0.6fr 0.55fr 0.75fr 0.8fr 1.2fr'
const PAID_GOLD = '#B7791F'
const UGRID = '1.7fr 0.7fr 0.7fr 0.8fr 0.9fr 0.85fr 0.9fr'
const D7GRID = '1.4fr 0.8fr 0.8fr 1fr 0.8fr 0.8fr 0.9fr'
const USERS_PAGE_SIZE = 20
const USAGE_PAGE_SIZE = 15
const EXT_PAGE_SIZE = 15

const PLAN_HUE: Record<string, string> = {
  free: '#6E6E64', starter: '#2563EB', basic: '#0EA5E9', pro: '#FB5E09', 'pro-1yr': '#B7791F',
  business: '#0D9488', agency: '#7C3AED', enterprise: '#4F46E5', custom: '#5B6472',
}
const PLAN_RANK: Record<string, number> = {
  custom: 9, enterprise: 8, agency: 7, business: 6, 'pro-1yr': 5, pro: 4, basic: 3, starter: 2, free: 0,
}
const PLAN_LABEL: Record<string, string> = {
  free: 'Free', starter: 'Starter', basic: 'Basic', pro: 'Pro', 'pro-1yr': 'Pro · 1yr',
  business: 'Business', agency: 'Agency', enterprise: 'Enterprise', custom: 'Custom',
}
const PLAN_ORDER = ['custom', 'enterprise', 'agency', 'business', 'pro-1yr', 'pro', 'basic', 'starter', 'free']

function statusPill(s: string | null): { label: string; fg: string; bg: string } | null {
  if (!s) return null
  const map: Record<string, { fg: string; bg: string }> = {
    active:   { fg: '#1F7A42', bg: 'rgba(31,138,76,0.12)' },
    on_trial: { fg: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
    cancelled:{ fg: '#C2510B', bg: 'rgba(194,81,11,0.12)' },
    paused:   { fg: '#6E6E64', bg: 'rgba(110,110,100,0.14)' },
    past_due: { fg: '#CF463A', bg: 'rgba(207,70,58,0.12)' },
    expired:  { fg: '#CF463A', bg: 'rgba(207,70,58,0.12)' },
  }
  return { label: s.replace(/_/g, ' '), ...(map[s] ?? { fg: '#6E6E64', bg: 'rgba(110,110,100,0.10)' }) }
}
// Admin wants EXACT figures (1,300 - not "1.3k").
const exact = (n: number) => (n ?? 0).toLocaleString('en-US')
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : '-'
const fmtDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const numCell: React.CSSProperties = { ...tdMono, textAlign: 'right' }
const numTh: React.CSSProperties = { ...th, textAlign: 'right' }
const usd = (n: number) => `$${(n || 0).toFixed(n < 1 ? 4 : 2)}`
const timeAgo = (d: string | null) => {
  if (!d) return 'never'
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  return days <= 0 ? 'today' : days === 1 ? '1d ago' : days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`
}
const dayKeyLocal = (d: Date) => d.toISOString().slice(0, 10)

// Time-reading kept in plain module functions (not the component render body) so
// the render-purity lint stays happy - same pattern as timeAgo/fmtDate above.
function countNewThisWeek(users: { createdAt: string | null }[]): number {
  const cutoff = Date.now() - 7 * 86400000
  return users.filter(u => u.createdAt && new Date(u.createdAt).getTime() >= cutoff).length
}
function buildSignups(users: { createdAt: string | null }[]): { label: string; value: number }[] {
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return d })
  const counts = new Map(days.map(d => [dayKeyLocal(d), 0]))
  users.forEach(u => { if (u.createdAt) { const k = dayKeyLocal(new Date(u.createdAt)); if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1) } })
  return days.map(d => ({ label: d.toLocaleDateString('en-US', { day: 'numeric' }), value: counts.get(dayKeyLocal(d)) ?? 0 }))
}

const selectStyle: React.CSSProperties = {
  background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 100, padding: '6px 10px',
  fontSize: 12.5, fontFamily: MONO, color: C.ink, outline: 'none', cursor: 'pointer', width: '100%', minWidth: 0,
}

type Section = 'overview' | 'users' | 'analytics' | 'extension' | 'affiliates' | 'messages' | 'content' | 'settings'
const NAV: { id: Section; label: string; icon: string }[] = [
  { id: 'overview',  label: 'Overview',  icon: ICON.home },
  { id: 'users',     label: 'Users',     icon: ICON.account },
  { id: 'analytics', label: 'Analytics', icon: ICON.coins },
  { id: 'extension', label: 'Extension', icon: ICON.display },
  { id: 'affiliates',label: 'Affiliates',icon: ICON.gift },
  { id: 'messages',  label: 'Messages',  icon: ICON.chat },
  { id: 'content',   label: 'Content',   icon: ICON.book },
  { id: 'settings',  label: 'Settings',  icon: ICON.settings },
]

interface ExtRow { userId: string; name: string; email: string; plan: string; version: string | null; hits: number; firstSeenAt: string | null; lastSeenAt: string | null; lastEndpoint: string | null }
interface ExtData { total: number; active7d: number; rows: ExtRow[] }
const EXTGRID = '1.7fr 0.7fr 0.7fr 0.7fr 0.9fr 1fr'

export function AdminDashboard() {
  const [users, setUsers] = useState<AUser[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [track, setTrack] = useState<TrackStats | null>(null)
  const [ext, setExt] = useState<ExtData | null>(null)
  const [msgUnread, setMsgUnread] = useState(0)
  const [state, setState] = useState<'loading' | 'ok' | 'forbidden' | 'error'>('loading')
  const [section, setSection] = useState<Section>('overview')
  const [detailUserId, setDetailUserId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [usersPage, setUsersPage] = useState(1)
  const [usagePage, setUsagePage] = useState(1)
  const [extPage, setExtPage] = useState(1)
  const [userQuery, setUserQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [promoOn, setPromoOn] = useState(false)
  const [promoBusy, setPromoBusy] = useState(false)
  const [promoMsg, setPromoMsg] = useState('')

  const load = useCallback(() => {
    fetch('/api/admin/users').then(async r => {
      if (r.status === 401) { window.location.href = '/login?redirect=/admin'; return }
      if (r.status === 403) { setState('forbidden'); return }
      const d = await r.json().catch(() => null)
      if (r.ok && d?.success) { setUsers(d.data.users); setStats(d.data.stats); setPromoOn(!!d.data.freeToProPromo); setState('ok') }
      else setState('error')
    }).catch(() => setState('error'))
    fetch('/api/admin/usage').then(async r => {
      const d = await r.json().catch(() => null)
      if (r.ok && d?.success) setUsage(d.data)
    }).catch(() => {})
    fetch('/api/admin/snapshots-stats').then(async r => {
      const d = await r.json().catch(() => null)
      if (r.ok && d?.success) setTrack(d.data)
    }).catch(() => {})
    fetch('/api/admin/extension').then(async r => {
      const d = await r.json().catch(() => null)
      if (r.ok && d?.success) setExt(d.data)
    }).catch(() => {})
  }, [])
  useEffect(load, [load])

  // Keep the Messages nav badge current: poll the unread support-message count.
  useEffect(() => {
    let alive = true
    const poll = () => fetch('/api/admin/chat').then(r => r.json()).then(d => { if (alive && d?.success) setMsgUnread(d.data.totalUnread) }).catch(() => {})
    // eslint-disable-next-line react-hooks/set-state-in-effect
    poll()
    const t = setInterval(poll, 15000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  const patchUser = useCallback(async (id: string, patch: Partial<AUser>) => {
    setBusy(id)
    const r = await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    const d = await r.json().catch(() => null)
    if (r.ok && d?.success) {
      setUsers(us => us.map(u => u.id === id ? { ...u, ...patch } : u))
      if ('plan' in patch) load()
    }
    setBusy(null)
  }, [load])

  const callPromo = useCallback(async (body: { enabled?: boolean; refresh?: boolean }) => {
    setPromoBusy(true); setPromoMsg('')
    try {
      const r = await fetch('/api/admin/free-to-pro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => null)
      if (r.ok && d?.success) {
        setPromoOn(d.data.enabled)
        if (body.enabled === false) setPromoMsg('Promo turned off.')
        else setPromoMsg(`${d.data.affected} free user${d.data.affected === 1 ? '' : 's'} converted to Pro.`)
        load()
      } else setPromoMsg(d?.error || 'Failed.')
    } catch { setPromoMsg('Failed.') }
    setPromoBusy(false)
    setTimeout(() => setPromoMsg(''), 6000)
  }, [load])

  const deleteUser = useCallback(async (u: AUser) => {
    setBusy(u.id); setErr('')
    const r = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' })
    const d = await r.json().catch(() => null)
    if (r.ok && d?.success) {
      setUsers(us => us.filter(x => x.id !== u.id))
      setStats(s => s ? { ...s, total: s.total - 1, admins: s.admins - (u.role === 'admin' ? 1 : 0), verified: s.verified - (u.isVerified ? 1 : 0) } : s)
    } else setErr(d?.error || 'Delete failed')
    setBusy(null)
  }, [])

  const runConfirmed = useCallback(async () => {
    if (!confirmAction) return
    const { user: u, kind } = confirmAction
    setConfirmAction(null)
    if (kind === 'delete') await deleteUser(u)
    else await patchUser(u.id, { restricted: kind === 'restrict' })
  }, [confirmAction, deleteUser, patchUser])

  const sortedUsers = useMemo(() => {
    const t = (d: string | null) => (d ? new Date(d).getTime() : 0)
    return [...users].sort((a, b) => {
      const pa = isRealPaid(a) ? 1 : 0, pb = isRealPaid(b) ? 1 : 0
      if (pa !== pb) return pb - pa
      const ra = PLAN_RANK[a.plan] ?? 0, rb = PLAN_RANK[b.plan] ?? 0
      if (ra !== rb) return rb - ra
      return t(b.createdAt) - t(a.createdAt)
    })
  }, [users])
  const paidCount = useMemo(() => users.filter(isRealPaid).length, [users])
  const newThisWeek = useMemo(() => countNewThisWeek(users), [users])
  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase()
    if (!q) return sortedUsers
    return sortedUsers.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q))
  }, [sortedUsers, userQuery])
  const usersPageCount = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE))
  const usersPageRows = useMemo(
    () => filteredUsers.slice((usersPage - 1) * USERS_PAGE_SIZE, usersPage * USERS_PAGE_SIZE),
    [filteredUsers, usersPage],
  )
  const copyId = useCallback((id: string) => {
    navigator.clipboard?.writeText(id).then(() => {
      setCopiedId(id); setTimeout(() => setCopiedId(c => (c === id ? null : c)), 1400)
    }).catch(() => {})
  }, [])
  const usagePerUser = useMemo(() => usage?.today.perUser ?? [], [usage])
  const usagePageCount = Math.max(1, Math.ceil(usagePerUser.length / USAGE_PAGE_SIZE))
  const usagePageRows = useMemo(
    () => usagePerUser.slice((usagePage - 1) * USAGE_PAGE_SIZE, usagePage * USAGE_PAGE_SIZE),
    [usagePerUser, usagePage],
  )
  const extRows = useMemo(() => ext?.rows ?? [], [ext])
  const extPageCount = Math.max(1, Math.ceil(extRows.length / EXT_PAGE_SIZE))
  const extPageRows = useMemo(
    () => extRows.slice((extPage - 1) * EXT_PAGE_SIZE, extPage * EXT_PAGE_SIZE),
    [extRows, extPage],
  )

  // ─── Overview derived series ────────────────────────────────────────────────
  const signups = useMemo(() => buildSignups(users), [users])
  const planDist = useMemo(() => {
    const counts: Record<string, number> = {}
    users.forEach(u => { counts[u.plan] = (counts[u.plan] ?? 0) + 1 })
    return PLAN_ORDER.filter(p => counts[p]).map(p => ({ label: PLAN_LABEL[p] ?? p, value: counts[p], color: PLAN_HUE[p] ?? C.stone }))
  }, [users])

  // ─── Loading / gate states ──────────────────────────────────────────────────
  const gate = (children: React.ReactNode) => (
    <main className="rpage" style={{ background: C.canvas, minHeight: '100vh', padding: '150px 40px 96px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>{children}</div>
    </main>
  )
  if (state === 'loading') return gate(<div className="shimmer" style={{ height: 420, borderRadius: 12, background: '#e8e7e2' }} />)
  if (state === 'forbidden') return gate(<EmptyState icon="🔒" title="Admins only" sub="You don't have access to this page." />)
  if (state === 'error') return gate(<EmptyState icon="⚠️" title="Couldn't load the admin data" sub="Please try again." />)

  const navBtn = (item: typeof NAV[number]) => {
    const on = section === item.id
    return (
      <button key={item.id} onClick={() => setSection(item.id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
          padding: '11px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: on ? C.orangeFaint : 'transparent', color: on ? C.orange : C.graphite,
          fontSize: 14.5, fontWeight: on ? 600 : 500, fontFamily: 'inherit', transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { if (!on) e.currentTarget.style.background = C.bone }}
        onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}>
        <AnimIcon src={item.icon} size={22} color={on ? C.orange : '#6E6E64'} active={on} />
        {item.label}
        {item.id === 'messages' && msgUnread > 0 && (
          <span style={{ marginLeft: 'auto', background: C.orange, color: '#fff', fontSize: 10.5, fontWeight: 700, fontFamily: MONO, borderRadius: 100, padding: '1px 7px', minWidth: 18, textAlign: 'center' }}>{msgUnread}</span>
        )}
      </button>
    )
  }

  return (
    <RealtimeProvider isAdmin>
    <main className="rpage" style={{ background: C.canvas, minHeight: '100vh', paddingTop: 92 }}>
      <div className="admin-shell" style={{ display: 'flex', maxWidth: 1440, margin: '0 auto', alignItems: 'flex-start' }}>
        {/* ─── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className="admin-sidebar" style={{ width: 236, flexShrink: 0, position: 'sticky', top: 92, alignSelf: 'flex-start', padding: '28px 16px', height: 'calc(100vh - 92px)', borderRight: `1px solid ${C.ash}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px 18px', fontSize: 11.5, fontFamily: MONO, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6E6E64' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.orange }} /> Admin
          </div>
          {NAV.map(navBtn)}
          <div style={{ marginTop: 'auto', paddingTop: 16 }}>
            <NavButton href="/dashboard" spinnerColor={C.ink} spinnerSize={15} style={{ display: 'block', width: '100%', padding: '10px 14px', fontSize: 13, color: C.ink, background: 'transparent', borderRadius: 12, border: `1px solid ${C.ash}`, textAlign: 'center', fontFamily: 'inherit' }}>← Dashboard</NavButton>
          </div>
        </aside>

        {/* ─── Content ─────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, padding: '30px 34px 90px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
            <h1 style={{ fontSize: 'clamp(26px,3vw,38px)', fontWeight: 600, color: C.ink, letterSpacing: '-0.03em', textTransform: 'capitalize', margin: 0 }}>{section}</h1>
            <NotificationBell />
          </div>

          {section === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                <Kpi label="Total users" value={stats?.total ?? 0} accent={C.ink} delay={0} />
                <Kpi label="Paying customers" value={paidCount} accent={C.orange} delay={60} sub={`${stats?.total ? Math.round((paidCount / stats.total) * 100) : 0}% of total`} />
                <Kpi label="New this week" value={newThisWeek} accent="#0D9488" delay={120} />
                <Kpi label="Verified" value={stats?.verified ?? 0} accent="#2563EB" delay={180} />
              </div>
              <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                <Kpi label="Searches (all time)" value={stats?.searches ?? 0} accent={C.ink} delay={0} />
                <Kpi label="API calls today" value={(usage?.today.totals.etsyCalls ?? 0) + (usage?.today.totals.googleCalls ?? 0)} accent={C.orange} delay={60} />
                <Kpi label="AI images today" value={usage?.today.totals.imageCalls ?? 0} accent="#7C3AED" delay={120} />
                <Kpi label="Image cost today" value={usage?.today.totals.imageCostUsd ?? 0} accent="#B7791F" delay={180} format={usd} />
              </div>

              <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, alignItems: 'start' }}>
                <div style={{ ...cardStyle, padding: '20px 22px' }}>
                  <SectionTitle>New signups · last 14 days</SectionTitle>
                  <Bars data={signups} height={170} accent={C.orange} />
                </div>
                <div style={{ ...cardStyle, padding: '20px 22px' }}>
                  <SectionTitle>Plan distribution</SectionTitle>
                  {planDist.length ? <Donut segments={planDist} /> : <p style={{ fontSize: 13, color: C.graphite }}>No users yet.</p>}
                </div>
              </div>

              {usage && (
                <div style={{ ...cardStyle, padding: '20px 22px' }}>
                  <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080' }}>searches / day</span>}>API usage · last 7 days</SectionTitle>
                  <Bars data={[...usage.last7Days].reverse().map(d => ({ label: fmtDay(d.day).split(',')[0], value: d.searches }))} height={150} accent="#2563EB" />
                </div>
              )}

              {/* ─── Snapshot tracking (crowd-sourced listing history) ─────────── */}
              <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                <Kpi label="Listings tracked" value={track?.trackedListings ?? 0} accent={C.orange} delay={0} sub="on the watchlist" />
                <Kpi label="Measured listings" value={track?.measuredListings ?? 0} accent="#0D9488" delay={60} sub="real sales velocity" />
                <Kpi label="Listing snapshots" value={track?.listingSnapshots ?? 0} accent={C.ink} delay={120} />
                <Kpi label="Snapshots today" value={track?.snapshotsToday ?? 0} accent="#2563EB" delay={180} />
              </div>

              {track && track.recent.length > 0 && (
                <div style={{ ...cardStyle, padding: '20px 22px' }}>
                  <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080' }}>most recently observed</span>}>Tracking activity</SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {track.recent.map((r, i) => (
                      <div key={r.listingId} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: '9px 0', borderTop: i ? `1px solid ${C.ash}` : 'none', fontSize: 13 }}>
                        <a href={`https://www.etsy.com/listing/${r.listingId}`} target="_blank" rel="noreferrer" style={{ color: C.ink, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.title || `Listing ${r.listingId}`}
                        </a>
                        <span style={{ fontFamily: MONO, fontSize: 11.5, color: '#808080' }}>{r.observeCount}× seen</span>
                        <span style={{ fontFamily: MONO, fontSize: 11.5, color: '#808080', minWidth: 84, textAlign: 'right' }}>{timeAgo(typeof r.lastSeenAt === 'string' ? r.lastSeenAt : new Date(r.lastSeenAt).toISOString())}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {section === 'users' && (
            <div>
              <SectionTitle right={err ? <span style={{ fontSize: 12, color: C.danger }}>{err}</span> : <span style={{ fontSize: 11, fontFamily: MONO, color: '#808080' }}>{userQuery.trim() ? `${exact(filteredUsers.length)} match${filteredUsers.length === 1 ? '' : 'es'}` : `${exact(paidCount)} paying · ${exact(users.length)} total`} · page {usersPage}/{usersPageCount}</span>}>All users</SectionTitle>

              <div style={{ position: 'relative', marginBottom: 12, maxWidth: 420 }}>
                <span aria-hidden style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#8a8a82', pointerEvents: 'none', display: 'flex' }}><Icon name="search" size={13} color="#8a8a82" /></span>
                <input value={userQuery} onChange={e => { setUserQuery(e.target.value); setUsersPage(1) }}
                  placeholder="Search users by name, email or ID…" aria-label="Search users by name, email or ID"
                  style={{ width: '100%', background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 100, padding: '10px 38px', fontSize: 13.5, fontFamily: MONO, color: C.ink, outline: 'none' }} />
                {userQuery && <button onClick={() => { setUserQuery(''); setUsersPage(1) }} aria-label="Clear search" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#8a8a82', lineHeight: 1 }}>×</button>}
              </div>

              <div className="rtable" style={{ ...tableCard, overflow: 'hidden' }}>
                <div style={{ ...tableHead(GRID), padding: '15px 22px' }}>
                  {['#', 'User', 'Role', 'Plan', 'Status', 'Joined', 'Activity', 'Credits', ''].map((h, i) => <span key={i} style={{ ...th, fontSize: 12 }}>{h}</span>)}
                </div>
                {usersPageRows.map((u, i) => {
                  const sp = statusPill(u.subscriptionStatus)
                  const paid = isRealPaid(u)
                  const hue = PLAN_HUE[u.plan] ?? C.stone
                  const rowBg = u.restricted ? 'rgba(207,70,58,0.06)' : paid ? 'rgba(183,121,31,0.07)' : (i % 2 ? C.canvas : 'transparent')
                  const rowBgHover = u.restricted ? 'rgba(207,70,58,0.11)' : paid ? 'rgba(183,121,31,0.12)' : C.headerBg
                  const barColor = u.restricted ? C.danger : paid ? PAID_GOLD : 'transparent'
                  return (
                    <div key={u.id} className="admin-user-row"
                      style={{ ...tableRow(GRID), padding: '18px 22px', opacity: busy === u.id ? 0.5 : 1, transition: 'background 0.12s', background: rowBg, borderLeft: `4px solid ${barColor}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = rowBgHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
                      <span style={{ ...tdMono, fontSize: 13, color: '#8a8a82' }}>{(usersPage - 1) * USERS_PAGE_SIZE + i + 1}</span>
                      <div style={{ minWidth: 0 }}>
                        <button onClick={() => setDetailUserId(u.id)} title="View full detail"
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', display: 'flex', alignItems: 'center', gap: 7, maxWidth: '100%' }}>
                          <span style={{ fontSize: 15, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: C.ash }}>{u.name}</span>
                          {u.isVerified && <span title="Verified" style={{ display: 'inline-grid', placeItems: 'center', width: 16, height: 16, borderRadius: '50%', background: 'rgba(31,138,76,0.14)', color: '#1F7A42', fontSize: 10.5, flexShrink: 0 }}>✓</span>}
                          {u.role === 'admin' && <span style={{ fontSize: 10, fontWeight: 700, fontFamily: MONO, color: C.orange, background: C.orangeFaint, padding: '2.5px 8px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Admin</span>}
                        </button>
                        <p style={{ fontSize: 13, color: '#6E6E64', fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3 }}>{u.email}</p>
                        <button onClick={() => copyId(u.id)} title="Click to copy user ID"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '100%', marginTop: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: MONO, fontSize: 11, color: copiedId === u.id ? '#1F8A4C' : '#a2a29a', overflow: 'hidden' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>ID {u.id}</span>
                          <span style={{ flexShrink: 0 }}>{copiedId === u.id ? '✓ copied' : '⧉'}</span>
                        </button>
                        {u.restricted && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, fontFamily: MONO, color: C.danger, background: C.dangerBg, padding: '3px 9px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 6 }}><Icon name="lock" size={11} color={C.danger} />Restricted</span>}
                      </div>
                      <select value={u.role} onChange={e => patchUser(u.id, { role: e.target.value as AUser['role'] })} style={selectStyle}>
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                      <div style={{ position: 'relative', minWidth: 0 }}>
                        <select value={u.plan} onChange={e => patchUser(u.id, { plan: e.target.value })}
                          style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', outline: 'none', fontSize: 11.5, fontWeight: 700, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.04em', color: paid ? '#fff' : hue, background: paid ? hue : 'transparent', border: paid ? 'none' : `1px solid ${hue}`, borderRadius: 100, padding: '6px 22px 6px 12px' }}>
                          {['free', 'starter', 'basic', 'pro', 'pro-1yr', 'business', 'agency', 'enterprise', 'custom'].map(pl => (
                            <option key={pl} value={pl} style={{ color: C.ink, background: C.paper }}>{PLAN_LABEL[pl] ?? pl}</option>
                          ))}
                        </select>
                        <span aria-hidden style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: paid ? '#fff' : hue, pointerEvents: 'none' }}>▾</span>
                        {!u.paidViaLemonSqueezy && u.plan !== 'free' && u.compExpiresAt && (
                          <p title="Admin-granted plan - reverts to Free on this date unless the user pays" style={{ fontSize: 10, fontFamily: MONO, color: C.stone, marginTop: 5, whiteSpace: 'nowrap' }}><Icon name="clock" size={10} color={C.stone} style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: 4 }} />expires {fmtDate(u.compExpiresAt)}</p>
                        )}
                      </div>
                      {paid
                        ? <span title="Paid via Lemon Squeezy" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, width: 'fit-content', fontSize: 11.5, fontWeight: 700, color: '#fff', background: PAID_GOLD, padding: '4px 12px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>★ Paid</span>
                        : sp ? <span style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content', fontSize: 11.5, fontWeight: 600, color: sp.fg, background: sp.bg, padding: '4px 11px', borderRadius: 100, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{sp.label}</span>
                        : <span style={{ color: '#b7b7ae', fontSize: 14 }}>-</span>}
                      <span style={{ ...tdMono, fontSize: 13.5, color: C.graphite }}>{fmtDate(u.createdAt)}</span>
                      <div style={{ fontFamily: MONO, minWidth: 0, lineHeight: 1.6 }}>
                        <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 500 }}>{exact(u.searches)} searches</div>
                        <div style={{ fontSize: 12, color: '#8a8a82', marginTop: 2 }}>{u.imagesThisMonth} img · {u.connectedShops} shop{u.connectedShops === 1 ? '' : 's'} · {timeAgo(u.lastActive)}</div>
                      </div>
                      <div style={{ fontFamily: MONO, minWidth: 0, lineHeight: 1.6 }} title={`${exact(u.creditsUsedTotal)} credits spent lifetime`}>
                        <div style={{ fontSize: 13.5, color: u.creditsRemaining <= 0 ? C.danger : C.ink, fontWeight: 600 }}>{exact(u.creditsUsedToday)} <span style={{ color: '#8a8a82', fontWeight: 500 }}>/ {exact(u.creditsLimit)}</span></div>
                        <div style={{ fontSize: 12, color: '#8a8a82', marginTop: 2 }}>{exact(u.creditsUsedTotal)} lifetime</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => setConfirmAction({ user: u, kind: u.restricted ? 'unrestrict' : 'restrict' })} title={u.restricted ? 'Lift restriction' : 'Restrict this user'}
                          style={{ background: u.restricted ? 'rgba(31,138,76,0.10)' : 'rgba(194,129,17,0.12)', border: `1px solid ${u.restricted ? '#1F8A4C' : '#C28111'}`, color: u.restricted ? '#1F8A4C' : '#C28111', borderRadius: 100, padding: '8px 14px', fontSize: 12.5, fontWeight: 500, fontFamily: MONO, cursor: 'pointer', width: 'fit-content' }}>
                          {u.restricted ? 'Unrestrict' : 'Restrict'}
                        </button>
                        <button onClick={() => setConfirmAction({ user: u, kind: 'delete' })} title="Delete user"
                          style={{ background: C.dangerBg, border: `1px solid ${C.danger}`, color: C.danger, borderRadius: 100, padding: '8px 16px', fontSize: 12.5, fontWeight: 500, fontFamily: MONO, cursor: 'pointer', width: 'fit-content' }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <Pagination page={usersPage} pageCount={usersPageCount} onChange={setUsersPage} />
              <p style={{ fontSize: 12.5, color: '#808080', marginTop: 12, lineHeight: 1.5 }}>
                Click a name to open the full profile. Role/plan changes save instantly. &ldquo;★ Paid&rdquo; marks a real Lemon Squeezy purchase; changing a plan here does not add it. Emails in <code style={{ fontFamily: MONO }}>ADMIN_EMAILS</code> are always admin.
              </p>
            </div>
          )}

          {section === 'analytics' && (
            usage ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080' }}>today · {usage.today.day} (UTC) · resets at midnight</span>}>API usage - today</SectionTitle>
                <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                  <Kpi label="Etsy API calls" value={usage.today.totals.etsyCalls} accent={C.orange} />
                  <Kpi label="Google API calls" value={usage.today.totals.googleCalls} accent={C.ink} />
                  <Kpi label="Searches" value={usage.today.totals.searches} accent="#2563EB" />
                  <Kpi label="Credits spent" value={usage.today.totals.creditsSpent} accent="#7C3AED" />
                </div>
                <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                  <Kpi label="Cache hits" value={usage.today.totals.cacheHits} accent="#0D9488" />
                  <Kpi label="Live API hits" value={usage.today.totals.apiHits} accent={C.ink} />
                  <Kpi label="AI images" value={usage.today.totals.imageCalls} accent={C.orange} />
                  <Kpi label="Image cost" value={usage.today.totals.imageCostUsd} accent="#B7791F" format={usd} />
                </div>

                <div style={{ ...cardStyle, padding: '20px 22px' }}>
                  <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080' }}>Etsy + Google calls / day</span>}>API calls · last 7 days</SectionTitle>
                  <Bars data={[...usage.last7Days].reverse().map(d => ({ label: fmtDay(d.day).split(',')[0], value: d.etsyCalls + d.googleCalls }))} height={160} accent={C.orange} />
                </div>

                <div>
                  <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080' }}>page {usagePage}/{usagePageCount}</span>}>Top consumers today</SectionTitle>
                  <div className="rtable" style={tableCard}>
                    <div style={tableHead(UGRID)}>
                      {['User', 'Etsy', 'Google', 'Searches', 'Cache / API', 'Credits', 'Images · $'].map((h, i) => <span key={i} style={th}>{h}</span>)}
                    </div>
                    {usagePerUser.length === 0 ? (
                      <div style={{ padding: '16px 18px', fontSize: 13, color: '#808080' }}>No API usage recorded yet today.</div>
                    ) : usagePageRows.map(u => (
                      <div key={u.userId} style={tableRow(UGRID)}>
                        <span style={{ fontSize: 12.5, color: C.ink, fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.userEmail || (u.userId === 'anonymous' ? 'anonymous (logged-out)' : u.userId)}</span>
                        <span style={tdMono}>{exact(u.etsyCalls)}</span>
                        <span style={tdMono}>{exact(u.googleCalls)}</span>
                        <span style={tdMono}>{exact(u.searches)}</span>
                        <span style={tdMono}>{exact(u.cacheHits)} / {exact(u.apiHits)}</span>
                        <span style={{ ...tdMono, color: u.creditsSpent > 0 ? C.orange : '#808080' }}>{exact(u.creditsSpent)}</span>
                        <span style={{ ...tdMono, color: u.imageCalls > 0 ? C.orange : '#808080' }}>{exact(u.imageCalls)} · {usd(u.imageCostUsd)}</span>
                      </div>
                    ))}
                  </div>
                  <Pagination page={usagePage} pageCount={usagePageCount} onChange={setUsagePage} />
                </div>

                <div>
                  <SectionTitle>Daily totals · last 7 days</SectionTitle>
                  <div className="rtable" style={tableCard}>
                    <div style={tableHead(D7GRID)}>
                      <span style={th}>Day</span><span style={numTh}>Etsy</span><span style={numTh}>Google</span><span style={numTh}>Searches</span><span style={numTh}>Credits</span><span style={numTh}>Images</span><span style={numTh}>Cost</span>
                    </div>
                    {usage.last7Days.map((d, i) => (
                      <div key={d.day} style={{ ...tableRow(D7GRID), background: i % 2 ? C.canvas : 'transparent' }}>
                        <span style={{ fontSize: 13, fontFamily: MONO, fontWeight: 500, color: C.ink }}>{fmtDay(d.day)}</span>
                        <span style={numCell}>{exact(d.etsyCalls)}</span>
                        <span style={numCell}>{exact(d.googleCalls)}</span>
                        <span style={numCell}>{exact(d.searches)}</span>
                        <span style={{ ...numCell, color: d.creditsSpent > 0 ? C.orange : C.ink }}>{exact(d.creditsSpent)}</span>
                        <span style={{ ...numCell, color: d.imageCalls > 0 ? C.orange : C.ink }}>{exact(d.imageCalls)}</span>
                        <span style={{ ...numCell, color: C.graphite }}>{usd(d.imageCostUsd)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : <EmptyState icon="📊" title="No usage data yet" sub="Analytics appear once the app records API activity." />
          )}

          {section === 'extension' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                <Kpi label="Extension users" value={ext?.total ?? 0} accent={C.orange} delay={0} sub="signed-in users on the extension" />
                <Kpi label="Active last 7 days" value={ext?.active7d ?? 0} accent="#0D9488" delay={60} />
                <Kpi label="Total captures" value={ext?.rows.reduce((s, r) => s + r.hits, 0) ?? 0} accent={C.ink} delay={120} />
              </div>
              <div>
                <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080' }}>{ext?.rows.length ? `${exact(ext.rows.length)} users · page ${extPage}/${extPageCount}` : 'newest activity first'}</span>}>Extension users</SectionTitle>
                {!ext || ext.rows.length === 0 ? (
                  <EmptyState icon="🧩" title="No extension activity yet" sub="Usage appears here once a signed-in user browses Etsy with the Rankkw extension installed." />
                ) : (
                  <div className="rtable" style={tableCard}>
                    <div style={tableHead(EXTGRID)}>
                      {['User', 'Plan', 'Version', 'Captures', 'First seen', 'Last active'].map((h, i) => <span key={i} style={th}>{h}</span>)}
                    </div>
                    {extPageRows.map((r, i) => (
                      <div key={r.userId} style={{ ...tableRow(EXTGRID), background: i % 2 ? C.canvas : 'transparent' }}>
                        <div style={{ minWidth: 0 }}>
                          <button onClick={() => setDetailUserId(r.userId)} title="View full detail"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', maxWidth: '100%', textAlign: 'left' }}>
                            <span style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: C.ash }}>{r.name}</span>
                          </button>
                          <p style={{ fontSize: 12.5, color: '#6E6E64', fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3 }}>{r.email}</p>
                        </div>
                        <span style={{ ...tdMono, textTransform: 'capitalize' }}>{r.plan}</span>
                        <span style={tdMono}>{r.version || '-'}</span>
                        <span style={tdMono}>{exact(r.hits)}</span>
                        <span style={tdMono}>{fmtDate(r.firstSeenAt)}</span>
                        <span style={{ ...tdMono, color: C.graphite }}>{timeAgo(r.lastSeenAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {ext && ext.rows.length > 0 && <Pagination page={extPage} pageCount={extPageCount} onChange={setExtPage} />}
                <p style={{ fontSize: 12.5, color: '#808080', marginTop: 12, lineHeight: 1.5 }}>
                  Detected from browser-extension requests and the extension-only capture endpoint. Version shows once the extension sends an <code style={{ fontFamily: MONO }}>X-Rankkw-Ext-Version</code> header. Captures count active minutes, not raw requests.
                </p>
              </div>
            </div>
          )}

          {section === 'affiliates' && <AdminAffiliates />}

          {section === 'messages' && <AdminMessages />}

          {section === 'content' && (
            <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
              {[
                { href: '/admin/ads', title: 'Popup ads', desc: 'Create and toggle the site-wide promotional popup.' },
                { href: '/admin/deals', title: 'Deals', desc: 'Publish special-offer pages shown at /deals.' },
                { href: '/admin/blogs', title: 'Blog', desc: 'Write and manage Markdown blog posts.' },
              ].map(c => (
                <Link key={c.href} href={c.href} style={{ ...cardStyle, padding: '22px', textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 8, transition: 'transform 0.15s, border-color 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = C.orange }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = C.ash }}>
                  <span style={{ fontSize: 17, fontWeight: 600, color: C.ink }}>{c.title}</span>
                  <span style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.5 }}>{c.desc}</span>
                  <span style={{ fontSize: 13, color: C.orange, fontWeight: 600, marginTop: 4 }}>Manage →</span>
                </Link>
              ))}
            </div>
          )}

          {section === 'settings' && (
            <div style={{ ...tableCard, padding: '20px 24px', maxWidth: 640, display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap', borderColor: promoOn ? C.orange : C.ash, background: promoOn ? 'rgba(251,94,9,0.05)' : C.paper }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>Convert all free users to Pro</p>
                <p style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.55, marginTop: 4 }}>Turn on to upgrade every Free user to Pro. Use <strong>Refresh</strong> to convert any new free users since.</p>
                {promoMsg && <p style={{ fontSize: 12.5, color: C.orange, fontFamily: MONO, marginTop: 8 }}>{promoMsg}</p>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <button onClick={() => callPromo({ refresh: true })} disabled={promoBusy} title="Convert new free users to Pro now"
                  style={{ fontSize: 13, fontWeight: 500, fontFamily: MONO, color: C.orange, background: C.orangeFaint, border: `1px solid ${C.orange}`, borderRadius: 100, padding: '8px 15px', cursor: promoBusy ? 'wait' : 'pointer', opacity: promoBusy ? 0.6 : 1 }}>Refresh</button>
                <button onClick={() => callPromo({ enabled: !promoOn })} disabled={promoBusy} role="switch" aria-checked={promoOn} title={promoOn ? 'Turn off' : 'Turn on'}
                  style={{ position: 'relative', width: 58, height: 32, borderRadius: 100, border: 'none', cursor: promoBusy ? 'wait' : 'pointer', background: promoOn ? C.orange : C.ash, transition: 'background 0.18s', opacity: promoBusy ? 0.6 : 1 }}>
                  <span style={{ position: 'absolute', top: 3, left: promoOn ? 29 : 3, width: 26, height: 26, borderRadius: '50%', background: '#fff', transition: 'left 0.18s', boxShadow: '0 2px 5px rgba(0,0,0,0.25)' }} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User detail drawer */}
      <UserDetailPanel userId={detailUserId} onClose={() => setDetailUserId(null)} />

      {/* Confirm modal */}
      {confirmAction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,14,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 20 }} onClick={() => setConfirmAction(null)}>
          <div style={{ background: C.paper, borderRadius: 16, padding: '26px 28px', maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: C.ink, marginBottom: 10 }}>{confirmAction.kind === 'delete' ? 'Delete this user?' : confirmAction.kind === 'restrict' ? 'Restrict this user?' : 'Lift restriction?'}</h3>
            <p style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.6, marginBottom: 22 }}>
              {confirmAction.kind === 'delete' && <>Permanently delete <strong style={{ color: C.ink }}>{confirmAction.user.email}</strong>? This removes their account and search history and cannot be undone.</>}
              {confirmAction.kind === 'restrict' && <>Restrict <strong style={{ color: C.ink }}>{confirmAction.user.email}</strong>? They&apos;ll be signed out of the dashboard immediately until you lift it.</>}
              {confirmAction.kind === 'unrestrict' && <>Lift the restriction on <strong style={{ color: C.ink }}>{confirmAction.user.email}</strong>? They&apos;ll regain dashboard access right away.</>}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setConfirmAction(null)} style={{ background: 'transparent', border: `1px solid ${C.hairInk}`, color: C.ink, borderRadius: 100, padding: '9px 18px', fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}>Cancel</button>
              <button onClick={runConfirmed} style={{ background: confirmAction.kind === 'unrestrict' ? C.orange : C.danger, border: 'none', color: '#fff', borderRadius: 100, padding: '9px 18px', fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>{confirmAction.kind === 'delete' ? 'Delete' : confirmAction.kind === 'restrict' ? 'Restrict' : 'Unrestrict'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
    </RealtimeProvider>
  )
}
