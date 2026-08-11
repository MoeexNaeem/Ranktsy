'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { C, formatNumber } from '@/utils'
import { StatCard, SectionTitle, Pagination, tableCard, tableHead, th, tableRow, tdMono, EmptyState, MONO } from '@/components/dashboard/kit'

interface AUser {
  id: string; name: string; email: string; role: 'user' | 'admin'; plan: string
  isVerified: boolean; createdAt: string | null; searches: number; lastActive: string | null; connectedShops: number
  subscriptionStatus: string | null; imagesThisMonth: number; restricted: boolean; paidViaLemonSqueezy: boolean
  creditsUsedToday: number; creditsLimit: number; creditsRemaining: number; creditsUsedTotal: number
}
type ConfirmAction = { user: AUser; kind: 'delete' | 'restrict' | 'unrestrict' }
// A REAL paying customer: an actual Lemon Squeezy purchase behind their
// current plan — NOT just "plan !== free", which an admin can set for free
// via the Plan dropdown below with no purchase involved.
const isRealPaid = (u: AUser) => u.paidViaLemonSqueezy && u.plan !== 'free'
interface Stats { total: number; admins: number; verified: number; searches: number }
interface UsageUser { userId: string; userEmail: string | null; etsyCalls: number; googleCalls: number; searches: number; cacheHits: number; apiHits: number; imageCalls: number; imageTokens: number; imageCostUsd: number; creditsSpent: number }
interface UsageData {
  today: { day: string; totals: { etsyCalls: number; googleCalls: number; searches: number; cacheHits: number; apiHits: number; imageCalls: number; imageTokens: number; imageCostUsd: number; creditsSpent: number }; perUser: UsageUser[] }
  last7Days: { day: string; etsyCalls: number; googleCalls: number; searches: number; imageCalls: number; imageCostUsd: number; creditsSpent: number }[]
}

const GRID = '1.5fr 0.6fr 0.8fr 0.6fr 0.55fr 0.75fr 0.8fr 1.2fr'
// Consistent "this account pays us" signal — deliberately NOT one of the
// per-plan hues, so it reads as one visual class regardless of tier.
const PAID_GOLD = '#B7791F'
const UGRID = '1.7fr 0.7fr 0.7fr 0.8fr 0.9fr 0.85fr 0.9fr'
const USERS_PAGE_SIZE = 20
const USAGE_PAGE_SIZE = 15

// Per-tier accent dot + subscription-status pill colours (professional, no rainbow).
const PLAN_HUE: Record<string, string> = {
  free: '#6E6E64', starter: '#2563EB', basic: '#0EA5E9', pro: '#FB5E09', 'pro-1yr': '#B7791F',
  business: '#0D9488', agency: '#7C3AED', enterprise: '#4F46E5', custom: '#5B6472',
}
// Higher = shown first / more prominent. Free is deliberately lowest.
const PLAN_RANK: Record<string, number> = {
  custom: 9, enterprise: 8, agency: 7, business: 6, 'pro-1yr': 5, pro: 4, basic: 3, starter: 2, free: 0,
}
const PLAN_LABEL: Record<string, string> = {
  free: 'Free', starter: 'Starter', basic: 'Basic', pro: 'Pro', 'pro-1yr': 'Pro · 1yr',
  business: 'Business', agency: 'Agency', enterprise: 'Enterprise', custom: 'Custom',
}
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
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : '—'
/** USD with enough precision for tiny per-image costs. */
const usd = (n: number) => `$${(n || 0).toFixed(n < 1 ? 4 : 2)}`
const timeAgo = (d: string | null) => {
  if (!d) return 'never'
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  return days <= 0 ? 'today' : days === 1 ? '1d ago' : days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`
}

const selectStyle: React.CSSProperties = {
  background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 100, padding: '6px 10px',
  fontSize: 12.5, fontFamily: MONO, color: C.ink, outline: 'none', cursor: 'pointer', width: '100%', minWidth: 0,
}

export function AdminDashboard() {
  const [users, setUsers] = useState<AUser[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'forbidden' | 'error'>('loading')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [usersPage, setUsersPage] = useState(1)
  const [usagePage, setUsagePage] = useState(1)
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
    // API-usage analytics (per-user + totals + 7-day) — independent of the user list.
    fetch('/api/admin/usage').then(async r => {
      const d = await r.json().catch(() => null)
      if (r.ok && d?.success) setUsage(d.data)
    }).catch(() => {})
  }, [])
  useEffect(load, [load])

  const patchUser = useCallback(async (id: string, patch: Partial<AUser>) => {
    setBusy(id)
    const r = await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    const d = await r.json().catch(() => null)
    if (r.ok && d?.success) {
      setUsers(us => us.map(u => u.id === id ? { ...u, ...patch } : u))
      // A plan change also changes the daily credit limit — refetch for the true value.
      if ('plan' in patch) load()
    }
    setBusy(null)
  }, [load])

  // body: { enabled } to toggle, or { refresh: true } to re-convert new free users.
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

  // REAL paying customers (Lemon Squeezy purchase) surface first, then
  // admin-granted plans, then free — each group newest-joined-first, and
  // higher-tier plans first within a group.
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
  const usersPageCount = Math.max(1, Math.ceil(sortedUsers.length / USERS_PAGE_SIZE))
  const usersPageRows = useMemo(
    () => sortedUsers.slice((usersPage - 1) * USERS_PAGE_SIZE, usersPage * USERS_PAGE_SIZE),
    [sortedUsers, usersPage],
  )
  const usagePerUser = usage?.today.perUser ?? []
  const usagePageCount = Math.max(1, Math.ceil(usagePerUser.length / USAGE_PAGE_SIZE))
  const usagePageRows = useMemo(
    () => usagePerUser.slice((usagePage - 1) * USAGE_PAGE_SIZE, usagePage * USAGE_PAGE_SIZE),
    [usagePerUser, usagePage],
  )

  const shell = (children: React.ReactNode) => (
    <main className="rpage" style={{ background: C.canvas, minHeight: '100vh', padding: '150px 40px 96px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 500, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#6E6E64', marginBottom: 18 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} /> Admin
        </div>
        {children}
      </div>
    </main>
  )

  if (state === 'loading') return shell(<div className="shimmer" style={{ height: 380, borderRadius: 8, background: '#e8e7e2' }} />)
  if (state === 'forbidden') return shell(<EmptyState icon="🔒" title="Admins only" sub="You don't have access to this page." />)
  if (state === 'error') return shell(<EmptyState icon="⚠️" title="Couldn't load users" sub="Please try again." />)

  return shell(
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 'clamp(30px,3.8vw,46px)', fontWeight: 500, color: C.ink, letterSpacing: '-0.03em', lineHeight: 1.02 }}>User management</h1>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Link href="/admin/ads" style={{ fontSize: 13.5, fontWeight: 500, color: C.orange, background: C.orangeFaint, border: `1px solid ${C.orange}`, borderRadius: 100, padding: '8px 18px', textDecoration: 'none' }}>📣 Manage ads</Link>
          <Link href="/admin/deals" style={{ fontSize: 13.5, fontWeight: 500, color: C.orange, background: C.orangeFaint, border: `1px solid ${C.orange}`, borderRadius: 100, padding: '8px 18px', textDecoration: 'none' }}>🎁 Manage deals</Link>
          <Link href="/admin/blogs" style={{ fontSize: 13.5, fontWeight: 500, color: '#fff', background: C.orange, borderRadius: 100, padding: '9px 18px', textDecoration: 'none' }}>✍ Manage blog</Link>
          <Link href="/dashboard" style={{ fontSize: 13, color: C.ink, textDecoration: 'underline', textUnderlineOffset: 4 }}>← Back to dashboard</Link>
        </div>
      </div>

      {stats && (
        <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          <StatCard label="Total users" value={formatNumber(stats.total)} accent={C.ink} />
          <StatCard label="Paying customers" value={formatNumber(paidCount)} accent={C.orange} sub={`${stats.total ? Math.round((paidCount / stats.total) * 100) : 0}% of total`} />
          <StatCard label="Admins" value={formatNumber(stats.admins)} accent={C.ink} />
          <StatCard label="Verified" value={formatNumber(stats.verified)} accent={C.ink} />
        </div>
      )}

      {/* ─── Free → Pro toggle + refresh ────────────────────────────────────── */}
      <div style={{ ...tableCard, padding: '18px 22px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', borderColor: promoOn ? C.orange : C.ash, background: promoOn ? 'rgba(251,94,9,0.05)' : C.paper }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>Convert all free users to Pro</p>
          <p style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.55, marginTop: 4 }}>
            Turn on to upgrade every Free user to Pro. Use <strong>Refresh</strong> to convert any new free users since.
          </p>
          {promoMsg && <p style={{ fontSize: 12.5, color: C.orange, fontFamily: MONO, marginTop: 8 }}>{promoMsg}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={() => callPromo({ refresh: true })} disabled={promoBusy}
            title="Convert new free users to Pro now"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 500, fontFamily: MONO, color: C.orange, background: C.orangeFaint, border: `1px solid ${C.orange}`, borderRadius: 100, padding: '8px 15px', cursor: promoBusy ? 'wait' : 'pointer', opacity: promoBusy ? 0.6 : 1 }}>
            ↻ Refresh
          </button>
          <button onClick={() => callPromo({ enabled: !promoOn })} disabled={promoBusy}
            role="switch" aria-checked={promoOn} title={promoOn ? 'Turn off' : 'Turn on'}
            style={{ position: 'relative', width: 58, height: 32, borderRadius: 100, border: 'none', cursor: promoBusy ? 'wait' : 'pointer', background: promoOn ? C.orange : C.ash, transition: 'background 0.18s', opacity: promoBusy ? 0.6 : 1 }}>
            <span style={{ position: 'absolute', top: 3, left: promoOn ? 29 : 3, width: 26, height: 26, borderRadius: '50%', background: '#fff', transition: 'left 0.18s', boxShadow: '0 2px 5px rgba(0,0,0,0.25)' }} />
          </button>
        </div>
      </div>

      {/* ─── All users — paying customers surface first, clearly marked ─────── */}
      <div style={{ marginBottom: 34 }}>
        <SectionTitle right={err ? <span style={{ fontSize: 12, color: C.danger }}>{err}</span> : <span style={{ fontSize: 11, fontFamily: MONO, color: '#808080' }}>{formatNumber(paidCount)} paying · {formatNumber(users.length)} total · page {usersPage}/{usersPageCount}</span>}>All users</SectionTitle>
        <div className="rtable" style={{ ...tableCard, overflow: 'hidden' }}>
          <div style={{ ...tableHead(GRID), padding: '15px 22px' }}>
            {['User', 'Role', 'Plan', 'Status', 'Joined', 'Activity', 'Credits', ''].map((h, i) => <span key={i} style={{ ...th, fontSize: 12 }}>{h}</span>)}
          </div>
          {usersPageRows.map((u, i) => {
            const sp = statusPill(u.subscriptionStatus)
            const paid = isRealPaid(u)
            const hue = PLAN_HUE[u.plan] ?? C.stone
            // Restricted is the more urgent state — it overrides the paid tint.
            const rowBg = u.restricted ? 'rgba(207,70,58,0.06)' : paid ? 'rgba(183,121,31,0.07)' : (i % 2 ? C.canvas : 'transparent')
            const rowBgHover = u.restricted ? 'rgba(207,70,58,0.11)' : paid ? 'rgba(183,121,31,0.12)' : C.headerBg
            const barColor = u.restricted ? C.danger : paid ? PAID_GOLD : 'transparent'
            return (
            <div key={u.id} className="admin-user-row"
              style={{
                ...tableRow(GRID), padding: '18px 22px', opacity: busy === u.id ? 0.5 : 1, transition: 'background 0.12s',
                background: rowBg, borderLeft: `4px solid ${barColor}`,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = rowBgHover)}
              onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 7 }}>
                  {u.name}
                  {u.isVerified && <span title="Verified" style={{ display: 'inline-grid', placeItems: 'center', width: 16, height: 16, borderRadius: '50%', background: 'rgba(31,138,76,0.14)', color: '#1F7A42', fontSize: 10.5, flexShrink: 0 }}>✓</span>}
                  {u.role === 'admin' && <span style={{ fontSize: 10, fontWeight: 700, fontFamily: MONO, color: C.orange, background: C.orangeFaint, padding: '2.5px 8px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Admin</span>}
                </p>
                <p style={{ fontSize: 13, color: '#6E6E64', fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3 }}>{u.email}</p>
                {/* Restricted is shown here (it's the account's access state); "Paid"
                    lives only in the Status column so it's never written twice. */}
                {u.restricted && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, fontFamily: MONO, color: C.danger, background: C.dangerBg, padding: '3px 9px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 6 }}>⛔ Restricted</span>
                )}
              </div>
              <select value={u.role} onChange={e => patchUser(u.id, { role: e.target.value as AUser['role'] })} style={selectStyle}>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
              {/* A single styled control — the pill IS the select, not a separate badge above it. */}
              <div style={{ position: 'relative', minWidth: 0 }}>
                <select value={u.plan} onChange={e => patchUser(u.id, { plan: e.target.value })}
                  style={{
                    width: '100%', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', outline: 'none',
                    fontSize: 11.5, fontWeight: 700, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.04em',
                    color: paid ? '#fff' : hue, background: paid ? hue : 'transparent', border: paid ? 'none' : `1px solid ${hue}`,
                    borderRadius: 100, padding: '6px 22px 6px 12px',
                  }}>
                  {['free','starter','basic','pro','pro-1yr','business','agency','enterprise','custom'].map(pl => (
                    <option key={pl} value={pl} style={{ color: C.ink, background: C.paper }}>{PLAN_LABEL[pl] ?? pl}</option>
                  ))}
                </select>
                <span aria-hidden style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: paid ? '#fff' : hue, pointerEvents: 'none' }}>▾</span>
              </div>
              {/* Status = the single "Paid" indicator (real Lemon Squeezy purchase),
                  gold-highlighted; falls back to the LS subscription state, then —. */}
              {paid
                ? <span title="Paid via Lemon Squeezy" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, width: 'fit-content', fontSize: 11.5, fontWeight: 700, color: '#fff', background: PAID_GOLD, padding: '4px 12px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>★ Paid</span>
                : sp
                ? <span style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content', fontSize: 11.5, fontWeight: 600, color: sp.fg, background: sp.bg, padding: '4px 11px', borderRadius: 100, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{sp.label}</span>
                : <span style={{ color: '#b7b7ae', fontSize: 14 }}>—</span>}
              <span style={{ ...tdMono, fontSize: 13.5, color: C.graphite }}>{fmtDate(u.createdAt)}</span>
              <div style={{ fontFamily: MONO, minWidth: 0, lineHeight: 1.6 }}>
                <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 500 }}>{formatNumber(u.searches)} searches</div>
                <div style={{ fontSize: 12, color: '#8a8a82', marginTop: 2 }}>{u.imagesThisMonth} img · {u.connectedShops} shop{u.connectedShops === 1 ? '' : 's'} · {timeAgo(u.lastActive)}</div>
              </div>
              <div style={{ fontFamily: MONO, minWidth: 0, lineHeight: 1.6 }} title={`${formatNumber(u.creditsUsedTotal)} credits spent lifetime`}>
                <div style={{ fontSize: 13.5, color: u.creditsRemaining <= 0 ? C.danger : C.ink, fontWeight: 600 }}>{formatNumber(u.creditsUsedToday)} <span style={{ color: '#8a8a82', fontWeight: 500 }}>/ {formatNumber(u.creditsLimit)}</span></div>
                <div style={{ fontSize: 12, color: '#8a8a82', marginTop: 2 }}>{formatNumber(u.creditsUsedTotal)} lifetime</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {/* Colored: amber "Restrict" (a warning action) vs green "Unrestrict" (restores access). */}
                <button onClick={() => setConfirmAction({ user: u, kind: u.restricted ? 'unrestrict' : 'restrict' })} title={u.restricted ? 'Lift restriction' : 'Restrict this user'}
                  style={{
                    background: u.restricted ? 'rgba(31,138,76,0.10)' : 'rgba(194,129,17,0.12)',
                    border: `1px solid ${u.restricted ? '#1F8A4C' : '#C28111'}`, color: u.restricted ? '#1F8A4C' : '#C28111',
                    borderRadius: 100, padding: '8px 14px', fontSize: 12.5, fontWeight: 500, fontFamily: MONO, cursor: 'pointer', width: 'fit-content',
                  }}>
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
          Role/plan changes save instantly. The &ldquo;★ Paid&rdquo; status marks a real Lemon Squeezy purchase — changing someone&apos;s plan here does not add it. Emails in the server&apos;s <code style={{ fontFamily: MONO }}>ADMIN_EMAILS</code> are always admin regardless of this setting.
        </p>
      </div>

      {usage && (
        <div style={{ marginBottom: 30 }}>
          <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080' }}>today · {usage.today.day} (UTC) · resets at midnight</span>}>API usage — today</SectionTitle>
          <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 12 }}>
            <StatCard label="Etsy API calls" value={formatNumber(usage.today.totals.etsyCalls)} accent={C.orange} />
            <StatCard label="Google API calls" value={formatNumber(usage.today.totals.googleCalls)} accent={C.ink} />
            <StatCard label="Searches" value={formatNumber(usage.today.totals.searches)} accent={C.ink} />
            <StatCard label="Cache hits / API" value={`${formatNumber(usage.today.totals.cacheHits)} / ${formatNumber(usage.today.totals.apiHits)}`} accent={C.ink} />
          </div>

          {/* Gemini image generation — count, tokens burnt, USD spent */}
          <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
            <StatCard label="AI images generated" value={formatNumber(usage.today.totals.imageCalls)} accent={C.orange} />
            <StatCard label="Image tokens burnt" value={formatNumber(usage.today.totals.imageTokens)} accent={C.ink} />
            <StatCard label="Image cost (today)" value={usd(usage.today.totals.imageCostUsd)} accent={C.orange} />
            <StatCard label="Credits spent (today)" value={formatNumber(usage.today.totals.creditsSpent)} accent={C.orange} />
          </div>

          <div className="rtable" style={tableCard}>
            <div style={tableHead(UGRID)}>
              {['User', 'Etsy', 'Google', 'Searches', 'Cache / API', 'Credits', 'Images · $'].map((h, i) => <span key={i} style={th}>{h}</span>)}
            </div>
            {usagePerUser.length === 0 ? (
              <div style={{ padding: '16px 18px', fontSize: 13, color: '#808080' }}>No API usage recorded yet today.</div>
            ) : usagePageRows.map(u => (
              <div key={u.userId} style={tableRow(UGRID)}>
                <span style={{ fontSize: 12.5, color: C.ink, fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.userEmail || (u.userId === 'anonymous' ? 'anonymous (logged-out)' : u.userId)}
                </span>
                <span style={tdMono}>{formatNumber(u.etsyCalls)}</span>
                <span style={tdMono}>{formatNumber(u.googleCalls)}</span>
                <span style={tdMono}>{formatNumber(u.searches)}</span>
                <span style={tdMono}>{formatNumber(u.cacheHits)} / {formatNumber(u.apiHits)}</span>
                <span style={{ ...tdMono, color: u.creditsSpent > 0 ? C.orange : '#808080' }}>{formatNumber(u.creditsSpent)}</span>
                <span style={{ ...tdMono, color: u.imageCalls > 0 ? C.orange : '#808080' }}>{formatNumber(u.imageCalls)} · {usd(u.imageCostUsd)}</span>
              </div>
            ))}
          </div>
          <Pagination page={usagePage} pageCount={usagePageCount} onChange={setUsagePage} />

          <p style={{ fontSize: 11.5, fontFamily: MONO, color: '#808080', margin: '16px 0 8px' }}>LAST 7 DAYS</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {usage.last7Days.map(d => (
              <div key={d.day} style={{ flex: '1 1 96px', minWidth: 96, background: C.canvas, borderRadius: 10, padding: '9px 11px' }}>
                <p style={{ fontSize: 10, fontFamily: MONO, color: '#808080', marginBottom: 5 }}>{d.day.slice(5)}</p>
                <p style={{ fontSize: 12.5, color: C.ink, fontFamily: MONO }}>E {formatNumber(d.etsyCalls)} · G {formatNumber(d.googleCalls)}</p>
                <p style={{ fontSize: 10.5, color: '#808080', fontFamily: MONO, marginTop: 2 }}>{formatNumber(d.searches)} searches · {formatNumber(d.creditsSpent)} credits</p>
                <p style={{ fontSize: 10.5, color: d.imageCalls > 0 ? C.orange : '#808080', fontFamily: MONO, marginTop: 2 }}>{formatNumber(d.imageCalls)} img · {usd(d.imageCostUsd)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmAction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,14,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
          onClick={() => setConfirmAction(null)}>
          <div style={{ background: C.paper, borderRadius: 16, padding: '26px 28px', maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: C.ink, marginBottom: 10 }}>
              {confirmAction.kind === 'delete' ? 'Delete this user?' : confirmAction.kind === 'restrict' ? 'Restrict this user?' : 'Lift restriction?'}
            </h3>
            <p style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.6, marginBottom: 22 }}>
              {confirmAction.kind === 'delete' && <>Permanently delete <strong style={{ color: C.ink }}>{confirmAction.user.email}</strong>? This removes their account and search history and cannot be undone.</>}
              {confirmAction.kind === 'restrict' && <>Restrict <strong style={{ color: C.ink }}>{confirmAction.user.email}</strong>? They&apos;ll be signed out of the dashboard immediately and see a message explaining they&apos;ve been restricted, until you lift it.</>}
              {confirmAction.kind === 'unrestrict' && <>Lift the restriction on <strong style={{ color: C.ink }}>{confirmAction.user.email}</strong>? They&apos;ll regain dashboard access right away.</>}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setConfirmAction(null)}
                style={{ background: 'transparent', border: `1px solid ${C.hairInk}`, color: C.ink, borderRadius: 100, padding: '9px 18px', fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={runConfirmed}
                style={{
                  background: confirmAction.kind === 'unrestrict' ? C.orange : C.danger, border: 'none', color: '#fff',
                  borderRadius: 100, padding: '9px 18px', fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                }}>
                {confirmAction.kind === 'delete' ? 'Delete' : confirmAction.kind === 'restrict' ? 'Restrict' : 'Unrestrict'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}
