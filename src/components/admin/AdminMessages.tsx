'use client'
/**
 * Admin messaging: reply to per-user support threads (polled for near-realtime), and a
 * composer to broadcast a notification to everyone or a single user. The user side rides
 * the SSE stream, so a reply or broadcast reaches them live.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { C } from '@/utils'
import { MONO, SectionTitle, cardStyle, EmptyState } from '@/components/dashboard/kit'

interface Thread { userId: string; name: string; email: string; lastBody: string; lastSender: 'user' | 'admin'; lastAt: string | null; count: number; unread: number }
interface Msg { id: string; userId: string; sender: 'user' | 'admin'; body: string; createdAt: string | null; readByUser?: boolean }

const rel = (d: string | null) => {
  if (!d) return ''
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
const exactTime = (d: string | null) => (d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')
const initials = (name: string, email = '') => {
  const base = (name || email || '?').trim()
  const parts = base.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || base[0]?.toUpperCase() || '?'
}
// Deterministic soft avatar colour from the user id, so each person is recognisable.
const AV_COLORS = ['#E8590C', '#2563EB', '#0D9488', '#7C3AED', '#B4690E', '#1F7A44', '#C0392B', '#0EA5E9']
const avatarColor = (seed: string) => AV_COLORS[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length]

function Avatar({ name, email, seed, size = 38 }: { name: string; email?: string; seed: string; size?: number }) {
  return (
    <span style={{ width: size, height: size, flexShrink: 0, borderRadius: '50%', background: avatarColor(seed), color: '#fff', display: 'grid', placeItems: 'center', fontSize: size * 0.4, fontWeight: 600, fontFamily: 'inherit' }}>
      {initials(name, email)}
    </span>
  )
}

export function AdminMessages() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [selName, setSelName] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Broadcast composer
  const [bTitle, setBTitle] = useState('')
  const [bBody, setBBody] = useState('')
  const [bLink, setBLink] = useState('')
  const [bTarget, setBTarget] = useState('')
  const [bBusy, setBBusy] = useState(false)
  const [bMsg, setBMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const loadThreads = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/chat')
      const j = await r.json()
      if (j?.success) setThreads(j.data.threads)
    } catch { /* ignore */ }
  }, [])

  const openThread = useCallback(async (userId: string, name: string) => {
    setSel(userId); setSelName(name); setMessages([])
    try {
      const r = await fetch(`/api/admin/chat/${userId}`)
      const j = await r.json()
      if (j?.success) { setMessages(j.data.messages); if (j.data.user?.name) setSelName(j.data.user.name) }
    } catch { /* ignore */ }
    loadThreads()
  }, [loadThreads])

  const sendReply = useCallback(async () => {
    const b = reply.trim()
    if (!b || !sel || sending) return
    setSending(true); setReply('')
    try {
      const r = await fetch(`/api/admin/chat/${sel}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: b }) })
      const j = await r.json()
      if (j?.success) { setMessages(m => [...m, j.data.message]); loadThreads() }
    } finally { setSending(false) }
  }, [reply, sel, sending, loadThreads])

  const deleteThread = useCallback(async () => {
    if (!sel) return
    if (!window.confirm('Delete this entire conversation? This cannot be undone.')) return
    const id = sel
    try {
      await fetch(`/api/admin/chat/${id}`, { method: 'DELETE' })
      setThreads(ts => ts.filter(t => t.userId !== id))
      setSel(null); setMessages([])
    } catch { /* ignore */ }
  }, [sel])

  const sendBroadcast = useCallback(async () => {
    if (!bTitle.trim() || bBusy) return
    setBBusy(true); setBMsg(null)
    const audience = bTarget.trim() ? 'user' : 'all'
    try {
      const r = await fetch('/api/admin/notifications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bTitle.trim(), body: bBody.trim(), link: bLink.trim() || undefined, audience, email: bTarget.trim() || undefined }),
      })
      const j = await r.json()
      if (r.ok && j?.success) { setBMsg({ ok: true, text: audience === 'all' ? 'Sent to everyone.' : `Sent to ${bTarget.trim()}.` }); setBTitle(''); setBBody(''); setBLink(''); setBTarget('') }
      else setBMsg({ ok: false, text: j?.error || 'Could not send.' })
    } catch { setBMsg({ ok: false, text: 'Network error.' }) }
    finally { setBBusy(false) }
  }, [bTitle, bBody, bLink, bTarget, bBusy])

  useEffect(() => {
    // loadThreads setStates only after its fetch resolves (async), not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadThreads()
    const t = setInterval(loadThreads, 5000)
    return () => clearInterval(t)
  }, [loadThreads])

  // Poll the open thread for new user messages.
  useEffect(() => {
    if (!sel) return
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/admin/chat/${sel}`)
        const j = await r.json()
        if (j?.success) setMessages(j.data.messages)
      } catch { /* ignore */ }
    }, 5000)
    return () => clearInterval(t)
  }, [sel])

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [messages])

  const q = search.trim().toLowerCase()
  const filtered = q ? threads.filter(t => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)) : threads
  const selThread = threads.find(t => t.userId === sel)
  const selEmail = selThread?.email ?? ''
  const totalUnread = threads.reduce((n, t) => n + (t.unread || 0), 0)
  // Index of the LAST admin message, so we show the read receipt only under it.
  let lastAdminIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) { if (messages[i].sender === 'admin') { lastAdminIdx = i; break } }

  const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.ash}`, borderRadius: 9, background: C.canvas, color: C.ink, fontSize: 13.5, fontFamily: 'inherit', padding: '9px 12px', outline: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Broadcast composer */}
      <div style={{ ...cardStyle, padding: '20px 22px' }}>
        <SectionTitle>Send a notification</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={bTitle} onChange={e => setBTitle(e.target.value)} maxLength={160} placeholder="Title (e.g. New feature: Bulk keywords)" style={field} />
          <textarea value={bBody} onChange={e => setBBody(e.target.value)} rows={2} placeholder="Optional message" style={{ ...field, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input value={bLink} onChange={e => setBLink(e.target.value)} placeholder="Optional link (e.g. /deals/summer)" style={{ ...field, flex: 1, minWidth: 200 }} />
            <input value={bTarget} onChange={e => setBTarget(e.target.value)} placeholder="One user's email (blank = everyone)" style={{ ...field, flex: 1, minWidth: 200 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={sendBroadcast} disabled={bBusy || !bTitle.trim()} style={{ background: bBusy || !bTitle.trim() ? C.ash : C.orange, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: bBusy || !bTitle.trim() ? 'default' : 'pointer' }}>
              {bBusy ? 'Sending…' : bTarget.trim() ? 'Send to user' : 'Broadcast to all'}
            </button>
            {bMsg && <span style={{ fontSize: 12.5, color: bMsg.ok ? C.orange : C.danger }}>{bMsg.text}</span>}
          </div>
        </div>
      </div>

      {/* Chat threads + conversation */}
      <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', maxHeight: 620, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${C.ash}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Conversations</span>
              {totalUnread > 0 && <span style={{ background: C.orange, color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: MONO, borderRadius: 100, padding: '2px 9px' }}>{totalUnread} new</span>}
            </div>
            <div style={{ position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.stone} strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…"
                style={{ ...field, padding: '8px 12px 8px 32px', fontSize: 13 }} />
            </div>
          </div>
          <div style={{ overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <p style={{ fontSize: 13, color: C.graphite, padding: '22px 18px' }}>{threads.length === 0 ? 'No messages from users yet.' : 'No conversations match your search.'}</p>
            ) : filtered.map(t => (
              <button key={t.userId} onClick={() => openThread(t.userId, t.name)}
                style={{ display: 'flex', gap: 11, alignItems: 'center', width: '100%', textAlign: 'left', padding: '12px 16px', border: 'none', borderBottom: `1px solid ${C.hair}`, cursor: 'pointer', background: sel === t.userId ? C.orangeFaint : 'transparent', fontFamily: 'inherit' }}>
                <Avatar name={t.name} email={t.email} seed={t.userId} size={40} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: t.unread > 0 ? 700 : 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                    <span style={{ fontSize: 10.5, color: C.stone, fontFamily: MONO, flexShrink: 0 }}>{rel(t.lastAt)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginTop: 2 }}>
                    <p style={{ fontSize: 12.5, color: t.unread > 0 ? C.ink : C.graphite, fontWeight: t.unread > 0 ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{t.lastSender === 'admin' ? 'You: ' : ''}{t.lastBody}</p>
                    {t.unread > 0 && <span style={{ background: C.orange, color: '#fff', fontSize: 10, fontWeight: 700, fontFamily: MONO, borderRadius: 100, minWidth: 18, textAlign: 'center', padding: '1px 6px', flexShrink: 0 }}>{t.unread}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 0, height: 620, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!sel ? (
            <div style={{ margin: 'auto' }}><EmptyState icon="💬" title="Select a conversation" sub="Pick a user on the left to read and reply to their messages." /></div>
          ) : (
            <>
              <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.ash}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  <Avatar name={selName} email={selEmail} seed={sel} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selName}</div>
                    {selEmail && <a href={`mailto:${selEmail}`} style={{ fontSize: 12, color: C.graphite, fontFamily: MONO, textDecoration: 'none' }}>{selEmail}</a>}
                  </div>
                </div>
                <button onClick={deleteThread} title="Delete this conversation"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, background: C.dangerBg, border: `1px solid ${C.danger}`, color: C.danger, borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Delete
                </button>
              </div>
              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 12, background: C.snow }}>
                {messages.map((m, i) => (
                  <div key={m.id} style={{ alignSelf: m.sender === 'admin' ? 'flex-end' : 'flex-start', maxWidth: '76%' }}>
                    <div style={{ padding: '10px 14px', borderRadius: m.sender === 'admin' ? '16px 16px 5px 16px' : '16px 16px 16px 5px', fontSize: 13.5, lineHeight: 1.5, background: m.sender === 'admin' ? C.orange : C.canvas, color: m.sender === 'admin' ? '#fff' : C.ink, border: m.sender === 'admin' ? 'none' : `1px solid ${C.hair}`, whiteSpace: 'pre-wrap', wordBreak: 'break-word', boxShadow: m.sender === 'admin' ? '0 2px 6px rgba(251,94,9,0.22)' : '0 1px 2px rgba(61,62,59,0.05)' }}>{m.body}</div>
                    <p title={exactTime(m.createdAt)} style={{ fontSize: 10.5, color: C.stone, fontFamily: MONO, marginTop: 3, textAlign: m.sender === 'admin' ? 'right' : 'left', cursor: 'default' }}>
                      {rel(m.createdAt)}
                      {m.sender === 'admin' && i === lastAdminIdx && (
                        <span style={{ marginLeft: 6, color: m.readByUser ? '#1F7A44' : C.stone, fontWeight: 600 }}>{m.readByUser ? '✓✓ Seen' : '✓ Sent'}</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.hair}`, display: 'flex', gap: 9, alignItems: 'flex-end', background: C.paper }}>
                <textarea value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                  placeholder="Write a reply…  (Enter to send, Shift+Enter for a new line)" rows={1} maxLength={4000}
                  style={{ flex: 1, resize: 'none', border: `1px solid ${C.hair}`, borderRadius: 22, background: C.snow, color: C.ink, fontSize: 13.5, fontFamily: 'inherit', padding: '11px 16px', outline: 'none', maxHeight: 120, lineHeight: 1.4 }} />
                <button onClick={sendReply} disabled={!reply.trim() || sending} title="Send reply"
                  style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, background: !reply.trim() || sending ? C.ash : C.orange, color: '#fff', border: 'none', borderRadius: '50%', fontFamily: 'inherit', cursor: !reply.trim() || sending ? 'default' : 'pointer', flexShrink: 0, boxShadow: !reply.trim() || sending ? 'none' : '0 2px 8px rgba(251,94,9,0.3)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
