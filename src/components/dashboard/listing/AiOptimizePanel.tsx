'use client'
/**
 * AI Improvement Suggestions + One-Click Optimization — sits under the Listing
 * Audit checklist. The audit finds the gaps; this panel sends those REAL
 * findings (plus the real keyword-gap tags, scanned server-side) to Gemini,
 * which writes the fixes: a prioritised suggestion list and a complete
 * ready-to-paste rewrite. AI writes copy only — every number shown here was
 * measured before the model ever saw it.
 */
import { useMemo, useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { C } from '@/utils'
import { Card, SectionTitle, ErrorBox, MONO, primaryBtn } from '../kit'
import type { ApiResponse, AiOptimization, AiSuggestion, EtsyListing } from '@/types'

interface Finding { label: string; status: 'pass' | 'warn' | 'fail'; detail: string }

const PRIORITY: Record<AiSuggestion['priority'], { label: string; fg: string; bg: string }> = {
  high:   { label: 'HIGH',   fg: C.danger,   bg: C.dangerBg },
  medium: { label: 'MEDIUM', fg: C.warn,     bg: C.warnBg },
  low:    { label: 'LOW',    fg: C.graphite, bg: C.bone },
}

function CopyBtn({ text, label = 'Copy', copied, onCopied }: {
  text: string; label?: string; copied: boolean; onCopied: () => void
}) {
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text); onCopied() }}
      style={{
        fontSize: 12, fontFamily: MONO, fontWeight: 600, cursor: 'pointer',
        color: copied ? C.paper : C.orange, background: copied ? C.orange : C.orangeFaint,
        border: `1px solid ${C.orange}`, padding: '4px 13px', borderRadius: 100,
        flexShrink: 0, transition: 'all 0.15s',
      }}>
      {copied ? '✓ Copied' : label}
    </button>
  )
}

export function AiOptimizePanel({ listing, findings }: { listing: EtsyListing; findings: Finding[] }) {
  // Best-guess grounding keyword: the listing's first multi-word tag (what the
  // seller is already targeting), else its leading title words. Editable.
  const defaultKeyword = useMemo(() => {
    const longTail = (listing.tags ?? []).find(t => t.trim().split(/\s+/).length >= 2)
    return (longTail ?? listing.title.split(/\s+/).slice(0, 3).join(' ')).toLowerCase()
  }, [listing])

  const [keyword, setKeyword] = useState(defaultKeyword)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const markCopied = useCallback((k: string) => {
    setCopiedKey(k)
    setTimeout(() => setCopiedKey(cur => (cur === k ? null : cur)), 1800)
  }, [])

  const gen = useMutation({
    mutationFn: async () => {
      const { data } = await axios.post<ApiResponse<AiOptimization>>('/api/ai/optimize', {
        listingId: listing.listing_id,
        keyword: keyword.trim(),
        findings,
      })
      if (!data.success || !data.data) throw new Error(data.error ?? 'Generation failed')
      return data.data
    },
  })
  const r = gen.data

  const fullListing = r
    ? `TITLE\n${r.title}\n\nTAGS (${r.tags.length})\n${r.tags.join(', ')}\n\nDESCRIPTION\n${r.description}`
    : ''

  return (
    <div>
      <SectionTitle
        right={r && (
          <span style={{ fontSize: 11, fontFamily: MONO, fontWeight: 600, color: r.ai ? C.orange : C.graphite, background: r.ai ? C.orangeFaint : C.bone, padding: '3px 11px', borderRadius: 100, letterSpacing: '0.05em' }}>
            {r.ai ? 'AI · GEMINI' : 'RULE-BASED'}
          </span>
        )}>
        AI Improvement Suggestions
      </SectionTitle>

      <Card pad="18px">
        <p style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.55, marginBottom: 14 }}>
          Turn this audit into fixes: AI reads the findings above plus the real tags winners use for your keyword,
          then writes a prioritised fix list and a complete optimized rewrite. It writes copy only — every number
          it cites was measured first.
        </p>
        <div className="rsplit" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 100, padding: '10px 16px', flex: 1, minWidth: 220, maxWidth: 420 }}>
            <span style={{ fontSize: 11, fontFamily: MONO, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Keyword</span>
            <input value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && !gen.isPending && gen.mutate()}
              placeholder="Keyword to rank for"
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 14.5, fontFamily: 'inherit', flex: 1, color: C.ink, minWidth: 0 }} />
          </div>
          <button onClick={() => gen.mutate()} disabled={gen.isPending}
            style={{ ...primaryBtn, height: 44, opacity: gen.isPending ? 0.6 : 1, cursor: gen.isPending ? 'default' : 'pointer' }}>
            {gen.isPending ? 'Writing fixes…' : r ? 'Regenerate ↻' : '✦ Generate fixes'}
          </button>
        </div>

        {gen.isError && (
          <div style={{ marginTop: 14 }}>
            <ErrorBox>{gen.error instanceof Error ? gen.error.message : 'Could not generate improvements. Please try again.'}</ErrorBox>
          </div>
        )}
      </Card>

      {r && !gen.isPending && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          {/* Prioritised fixes */}
          <Card pad={0}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.hair}` }}>
              <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.5 }}>{r.summary}</p>
              {r.grounding.sampled > 0 && (
                <p style={{ fontSize: 11.5, fontFamily: MONO, color: C.stone, marginTop: 6 }}>
                  Grounded in the top {r.grounding.sampled} live listings for “{r.grounding.keyword}”
                  {r.grounding.missingTags.length ? ` — ${r.grounding.missingTags.length} high-adoption tags you're missing` : ''}.
                </p>
              )}
            </div>
            {r.suggestions.map((s, i) => {
              const p = PRIORITY[s.priority]
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px', borderBottom: i < r.suggestions.length - 1 ? `1px solid ${C.hair}` : 'none' }}>
                  <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 700, color: p.fg, background: p.bg, padding: '3px 9px', borderRadius: 100, letterSpacing: '0.05em', flexShrink: 0, marginTop: 2 }}>{p.label}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14.5, fontWeight: 500, color: C.ink }}>{s.area}: <span style={{ fontWeight: 400, color: C.graphite }}>{s.issue}</span></p>
                    <p style={{ fontSize: 13.5, color: C.ink, marginTop: 4, lineHeight: 1.5 }}>→ {s.action}</p>
                  </div>
                </div>
              )
            })}
          </Card>

          {/* One-Click Optimization — the ready-to-paste rewrite */}
          <Card pad="18px" style={{ borderColor: C.orange }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <h4 style={{ fontSize: 16.5, fontWeight: 500, color: C.ink, letterSpacing: '-0.02em' }}>⚡ One-Click Optimization</h4>
              <CopyBtn text={fullListing} label="Copy full listing" copied={copiedKey === 'all'} onCopied={() => markCopied('all')} />
            </div>

            {/* Title */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
                <p style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Title · {r.title.length}/140</p>
                <CopyBtn text={r.title} copied={copiedKey === 'title'} onCopied={() => markCopied('title')} />
              </div>
              <p style={{ fontSize: 15, color: C.ink, background: C.bone, padding: '11px 14px', borderRadius: 10, lineHeight: 1.45 }}>{r.title}</p>
            </div>

            {/* Tags */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
                <p style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tags · {r.tags.length}/13</p>
                <CopyBtn text={r.tags.join(', ')} copied={copiedKey === 'tags'} onCopied={() => markCopied('tags')} />
              </div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {r.tags.map(t => {
                  const isNew = r.tagsToAdd.includes(t)
                  return (
                    <span key={t} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontFamily: MONO,
                      color: isNew ? C.orange : C.ink, background: isNew ? C.orangeFaint : C.bone,
                      border: `1px solid ${isNew ? C.orange : C.hair}`, padding: '4px 12px', borderRadius: 100,
                    }}>
                      {isNew && <span style={{ fontSize: 9.5, fontWeight: 700 }}>NEW</span>}
                      {t}
                    </span>
                  )
                })}
              </div>
              {r.tagsToRemove.length > 0 && (
                <p style={{ fontSize: 12, color: C.graphite, marginTop: 9 }}>
                  Drops: {r.tagsToRemove.map(t => <span key={t} style={{ textDecoration: 'line-through', marginRight: 8, fontFamily: MONO }}>{t}</span>)}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
                <p style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description · {r.description.length} chars</p>
                <CopyBtn text={r.description} copied={copiedKey === 'desc'} onCopied={() => markCopied('desc')} />
              </div>
              <p style={{ fontSize: 14, color: C.ink, background: C.bone, padding: '13px 15px', borderRadius: 10, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto' }}>{r.description || '—'}</p>
            </div>

            <p style={{ fontSize: 11.5, color: C.stone, marginTop: 14, lineHeight: 1.55 }}>
              {r.ai
                ? 'Copy written by AI from your real audit findings and the measured tags of top-ranking listings — review before publishing. Etsy caps: title 140 chars, 13 tags of 20 chars.'
                : 'AI is unavailable right now (no key or rate-limited) — this rewrite keeps your own copy and tops up your tags with the measured high-adoption ones. Try again for the full AI rewrite.'}
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}
