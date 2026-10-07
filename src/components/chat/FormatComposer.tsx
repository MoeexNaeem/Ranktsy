'use client'
/**
 * Formatting for admin message boxes. Messages are stored as the small Markdown
 * subset ChatText renders, so:
 *  - pasting already-formatted text (Google Docs, ChatGPT, Word, a web page) keeps
 *    its headings, bold, italics, lists and links, converted on paste;
 *  - a toolbar adds Bold / Heading / List / Link to the selected text;
 *  - a preview shows exactly what users will see.
 */
import { useState, type RefObject } from 'react'
import { C } from '@/utils'
import { ChatText } from './ChatText'

// ── Pasted HTML → message Markdown ───────────────────────────────────────────
const BLOCK = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'BLOCKQUOTE', 'TR', 'TABLE', 'UL', 'OL'])

function isBold(el: HTMLElement): boolean {
  if (el.tagName === 'STRONG') return true
  // Google Docs wraps the whole paste in <b style="font-weight:normal">.
  const w = el.style?.fontWeight
  if (el.tagName === 'B') return !(w === 'normal' || w === '400')
  return w === 'bold' || Number(w) >= 600
}
const isItalic = (el: HTMLElement) => el.tagName === 'EM' || el.tagName === 'I' || el.style?.fontStyle === 'italic'

/** Wrap with a marker, keeping the spaces outside it ("** word**" would not render). */
function wrap(s: string, mark: string): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!
  return m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : s
}

export function htmlToChatMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const walk = (node: Node, ctx: { ordered?: boolean; index?: number; inHeading?: boolean }): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/\s+/g, ' ')
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as HTMLElement
    const tag = el.tagName
    if (tag === 'STYLE' || tag === 'SCRIPT' || tag === 'META' || tag === 'TITLE') return ''
    if (tag === 'BR') return '\n'
    const kids = (c = ctx) => Array.from(el.childNodes).map(n => walk(n, c)).join('')

    if (/^H[1-6]$/.test(tag)) {
      const level = Math.min(3, Number(tag[1]))
      return `\n\n${'#'.repeat(level)} ${kids({ ...ctx, inHeading: true }).replace(/\*\*/g, '').trim()}\n\n`
    }
    if (tag === 'A') {
      const href = el.getAttribute('href') ?? ''
      const text = kids().trim()
      if (/^(https?:\/\/|mailto:)/i.test(href)) return text && text !== href ? `[${text}](${href})` : href
      return text
    }
    if (tag === 'UL' || tag === 'OL') {
      let i = 0
      const items = Array.from(el.children).map(li => {
        if (li.tagName !== 'LI') return walk(li, ctx)
        i++
        const body = Array.from(li.childNodes).map(n => walk(n, ctx)).join('').replace(/\n+/g, ' ').trim()
        return `${tag === 'OL' ? `${i}.` : '-'} ${body}\n`
      })
      return `\n${items.join('')}\n`
    }
    let inner = kids()
    if (!ctx.inHeading && isBold(el)) inner = wrap(inner, '**')
    if (!ctx.inHeading && isItalic(el)) inner = wrap(inner, '*')
    if (BLOCK.has(tag) || tag === 'LI') return `\n${inner}\n`
    return inner
  }
  return walk(doc.body, {})
    .replace(/\*\*\s*\*\*/g, '')             // empty bold left by stray tags
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** onPaste for a message textarea: formatted clipboard content is kept as Markdown. */
export function pasteFormatted(e: React.ClipboardEvent<HTMLTextAreaElement>, value: string, set: (v: string) => void, max = 4000) {
  const html = e.clipboardData.getData('text/html')
  if (!html) return   // plain text: the browser's own paste is right
  const md = htmlToChatMarkdown(html)
  if (!md) return
  e.preventDefault()
  const ta = e.currentTarget
  const start = ta.selectionStart ?? value.length, end = ta.selectionEnd ?? value.length
  const next = (value.slice(0, start) + md + value.slice(end)).slice(0, max)
  set(next)
  requestAnimationFrame(() => { const p = Math.min(start + md.length, next.length); ta.selectionStart = ta.selectionEnd = p })
}

// ── Toolbar ──────────────────────────────────────────────────────────────────
type Action = 'bold' | 'italic' | 'heading' | 'list' | 'link'

function apply(action: Action, value: string, start: number, end: number): { next: string; selStart: number; selEnd: number } | null {
  const sel = value.slice(start, end)
  if (action === 'bold' || action === 'italic') {
    const mark = action === 'bold' ? '**' : '*'
    const body = sel || (action === 'bold' ? 'bold text' : 'italic text')
    const next = value.slice(0, start) + mark + body + mark + value.slice(end)
    return { next, selStart: start + mark.length, selEnd: start + mark.length + body.length }
  }
  if (action === 'link') {
    const url = window.prompt('Link address (https://...)', 'https://')
    if (!url || !/^(https?:\/\/|mailto:)\S+$/i.test(url.trim())) return null
    const text = sel || 'link text'
    const md = `[${text}](${url.trim()})`
    const next = value.slice(0, start) + md + value.slice(end)
    return { next, selStart: start + 1, selEnd: start + 1 + text.length }
  }
  // Line-based: heading / list on every selected line.
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const lineEndIdx = value.indexOf('\n', end)
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx
  const block = value.slice(lineStart, lineEnd)
  const prefix = action === 'heading' ? '## ' : '- '
  const lines = block.split('\n')
  const has = lines.every(l => l.startsWith(prefix))
  const strip = (l: string) => l.replace(/^(#{1,3}\s+|[-*•]\s+)/, '')
  // Toggle: every line already has it → remove; otherwise set it (replacing the other kind).
  const changed = lines.map(l => (has ? l.slice(prefix.length) : prefix + strip(l))).join('\n')
  const next = value.slice(0, lineStart) + changed + value.slice(lineEnd)
  return { next, selStart: lineStart, selEnd: lineStart + changed.length }
}

export function FormatToolbar({ textareaRef, value, onChange, preview = true }: {
  textareaRef: RefObject<HTMLTextAreaElement | null>; value: string; onChange: (v: string) => void; preview?: boolean
}) {
  const [showPreview, setShowPreview] = useState(false)
  const run = (a: Action) => {
    const ta = textareaRef.current
    if (!ta) return
    const r = apply(a, value, ta.selectionStart ?? value.length, ta.selectionEnd ?? value.length)
    if (!r) return
    onChange(r.next.slice(0, 4000))
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = r.selStart; ta.selectionEnd = r.selEnd })
  }
  const btn: React.CSSProperties = { minWidth: 30, height: 28, padding: '0 9px', border: `1px solid ${C.ash}`, borderRadius: 7, background: C.paper, color: C.ink, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', lineHeight: 1 }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" title="Bold (select text first)" onClick={() => run('bold')} style={{ ...btn, fontWeight: 800 }}>B</button>
        <button type="button" title="Italic" onClick={() => run('italic')} style={{ ...btn, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>I</button>
        <button type="button" title="Heading" onClick={() => run('heading')} style={{ ...btn, fontWeight: 700 }}>H</button>
        <button type="button" title="Bullet list" onClick={() => run('list')} style={btn}>• List</button>
        <button type="button" title="Link (opens in a new tab)" onClick={() => run('link')} style={btn}>🔗 Link</button>
        <span style={{ fontSize: 11.5, color: C.stone, marginLeft: 4 }}>Pasting formatted text keeps its headings, bold and links.</span>
        {preview && (
          <button type="button" onClick={() => setShowPreview(v => !v)} disabled={!value.trim()}
            style={{ ...btn, marginLeft: 'auto', color: C.orange, borderColor: `${C.orange}66`, opacity: value.trim() ? 1 : 0.5 }}>
            {showPreview ? 'Hide preview' : 'Preview'}
          </button>
        )}
      </div>
      {preview && showPreview && value.trim() && (
        <div style={{ border: `1px dashed ${C.ash}`, borderRadius: 10, padding: '10px 13px', background: C.paper, fontSize: 13.5, lineHeight: 1.5, color: C.ink }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>What users will see</p>
          <ChatText text={value} />
        </div>
      )}
    </div>
  )
}
