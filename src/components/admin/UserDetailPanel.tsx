'use client'
/**
 * Slide-in drawer with EVERYTHING we hold about one user — opened by clicking a
 * row in the Users table. Fetches /api/admin/users/[id] (full detail) on open.
 */
import { useEffect, useState } from 'react'
import { C } from '@/utils'
import { MONO } from '@/components/dashboard/kit'
import { Bars } from './AdminCharts'

interface Detail {
  id: string; name: string; email: string; authProvider: string | null
  role: 'user' | 'admin'; plan: string; effectivePlan: string
  isVerified: boolean; restricted: boolean; paidViaLemonSqueezy: boolean
  subscriptionStatus: string | null; lsCustomerId: string | null; planRenewsAt: string | null
  createdAt: string | null
  credits: { usedToday: number; limit: number; remaining: number; usedTotal: number }
  imagesThisMonth: number; savedKeywords: number; searchTotal: number
  shops: { shopName: string; shopId: string }[]
  recentSearches: { keyword: string; at: string | null }[]
  usage: { day: string; etsyCalls: number; googleCalls: number; searches: number; imageCalls: number; imageCostUsd: number; creditsSpent: number }[]
}

const exact = (n: number) => (n ?? 0).toLocaleString('en-US')
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const fmtWhen = (d: string | null) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: `1px solid ${C.hair}` }}>
      <span style={{ fontSize: 12.5, color: C.graphite }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.ink, fontFamily: MONO, textAlign: 'right', wordBreak: 'break-word' }}>{children}</span>
    </div>
  )
}
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <p style={{ fontSize: 11, fontFamily: MONO, fontWeight: 600, color: C.orange, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{title}</p>
      {children}
    </div>
  )
}

export function UserDetailPanel({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const open = !!userId

  useEffect(() => {
    if (!userId) return
    let alive = true
    // Reset + fetch inside a nested async fn (not the effect body) so we don't
    // call setState synchronously during the effect.
    const run = async () => {
      setState('loading'); setD(null)
      try {
        const r = await fetch(`/api/admin/users/${userId}`)
        const j = await r.json().catch(() => null)
        if (!alive) return
        if (r.ok && j?.success) { setD(j.data); setState('ok') } else setState('error')
      } catch { if (alive) setState('error') }
    }
    run()
    return () => { alive = false }
  }, [userId])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      {/* Scrim */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(20,18,14,0.45)', zIndex: 300,
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 0.25s',
      }} />
      {/* Drawer */}
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(460px, 94vw)', background: C.paper, zIndex: 301,
        boxShadow: '-20px 0 60px rgba(0,0,0,0.22)', transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.32s cubic-bezier(.2,.7,.2,1)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${C.ash}`, flexShrink: 0 }}>
          <span style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.08em' }}>User detail</span>
          <button onClick={onClose} aria-label="Close" style={{ background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: C.ink, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '22px 24px 40px', flex: 1 }}>
          {state === 'loading' && <div className="shimmer" style={{ height: 400, borderRadius: 10, background: '#e8e7e2' }} />}
          {state === 'error' && <p style={{ fontSize: 14, color: C.graphite }}>Couldn&apos;t load this user. Please close and try again.</p>}
          {state === 'ok' && d && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: C.orangeFaint, color: C.orange, display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
                  {(d.name || d.email || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: C.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {d.name}
                    {d.role === 'admin' && <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: MONO, color: C.orange, background: C.orangeFaint, padding: '2px 7px', borderRadius: 100, textTransform: 'uppercase' }}>Admin</span>}
                    {d.restricted && <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: MONO, color: C.danger, background: C.dangerBg, padding: '2px 7px', borderRadius: 100, textTransform: 'uppercase' }}>Restricted</span>}
                  </p>
                  <p style={{ fontSize: 13, color: C.graphite, fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.email}</p>
                </div>
              </div>

              <Group title="Account">
                <Field label="User ID"><span style={{ fontSize: 11 }}>{d.id}</span></Field>
                <Field label="Joined">{fmtDate(d.createdAt)}</Field>
                <Field label="Verified">{d.isVerified ? 'Yes' : 'No'}</Field>
                <Field label="Sign-in">{d.authProvider ? d.authProvider : 'email + password'}</Field>
              </Group>

              <Group title="Plan & billing">
                <Field label="Plan">{d.effectivePlan}{d.plan !== d.effectivePlan ? ` (set: ${d.plan})` : ''}</Field>
                <Field label="Paid customer">{d.paidViaLemonSqueezy ? '★ Yes (Lemon Squeezy)' : 'No'}</Field>
                <Field label="Subscription">{d.subscriptionStatus ? d.subscriptionStatus.replace(/_/g, ' ') : '—'}</Field>
                {d.lsCustomerId && <Field label="LS customer">{d.lsCustomerId}</Field>}
                {d.planRenewsAt && <Field label="Renews">{fmtDate(d.planRenewsAt)}</Field>}
              </Group>

              <Group title="Credits">
                <Field label="Today">{exact(d.credits.usedToday)} / {exact(d.credits.limit)}</Field>
                <Field label="Remaining">{exact(d.credits.remaining)}</Field>
                <Field label="Lifetime spent">{exact(d.credits.usedTotal)}</Field>
              </Group>

              <Group title="Activity">
                <Field label="Total searches">{exact(d.searchTotal)}</Field>
                <Field label="Images this month">{exact(d.imagesThisMonth)}</Field>
                <Field label="Saved keywords">{exact(d.savedKeywords)}</Field>
                <Field label="Connected shops">{d.shops.length ? d.shops.map(s => s.shopName).join(', ') : '—'}</Field>
              </Group>

              <Group title="Searches · last 14 days">
                {d.usage.some(u => u.searches > 0)
                  ? <Bars data={d.usage.map(u => ({ label: u.day.slice(8), value: u.searches }))} height={120} accent={C.orange} />
                  : <p style={{ fontSize: 12.5, color: C.graphite }}>No searches recorded in the last 14 days.</p>}
              </Group>

              <Group title="Recent searches">
                {d.recentSearches.length === 0
                  ? <p style={{ fontSize: 12.5, color: C.graphite }}>No search history.</p>
                  : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {d.recentSearches.map((s, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: i < d.recentSearches.length - 1 ? `1px solid ${C.hair}` : 'none' }}>
                          <span style={{ fontSize: 13, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.keyword}</span>
                          <span style={{ fontSize: 11.5, color: C.graphite, fontFamily: MONO, flexShrink: 0 }}>{fmtWhen(s.at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
              </Group>
            </>
          )}
        </div>
      </aside>
    </>
  )
}
