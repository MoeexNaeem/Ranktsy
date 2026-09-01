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
interface Msg { id: string; userId: string; sender: 'user' | 'admin'; body: string; createdAt: string | null }

const rel = (d: string | null) => {
  if (!d) return ''
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function AdminMessages() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [selName, setSelName] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
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
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', maxHeight: 560, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '15px 18px', borderBottom: `1px solid ${C.ash}`, fontSize: 14, fontWeight: 600, color: C.ink }}>Conversations</div>
          <div style={{ overflowY: 'auto' }}>
            {threads.length === 0 ? (
              <p style={{ fontSize: 13, color: C.graphite, padding: '22px 18px' }}>No messages from users yet.</p>
            ) : threads.map(t => (
              <button key={t.userId} onClick={() => openThread(t.userId, t.name)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '13px 18px', border: 'none', borderBottom: `1px solid ${C.hair}`, cursor: 'pointer', background: sel === t.userId ? C.orangeFaint : 'transparent', fontFamily: 'inherit' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                  {t.unread > 0 && <span style={{ background: C.orange, color: '#fff', fontSize: 10.5, fontWeight: 700, fontFamily: MONO, borderRadius: 100, padding: '1px 7px', flexShrink: 0 }}>{t.unread}</span>}
                </div>
                <p style={{ fontSize: 12.5, color: C.graphite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3 }}>{t.lastSender === 'admin' ? 'You: ' : ''}{t.lastBody}</p>
                <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, marginTop: 3 }}>{rel(t.lastAt)}</p>
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 0, height: 560, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!sel ? (
            <div style={{ margin: 'auto' }}><EmptyState icon="💬" title="Select a conversation" sub="Pick a user on the left to read and reply to their messages." /></div>
          ) : (
            <>
              <div style={{ padding: '13px 20px', borderBottom: `1px solid ${C.ash}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{selName}</span>
                <button onClick={deleteThread} title="Delete this conversation"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.dangerBg, border: `1px solid ${C.danger}`, color: C.danger, borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Delete
                </button>
              </div>
              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map(m => (
                  <div key={m.id} style={{ alignSelf: m.sender === 'admin' ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
                    <div style={{ padding: '9px 13px', borderRadius: 13, fontSize: 13.5, lineHeight: 1.5, background: m.sender === 'admin' ? C.orange : C.canvas, color: m.sender === 'admin' ? '#fff' : C.ink, border: m.sender === 'admin' ? 'none' : `1px solid ${C.ash}`, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
                    <p style={{ fontSize: 10.5, color: C.stone, fontFamily: MONO, marginTop: 3, textAlign: m.sender === 'admin' ? 'right' : 'left' }}>{rel(m.createdAt)}</p>
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.ash}`, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                  placeholder="Write a reply…" rows={1} maxLength={4000}
                  style={{ flex: 1, resize: 'none', border: `1px solid ${C.ash}`, borderRadius: 10, background: C.canvas, color: C.ink, fontSize: 13.5, fontFamily: 'inherit', padding: '9px 12px', outline: 'none', maxHeight: 120 }} />
                <button onClick={sendReply} disabled={!reply.trim() || sending} style={{ background: !reply.trim() || sending ? C.ash : C.orange, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: !reply.trim() || sending ? 'default' : 'pointer', flexShrink: 0 }}>Send</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
