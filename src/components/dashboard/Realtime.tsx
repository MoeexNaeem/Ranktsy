'use client'
/**
 * Realtime layer for the dashboard: one SSE connection (/api/realtime/stream) feeds
 * live notifications and support-chat messages to the whole dashboard. The provider
 * owns the connection and state; NotificationBell and ChatWidget consume it.
 *
 * Admins manage chat in /admin, so for them the chat widget is hidden and chat events
 * are ignored here (their SSE chat branch is scoped to all users, not one thread).
 */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { C } from '@/utils'
import { MONO } from './kit'
import { pushToast, errorToast } from '@/components/ui/toast'
import { validateUpload, CHAT_ACCEPT } from '@/lib/chat-upload-constants'
import { ChatAttachmentView } from '@/components/ui/ChatAttachmentView'

/** Announcements from Rankkw render blue, so they read as news, not a 1:1 reply. */
const ANNOUNCE_BLUE = '#2563EB'

export interface Notif { id: string; type: string; title: string; body: string | null; link: string | null; createdAt: string | null; read: boolean }
interface ChatMsg {
  id: string; userId: string; sender: 'user' | 'admin'; body: string; createdAt: string | null; editedAt?: string | null
  // Set when this came from an admin announcement rather than a personal reply.
  broadcast?: 'all' | 'sebt' | null
  attachmentUrl?: string | null; attachmentName?: string | null; attachmentType?: string | null
  attachmentSize?: number | null; attachmentKind?: 'image' | 'file' | null
}

interface RealtimeCtx {
  isAdmin: boolean
  notifUnread: number
  notifications: Notif[]
  loadNotifications: () => void
  markAllRead: () => void
  /** Mark specific notifications read (default) or unread. */
  markRead: (ids: string[], read?: boolean) => void
  chatUnread: number
  chatMessages: ChatMsg[]
  loadChat: () => void
  sendChat: (body: string) => Promise<void>
  uploadChat: (file: File) => Promise<{ ok: boolean; error?: string }>
}
const Ctx = createContext<RealtimeCtx | null>(null)
export const useRealtime = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useRealtime must be used inside RealtimeProvider')
  return c
}

export function relTime(d: string | null): string {
  if (!d) return ''
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

/** Open a notification's link. Dashboard tab links switch tabs in place (no reload). */
export function openNotifLink(link: string) {
  const m = /^\/dashboard\?tab=([\w-]+)$/.exec(link)
  if (m && window.location.pathname === '/dashboard') {
    window.dispatchEvent(new CustomEvent('rk-open-tab', { detail: m[1] }))
    return
  }
  window.location.assign(link)
}

export function RealtimeProvider({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  const [notifUnread, setNotifUnread] = useState(0)
  const [notifications, setNotifications] = useState<Notif[]>([])
  const [chatUnread, setChatUnread] = useState(0)
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  // Effective admin comes from the server's SSE init (authoritative, covers ADMIN_EMAILS
  // accounts whose JWT role may still read 'user'); the prop is just the initial guess.
  const [effAdmin, setEffAdmin] = useState(isAdmin)
  const adminRef = useRef(isAdmin)
  // Ids we've already shown a toast for, so a reconnect/replay never double-toasts.
  const toastedRef = useRef<Set<string>>(new Set())
  // Latest list, for callbacks that need it without re-creating themselves.
  const notifsRef = useRef<Notif[]>([])
  useEffect(() => { notifsRef.current = notifications }, [notifications])

  const loadNotifications = useCallback(async () => {
    try {
      const r = await fetch('/api/notifications')
      const j = await r.json()
      if (j?.success) { setNotifications(j.data.items); setNotifUnread(j.data.unread) }
    } catch { /* ignore */ }
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications(ns => ns.map(n => ({ ...n, read: true }))); setNotifUnread(0)
    try { await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }) } catch { /* ignore */ }
  }, [])

  const markRead = useCallback(async (ids: string[], read = true) => {
    if (!ids.length) return
    const set = new Set(ids)
    // Adjust the badge optimistically, only for loaded rows whose state actually flips;
    // the server's count below is the source of truth (it also covers older pages).
    const flips = notifsRef.current.filter(n => set.has(n.id) && n.read !== read).length
    if (flips) setNotifUnread(u => Math.max(0, u + (read ? -flips : flips)))
    setNotifications(ns => ns.map(n => set.has(n.id) ? { ...n, read } : n))
    try {
      const r = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, unread: !read }) })
      const j = await r.json()
      if (j?.success) setNotifUnread(j.data.unread)
    } catch { /* ignore */ }
  }, [])

  const loadChat = useCallback(async () => {
    try {
      const r = await fetch('/api/chat')
      const j = await r.json()
      if (j?.success) { setChatMessages(j.data.messages); setChatUnread(0) }
    } catch { /* ignore */ }
  }, [])

  const sendChat = useCallback(async (body: string) => {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) })
    const j = await r.json().catch(() => null)
    if (j?.success) setChatMessages(m => [...m, j.data.message])
    else throw new Error(j?.error || 'Message not sent. Please try again.')
  }, [])

  const uploadChat = useCallback(async (file: File): Promise<{ ok: boolean; error?: string }> => {
    const fd = new FormData(); fd.append('file', file)
    const r = await fetch('/api/chat/upload', { method: 'POST', body: fd })
    const j = await r.json().catch(() => null)
    if (r.ok && j?.success) { setChatMessages(m => [...m, j.data.message]); return { ok: true } }
    return { ok: false, error: j?.error || 'Upload failed. Please try again.' }
  }, [])

  // loadNotifications setStates only after its fetch resolves (async), so this is not a
  // synchronous setState-in-effect despite the lint heuristic.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadNotifications() }, [loadNotifications])

  // Single SSE connection, with auto-reconnect (also covers the server's 5-min recycle).
  useEffect(() => {
    let es: EventSource | null = null
    let stopped = false
    const connect = () => {
      if (stopped) return
      es = new EventSource('/api/realtime/stream')
      es.addEventListener('init', e => {
        const d = JSON.parse((e as MessageEvent).data)
        adminRef.current = !!d.admin; setEffAdmin(!!d.admin)
        setNotifUnread(d.notifUnread); if (!d.admin) setChatUnread(d.chatUnread)
      })
      es.addEventListener('notification', e => {
        const n = JSON.parse((e as MessageEvent).data)
        // Pop a clickable toast for a genuinely new notification (admin broadcast,
        // alert, etc.). Clicking follows its link; the bell still lists it.
        if (!toastedRef.current.has(n.id)) {
          toastedRef.current.add(n.id)
          // Bodies are stored in full; the toast only needs a short preview.
          const body = n.body && n.body.length > 140 ? `${n.body.slice(0, 140)}…` : n.body
          pushToast({ title: n.title, body, link: n.link, kind: n.type === 'success' ? 'success' : 'info' })
        }
        setNotifications(list => list.some(x => x.id === n.id) ? list : [{ ...n, read: false }, ...list].slice(0, 50))
      })
      es.addEventListener('notif-count', e => setNotifUnread(JSON.parse((e as MessageEvent).data).unread))
      es.addEventListener('chat', e => {
        if (adminRef.current) return
        const m = JSON.parse((e as MessageEvent).data)
        // An admin reply arriving live → toast it; clicking opens the chat widget.
        if (m.sender === 'admin' && !toastedRef.current.has(`chat:${m.id}`)) {
          toastedRef.current.add(`chat:${m.id}`)
          const preview = m.body || (m.attachmentName ? `📎 ${m.attachmentName}` : 'Sent an attachment')
          pushToast({ title: m.broadcast ? 'Message from Rankkw' : 'New reply from support', body: preview, kind: 'info', onClick: () => window.dispatchEvent(new Event('rk-open-chat')) })
        }
        setChatMessages(list => list.some(x => x.id === m.id) ? list : [...list, m])
      })
      es.addEventListener('chat-count', e => { if (!adminRef.current) setChatUnread(JSON.parse((e as MessageEvent).data).unread) })
      es.onerror = () => { es?.close(); if (!stopped) setTimeout(connect, 4000) }
    }
    connect()
    return () => { stopped = true; es?.close() }
  }, [isAdmin])

  return (
    <Ctx.Provider value={{ isAdmin: effAdmin, notifUnread, notifications, loadNotifications, markAllRead, markRead, chatUnread, chatMessages, loadChat, sendChat, uploadChat }}>
      {children}
    </Ctx.Provider>
  )
}

// ─── Notification bell (top bar) ────────────────────────────────────────────────
/** Unread count pill for the sidebar's Notifications item (hidden at zero). */
export function NotifNavBadge() {
  const { notifUnread } = useRealtime()
  if (notifUnread <= 0) return null
  return (
    <span className="rlabel" style={{ marginLeft: 'auto', minWidth: 20, height: 20, padding: '0 6px', borderRadius: 100, background: C.orange, color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: MONO, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {notifUnread > 99 ? '99+' : notifUnread}
    </span>
  )
}

/** How many recent notifications the bell previews; the full list lives on its own page. */
const BELL_PREVIEW = 8

/** Id the Notifications page should scroll to and highlight when it opens. */
let pendingFocusId: string | null = null
export function takePendingNotifFocus(): string | null {
  const id = pendingFocusId
  pendingFocusId = null
  return id
}

/** Open the full Notifications page (a dashboard tab), optionally focused on one item. */
export function openNotificationsPage(focusId?: string) {
  pendingFocusId = focusId ?? null
  window.dispatchEvent(new CustomEvent('rk-open-tab', { detail: 'notifications' }))
  window.dispatchEvent(new Event('rk-notif-focus'))
}

/**
 * What a click on a notification does, shared by the bell and the page: follow its link,
 * open the support chat for replies/announcements, or null when there is nowhere to go.
 */
export function notifAction(n: Notif, isAdmin: boolean): (() => void) | null {
  if (n.link) { const link = n.link; return () => openNotifLink(link) }
  if (n.type === 'chat' && !isAdmin) return () => window.dispatchEvent(new Event('rk-open-chat'))
  return null
}

export function NotificationBell() {
  const { isAdmin, notifUnread, notifications, loadNotifications, markAllRead, markRead } = useRealtime()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    loadNotifications()
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, loadNotifications])

  // Clicking an item marks it read, then follows it. Items with nowhere to go open
  // the full page on that item, so a long message can always be read in full.
  const onItem = (n: Notif) => {
    setOpen(false)
    if (!n.read) markRead([n.id])
    const act = notifAction(n, isAdmin)
    if (act) act(); else openNotificationsPage(n.id)
  }

  const preview = notifications.slice(0, BELL_PREVIEW)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} title="Notifications" aria-label="Notifications" className="rdash-badge"
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', background: C.paper, border: `1px solid ${C.ash}`, color: C.graphite, cursor: 'pointer', flexShrink: 0 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        {notifUnread > 0 && (
          <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 100, background: C.orange, color: '#fff', fontSize: 10, fontWeight: 700, fontFamily: MONO, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${C.paper}` }}>{notifUnread > 99 ? '99+' : notifUnread}</span>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 44, width: 'min(360px, 92vw)', background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 14, boxShadow: '0 18px 50px rgba(20,18,14,0.22)', zIndex: 50, display: 'flex', flexDirection: 'column', maxHeight: 480, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: `1px solid ${C.ash}` }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Notifications</span>
            {notifUnread > 0 && <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: C.orange, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Mark all read</button>}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {preview.length === 0 ? (
              <p style={{ fontSize: 13, color: C.graphite, padding: '26px 16px', textAlign: 'center' }}>You are all caught up.</p>
            ) : preview.map(n => (
              <button key={n.id} type="button" onClick={() => onItem(n)}
                style={{ width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', border: 'none', borderBottom: `1px solid ${C.hair}`, padding: '12px 16px', background: n.read ? 'transparent' : C.orangeFaint, display: 'flex', gap: 10 }}
                onMouseEnter={e => { if (n.read) e.currentTarget.style.background = C.canvas }}
                onMouseLeave={e => { if (n.read) e.currentTarget.style.background = 'transparent' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: n.read ? C.ash : C.orange, marginTop: 6, flexShrink: 0 }} />
                <span style={{ minWidth: 0, flex: 1, display: 'block' }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: C.ink, marginBottom: 2 }}>{n.title}</span>
                  {n.body && (
                    <span style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.5, wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.body}</span>
                  )}
                  <span style={{ display: 'block', fontSize: 11, color: C.stone, fontFamily: MONO, marginTop: 4 }}>{relTime(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => { setOpen(false); openNotificationsPage() }}
            style={{ border: 'none', borderTop: `1px solid ${C.ash}`, background: C.paper, padding: '12px 16px', fontSize: 13, fontWeight: 600, color: C.orange, cursor: 'pointer', fontFamily: 'inherit' }}>
            View all notifications
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Support chat widget (floating, users only) ─────────────────────────────────
export function ChatWidget() {
  const { isAdmin, chatUnread, chatMessages, loadChat, sendChat, uploadChat } = useRealtime()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''   // allow re-picking the same file
    if (!file) return
    // Validate BEFORE uploading; the error only appears now, as a toast, if the file is bad.
    const check = validateUpload(file.type, file.size)
    if (!check.ok) { errorToast('Can’t attach that file', check.error); return }
    setSending(true)
    try {
      const res = await uploadChat(file)
      if (!res.ok) errorToast('Upload failed', res.error)
    } finally { setSending(false) }
  }

  // While open, refresh periodically so support edits/deletes show up without reopening.
  useEffect(() => {
    if (!open) return
    loadChat()
    const t = setInterval(loadChat, 10_000)
    return () => clearInterval(t)
  }, [open, loadChat])
  useEffect(() => { if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [chatMessages, open])
  // Clicking a "new reply" toast opens this widget.
  useEffect(() => {
    const openChat = () => setOpen(true)
    window.addEventListener('rk-open-chat', openChat)
    return () => window.removeEventListener('rk-open-chat', openChat)
  }, [])

  if (isAdmin) return null

  const submit = async () => {
    const b = text.trim()
    if (!b || sending) return
    setSending(true); setText('')
    try { await sendChat(b) }
    catch (e) { setText(b); errorToast('Message not sent', e instanceof Error ? e.message : 'Please try again.') }
    finally { setSending(false) }
  }

  return (
    <>
      {open && (
        <div style={{ position: 'fixed', right: 24, bottom: 92, width: 'min(360px, 92vw)', height: 460, background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 16, boxShadow: '0 24px 60px rgba(20,18,14,0.28)', zIndex: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '15px 18px', borderBottom: `1px solid ${C.ash}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>Support chat</p>
              <p style={{ fontSize: 12, color: C.graphite }}>We usually reply within a day.</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" style={{ background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, color: C.ink, lineHeight: 1 }}>×</button>
          </div>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {chatMessages.length === 0 && <p style={{ fontSize: 13, color: C.graphite, textAlign: 'center', margin: 'auto 0' }}>Send us a message and we will get back to you here.</p>}
            {chatMessages.map(m => (
              <div key={m.id} style={{ alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                {m.broadcast && (
                  <p style={{ fontSize: 10, fontWeight: 700, fontFamily: MONO, color: ANNOUNCE_BLUE, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 3px' }}>
                    Announcement
                  </p>
                )}
                <div style={{ padding: m.attachmentKind === 'image' ? 5 : '9px 13px', borderRadius: 13, fontSize: 13.5, lineHeight: 1.5, background: m.sender === 'user' ? C.orange : m.broadcast ? ANNOUNCE_BLUE : C.canvas, color: m.sender === 'user' || m.broadcast ? '#fff' : C.ink, border: m.sender === 'user' || m.broadcast ? 'none' : `1px solid ${C.ash}`, whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {m.attachmentUrl && m.attachmentKind && (
                    <ChatAttachmentView url={m.attachmentUrl} name={m.attachmentName || 'file'} kind={m.attachmentKind} size={m.attachmentSize} />
                  )}
                  {m.body && <span style={{ padding: m.attachmentKind === 'image' ? '2px 8px 4px' : 0 }}>{m.body}</span>}
                </div>
                <p style={{ fontSize: 10.5, color: C.stone, fontFamily: MONO, marginTop: 3, textAlign: m.sender === 'user' ? 'right' : 'left' }}>{m.editedAt ? 'edited · ' : ''}{relTime(m.createdAt)}</p>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.ash}`, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <input ref={fileRef} type="file" accept={CHAT_ACCEPT} onChange={onPickFile} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()} disabled={sending} aria-label="Attach a file" title="Attach an image or document"
              style={{ background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 10, width: 40, height: 40, cursor: sending ? 'default' : 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: C.graphite }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
              placeholder="Write a message…" rows={1} maxLength={4000}
              style={{ flex: 1, resize: 'none', border: `1px solid ${C.ash}`, borderRadius: 10, background: C.canvas, color: C.ink, fontSize: 13.5, fontFamily: 'inherit', padding: '9px 12px', outline: 'none', maxHeight: 100 }} />
            <button onClick={submit} disabled={!text.trim() || sending} aria-label="Send" style={{ background: !text.trim() || sending ? C.ash : C.orange, color: '#fff', border: 'none', borderRadius: 10, width: 40, height: 40, cursor: !text.trim() || sending ? 'default' : 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} aria-label="Support chat" title="Support chat"
        style={{ position: 'fixed', right: 24, bottom: 24, width: 54, height: 54, borderRadius: '50%', background: C.orange, color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 10px 30px rgba(251,94,9,0.4)', zIndex: 200, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        {chatUnread > 0 && <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 100, background: C.ink, color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: MONO, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${C.paper}` }}>{chatUnread > 99 ? '99+' : chatUnread}</span>}
      </button>
    </>
  )
}
