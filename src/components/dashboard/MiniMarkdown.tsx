'use client'
import React from 'react'
import { C } from '@/utils'
import { MONO } from './kit'

/**
 * Lightweight Markdown renderer shared by the AI description surfaces
 * (Description Gen + Etsy Listing Pro) so a generated description looks the
 * same everywhere - real headings, bullets, numbered steps and bold, instead
 * of raw `## Heading` / `- bullet` text. Deliberately tiny: it only handles
 * the subset the AI actually emits.
 */
function bold(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <strong key={i} style={{ color: C.ink }}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>)
}

export function MiniMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n')
  const out: React.ReactNode[] = []
  lines.forEach((ln, i) => {
    const t = ln.trim()
    if (!t) { out.push(<div key={i} style={{ height: 9 }} />); return }
    if (/^#{1,6}\s/.test(t)) {
      out.push(<h3 key={i} style={{ fontSize: 18.5, fontWeight: 600, color: C.ink, margin: '16px 0 6px', letterSpacing: '-0.01em' }}>{bold(t.replace(/^#{1,6}\s/, ''))}</h3>)
    } else if (/^(-|•|\*)\s/.test(t)) {
      out.push(<div key={i} style={{ display: 'flex', gap: 9, paddingLeft: 4, margin: '3px 0' }}><span style={{ color: C.orange }}>•</span><span style={{ fontSize: 15.5, color: C.graphite, lineHeight: 1.6 }}>{bold(t.replace(/^(-|•|\*)\s/, ''))}</span></div>)
    } else if (/^\d+\.\s/.test(t)) {
      const m = t.match(/^(\d+)\.\s(.*)/)!
      out.push(<div key={i} style={{ display: 'flex', gap: 9, paddingLeft: 4, margin: '3px 0' }}><span style={{ color: C.orange, fontFamily: MONO, fontSize: 14, minWidth: 18 }}>{m[1]}.</span><span style={{ fontSize: 15.5, color: C.graphite, lineHeight: 1.6 }}>{bold(m[2])}</span></div>)
    } else {
      out.push(<p key={i} style={{ fontSize: 15.5, color: C.graphite, lineHeight: 1.65, margin: '5px 0' }}>{bold(t)}</p>)
    }
  })
  return <div>{out}</div>
}
