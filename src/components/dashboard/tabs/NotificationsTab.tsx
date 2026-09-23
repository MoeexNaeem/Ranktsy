'use client'
/**
 * Notifications page: the full, readable history behind the top-bar bell. The newest
 * page comes from the realtime context (so live arrivals appear instantly); older pages
 * are fetched here by cursor. Notifications expire after 30 days (TTL on the model).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { C, withAlpha } from '@/utils'
import { Card, EmptyState, MONO } from '../kit'
import { Shimmer } from '../skeletons'
import { ICON } from '@/components/ui/AnimIcon'
import { useRealtime, relTime, notifAction, takePendingNotifFocus, type Notif } from '../Realtime'

type Filter = 'all' | 'unread' | 'messages' | 'alerts' | 'deals' | 'updates'

// How each notification type reads on the page. Unknown/admin-set types fall back to "Update".
const KIND: Record<string, { label: string; color: string; filter: Filter }> = {
  chat:  { label: 'Message', color: '#2563EB', filter: 'messages' },
  alert: { label: 'Alert',   color: '#D97706', filter: 'alerts' },
  deal:  { label: 'Deal',    color: '#16A34A', filter: 'deals' },
}
const UPDATE = { label: 'Update', color: C.orange, filter: 'updates' as Filter }
const kindOf = (t: string) => KIND[t] ?? UPDATE
const colorOf = (f: Filter) => (Object.values(KIND).find(k => k.filter === f) ?? UPDATE).color

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'messages', label: 'Messages' },
  { id: 'alerts', label: 'Keyword alerts' },
  { id: 'deals', label: 'Deals' },
  { id: 'updates', label: 'Updates' },
]
const CATEGORIES: Filter[] = ['messages', 'alerts', 'deals', 'updates']

const PAGE = 50

// Feed + right rail on wide screens; below 1100px the rail stacks on top and its
// filters become a swipeable row.
const LAYOUT_CSS = `
.rnotif-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 20px; max-width: 1240px; margin: 0 auto; align-items: start; }
.rnotif-feed { order: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
.rnotif-rail { order: 2; position: sticky; top: 16px; display: flex; flex-direction: column; gap: 16px; }
.rnotif-filters { display: flex; flex-direction: column; gap: 2px; }
@media (max-width: 1100px) {
  .rnotif-grid { grid-template-columns: minmax(0, 1fr); }
  .rnotif-rail { order: 0; position: static; }
  .rnotif-filters { flex-direction: row; overflow-x: auto; gap: 6px; padding-bottom: 2px; }
  .rnotif-help { display: none; }
}
`

function dayBucket(d: string | null): string {
  if (!d) return 'Earlier'
  const date = new Date(d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today.getTime() - new Date(date).setHours(0, 0, 0, 0)) / 86400000)
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return 'This week'
  return 'Earlier'
}

const fullDate = (d: string | null) => d
  ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : ''

function KindIcon({ type }: { type: string }) {
  const { color } = kindOf(type)
  const path = type === 'chat'
    ? <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    : type === 'alert'
      ? <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>
      : type === 'deal'
        ? <><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></>
        : <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>
  return (
    <span style={{ width: 38, height: 38, borderRadius: 11, background: withAlpha(color, 0.12), color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{path}</svg>
    </span>
  )
}

export function NotificationsTab() {
  const { isAdmin, notifications: live, notifUnread, markAllRead, markRead, loadNotifications } = useRealtime()
  const [filter, setFilter] = useState<Filter>('all')
  // Pages older than the live window, loaded on demand.
  const [older, setOlder] = useState<Notif[]>([])
  const [hasMore, setHasMore] = useState<boolean | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [ready, setReady] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)

  // Fresh first page on open (also tells us whether older pages exist).
  useEffect(() => {
    let alive = true
    loadNotifications()
    fetch(`/api/notifications?limit=${PAGE}`).then(r => r.json()).then(j => {
      if (alive && j?.success) setHasMore(!!j.data.hasMore)
    }).catch(() => {}).finally(() => { if (alive) setReady(true) })
    return () => { alive = false }
  }, [loadNotifications])

  // Opened from the bell on a specific item: scroll to it and highlight it briefly.
  useEffect(() => {
    const take = () => { const id = takePendingNotifFocus(); if (id) setFocusId(id) }
    take()
    window.addEventListener('rk-notif-focus', take)
    return () => window.removeEventListener('rk-notif-focus', take)
  }, [])
  useEffect(() => {
    if (!focusId || !ready) return
    document.querySelector(`[data-notif-id="${focusId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setFocusId(null), 2400)
    return () => clearTimeout(t)
  }, [focusId, ready])

  const all = useMemo(() => {
    const seen = new Set(live.map(n => n.id))
    return [...live, ...older.filter(n => !seen.has(n.id))]
  }, [live, older])

  const visible = useMemo(() => all.filter(n =>
    filter === 'all' ? true : filter === 'unread' ? !n.read : kindOf(n.type).filter === filter,
  ), [all, filter])

  const groups = useMemo(() => {
    const out: { label: string; items: Notif[] }[] = []
    for (const n of visible) {
      const label = dayBucket(n.createdAt)
      const g = out[out.length - 1]
      if (g && g.label === label) g.items.push(n); else out.push({ label, items: [n] })
    }
    return out
  }, [visible])

  const loadOlder = useCallback(async () => {
    const last = all[all.length - 1]
    if (!last?.createdAt || loadingMore) return
    setLoadingMore(true)
    try {
      const r = await fetch(`/api/notifications?limit=${PAGE}&before=${encodeURIComponent(last.createdAt)}`)
      const j = await r.json()
      if (j?.success) { setOlder(o => [...o, ...j.data.items]); setHasMore(!!j.data.hasMore) }
    } catch { /* ignore */ } finally { setLoadingMore(false) }
  }, [all, loadingMore])

  // Read state for rows outside the live window is kept here; the context owns the rest.
  const setRead = (ids: string[], read: boolean) => {
    const set = new Set(ids)
    setOlder(o => o.map(n => set.has(n.id) ? { ...n, read } : n))
    markRead(ids, read)
  }
  const readAll = () => { setOlder(o => o.map(n => ({ ...n, read: true }))); markAllRead() }

  const open = (n: Notif) => {
    if (!n.read) setRead([n.id], true)
    notifAction(n, isAdmin)?.()
  }

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: all.length, unread: 0, messages: 0, alerts: 0, deals: 0, updates: 0 }
    for (const n of all) { if (!n.read) c.unread++; c[kindOf(n.type).filter]++ }
    return c
  }, [all])

  // Share of each kind among loaded notifications, for the summary bar.
  const mix = CATEGORIES.map(id => ({ id, n: counts[id], color: colorOf(id), label: FILTERS.find(f => f.id === id)!.label })).filter(m => m.n > 0)
  const activeLabel = FILTERS.find(f => f.id === filter)!.label

  const textBtn: React.CSSProperties = { background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--accent, #FB5E09)' }
  const railTitle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }

  return (
    <div className="rnotif-grid">
      <style>{LAYOUT_CSS}</style>

      {/* ── Feed ─────────────────────────────────────────────────────────── */}
      <div className="rnotif-feed">
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${C.ash}` }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: C.ink, letterSpacing: '-0.02em' }}>
              {filter === 'all' ? 'All notifications' : activeLabel}
              <span style={{ fontSize: 13, fontWeight: 500, color: C.stone, fontFamily: MONO, marginLeft: 8 }}>{visible.length}</span>
            </h2>
            <span style={{ fontSize: 12.5, color: C.stone }}>Newest first</span>
          </div>

          {!ready && all.length === 0 ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', gap: 14 }}>
                  <Shimmer h={38} w={38} r={11} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Shimmer h={14} w="45%" /><Shimmer h={12} w="85%" /><Shimmer h={10} w="20%" />
                  </div>
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState icon={ICON.check}
              title={filter === 'unread' ? 'No unread notifications' : filter === 'all' ? 'No notifications yet' : 'Nothing here yet'}
              sub={filter === 'all' ? 'Support replies, keyword alerts, deals and updates from Rankkw will show up here.' : 'You are all caught up.'} />
          ) : groups.map(g => (
            <section key={g.label}>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '12px 20px 8px', background: C.canvas, borderBottom: `1px solid ${C.hair}` }}>{g.label}</p>
              {g.items.map(n => {
                const kind = kindOf(n.type)
                const act = notifAction(n, isAdmin)
                const focused = focusId === n.id
                return (
                  <div key={n.id} data-notif-id={n.id}
                    style={{
                      position: 'relative', display: 'flex', gap: 14, padding: '16px 20px', borderBottom: `1px solid ${C.hair}`,
                      background: focused ? withAlpha(C.orange, 0.16) : n.read ? C.paper : C.orangeFaint,
                      transition: 'background 0.6s',
                    }}>
                    {!n.read && <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: C.orange }} />}
                    <KindIcon type={n.type} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
                        <p style={{ fontSize: 15, fontWeight: n.read ? 500 : 650, color: C.ink, letterSpacing: '-0.01em', minWidth: 0 }}>{n.title}</p>
                        <span title={fullDate(n.createdAt)} style={{ fontSize: 12, color: C.stone, fontFamily: MONO, whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}>{relTime(n.createdAt)}</span>
                      </div>
                      {n.body && (
                        <p style={{ fontSize: 14, color: C.graphite, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 760 }}>{n.body}</p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: kind.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kind.label}</span>
                        {act && (
                          <button type="button" onClick={() => open(n)} style={textBtn}>
                            {n.link ? 'Open' : 'Open in chat'}
                          </button>
                        )}
                        <button type="button" onClick={() => setRead([n.id], !n.read)} style={{ ...textBtn, color: C.graphite, fontWeight: 500 }}>
                          {n.read ? 'Mark as unread' : 'Mark as read'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </section>
          ))}
        </Card>

        {hasMore && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={loadOlder} disabled={loadingMore}
              style={{ padding: '10px 22px', borderRadius: 999, border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, fontSize: 13.5, fontWeight: 600, cursor: loadingMore ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {loadingMore ? 'Loading…' : 'Load older notifications'}
            </button>
          </div>
        )}
      </div>

      {/* ── Right rail ───────────────────────────────────────────────────── */}
      <aside className="rnotif-rail">
        <Card pad={20}>
          <p style={railTitle}>Summary</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 34, fontWeight: 650, color: C.ink, letterSpacing: '-0.03em', lineHeight: 1, fontFamily: MONO }}>{notifUnread}</span>
            <span style={{ fontSize: 14, color: C.graphite }}>unread</span>
          </div>
          <p style={{ fontSize: 13, color: C.stone, marginTop: 6 }}>{all.length}{hasMore ? '+' : ''} in the last 30 days</p>
          {mix.length > 0 && (
            <>
              <div aria-hidden style={{ display: 'flex', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 14 }}>
                {mix.map(m => <span key={m.id} style={{ flex: m.n, background: m.color }} />)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 10 }}>
                {mix.map(m => (
                  <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.graphite }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color }} />
                    {m.label}
                    <span style={{ fontFamily: MONO, color: C.stone }}>{m.n}</span>
                  </span>
                ))}
              </div>
            </>
          )}
          <button onClick={readAll} disabled={notifUnread === 0}
            style={{
              marginTop: 16, width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
              background: notifUnread === 0 ? C.canvas : 'var(--accent, #FB5E09)', color: notifUnread === 0 ? C.stone : '#fff', cursor: notifUnread === 0 ? 'default' : 'pointer',
            }}>
            {notifUnread === 0 ? 'All caught up' : 'Mark all as read'}
          </button>
        </Card>

        <Card pad={12}>
          <p style={{ ...railTitle, padding: '6px 8px 0' }}>Show</p>
          <div role="tablist" aria-label="Filter notifications" className="rnotif-filters">
            {FILTERS.map(f => {
              // Unread shows the server's true total; the rest count what's loaded.
              const n = f.id === 'unread' ? notifUnread : counts[f.id]
              const active = filter === f.id
              const dot = CATEGORIES.includes(f.id) ? colorOf(f.id) : null
              return (
                <button key={f.id} role="tab" aria-selected={active} onClick={() => setFilter(f.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, border: 'none', whiteSpace: 'nowrap', flexShrink: 0,
                    fontFamily: 'inherit', fontSize: 14, fontWeight: active ? 600 : 500, textAlign: 'left', cursor: 'pointer',
                    background: active ? 'var(--accent-soft, rgba(251,94,9,0.12))' : 'transparent', color: active ? C.ink : C.inkSoft,
                  }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: dot ?? 'transparent', flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{f.label}</span>
                  <span style={{ fontSize: 12, fontFamily: MONO, color: active ? C.ink : C.stone, marginLeft: 8 }}>{n}</span>
                </button>
              )
            })}
          </div>
        </Card>

        <Card pad={20} style={{ background: C.canvas }}>
          <div className="rnotif-help" style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 4 }}>{isAdmin ? 'Replying to users?' : 'Need a hand?'}</p>
            <p style={{ fontSize: 13, color: C.graphite, lineHeight: 1.55, marginBottom: 10 }}>
              {isAdmin ? 'Support conversations are answered from the Admin panel, under Messages.' : 'Our team usually replies within a day, and replies show up right here.'}
            </p>
            {isAdmin
              ? <Link href="/admin" style={{ ...textBtn, textDecoration: 'none' }}>Open Admin messages</Link>
              : <button type="button" onClick={() => window.dispatchEvent(new Event('rk-open-chat'))} style={textBtn}>Chat with support</button>}
          </div>
          <p style={{ fontSize: 12, color: C.stone, lineHeight: 1.5 }}>Notifications are kept for 30 days.</p>
        </Card>
      </aside>
    </div>
  )
}
