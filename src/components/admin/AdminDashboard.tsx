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

const GRID = '2.2fr 0.9fr 0.85fr 0.7fr 0.9fr 0.6fr'
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : '—'
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
    <main style={{ background: C.canvas, minHeight: '100vh', padding: '150px 40px 96px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 500, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#3a4444', marginBottom: 18 }}>
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
        <h1 style={{ fontSize: 'clamp(28px,3.5vw,42px)', fontWeight: 300, color: C.ink, letterSpacing: '-1.2px', lineHeight: 1.05 }}>User management</h1>
        <Link href="/dashboard" style={{ fontSize: 13, color: C.ink, textDecoration: 'underline', textUnderlineOffset: 4 }}>← Back to dashboard</Link>
      </div>

      {stats && (
        <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          <StatCard label="Total users" value={formatNumber(stats.total)} accent={C.ink} />
          <StatCard label="Admins" value={formatNumber(stats.admins)} accent={C.orange} />
          <StatCard label="Verified" value={formatNumber(stats.verified)} accent={C.ink} />
          <StatCard label="Total searches" value={formatNumber(stats.searches)} accent={C.ink} />
        </div>
      )}

      <SectionTitle right={err ? <span style={{ fontSize: 12, color: C.danger }}>{err}</span> : <span style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080' }}>{users.length} users</span>}>All users</SectionTitle>
      <div style={tableCard}>
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
