'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useKeywordIdeas } from '@/hooks/useKeywords'
import { C, D, formatNumber } from '@/utils'
import { SearchBar, Card, SectionTitle, EmptyState, MONO } from '../kit'
import type { EtsyListing } from '@/types'

const cap = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase())

// Google advertiser-competition band → colour, so demand-backed tags read at a glance.
const GCOMP: Record<string, { fg: string; bg: string; label: string }> = {
  LOW:    { fg: D.good, bg: D.goodBg, label: 'Low' },
  MEDIUM: { fg: D.mid,  bg: D.midBg,  label: 'Med' },
  HIGH:   { fg: D.hard, bg: D.hardBg, label: 'High' },
}

function joinUntil(parts: string[], sep: string, max = 140): string {
  let out = ''
  for (const p of parts) {
    const next = out ? out + sep + p : p
    if (next.length > max) break
    out = next
  }
  return out
}

function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200) }}
      style={{ fontSize: 12, fontFamily: MONO, color: done ? C.success : C.orange, background: 'transparent', border: `1px solid ${done ? C.success : C.orange}`, padding: '4px 12px', borderRadius: 100, cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}>
      {done ? '✓ Copied' : label}
    </button>
  )
}

export function TagTitleGeneratorTab() {
  const [input, setInput] = useState('boho earrings')
  const [seed, setSeed] = useState('boho earrings')

  const { data: listings, isLoading } = useQuery({
    queryKey: ['tagtitle', seed],
    queryFn: async () => {
      const { data } = await axios.get(`/api/etsy/search?q=${encodeURIComponent(seed)}&limit=50`)
      return (data.data ?? []) as EtsyListing[]
    },
    staleTime: 1000 * 60 * 30,
  })

  // Google keyword ideas for the same seed — real search demand, so tags/titles
  // can be driven by what people actually search, not just what other sellers tag.
  const ideasQ = useKeywordIdeas(seed)

  const go = useCallback(() => { const v = input.trim(); if (v.length < 2) return; setSeed(v) }, [input])

  // Valid Etsy tags are ≤ 20 chars. Rank Google ideas by demand; the low-competition
  // ones with real volume are the demand-backed tags worth adding.
  const googleTags = useMemo(() => {
    const list = ideasQ.data?.ideas ?? []
    return list
      .filter(i => i.keyword.length <= 20 && i.keyword.toLowerCase() !== seed.toLowerCase() && i.searches > 0)
      .slice(0, 12)
  }, [ideasQ.data, seed])

  // Longer Google phrases (real demand) to weave into titles.
  const googlePhrases = useMemo(
    () => (ideasQ.data?.ideas ?? []).filter(i => i.keyword.length > 20 && i.searches > 0).slice(0, 6),
    [ideasQ.data],
  )

  // The "copy all" tag set: seed + demand-backed low/med-competition Google tags,
  // capped at 13 (Etsy's tag limit).
  const googleTagSet = useMemo(() => {
    const picks = googleTags.filter(i => i.competition !== 'HIGH').map(i => i.keyword)
    return [seed.toLowerCase(), ...picks].filter((v, i, a) => a.indexOf(v) === i).slice(0, 13)
  }, [googleTags, seed])

  const { tags, titles } = useMemo(() => {
    if (!listings?.length) return { tags: [] as string[], titles: [] as string[] }
    const counts: Record<string, { c: number; v: number }> = {}
    listings.forEach(l => (l.tags ?? []).forEach(t => {
      const k = t.toLowerCase().trim()
      if (!counts[k]) counts[k] = { c: 0, v: 0 }
      counts[k].c++; counts[k].v += l.views ?? 0
    }))
    const ranked = Object.entries(counts)
      .filter(([t]) => t !== seed.toLowerCase() && t.length <= 20)
      .sort((a, b) => b[1].v / b[1].c - a[1].v / a[1].c)
      .map(([t]) => t)
    const top13 = [seed.toLowerCase(), ...ranked].filter((v, i, a) => a.indexOf(v) === i).slice(0, 13)

    const t1 = cap(joinUntil(top13, ' | '))
    const t2 = cap(joinUntil([seed.toLowerCase(), ...ranked], ', '))
    const t3 = cap(joinUntil([ranked[0] ?? seed.toLowerCase(), seed.toLowerCase(), ...ranked.slice(1)], ' '))
    const titles = [t1, t2, t3].filter((v, i, a) => v && a.indexOf(v) === i)
    return { tags: top13, titles }
  }, [listings, seed])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SearchBar value={input} onChange={setInput} onSubmit={go} placeholder="Seed keyword — e.g. boho earrings…" button="Generate →" />

      {isLoading && <div className="shimmer" style={{ height: 260, borderRadius: 8, background: '#e8e7e2' }} />}

      {tags.length > 0 && !isLoading && (
        <>
          {/* Title suggestions */}
          <div>
            <SectionTitle>Suggested titles <span style={{ fontSize: 11, fontFamily: MONO, color: '#808080', fontWeight: 400 }}>(≤140 chars)</span></SectionTitle>
            <Card pad={0}>
              {titles.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < titles.length - 1 ? `1px solid ${C.hair}` : 'none' }}>
                  <span style={{ flex: 1, fontSize: 13.5, color: C.ink, lineHeight: 1.4 }}>{t}</span>
                  <span style={{ fontSize: 11, fontFamily: MONO, color: t.length > 140 ? C.danger : '#a3a29a', flexShrink: 0 }}>{t.length}</span>
                  <CopyBtn text={t} />
                </div>
              ))}
            </Card>
          </div>

          {/* Tag set */}
          <Card>
            <SectionTitle right={<CopyBtn text={tags.join(', ')} label="Copy all 13" />}>Recommended tags ({tags.length}/13)</SectionTitle>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {tags.map(t => (
                <button key={t} onClick={() => navigator.clipboard?.writeText(t)} title="Click to copy"
                  style={{ fontSize: 12.5, fontFamily: MONO, color: C.orange, background: C.orangeFaint, border: `1px solid rgba(251,94,9,0.22)`, padding: '5px 12px', borderRadius: 100, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.orange; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.orangeFaint; e.currentTarget.style.color = C.orange }}>
                  {t}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: '#808080', marginTop: 14, lineHeight: 1.5 }}>
              Generated from tags used by the top {listings?.length} live listings for &ldquo;{seed}&rdquo;, ranked by average views.
            </p>
          </Card>
        </>
      )}

      {/* Google demand-backed tags & title phrases — real Google search volume,
          so the generator is driven by what buyers search, not only seller tags. */}
      {ideasQ.isFetching && !ideasQ.data && <div className="shimmer" style={{ height: 130, borderRadius: 8, background: '#e8e7e2' }} />}
      {(googleTags.length > 0 || googlePhrases.length > 0) && (
        <Card>
          <SectionTitle right={googleTagSet.length > 1 ? <CopyBtn text={googleTagSet.join(', ')} label={`Copy ${googleTagSet.length} demand tags`} /> : undefined}>
            Backed by Google search demand
          </SectionTitle>
          <p style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.55, marginTop: -6, marginBottom: 12 }}>
            Keywords Google shows real search volume for — not just what other sellers tag.{' '}
            <strong style={{ color: D.good }}>Low-competition</strong> tags with real volume are the ones to prioritise.
          </p>
          {googleTags.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {googleTags.map(i => {
                const g = GCOMP[i.competition]
                return (
                  <button key={i.keyword} onClick={() => navigator.clipboard?.writeText(i.keyword)}
                    title={`${formatNumber(i.searches)} searches/mo · ${g?.label ?? '—'} competition · click to copy`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontFamily: MONO, color: C.ink, background: C.canvas, border: `1px solid ${C.ash}`, padding: '6px 12px', borderRadius: 100, cursor: 'pointer' }}>
                    {i.keyword}
                    <span style={{ fontSize: 11, color: '#2E6DB4', fontWeight: 600 }}>{formatNumber(i.searches)}</span>
                    {g && <span style={{ width: 7, height: 7, borderRadius: '50%', background: g.fg, flexShrink: 0 }} title={`${g.label} competition`} />}
                  </button>
                )
              })}
            </div>
          )}
          {googlePhrases.length > 0 && (
            <>
              <p style={{ fontSize: 11.5, fontFamily: MONO, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '16px 0 9px' }}>Title phrase ideas</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {googlePhrases.map(i => (
                  <div key={i.keyword} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: C.canvas, borderRadius: 8 }}>
                    <span style={{ flex: 1, fontSize: 13.5, color: C.ink }}>{cap(i.keyword)}</span>
                    <span style={{ fontSize: 12, fontFamily: MONO, color: '#2E6DB4', fontWeight: 600 }}>{formatNumber(i.searches)}/mo</span>
                    <CopyBtn text={i.keyword} />
                  </div>
                ))}
              </div>
            </>
          )}
          <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, marginTop: 14, lineHeight: 1.6 }}>
            Real Google Ads Keyword Planner data (US). The number is monthly searches; the dot is Google advertiser competition (green = low).
          </p>
        </Card>
      )}

      {!tags.length && !isLoading && !googleTags.length && !googlePhrases.length && (
        <EmptyState icon="🏷️" title="Generate tags & titles" sub="Enter a seed keyword to get a ready-to-paste 13-tag set and title ideas" />
      )}
    </div>
  )
}

