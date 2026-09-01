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

interface Notif { id: string; type: string; title: string; body: string | null; link: string | null; createdAt: string | null; read: boolean }
interface ChatMsg { id: string; userId: string; sender: 'user' | 'admin'; body: string; createdAt: string | null }

interface RealtimeCtx {
  isAdmin: boolean
  notifUnread: number
  notifications: Notif[]
  loadNotifications: () => void
  markAllRead: () => void
  chatUnread: number
  chatMessages: ChatMsg[]
  loadChat: () => void
  sendChat: (body: string) => Promise<void>
}
const Ctx = createContext<RealtimeCtx | null>(null)
export const useRealtime = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useRealtime must be used inside RealtimeProvider')
  return c
}

function relTime(d: string | null): string {
  if (!d) return ''
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
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
        setNotifications(list => list.some(x => x.id === n.id) ? list : [{ ...n, read: false }, ...list].slice(0, 50))
      })
      es.addEventListener('notif-count', e => setNotifUnread(JSON.parse((e as MessageEvent).data).unread))
      es.addEventListener('chat', e => {
        if (adminRef.current) return
        const m = JSON.parse((e as MessageEvent).data)
        setChatMessages(list => list.some(x => x.id === m.id) ? list : [...list, m])
      })
      es.addEventListener('chat-count', e => { if (!adminRef.current) setChatUnread(JSON.parse((e as MessageEvent).data).unread) })
      es.onerror = () => { es?.close(); if (!stopped) setTimeout(connect, 4000) }
    }
    connect()
    return () => { stopped = true; es?.close() }
  }, [isAdmin])

  return (
    <Ctx.Provider value={{ isAdmin: effAdmin, notifUnread, notifications, loadNotifications, markAllRead, chatUnread, chatMessages, loadChat, sendChat }}>
      {children}
    </Ctx.Provider>
  )
}

// ─── Notification bell (top bar) ────────────────────────────────────────────────
export function NotificationBell() {
  const { notifUnread, notifications, loadNotifications, markAllRead } = useRealtime()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    loadNotifications()
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, loadNotifications])

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
        <div style={{ position: 'absolute', right: 0, top: 44, width: 340, maxHeight: 440, overflowY: 'auto', background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 14, boxShadow: '0 18px 50px rgba(20,18,14,0.22)', zIndex: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: `1px solid ${C.ash}`, position: 'sticky', top: 0, background: C.paper }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Notifications</span>
            {notifUnread > 0 && <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: C.orange, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Mark all read</button>}
          </div>
          {notifications.length === 0 ? (
            <p style={{ fontSize: 13, color: C.graphite, padding: '26px 16px', textAlign: 'center' }}>You are all caught up.</p>
          ) : notifications.map(n => {
            const inner = (
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.hair}`, background: n.read ? 'transparent' : C.orangeFaint, display: 'flex', gap: 10 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: n.read ? C.ash : C.orange, marginTop: 6, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, marginBottom: 2 }}>{n.title}</p>
                  {n.body && <p style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.5 }}>{n.body}</p>}
                  <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, marginTop: 4 }}>{relTime(n.createdAt)}</p>
                </div>
              </div>
            )
            return n.link
              ? <a key={n.id} href={n.link} style={{ textDecoration: 'none', display: 'block' }}>{inner}</a>
              : <div key={n.id}>{inner}</div>
          })}
        </div>
      )}
    </div>
  )
}

// ─── Support chat widget (floating, users only) ─────────────────────────────────
export function ChatWidget() {
  const { isAdmin, chatUnread, chatMessages, loadChat, sendChat } = useRealtime()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (open) loadChat() }, [open, loadChat])
  useEffect(() => { if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [chatMessages, open])

  if (isAdmin) return null

  const submit = async () => {
    const b = text.trim()
    if (!b || sending) return
    setSending(true); setText('')
    try { await sendChat(b) } finally { setSending(false) }
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
                <div style={{ padding: '9px 13px', borderRadius: 13, fontSize: 13.5, lineHeight: 1.5, background: m.sender === 'user' ? C.orange : C.canvas, color: m.sender === 'user' ? '#fff' : C.ink, border: m.sender === 'user' ? 'none' : `1px solid ${C.ash}`, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
                <p style={{ fontSize: 10.5, color: C.stone, fontFamily: MONO, marginTop: 3, textAlign: m.sender === 'user' ? 'right' : 'left' }}>{relTime(m.createdAt)}</p>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.ash}`, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
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
