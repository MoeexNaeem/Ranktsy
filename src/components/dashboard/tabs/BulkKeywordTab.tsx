'use client'
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { C, formatNumber } from '@/utils'
import { Card, SectionTitle, ErrorBox, Loading, EmptyState, tableCard, tableHead, th, tableRow, tdMono, tdTitle, CompBadge, primaryBtn, MONO } from '../kit'
import type { EtsyListing } from '@/types'

const GRID = '2fr 1fr 1fr 1fr 0.9fr'
const MAX = 10

function compLevel(count: number): 'Low' | 'Med' | 'High' {
  return count < 50000 ? 'Low' : count < 500000 ? 'Med' : 'High'
}

interface Row { keyword: string; count: number; avgViews: number; avgFavs: number }

export function BulkKeywordTab() {
  const [text, setText] = useState('silver necklace\nboho earrings\nhandmade candle\npersonalized gift')
  const [submitted, setSubmitted] = useState<string[]>([])

  const { data: rows, isLoading, isError } = useQuery({
    queryKey: ['bulk-keyword', submitted],
    queryFn: async () => {
      const results = await Promise.all(submitted.map(async kw => {
        try {
          const { data } = await axios.get(`/api/etsy/search?q=${encodeURIComponent(kw)}&limit=8`)
          const ls = (data.data ?? []) as EtsyListing[]
          const count = data.count ?? 0
          const avgViews = ls.length ? Math.round(ls.reduce((s, l) => s + (l.views ?? 0), 0) / ls.length) : 0
          const avgFavs = ls.length ? Math.round(ls.reduce((s, l) => s + (l.num_favorers ?? 0), 0) / ls.length) : 0
          return { keyword: kw, count, avgViews, avgFavs } as Row
        } catch { return { keyword: kw, count: 0, avgViews: 0, avgFavs: 0 } as Row }
      }))
      return results.sort((a, b) => a.count - b.count) // least competition first
    },
    enabled: submitted.length > 0,
    staleTime: 1000 * 60 * 30,
  })

  const go = useCallback(() => {
    const kws = text.split('\n').map(s => s.trim().toLowerCase()).filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i).slice(0, MAX)
    setSubmitted(kws)
  }, [text])

  const count = text.split('\n').map(s => s.trim()).filter(Boolean).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card pad="18px">
        <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: count > MAX ? C.danger : '#808080' }}>{Math.min(count, MAX)}/{MAX}</span>}>
          Compare up to {MAX} keywords
        </SectionTitle>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder={'One keyword per line…'} rows={5}
          style={{ width: '100%', background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 8, padding: '12px 14px', fontSize: 13.5, fontFamily: MONO, color: '#1a1a1a', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
        <button onClick={go} style={{ ...primaryBtn, marginTop: 12 }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
          Analyze keywords →
        </button>
      </Card>

      {isLoading && <Loading label="Analyzing keywords…" />}
      {isError && <ErrorBox>Failed to analyze keywords. Please try again.</ErrorBox>}

      {rows && rows.length > 0 && !isLoading && (
        <div>
          <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080' }}>sorted by lowest competition</span>}>Results</SectionTitle>
          <div className="rtable" style={tableCard}>
            <div style={tableHead(GRID)}>
              {['Keyword', 'Listings', 'Avg Views', 'Avg Favs', 'Competition'].map(h => <span key={h} style={th}>{h}</span>)}
            </div>
            {rows.map(r => (
              <div key={r.keyword} style={tableRow(GRID)}>
                <span style={tdTitle}>{r.keyword}</span>
                <span style={tdMono}>{formatNumber(r.count)}</span>
                <span style={tdMono}>{formatNumber(r.avgViews)}</span>
                <span style={tdMono}>{formatNumber(r.avgFavs)}</span>
                <CompBadge level={compLevel(r.count)} />
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#808080', marginTop: 12, lineHeight: 1.5 }}>
            &ldquo;Listings&rdquo; is the number of live Etsy results for each keyword (a competition proxy — Etsy&apos;s API doesn&apos;t expose raw search volume). Lower = easier to rank.
          </p>
        </div>
      )}

      {!submitted.length && !isLoading && (
        <EmptyState icon="📊" title="Bulk keyword comparison" sub="Paste keywords above to compare their competition side by side" />
      )}
    </div>
  )
}
