'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { C } from '@/utils'
import { SearchBar, Card, SectionTitle, EmptyState, MONO } from '../kit'
import type { EtsyListing } from '@/types'

const cap = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase())

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

  const go = useCallback(() => { const v = input.trim(); if (v.length < 2) return; setSeed(v) }, [input])

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
                  style={{ fontSize: 12.5, fontFamily: MONO, color: C.orange, background: C.orangeFaint, border: `1px solid rgba(255,96,8,0.22)`, padding: '5px 12px', borderRadius: 100, cursor: 'pointer', transition: 'all 0.15s' }}
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

      {!tags.length && !isLoading && (
        <EmptyState icon="🏷️" title="Generate tags & titles" sub="Enter a seed keyword to get a ready-to-paste 13-tag set and title ideas" />
      )}
    </div>
  )
}
