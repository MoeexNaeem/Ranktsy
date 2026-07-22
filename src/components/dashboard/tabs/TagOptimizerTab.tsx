'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { C } from '@/utils'
import { Card, SearchBar, SectionTitle, EmptyState, tableCard, tableHead, th, tableRow, tdMono, MONO } from '../kit'
import { AiInsights } from '../AiInsights'
import type { EtsyListing, AiFact } from '@/types'

const GRID = '2fr 0.6fr 0.9fr 0.8fr 2fr'

export function TagOptimizerTab() {
  const [input, setInput] = useState('boho earrings')
  const [query, setQuery] = useState('boho earrings')

  const { data: listings, isLoading } = useQuery({
    queryKey: ['tag-optimizer', query],
    queryFn: async () => {
      const { data } = await axios.get(`/api/etsy/search?q=${encodeURIComponent(query)}&limit=50`)
      return (data.data ?? []) as EtsyListing[]
    },
    staleTime: 1000 * 60 * 30,
  })

  const go = useCallback(() => {
    const v = input.trim(); if (v.length < 2) return; setQuery(v)
  }, [input])

  const tagAnalysis = useMemo(() => {
    if (!listings?.length) return []
    const counts: Record<string, { count: number; totalViews: number; totalFavs: number }> = {}
    listings.forEach(l => {
      (l.tags ?? []).forEach(tag => {
        if (!counts[tag]) counts[tag] = { count: 0, totalViews: 0, totalFavs: 0 }
        counts[tag].count++
        counts[tag].totalViews += l.views ?? 0
        counts[tag].totalFavs  += l.num_favorers ?? 0
      })
    })
    return Object.entries(counts)
      .sort((a, b) => b[1].totalViews - a[1].totalViews)
      .slice(0, 30)
      .map(([tag, d]) => ({
        tag,
        count:     d.count,
        avgViews:  Math.round(d.totalViews / d.count),
        avgFavs:   Math.round(d.totalFavs  / d.count),
        score:     Math.round((d.totalViews / Math.max(d.count, 1)) / 100),
      }))
  }, [listings])

  const maxScore = useMemo(() => Math.max(...tagAnalysis.map(t => t.score), 1), [tagAnalysis])

  // Real facts for the AI tag-strategy read.
  const aiFacts = useMemo<AiFact[]>(() => {
    if (!tagAnalysis.length) return []
    const f: AiFact[] = [{ label: 'Tags analysed', value: String(tagAnalysis.length), hint: `from ${listings?.length ?? 0} listings for "${query}"` }]
    tagAnalysis.slice(0, 8).forEach(t => f.push({
      label: t.tag,
      value: `${t.avgViews.toLocaleString()} avg views`,
      hint: `used ${t.count}×, ${t.avgFavs} avg favorites`,
    }))
    return f
  }, [tagAnalysis, listings, query])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SearchBar value={input} onChange={setInput} onSubmit={go} placeholder="e.g. boho earrings, silver ring…" button="Analyze Tags →" />

      {isLoading && <div className="shimmer" style={{ height: 300, borderRadius: 10, background: '#e8e7e2' }} />}

      {tagAnalysis.length > 0 && !isLoading && (
        <>
          <div style={{ background: C.orange, borderRadius: 10, padding: '13px 16px' }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: C.snow, marginBottom: 3 }}>
              Top {tagAnalysis.length} tags from {listings?.length} listings for &ldquo;{query}&rdquo;
            </p>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.92)' }}>
              Etsy allows up to 13 tags per listing. Use the highest-scoring tags below to maximize discoverability.
            </p>
          </div>

          {/* Recommended */}
          <Card>
            <SectionTitle>✨ Recommended tags (click to copy)</SectionTitle>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {tagAnalysis.slice(0, 13).map(t => (
                <button key={t.tag} onClick={() => navigator.clipboard?.writeText(t.tag)} title="Click to copy"
                  style={{ fontSize: 12, fontFamily: MONO, color: C.orange, background: C.orangeFaint, border: `1px solid rgba(251,94,9,0.22)`, padding: '5px 12px', borderRadius: 999, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.orange; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.orangeFaint; e.currentTarget.style.color = C.orange }}>
                  {t.tag}
                </button>
              ))}
            </div>
          </Card>

          {/* Full analysis */}
          <div className="rtable" style={tableCard}>
            <div style={tableHead(GRID)}>
              {['Tag', 'Used', 'Avg Views', 'Avg Favs', 'Score'].map(h => <span key={h} style={th}>{h}</span>)}
            </div>
            {tagAnalysis.map((t, i) => (
              <div key={t.tag} style={tableRow(GRID)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {i < 13 && <span style={{ fontSize: 8, background: C.orange, color: C.snow, padding: '1px 6px', borderRadius: 999, fontFamily: MONO, fontWeight: 500, flexShrink: 0 }}>✓</span>}
                  <span style={{ fontSize: 12.5, color: '#1a1a1a', fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.tag}</span>
                </div>
                <span style={tdMono}>{t.count}x</span>
                <span style={tdMono}>{t.avgViews.toLocaleString()}</span>
                <span style={tdMono}>{t.avgFavs}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 5, background: '#EEEDE8', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(t.score / maxScore) * 100}%`, background: C.orange, borderRadius: 999 }} />
                  </div>
                  <span style={{ ...tdMono, color: C.orange, width: 30, fontWeight: 500 }}>{t.score}</span>
                </div>
              </div>
            ))}
          </div>

          {/* AI tag-strategy read. */}
          {aiFacts.length >= 2 && (
            <AiInsights
              tool="Tag Optimizer"
              subject={query}
              facts={aiFacts}
              notes="Each tag is ranked by the average views of the listings using it (real Etsy figures) — high avg views on a tag signals it's associated with discoverable listings, not proof of causation. Recommend a balanced 13-tag strategy (mix of broad + long-tail), explain which tags are strongest and why, and remind the seller to use tags that genuinely describe their product."
            />
          )}
        </>
      )}

      {!tagAnalysis.length && !isLoading && (
        <EmptyState icon="🏷️" title="Tag optimizer ready" sub="Search any product to see the best performing tags" />
      )}
    </div>
  )
}

