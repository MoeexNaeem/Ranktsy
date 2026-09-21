'use client'
/**
 * Admin messaging: reply to per-user support threads (polled for near-realtime), and a
 * composer to broadcast a notification to everyone or a single user. The user side rides
 * the SSE stream, so a reply or broadcast reaches them live.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { C } from '@/utils'
import { MONO, SectionTitle, cardStyle, EmptyState } from '@/components/dashboard/kit'
import { errorToast, toast } from '@/components/ui/toast'
import { ChatAttachmentView } from '@/components/ui/ChatAttachmentView'
import { validateUpload, CHAT_ACCEPT } from '@/lib/chat-upload-constants'

interface Thread { userId: string; name: string; email: string; lastBody: string; lastSender: 'user' | 'admin'; lastAt: string | null; count: number; unread: number }
type Audience = 'all' | 'sebt'

/** Announcements are blue so an admin never mistakes one for a personal reply. */
const BROADCAST_BLUE = '#2563EB'
const AUDIENCE_LABEL: Record<Audience, string> = { all: 'all users', sebt: 'SEBT students' }

interface Msg {
  id: string; userId: string; sender: 'user' | 'admin'; body: string; createdAt: string | null; editedAt?: string | null; readByUser?: boolean
  broadcast?: Audience | null
  attachmentUrl?: string | null; attachmentName?: string | null; attachmentKind?: 'image' | 'file' | null; attachmentSize?: number | null
}

/**
 * The thread poll returns a fresh array every 5s. Handing that straight to
 * setMessages re-renders the thread and retriggers the scroll effect even when
 * nothing changed, which yanked the admin back to the newest message mid-read.
 * Keeping the previous array when the content matches makes a quiet poll a no-op.
 */
const sameMessages = (a: Msg[], b: Msg[]) =>
  a.length === b.length && a.every((m, i) => {
    const n = b[i]
    return m.id === n.id && m.body === n.body && m.editedAt === n.editedAt && m.readByUser === n.readByUser
  })

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
  // Edit/delete of the admin's own messages.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [busyMsgId, setBusyMsgId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // True while the view is at (or near) the newest message. Scrolling up to read
  // history clears it, so incoming messages stop dragging the view down.
  const stickToBottom = useRef(true)

  // Message-everyone composer (writes into chat threads, not the notification bell).
  const [castText, setCastText] = useState('')
  const [castAudience, setCastAudience] = useState<Audience>('all')
  const [castBusy, setCastBusy] = useState(false)
  const [castConfirm, setCastConfirm] = useState(false)
  const [counts, setCounts] = useState<{ all: number; sebt: number } | null>(null)

  // Broadcast composer
  const [bTitle, setBTitle] = useState('')
  const [bBody, setBBody] = useState('')
  const [bLink, setBLink] = useState('')
  const [bTarget, setBTarget] = useState('')
  const [bBusy, setBBusy] = useState(false)

  const loadThreads = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/chat')
      const j = await r.json()
      if (j?.success) setThreads(j.data.threads)
    } catch { /* ignore */ }
  }, [])

  const openThread = useCallback(async (userId: string, name: string) => {
    setSel(userId); setSelName(name); setMessages([]); stickToBottom.current = true
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
      if (j?.success) { stickToBottom.current = true; setMessages(m => [...m, j.data.message]); loadThreads() }
      else { setReply(b); errorToast('Reply not sent', j?.error || 'Please try again.') }
    } catch { setReply(b); errorToast('Reply not sent', 'Network error. Please try again.') }
    finally { setSending(false) }
  }, [reply, sel, sending, loadThreads])

  const startEdit = useCallback((m: Msg) => { setEditingId(m.id); setEditText(m.body) }, [])
  const cancelEdit = useCallback(() => { setEditingId(null); setEditText('') }, [])

  const saveEdit = useCallback(async () => {
    if (!sel || !editingId) return
    const id = editingId
    const text = editText.trim()
    const orig = messages.find(m => m.id === id)
    if (orig && text === orig.body) { cancelEdit(); return }
    if (!text && !orig?.attachmentUrl) { errorToast('Message is empty', 'Delete the message instead.'); return }
    setBusyMsgId(id)
    try {
      const r = await fetch(`/api/admin/chat/${sel}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.success) {
        setMessages(ms => ms.map(m => (m.id === id ? { ...m, ...j.data.message } : m)))
        cancelEdit(); loadThreads()
        toast.success('Message updated')
      } else errorToast('Could not edit message', j?.error || 'Please try again.')
    } catch { errorToast('Could not edit message', 'Network error. Please try again.') }
    finally { setBusyMsgId(null) }
  }, [sel, editingId, editText, messages, cancelEdit, loadThreads])

  const deleteMessage = useCallback(async (id: string) => {
    if (!sel) return
    if (!window.confirm('Delete this message? The user will no longer see it.')) return
    setBusyMsgId(id)
    try {
      const r = await fetch(`/api/admin/chat/${sel}/${id}`, { method: 'DELETE' })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.success) {
        setMessages(ms => ms.filter(m => m.id !== id))
        if (editingId === id) cancelEdit()
        loadThreads()
        toast.success('Message deleted')
      } else errorToast('Could not delete message', j?.error || 'Please try again.')
    } catch { errorToast('Could not delete message', 'Network error. Please try again.') }
    finally { setBusyMsgId(null) }
  }, [sel, editingId, cancelEdit, loadThreads])

  const onPickFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !sel) return
    const check = validateUpload(file.type, file.size)
    if (!check.ok) { errorToast('Can’t attach that file', check.error); return }
    setSending(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch(`/api/admin/chat/${sel}/upload`, { method: 'POST', body: fd })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.success) { stickToBottom.current = true; setMessages(m => [...m, j.data.message]); loadThreads(); toast.success('File sent', file.name) }
      else errorToast('Upload failed', j?.error || 'Please try again.')
    } finally { setSending(false) }
  }, [sel, loadThreads])

  const deleteThread = useCallback(async () => {
    if (!sel) return
    if (!window.confirm('Delete this entire conversation? This cannot be undone.')) return
    const id = sel
    try {
      const r = await fetch(`/api/admin/chat/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
      setThreads(ts => ts.filter(t => t.userId !== id))
      setSel(null); setMessages([])
      toast.success('Conversation deleted')
    } catch { errorToast('Could not delete conversation', 'Please try again.') }
  }, [sel])

  const sendBroadcast = useCallback(async () => {
    if (!bTitle.trim() || bBusy) return
    setBBusy(true)
    const audience = bTarget.trim() ? 'user' : 'all'
    try {
      const r = await fetch('/api/admin/notifications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bTitle.trim(), body: bBody.trim(), link: bLink.trim() || undefined, audience, email: bTarget.trim() || undefined }),
      })
      const j = await r.json()
      if (r.ok && j?.success) { toast.success('Notification sent', audience === 'all' ? 'Sent to everyone.' : `Sent to ${bTarget.trim()}.`); setBTitle(''); setBBody(''); setBLink(''); setBTarget('') }
      else errorToast('Notification not sent', j?.error || 'Could not send.')
    } catch { errorToast('Notification not sent', 'Network error. Please try again.') }
    finally { setBBusy(false) }
  }, [bTitle, bBody, bLink, bTarget, bBusy])

  const sendCast = useCallback(async () => {
    const text = castText.trim()
    if (!text || castBusy) return
    setCastConfirm(false); setCastBusy(true)
    try {
      const r = await fetch('/api/admin/chat/broadcast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, audience: castAudience }),
      })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.success) {
        setCastText('')
        toast.success(`Sent to ${j.data.sent.toLocaleString()} ${AUDIENCE_LABEL[castAudience]}`, 'It lands in each recipient\u2019s support chat.')
        // The thread on screen has just gained a message; reload so it shows.
        if (sel) openThread(sel, selName)
        loadThreads()
      } else errorToast('Message not sent', j?.error || 'Please try again.')
    } catch { errorToast('Message not sent', 'Network error. Please try again.') }
    finally { setCastBusy(false) }
  }, [castText, castAudience, castBusy, sel, selName, openThread, loadThreads])

  useEffect(() => {
    let off = false
    fetch('/api/admin/chat/broadcast')
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (!off && j?.success) setCounts(j.data) })
      .catch(() => {})
    return () => { off = true }
  }, [])

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
        if (j?.success) setMessages(prev => (sameMessages(prev, j.data.messages) ? prev : j.data.messages))
      } catch { /* ignore */ }
    }, 5000)
    return () => clearInterval(t)
  }, [sel])

  useEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  // Within 80px of the end still counts as "at the bottom", so a nudge off the
  // last message does not switch following off.
  const onThreadScroll = useCallback(() => {
    const el = scrollRef.current
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }, [])

  const q = search.trim().toLowerCase()
  const filtered = q ? threads.filter(t => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)) : threads
  const selThread = threads.find(t => t.userId === sel)
  const selEmail = selThread?.email ?? ''
  const totalUnread = threads.reduce((n, t) => n + (t.unread || 0), 0)
  // Index of the LAST admin message, so we show the read receipt only under it.
  let lastAdminIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) { if (messages[i].sender === 'admin') { lastAdminIdx = i; break } }

  const msgActionBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: C.paper, color: C.graphite, border: `1px solid ${C.hair}`, borderRadius: 7, padding: '2px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }
  const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.ash}`, borderRadius: 9, background: C.canvas, color: C.ink, fontSize: 13.5, fontFamily: 'inherit', padding: '9px 12px', outline: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Message everyone at once - lands in each person's support chat. */}
      <div style={{ ...cardStyle, padding: '20px 22px', borderColor: 'rgba(37,99,235,0.35)', background: 'rgba(37,99,235,0.035)' }}>
        <SectionTitle>Message users directly</SectionTitle>
        <p style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.6, margin: '0 0 12px' }}>
          Drops one message into every recipient&rsquo;s support chat. They can reply, and the reply comes back as a normal conversation.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['all', 'sebt'] as Audience[]).map(a => {
              const on = castAudience === a
              const n = a === 'all' ? counts?.all : counts?.sebt
              return (
                <button key={a} onClick={() => setCastAudience(a)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', borderRadius: 100, padding: '8px 16px', cursor: 'pointer', border: `1.5px solid ${on ? BROADCAST_BLUE : C.ash}`, background: on ? BROADCAST_BLUE : C.paper, color: on ? '#fff' : C.ink }}>
                  {a === 'all' ? 'All users' : 'SEBT students'}
                  {n != null && <span style={{ fontSize: 11.5, fontFamily: MONO, opacity: on ? 0.85 : 0.6 }}>{n.toLocaleString()}</span>}
                </button>
              )
            })}
          </div>
          <textarea value={castText} onChange={e => setCastText(e.target.value)} rows={3} maxLength={4000}
            placeholder={castAudience === 'sebt' ? 'Message to every SEBT student...' : 'Message to every user...'}
            style={{ ...field, resize: 'vertical' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => setCastConfirm(true)} disabled={castBusy || !castText.trim()}
              style={{ background: castBusy || !castText.trim() ? C.ash : BROADCAST_BLUE, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: castBusy || !castText.trim() ? 'default' : 'pointer' }}>
              {castBusy ? 'Sending...' : `Send to ${castAudience === 'all' ? 'all users' : 'SEBT students'}`}
            </button>
            <span style={{ fontSize: 11.5, color: C.stone, fontFamily: MONO }}>{castText.length}/4000</span>
          </div>
        </div>
      </div>

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
              <div ref={scrollRef} onScroll={onThreadScroll} style={{ flex: 1, overflowY: 'auto', padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 12, background: C.snow }}>
                {messages.map((m, i) => {
                  const mine = m.sender === 'admin'
                  const editing = mine && editingId === m.id
                  const busy = busyMsgId === m.id
                  return (
                  <div key={m.id} onMouseEnter={() => setHoverId(m.id)} onMouseLeave={() => setHoverId(h => (h === m.id ? null : h))}
                    style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '76%', minWidth: editing ? '60%' : undefined, opacity: busy ? 0.55 : 1 }}>
                    {editing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, background: C.paper, border: `2px solid ${C.orange}`, borderRadius: 14, padding: 9 }}>
                        <textarea value={editText} onChange={e => setEditText(e.target.value)} autoFocus rows={3} maxLength={4000}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() } else if (e.key === 'Escape') cancelEdit() }}
                          style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', border: 'none', outline: 'none', background: 'transparent', color: C.ink, fontSize: 13.5, fontFamily: 'inherit', lineHeight: 1.5 }} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 7 }}>
                          <button onClick={cancelEdit} disabled={busy} style={{ background: C.snow, color: C.graphite, border: `1px solid ${C.hair}`, borderRadius: 8, padding: '5px 12px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>Cancel</button>
                          <button onClick={saveEdit} disabled={busy} style={{ background: C.orange, color: '#fff', border: 'none', borderRadius: 8, padding: '5px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer' }}>{busy ? 'Saving…' : 'Save'}</button>
                        </div>
                      </div>
                    ) : (<>
                    {m.broadcast && (
                      <p style={{ fontSize: 10.5, fontWeight: 700, fontFamily: MONO, color: BROADCAST_BLUE, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px', textAlign: 'right' }}>
                        Announcement &middot; {AUDIENCE_LABEL[m.broadcast]}
                      </p>
                    )}
                    <div style={{ padding: m.attachmentKind === 'image' ? 5 : '10px 14px', borderRadius: m.sender === 'admin' ? '16px 16px 5px 16px' : '16px 16px 16px 5px', fontSize: 13.5, lineHeight: 1.5, background: m.sender === 'admin' ? (m.broadcast ? BROADCAST_BLUE : C.orange) : C.canvas, color: m.sender === 'admin' ? '#fff' : C.ink, border: m.sender === 'admin' ? 'none' : `1px solid ${C.hair}`, whiteSpace: 'pre-wrap', wordBreak: 'break-word', boxShadow: m.sender === 'admin' ? (m.broadcast ? '0 2px 6px rgba(37,99,235,0.28)' : '0 2px 6px rgba(251,94,9,0.22)') : '0 1px 2px rgba(61,62,59,0.05)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {m.attachmentUrl && m.attachmentKind && (
                        <ChatAttachmentView url={m.attachmentUrl} name={m.attachmentName || 'file'} kind={m.attachmentKind} size={m.attachmentSize} />
                      )}
                      {m.body && <span style={{ padding: m.attachmentKind === 'image' ? '2px 8px 4px' : 0 }}>{m.body}</span>}
                    </div>
                    </>)}
                    <p title={exactTime(m.createdAt)} style={{ fontSize: 10.5, color: C.stone, fontFamily: MONO, marginTop: 3, textAlign: m.sender === 'admin' ? 'right' : 'left', cursor: 'default', display: 'flex', alignItems: 'center', gap: 6, justifyContent: mine ? 'flex-end' : 'flex-start', minHeight: 20 }}>
                      {mine && !editing && (hoverId === m.id || busy) && (
                        <span style={{ display: 'inline-flex', gap: 4, marginRight: 'auto' }}>
                          {(m.body || !m.attachmentUrl) && (
                            <button onClick={() => startEdit(m)} disabled={busy} title="Edit message" aria-label="Edit message" style={msgActionBtn}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                              Edit
                            </button>
                          )}
                          <button onClick={() => deleteMessage(m.id)} disabled={busy} title="Delete message" aria-label="Delete message" style={{ ...msgActionBtn, color: C.danger }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            Delete
                          </button>
                        </span>
                      )}
                      {m.editedAt && <span title={`Edited ${exactTime(m.editedAt)}`}>edited ·</span>}
                      {rel(m.createdAt)}
                      {m.sender === 'admin' && i === lastAdminIdx && (
                        <span style={{ marginLeft: 6, color: m.readByUser ? '#1F7A44' : C.stone, fontWeight: 600 }}>{m.readByUser ? '✓✓ Seen' : '✓ Sent'}</span>
                      )}
                    </p>
                  </div>
                  )
                })}
              </div>
              <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.hair}`, display: 'flex', gap: 9, alignItems: 'flex-end', background: C.paper }}>
                <input ref={fileRef} type="file" accept={CHAT_ACCEPT} onChange={onPickFile} style={{ display: 'none' }} />
                <button onClick={() => fileRef.current?.click()} disabled={sending} title="Attach an image or document" aria-label="Attach a file"
                  style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, background: C.snow, color: C.graphite, border: `1px solid ${C.hair}`, borderRadius: '50%', cursor: sending ? 'default' : 'pointer', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                </button>
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

      {/* Confirm before writing a message into every recipient's thread. */}
      {castConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,14,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 20 }} onClick={() => setCastConfirm(false)}>
          <div style={{ background: C.paper, borderRadius: 16, padding: '26px 28px', maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: C.ink, marginBottom: 10 }}>
              Send to {castAudience === 'all' ? 'every user' : 'every SEBT student'}?
            </h3>
            <p style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.6, marginBottom: 14 }}>
              This message goes into <strong style={{ color: C.ink }}>{((castAudience === 'all' ? counts?.all : counts?.sebt) ?? 0).toLocaleString()}</strong> support chats and cannot be unsent in one go.
            </p>
            <blockquote style={{ fontSize: 13, color: C.ink, lineHeight: 1.55, background: 'rgba(37,99,235,0.07)', borderLeft: `3px solid ${BROADCAST_BLUE}`, borderRadius: 6, padding: '10px 13px', margin: '0 0 22px', whiteSpace: 'pre-wrap', maxHeight: 160, overflowY: 'auto' }}>
              {castText.trim()}
            </blockquote>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setCastConfirm(false)} style={{ background: 'transparent', border: `1px solid ${C.hairInk}`, color: C.ink, borderRadius: 100, padding: '9px 18px', fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}>Cancel</button>
              <button onClick={sendCast} style={{ background: BROADCAST_BLUE, border: 'none', color: '#fff', borderRadius: 100, padding: '9px 18px', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>Send now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
