'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { C, formatNumber } from '@/utils'
import { StatCard, SectionTitle, tableCard, tableHead, th, tableRow, tdMono, EmptyState, MONO } from '@/components/dashboard/kit'

interface AUser {
  id: string; name: string; email: string; role: 'user' | 'admin'; plan: string
  isVerified: boolean; createdAt: string | null; searches: number; lastActive: string | null; etsyShopId: string | null
  subscriptionStatus: string | null; imagesThisMonth: number
}
interface Stats { total: number; admins: number; verified: number; searches: number }
interface UsageUser { userId: string; userEmail: string | null; etsyCalls: number; googleCalls: number; searches: number; cacheHits: number; apiHits: number; imageCalls: number; imageTokens: number; imageCostUsd: number }
interface UsageData {
  today: { day: string; totals: { etsyCalls: number; googleCalls: number; searches: number; cacheHits: number; apiHits: number; imageCalls: number; imageTokens: number; imageCostUsd: number }; perUser: UsageUser[] }
  last7Days: { day: string; etsyCalls: number; googleCalls: number; searches: number; imageCalls: number; imageCostUsd: number }[]
}

const GRID = '2fr 0.8fr 0.95fr 0.9fr 0.75fr 1fr 0.55fr'

// Per-tier accent dot + subscription-status pill colours (professional, no rainbow).
const PLAN_HUE: Record<string, string> = {
  free: '#6E6E64', starter: '#2563EB', basic: '#0EA5E9', pro: '#FB5E09', 'pro-1yr': '#B7791F',
  business: '#0D9488', agency: '#7C3AED', enterprise: '#4F46E5', custom: '#5B6472',
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
const UGRID = '1.7fr 0.7fr 0.7fr 0.8fr 0.9fr 1fr'
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

  const load = useCallback(() => {
    fetch('/api/admin/users').then(async r => {
      if (r.status === 401) { window.location.href = '/login?redirect=/admin'; return }
      if (r.status === 403) { setState('forbidden'); return }
      const d = await r.json().catch(() => null)
      if (r.ok && d?.success) { setUsers(d.data.users); setStats(d.data.stats); setState('ok') }
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
    if (r.ok && d?.success) setUsers(us => us.map(u => u.id === id ? { ...u, ...patch } : u))
    setBusy(null)
  }, [])

  const deleteUser = useCallback(async (u: AUser) => {
    if (!confirm(`Delete ${u.email}? This removes their account and search history and cannot be undone.`)) return
    setBusy(u.id); setErr('')
    const r = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' })
    const d = await r.json().catch(() => null)
    if (r.ok && d?.success) {
      setUsers(us => us.filter(x => x.id !== u.id))
      setStats(s => s ? { ...s, total: s.total - 1, admins: s.admins - (u.role === 'admin' ? 1 : 0), verified: s.verified - (u.isVerified ? 1 : 0) } : s)
    } else setErr(d?.error || 'Delete failed')
    setBusy(null)
  }, [])

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
          <Link href="/admin/blogs" style={{ fontSize: 13.5, fontWeight: 500, color: '#fff', background: C.orange, borderRadius: 100, padding: '9px 18px', textDecoration: 'none' }}>✍ Manage blog</Link>
          <Link href="/dashboard" style={{ fontSize: 13, color: C.ink, textDecoration: 'underline', textUnderlineOffset: 4 }}>← Back to dashboard</Link>
        </div>
      </div>

      {stats && (
        <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          <StatCard label="Total users" value={formatNumber(stats.total)} accent={C.ink} />
          <StatCard label="Admins" value={formatNumber(stats.admins)} accent={C.orange} />
          <StatCard label="Verified" value={formatNumber(stats.verified)} accent={C.ink} />
          <StatCard label="Total searches" value={formatNumber(stats.searches)} accent={C.ink} />
        </div>
      )}

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
          <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 14 }}>
            <StatCard label="AI images generated" value={formatNumber(usage.today.totals.imageCalls)} accent={C.orange} />
            <StatCard label="Image tokens burnt" value={formatNumber(usage.today.totals.imageTokens)} accent={C.ink} />
            <StatCard label="Image cost (today)" value={usd(usage.today.totals.imageCostUsd)} accent={C.orange} />
          </div>

          <div className="rtable" style={tableCard}>
            <div style={tableHead(UGRID)}>
              {['User', 'Etsy', 'Google', 'Searches', 'Cache / API', 'Images · $'].map((h, i) => <span key={i} style={th}>{h}</span>)}
            </div>
            {usage.today.perUser.length === 0 ? (
              <div style={{ padding: '16px 18px', fontSize: 13, color: '#808080' }}>No API usage recorded yet today.</div>
            ) : usage.today.perUser.map(u => (
              <div key={u.userId} style={tableRow(UGRID)}>
                <span style={{ fontSize: 12.5, color: C.ink, fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.userEmail || (u.userId === 'anonymous' ? 'anonymous (logged-out)' : u.userId)}
                </span>
                <span style={tdMono}>{formatNumber(u.etsyCalls)}</span>
                <span style={tdMono}>{formatNumber(u.googleCalls)}</span>
                <span style={tdMono}>{formatNumber(u.searches)}</span>
                <span style={tdMono}>{formatNumber(u.cacheHits)} / {formatNumber(u.apiHits)}</span>
                <span style={{ ...tdMono, color: u.imageCalls > 0 ? C.orange : '#808080' }}>{formatNumber(u.imageCalls)} · {usd(u.imageCostUsd)}</span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11.5, fontFamily: MONO, color: '#808080', margin: '16px 0 8px' }}>LAST 7 DAYS</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {usage.last7Days.map(d => (
              <div key={d.day} style={{ flex: '1 1 96px', minWidth: 96, background: C.canvas, borderRadius: 10, padding: '9px 11px' }}>
                <p style={{ fontSize: 10, fontFamily: MONO, color: '#808080', marginBottom: 5 }}>{d.day.slice(5)}</p>
                <p style={{ fontSize: 12.5, color: C.ink, fontFamily: MONO }}>E {formatNumber(d.etsyCalls)} · G {formatNumber(d.googleCalls)}</p>
                <p style={{ fontSize: 10.5, color: '#808080', fontFamily: MONO, marginTop: 2 }}>{formatNumber(d.searches)} searches</p>
                <p style={{ fontSize: 10.5, color: d.imageCalls > 0 ? C.orange : '#808080', fontFamily: MONO, marginTop: 2 }}>{formatNumber(d.imageCalls)} img · {usd(d.imageCostUsd)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <SectionTitle right={err ? <span style={{ fontSize: 12, color: C.danger }}>{err}</span> : <span style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080' }}>{users.length} users</span>}>All users</SectionTitle>
      <div className="rtable" style={tableCard}>
        <div style={tableHead(GRID)}>
          {['User', 'Role', 'Plan', 'Status', 'Joined', 'Activity', ''].map((h, i) => <span key={i} style={th}>{h}</span>)}
        </div>
        {users.map(u => {
          const sp = statusPill(u.subscriptionStatus)
          return (
          <div key={u.id} className="admin-user-row" style={{ ...tableRow(GRID), opacity: busy === u.id ? 0.5 : 1, transition: 'background 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.canvas)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                {u.name}
                {u.isVerified && <span title="Verified" style={{ display: 'inline-grid', placeItems: 'center', width: 15, height: 15, borderRadius: '50%', background: 'rgba(31,138,76,0.14)', color: '#1F7A42', fontSize: 10, flexShrink: 0 }}>✓</span>}
                {u.role === 'admin' && <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: MONO, color: C.orange, background: C.orangeFaint, padding: '2px 7px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Admin</span>}
              </p>
              <p style={{ fontSize: 12.5, color: '#6E6E64', fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{u.email}</p>
            </div>
            <select value={u.role} onChange={e => patchUser(u.id, { role: e.target.value as AUser['role'] })} style={selectStyle}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: PLAN_HUE[u.plan] ?? C.stone, flexShrink: 0 }} />
              <select value={u.plan} onChange={e => patchUser(u.id, { plan: e.target.value })} style={selectStyle}>
                {['free','starter','basic','pro','pro-1yr','business','agency','enterprise','custom'].map(pl => (
                  <option key={pl} value={pl}>{pl}</option>
                ))}
              </select>
            </div>
            {sp
              ? <span style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content', fontSize: 11, fontWeight: 600, color: sp.fg, background: sp.bg, padding: '4px 10px', borderRadius: 100, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{sp.label}</span>
              : <span style={{ color: '#b7b7ae', fontSize: 14 }}>—</span>}
            <span style={{ ...tdMono, fontSize: 13, color: C.graphite }}>{fmtDate(u.createdAt)}</span>
            <div style={{ fontFamily: MONO, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{formatNumber(u.searches)} searches</div>
              <div style={{ fontSize: 11, color: '#8a8a82', marginTop: 2 }}>{u.imagesThisMonth} img · {timeAgo(u.lastActive)}</div>
            </div>
            <button onClick={() => deleteUser(u)} title="Delete user"
              style={{ background: 'transparent', border: `1px solid ${C.dangerBg}`, color: C.danger, borderRadius: 100, padding: '6px 11px', fontSize: 11, fontFamily: MONO, cursor: 'pointer', width: 'fit-content' }}>
              Delete
            </button>
          </div>
          )
        })}
      </div>
      <p style={{ fontSize: 12, color: '#808080', marginTop: 12, lineHeight: 1.5 }}>
        Role/plan changes save instantly. Emails in the server&apos;s <code style={{ fontFamily: MONO }}>ADMIN_EMAILS</code> are always admin regardless of this setting.
      </p>
    </>
  )
}
