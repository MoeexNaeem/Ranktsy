'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { C, formatNumber } from '@/utils'
import { StatCard, SectionTitle, tableCard, tableHead, th, tableRow, tdMono, EmptyState, MONO } from '@/components/dashboard/kit'

interface AUser {
  id: string; name: string; email: string; role: 'user' | 'admin'; plan: string
  isVerified: boolean; createdAt: string | null; searches: number; lastActive: string | null; etsyShopId: string | null
}
interface Stats { total: number; admins: number; verified: number; searches: number }
interface UsageUser { userId: string; userEmail: string | null; etsyCalls: number; googleCalls: number; searches: number; cacheHits: number; apiHits: number; imageCalls: number; imageTokens: number; imageCostUsd: number }
interface UsageData {
  today: { day: string; totals: { etsyCalls: number; googleCalls: number; searches: number; cacheHits: number; apiHits: number; imageCalls: number; imageTokens: number; imageCostUsd: number }; perUser: UsageUser[] }
  last7Days: { day: string; etsyCalls: number; googleCalls: number; searches: number; imageCalls: number; imageCostUsd: number }[]
}

const GRID = '2.2fr 0.9fr 0.85fr 0.7fr 0.9fr 0.6fr'
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
  background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 100, padding: '5px 10px',
  fontSize: 12, fontFamily: MONO, color: C.ink, outline: 'none', cursor: 'pointer',
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
          {['User', 'Role', 'Plan', 'Joined', 'Activity', ''].map((h, i) => <span key={i} style={th}>{h}</span>)}
        </div>
        {users.map(u => (
          <div key={u.id} style={{ ...tableRow(GRID), opacity: busy === u.id ? 0.5 : 1 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.name} {u.isVerified && <span title="Verified" style={{ color: C.success, fontSize: 11 }}>✓</span>}
              </p>
              <p style={{ fontSize: 11.5, color: '#808080', fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
            </div>
            <select value={u.role} onChange={e => patchUser(u.id, { role: e.target.value as AUser['role'] })} style={selectStyle}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <select value={u.plan} onChange={e => patchUser(u.id, { plan: e.target.value })} style={selectStyle}>
              <option value="free">free</option>
              <option value="grow">grow</option>
              <option value="scale">scale</option>
            </select>
            <span style={tdMono}>{fmtDate(u.createdAt)}</span>
            <span style={tdMono}>{u.searches} · {timeAgo(u.lastActive)}</span>
            <button onClick={() => deleteUser(u)} title="Delete user"
              style={{ background: 'transparent', border: `1px solid ${C.dangerBg}`, color: C.danger, borderRadius: 100, padding: '5px 10px', fontSize: 11, fontFamily: MONO, cursor: 'pointer', width: 'fit-content' }}>
              Delete
            </button>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: '#808080', marginTop: 12, lineHeight: 1.5 }}>
        Role/plan changes save instantly. Emails in the server&apos;s <code style={{ fontFamily: MONO }}>ADMIN_EMAILS</code> are always admin regardless of this setting.
      </p>
    </>
  )
}
