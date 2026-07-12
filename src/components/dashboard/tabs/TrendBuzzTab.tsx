'use client'
import { useState, useCallback, useMemo } from 'react'
import { useTrendBuzz } from '@/hooks/useKeywords'
import { BarChart } from '@/components/charts/BarChart'
import { MiniTrend } from '@/components/charts/MiniTrend'
import {
  Card, SearchBar, SectionTitle, ErrorBox, Loading, EmptyState,
  CompBadge, tableCard, tableHead, th, tableRow, MONO,
} from '../kit'
import { C, formatNumber } from '@/utils'
import type { BuzzItem } from '@/lib/etsy'

const GRID = '2fr 0.8fr 0.9fr 1fr 0.9fr'

export function TrendBuzzTab() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const { data, isLoading, isFetching, isError } = useTrendBuzz(query)

  const go = useCallback(() => setQuery(input.trim()), [input])

  const top12 = useMemo(() => (data ?? []).slice(0, 12), [data])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <SearchBar value={input} onChange={setInput} onSubmit={go}
          placeholder="Leave blank for Etsy-wide buzz, or scope to a niche…" button="Find buzz →" />
        <p style={{ fontSize: 11.5, color: '#9a9a92', marginTop: 8, fontFamily: MONO }}>
          Emerging keywords ranked by a relative <strong>heat index</strong> — tag frequency × listing engagement across a live Etsy sample. Not absolute search volume.
        </p>
      </div>

      {isLoading && <Loading label="Reading the Etsy tea leaves…" />}
      {isError && <ErrorBox>Couldn&apos;t load trend buzz from Etsy. Please try again.</ErrorBox>}

      {data && !isLoading && data.length === 0 && (
        <EmptyState icon="🫧" title="No buzz found" sub="Try a broader niche or leave the box blank." />
      )}

      {data && data.length > 0 && (
        <>
          {/* Heat leaderboard chart */}
          <Card>
            <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080' }}>{isFetching ? 'refreshing…' : `top ${top12.length} · heat index`}</span>}>
              {query ? `Buzzing in “${query}”` : 'Buzzing across Etsy'}
            </SectionTitle>
            <BarChart axis="y" height={300}
              labels={top12.map(b => b.keyword)}
              values={top12.map(b => b.heat)}
              highlightMax />
          </Card>

          {/* Full table with sparklines */}
          <div className="rtable" style={tableCard}>
            <div style={tableHead(GRID)}>
              {['Keyword', 'Listings', 'Avg Views', 'Momentum', 'Heat'].map(h => <span key={h} style={th}>{h}</span>)}
            </div>
            {data.map((b: BuzzItem) => (
              <div key={b.keyword} style={tableRow(GRID)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.keyword}</span>
                  <CompBadge level={b.competition} />
                </div>
                <span style={{ fontSize: 11.5, fontFamily: MONO, color: '#6E6E64' }}>{b.listings}</span>
                <span style={{ fontSize: 11.5, fontFamily: MONO, color: '#6E6E64' }}>{formatNumber(b.avgViews)}</span>
                <MiniTrend data={b.trend} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 5, background: '#EEEDE8', borderRadius: 999, overflow: 'hidden', minWidth: 40 }}>
                    <div style={{ height: '100%', width: `${b.heat}%`, background: C.orange, borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: 11, fontFamily: MONO, color: C.orange, fontWeight: 500, width: 26, textAlign: 'right' }}>{b.heat}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
