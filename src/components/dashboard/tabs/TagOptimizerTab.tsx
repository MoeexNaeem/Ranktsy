'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { C } from '@/utils'
import type { EtsyListing } from '@/types'

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

  // Aggregate tags from top listings
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', background: C.warmGray, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.09)', maxWidth: 480 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()}
            placeholder="e.g. boho earrings, silver ring..."
            style={{ background: 'transparent', border: 'none', padding: '9px 14px', fontSize: 13, fontFamily: 'inherit', outline: 'none', flex: 1, color: '#1a1a1a' }} />
        </div>
        <button onClick={go}
          style={{ background: C.charcoal, color: C.snow, border: 'none', padding: '0 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          Analyze Tags →
        </button>
      </div>

      {isLoading && <div className="shimmer" style={{ height: 300, borderRadius: 12, background: '#ddd' }} />}

      {tagAnalysis.length > 0 && !isLoading && (
        <>
          <div style={{ background: C.orange, borderRadius: 10, padding: '12px 16px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.snow, marginBottom: 4 }}>
              Top {tagAnalysis.length} tags from {listings?.length} listings for &ldquo;{query}&rdquo;
            </p>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.9)' }}>
              Etsy allows up to 13 tags per listing. Use the highest-scoring tags below to maximize discoverability.
            </p>
          </div>

          {/* Top 13 recommended */}
          <div style={{ background: C.warmGray, borderRadius: 12, padding: '16px' }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.charcoal, marginBottom: 10 }}>✨ Recommended tags (copy these)</p>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {tagAnalysis.slice(0, 13).map(t => (
                <button key={t.tag}
                  onClick={() => navigator.clipboard?.writeText(t.tag)}
                  title="Click to copy"
                  style={{ fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", color: C.snow, background: C.orange, border: 'none', padding: '5px 12px', borderRadius: 999, cursor: 'pointer', transition: 'opacity 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                  {t.tag}
                </button>
              ))}
            </div>
          </div>

          {/* Full analysis table */}
          <div style={{ background: C.snow, border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.6fr 0.9fr 0.8fr 2fr', gap: 8, padding: '8px 14px', background: '#f8f8f4', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              {['Tag', 'Used', 'Avg Views', 'Avg Favs', 'Score'].map(h => (
                <span key={h} style={{ fontSize: 9, fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.06em', color: '#aaa' }}>{h}</span>
              ))}
            </div>
            {tagAnalysis.map((t, i) => (
              <div key={t.tag}
                style={{ display: 'grid', gridTemplateColumns: '2fr 0.6fr 0.9fr 0.8fr 2fr', gap: 8, padding: '8px 14px', borderBottom: '1px solid rgba(0,0,0,0.04)', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {i < 13 && <span style={{ fontSize: 8, background: C.orange, color: C.snow, padding: '1px 5px', borderRadius: 999, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600 }}>✓</span>}
                  <span style={{ fontSize: 12.5, color: '#1a1a1a', fontFamily: "'IBM Plex Mono',monospace" }}>{t.tag}</span>
                </div>
                <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: '#666' }}>{t.count}x</span>
                <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: '#666' }}>{t.avgViews.toLocaleString()}</span>
                <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: '#666' }}>{t.avgFavs}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 5, background: 'rgba(0,0,0,0.07)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(t.score / maxScore) * 100}%`, background: C.charcoal, borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", color: C.charcoal, width: 28 }}>{t.score}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!tagAnalysis.length && !isLoading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏷️</div>
          <p style={{ fontSize: 14, fontWeight: 500, color: C.charcoal }}>Tag optimizer ready</p>
          <p style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>Search any product to see the best performing tags</p>
        </div>
      )}
    </div>
  )
}
