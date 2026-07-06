'use client'
import { useState, useCallback, useMemo } from 'react'
import { useKeywordSearch, useTrends } from '@/hooks/useKeywords'
import { useAppStore }     from '@/store/app'
import { KeywordTable }    from '../KeywordTable'
import { TrendChart }      from '@/components/charts/TrendChart'
import { CountryChart }    from '@/components/charts/CountryChart'
import { PlatformToggle }  from '../PlatformToggle'
import { Card, SearchBar, StatCard, SectionTitle, ErrorBox, Loading, MONO } from '../kit'
import { C, formatNumber, formatPercent } from '@/utils'
import type { TrendPlatform } from '@/types'

function Skel({ h = 82 }: { h?: number }) {
  return <div className="shimmer" style={{ height: h, background: '#e8e7e2', borderRadius: 10 }} />
}

export function KeywordsTab() {
  const [input,  setInput]  = useState('silver necklace')
  const [query,  setQuery]  = useState('silver necklace')
  const [plats,  setPlats]  = useState<TrendPlatform[]>(['etsy', 'google'])
  const addR = useAppStore(s => s.addRecentSearch)

  const { data: kw, isLoading, isError } = useKeywordSearch(query)
  const { data: tr } = useTrends(query)

  const search = useCallback(() => {
    const q = input.trim(); if (q.length < 2) return
    setQuery(q); addR(q)
  }, [input, addR])

  const stats = useMemo(() => {
    if (!kw) return null
    const { avgSearches, avgClicks, avgCtr } = kw.stats
    return [
      { label: 'Avg. Searches', value: formatNumber(avgSearches), sub: 'per month',    pct: Math.min((avgSearches / 80000) * 100, 100), color: C.charcoal },
      { label: 'Avg. Clicks',   value: formatNumber(avgClicks),   sub: 'per month',    pct: Math.min((avgClicks / 60000) * 100, 100),   color: C.orange },
      { label: 'Avg. CTR',      value: formatPercent(avgCtr),     sub: 'click-through',pct: avgCtr,                                      color: C.charcoal },
    ]
  }, [kw])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SearchBar value={input} onChange={setInput} onSubmit={search} placeholder="Search any Etsy keyword…" />

      {/* Stats */}
      <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {isLoading || !stats
          ? [0, 1, 2].map(i => <Skel key={i} />)
          : stats.map(s => <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} accent={s.color} pct={s.pct} />)}
      </div>

      {/* Charts */}
      <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12 }}>
        <Card>
          <SectionTitle right={tr ? <PlatformToggle active={plats} onChange={setPlats} /> : undefined}>Search Trend (12 months)</SectionTitle>
          {tr ? <TrendChart data={tr.trends} activePlatforms={plats} /> : <Skel h={112} />}
        </Card>
        <Card>
          <SectionTitle>Searchers by Country</SectionTitle>
          {tr ? <CountryChart data={tr.countries} /> : <Skel h={112} />}
        </Card>
      </div>

      {/* Keyword table */}
      {isLoading && <Loading />}
      {isError && <ErrorBox>Failed to load keyword data from Etsy. Please try again.</ErrorBox>}
      {kw && !isLoading && (
        <div>
          <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: C.inkFaint }}>{kw.related.length} found · {kw.cachedAt ? 'cached' : 'live'}</span>}>
            Keywords related to &ldquo;{kw.query}&rdquo;
          </SectionTitle>
          <KeywordTable rows={kw.related} />
        </div>
      )}
    </div>
  )
}
