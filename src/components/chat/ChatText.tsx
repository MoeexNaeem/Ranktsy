'use client'
/**
 * Formatted text for admin-written chat messages and announcements.
 *
 * Messages are stored as a small, safe Markdown subset so formatting survives the
 * trip to every user: # / ## / ### headings, **bold**, *italic*, - and 1. lists,
 * [text](https://link) and bare https:// links (open in a new tab), line breaks.
 * Rendered as React elements (never raw HTML), and only http(s) / mailto links are
 * allowed, so nothing in a message can run script. User-written messages are NOT
 * rendered through this (a user could otherwise dress up a link to the admin).
 */
import type { ReactNode } from 'react'

const INLINE = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|(https?:\/\/[^\s<>()]+[^\s<>().,!?;:'"])/g

function safeHref(url: string): string | null {
  const u = url.trim()
  return /^(https?:\/\/|mailto:)/i.test(u) ? u : null
}

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" title={href}
      style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2, fontWeight: 600, wordBreak: 'break-word' }}>
      {children}
    </a>
  )
}

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0, i = 0
  let m: RegExpExecArray | null
  INLINE.lastIndex = 0
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const k = `${key}-${i++}`
    if (m[1] && m[2]) {
      const href = safeHref(m[2])
      out.push(href ? <Link key={k} href={href}>{m[1]}</Link> : m[1])
    } else if (m[3] || m[4]) out.push(<strong key={k}>{m[3] ?? m[4]}</strong>)
    else if (m[5]) out.push(<em key={k}>{m[5]}</em>)
    else if (m[6]) out.push(<Link key={k} href={m[6]}>{m[6]}</Link>)
    last = INLINE.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function ChatText({ text }: { text: string }) {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n')
  const out: ReactNode[] = []
  let key = 0
  const K = () => `c${key++}`
  let list: { ordered: boolean; items: string[] } | null = null
  const flush = () => {
    if (!list) return
    const items = list.items.map((t, j) => <li key={j} style={{ margin: '1px 0' }}>{inline(t, `${key}-${j}`)}</li>)
    out.push(list.ordered
      ? <ol key={K()} style={{ margin: '2px 0', paddingLeft: 20 }}>{items}</ol>
      : <ul key={K()} style={{ margin: '2px 0', paddingLeft: 18 }}>{items}</ul>)
    list = null
  }

  for (const raw of lines) {
    const t = raw.trim()
    const ul = /^[-*•]\s+(.*)$/.exec(t)
    const ol = /^\d+[.)]\s+(.*)$/.exec(t)
    if (ul || ol) {
      const ordered = !!ol
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] } }
      list.items.push((ul ?? ol)![1])
      continue
    }
    flush()
    if (!t) { out.push(<div key={K()} style={{ height: 6 }} />); continue }
    const h = /^(#{1,3})\s+(.*)$/.exec(t)
    if (h) {
      const size = h[1].length === 1 ? 16 : h[1].length === 2 ? 15 : 14
      out.push(<div key={K()} style={{ fontSize: size, fontWeight: 700, margin: '4px 0 1px', lineHeight: 1.35 }}>{inline(h[2], `h${key}`)}</div>)
      continue
    }
    out.push(<div key={K()}>{inline(raw, `p${key}`)}</div>)
  }
  flush()
  return <div style={{ whiteSpace: 'normal', display: 'flex', flexDirection: 'column' }}>{out}</div>
}

/** Plain-text preview of a formatted message (toasts, bell, thread list). */
export function chatPlainText(md: string): string {
  return (md || '')
    .replace(/^\s{0,3}#{1,3}\s+/gm, '')
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1$2')
    .replace(/^\s*[-*•]\s+/gm, '• ')
}
