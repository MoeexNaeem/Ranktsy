import type { ReactNode } from 'react'

/**
 * Compact, dependency-free Markdown → React renderer for blog bodies.
 * Supports: ## / ### headings, paragraphs, **bold**, *italic*, `code`, links,
 * images (block + inline), - / 1. lists, > blockquotes, --- rules, ``` code blocks.
 * Output is React elements (no dangerouslySetInnerHTML), styled via `.blogbody`.
 */
const INLINE = /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g

/**
 * Only allow safe URL schemes in rendered links/images. A `javascript:` (or
 * `data:`/`vbscript:`) href in an <a> executes on click - even admin-authored
 * markdown shouldn't be able to smuggle one in - so anything that isn't http(s),
 * mailto, a root-relative path, or an anchor is dropped to "#".
 */
function safeUrl(url: string): string {
  const u = url.trim()
  if (/^(https?:|mailto:|\/|#)/i.test(u)) return u
  return '#'
}

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0, m: RegExpExecArray | null, i = 0
  INLINE.lastIndex = 0
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const k = `${keyBase}-${i++}`
    if (m[1] !== undefined && m[2]) out.push(<img key={k} src={safeUrl(m[2])} alt={m[1]} loading="lazy" />)
    else if (m[3] && m[4]) out.push(<a key={k} href={safeUrl(m[4])} target={m[4].startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{m[3]}</a>)
    else if (m[5]) out.push(<strong key={k}>{m[5]}</strong>)
    else if (m[6]) out.push(<em key={k}>{m[6]}</em>)
    else if (m[7]) out.push(<code key={k}>{m[7]}</code>)
    last = INLINE.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ text }: { text: string }) {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n')
  const out: ReactNode[] = []
  let i = 0, key = 0
  const K = () => `b${key++}`

  while (i < lines.length) {
    const line = lines[i]
    const t = line.trim()

    if (!t) { i++; continue }

    // Fenced code block
    if (t.startsWith('```')) {
      const buf: string[] = []; i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) { buf.push(lines[i]); i++ }
      i++ // closing fence
      out.push(<pre key={K()}><code>{buf.join('\n')}</code></pre>)
      continue
    }
    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { out.push(<hr key={K()} />); i++; continue }
    // Headings
    const h = /^(#{1,6})\s+(.*)$/.exec(t)
    if (h) {
      const lvl = Math.min(h[1].length, 6)
      const Tag = (lvl <= 2 ? 'h2' : lvl === 3 ? 'h3' : 'h4') as 'h2' | 'h3' | 'h4'
      out.push(<Tag key={K()}>{inline(h[2], K())}</Tag>)
      i++; continue
    }
    // Standalone image → block figure
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(t)
    if (img) {
      out.push(<figure key={K()}><img src={safeUrl(img[2])} alt={img[1]} loading="lazy" />{img[1] ? <figcaption>{img[1]}</figcaption> : null}</figure>)
      i++; continue
    }
    // Blockquote
    if (t.startsWith('>')) {
      const buf: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) { buf.push(lines[i].trim().replace(/^>\s?/, '')); i++ }
      out.push(<blockquote key={K()}>{inline(buf.join(' '), K())}</blockquote>)
      continue
    }
    // Unordered list
    if (/^[-*]\s+/.test(t)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*]\s+/, '')); i++ }
      out.push(<ul key={K()}>{items.map((it, n) => <li key={n}>{inline(it, `${K()}-${n}`)}</li>)}</ul>)
      continue
    }
    // Ordered list
    if (/^\d+\.\s+/.test(t)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+\.\s+/, '')); i++ }
      out.push(<ol key={K()}>{items.map((it, n) => <li key={n}>{inline(it, `${K()}-${n}`)}</li>)}</ol>)
      continue
    }
    // Paragraph (gather consecutive non-blank, non-special lines)
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|[-*]\s|\d+\.\s|>|```|!\[)/.test(lines[i].trim()) && !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())) {
      para.push(lines[i].trim()); i++
    }
    out.push(<p key={K()}>{inline(para.join(' '), K())}</p>)
  }

  return <div className="blogbody">{out}</div>
}
