'use client'
import { useState, useCallback, useMemo } from 'react'
import { useTopSellers } from '@/hooks/useKeywords'
import { BarChart } from '@/components/charts/BarChart'
import { BubbleChart } from '@/components/charts/InsightCharts'
import {
  SearchBar, Card, SectionTitle, ErrorBox, Loading, EmptyState,
  tableCard, tableHead, th, tableRow, MONO,
} from '../kit'
import { C, formatNumber } from '@/utils'
import type { TopSeller } from '@/lib/etsy'

const GRID = '0.4fr 2fr 0.8fr 1fr 1fr 1fr'

export function TopSellersTab() {
  const [input, setInput] = useState('personalized jewelry')
  const [query, setQuery] = useState('personalized jewelry')
  const { data, isLoading, isFetching, isError } = useTopSellers(query)

  const go = useCallback(() => { const v = input.trim(); if (v.length >= 2) setQuery(v) }, [input])

  const top10 = useMemo(() => (data ?? []).slice(0, 10), [data])
  const cur = data?.[0]?.currency === 'USD' ? '$' : (data?.[0]?.currency ?? '$') + ' '
  const bubble = useMemo(() => (data ?? []).slice(0, 15).map((s, i) => ({
    x: s.totalViews, y: s.totalFaves, r: Math.max(8, Math.min(30, 7 + s.listings * 3.5)),
    label: s.shop_name, color: i < 3 ? C.orange : C.charcoal,
  })), [data])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <SearchBar value={input} onChange={setInput} onSubmit={go}
          placeholder="Which niche's top shops? e.g. macrame wall hanging" button="Rank shops →" />
        <p style={{ fontSize: 13, color: C.graphite, marginTop: 10, fontFamily: MONO }}>
          Shops ranked by total <strong>favorites &amp; views</strong> across their listings in this niche (official-API engagement signals — not sales figures, which Etsy doesn&apos;t expose).
        </p>
      </div>

      {isLoading && <Loading label="Ranking the top shops…" />}
      {isError && <ErrorBox>Couldn&apos;t load top sellers from Etsy. Please try again.</ErrorBox>}

      {data && !isLoading && data.length === 0 && (
        <EmptyState icon="🏆" title="No shops found" sub="Try a broader keyword." />
      )}

      {data && data.length > 0 && (
        <>
          <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            <Card>
              <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>{isFetching ? 'refreshing…' : 'by total favorites'}</span>}>
                Top shops for &ldquo;{query}&rdquo;
              </SectionTitle>
              <BarChart axis="y" height={300}
                labels={top10.map(s => s.shop_name)}
                values={top10.map(s => s.totalFaves)}
                highlightMax />
            </Card>
            <Card>
              <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>bubble = listings</span>}>Views vs favorites</SectionTitle>
              <p style={{ fontSize: 13, color: C.graphite, marginTop: -8, marginBottom: 10 }}>Shops toward the <strong style={{ color: C.orange }}>top-left</strong> earn the most favorites per view — the strongest buyer pull.</p>
              <BubbleChart points={bubble} xLabel="Total views" yLabel="Total favorites" />
            </Card>
          </div>

          <div className="rtable" style={tableCard}>
            <div style={tableHead(GRID)}>
              {['#', 'Shop', 'Listings', 'Views', 'Favorites', 'Avg Price'].map(h => <span key={h} style={th}>{h}</span>)}
            </div>
            {data.map((s: TopSeller, i) => (
              <a key={s.shop_name} href={s.shopUrl} target="_blank" rel="noopener noreferrer"
                style={{ ...tableRow(GRID), textDecoration: 'none', transition: 'background 0.12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ fontSize: 14, fontFamily: MONO, fontWeight: 600, color: i < 3 ? C.orange : C.stone }}>{i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14.5, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.shop_name}</p>
                  <p style={{ fontSize: 12.5, color: C.graphite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.topListing.title}</p>
                </div>
                <span style={{ fontSize: 14, fontFamily: MONO, color: C.ink }}>{s.listings}</span>
                <span style={{ fontSize: 14, fontFamily: MONO, color: C.ink }}>{formatNumber(s.totalViews)}</span>
                <span style={{ fontSize: 14, fontFamily: MONO, color: C.orange, fontWeight: 600 }}>{formatNumber(s.totalFaves)}</span>
                <span style={{ fontSize: 14, fontFamily: MONO, color: C.ink }}>{cur}{s.avgPrice.toFixed(2)}</span>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
