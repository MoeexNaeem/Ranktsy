'use client'
import { useState, useCallback, useMemo } from 'react'
import { useTrendBuzz } from '@/hooks/useKeywords'
import { BarChart } from '@/components/charts/BarChart'
import { MiniTrend } from '@/components/charts/MiniTrend'
import {
  Card, SearchBar, SectionTitle, ErrorBox, Loading, EmptyState,
  CompBadge, tableCard, tableHead, th, tableRow, MONO,
} from '../kit'
import { AiInsights } from '../AiInsights'
import { C, D, formatNumber } from '@/utils'
import type { BuzzItem } from '@/lib/etsy'
import type { AiFact } from '@/types'

const GRID = '2fr 0.7fr 0.8fr 0.8fr 1fr 0.7fr 0.9fr'

export function TrendBuzzTab() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const { data, isLoading, isFetching, isError } = useTrendBuzz(query)

  const go = useCallback(() => setQuery(input.trim()), [input])

  const top12 = useMemo(() => (data ?? []).slice(0, 12), [data])

  // Real facts for the AI read — which emerging tags are genuinely worth chasing.
  const aiFacts = useMemo<AiFact[]>(() => {
    const rows = (data ?? []).slice(0, 6)
    return rows.map<AiFact>(b => ({
      label: b.keyword,
      value: `heat ${b.heat}`,
      hint: `${b.competition} competition, ${formatNumber(b.avgViews)} avg views, ${b.medianAgeDays == null ? 'age n/a' : b.medianAgeDays >= 365 ? `${(b.medianAgeDays / 365).toFixed(1)}y median age` : `${b.medianAgeDays}d median age`}`,
    }))
  }, [data])

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

          {/* Full table — every column a real Etsy measurement. The old
              "Momentum" sparkline was a sine wave keyed to the row index. */}
          <div className="rtable" style={tableCard}>
            <div style={tableHead(GRID)}>
              {['Keyword', 'Listings', 'Avg Views', 'Avg Favs', 'Listings / month', 'Median age', 'Heat'].map(h => <span key={h} style={th}>{h}</span>)}
            </div>
            {data.map((b: BuzzItem) => (
              <div key={b.keyword} style={tableRow(GRID)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.keyword}</span>
                  <CompBadge level={b.competition} />
                </div>
                <span style={{ fontSize: 11.5, fontFamily: MONO, color: '#6E6E64' }}>{b.listings}</span>
                <span style={{ fontSize: 11.5, fontFamily: MONO, color: '#2E6DB4' }}>{formatNumber(b.avgViews)}</span>
                <span style={{ fontSize: 11.5, fontFamily: MONO, color: D.hard }}>{formatNumber(b.avgFavorites)}</span>
                <MiniTrend data={b.listingsByMonth} title={`${b.keyword} — listings created per calendar month (Jan→Dec)`} />
                {/* Young listings carrying a tag is the real "emerging" signal. */}
                <span title={b.medianAgeDays != null ? 'Median age of the listings using this tag' : 'No creation dates available'}
                  style={{ fontSize: 11.5, fontFamily: MONO, color: b.medianAgeDays == null ? C.stone : b.medianAgeDays < 90 ? D.good : b.medianAgeDays < 365 ? D.mid : C.graphite }}>
                  {b.medianAgeDays == null ? '—' : b.medianAgeDays >= 365 ? `${(b.medianAgeDays / 365).toFixed(1)}y` : `${b.medianAgeDays}d`}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 5, background: '#EEEDE8', borderRadius: 999, overflow: 'hidden', minWidth: 40 }}>
                    <div style={{ height: '100%', width: `${b.heat}%`, background: C.orange, borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: 11, fontFamily: MONO, color: C.orange, fontWeight: 500, width: 26, textAlign: 'right' }}>{b.heat}</span>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.6 }}>
            Listings, views, favourites and creation dates are real Etsy fields. <strong>Heat</strong> is a relative
            0–100 index over those measurements (how many sampled listings carry the tag × how well they engage) — it is
            not a search volume; Etsy publishes none. <strong>Median age</strong> is the real age of the listings using
            the tag: young listings on a busy tag is what &ldquo;emerging&rdquo; actually looks like.
          </p>

          {/* AI read: which of these emerging tags to actually chase. */}
          {aiFacts.length >= 2 && (
            <AiInsights
              tool="Trend Buzz"
              subject={query || 'Etsy-wide buzz'}
              facts={aiFacts}
              notes="Heat is a relative 0–100 index (tag frequency × listing engagement) — NOT search volume, which Etsy doesn't publish. A low median age on a high-heat tag is the real 'emerging' signal. Interpret which tags look like genuine early opportunities vs already-crowded, and how a seller should act."
            />
          )}
        </>
      )}
    </div>
  )
}
