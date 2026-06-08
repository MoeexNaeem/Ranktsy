'use client'
import { useState, useCallback, useMemo } from 'react'
import { useKeywordSearch, useTrends } from '@/hooks/useKeywords'
import { useAppStore }     from '@/store/app'
import { KeywordTable }    from '../KeywordTable'
import { TrendChart }      from '@/components/charts/TrendChart'
import { CountryChart }    from '@/components/charts/CountryChart'
import { PlatformToggle }  from '../PlatformToggle'
import { C, formatNumber, formatPercent } from '@/utils'
import type { TrendPlatform } from '@/types'

function Skel({ h = 76 }: { h?: number }) {
  return <div className="shimmer" style={{ height: h, background: '#ddd', borderRadius: 8 }} />
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
      { label: 'Avg. Searches', value: formatNumber(avgSearches), sub: 'per month',    pct: Math.min((avgSearches / 80000) * 100, 100), color: C.forest },
      { label: 'Avg. Clicks',   value: formatNumber(avgClicks),   sub: 'per month',    pct: Math.min((avgClicks / 60000) * 100, 100),   color: C.mutedYellow },
      { label: 'Avg. CTR',      value: formatPercent(avgCtr),     sub: 'click-through',pct: avgCtr,                                      color: C.mutedTeal },
    ]
  }, [kw])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Search bar */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', background: C.warmGray, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.09)' }}>
          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 12, color: '#bbb' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Search any Etsy keyword..."
            style={{ background: 'transparent', border: 'none', padding: '9px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none', flex: 1, color: '#1a1a1a' }} />
        </div>
        <button onClick={search}
          style={{ background: C.forest, color: C.snow, border: 'none', padding: '0 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          Search →
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
        {isLoading || !stats
          ? [0, 1, 2].map(i => <Skel key={i} />)
          : stats.map(s => (
            <div key={s.label} style={{ background: C.warmGray, borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ fontSize: 9.5, fontFamily: "'IBM Plex Mono',monospace", color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</p>
              <p style={{ fontSize: 22, fontWeight: 600, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</p>
              <p style={{ fontSize: 10.5, color: '#bbb', marginTop: 2 }}>{s.sub}</p>
              <div style={{ height: 3, background: 'rgba(0,0,0,0.07)', borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, borderRadius: 999, transition: 'width 0.7s ease' }} />
              </div>
            </div>
          ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 9 }}>
        <div style={{ background: C.warmGray, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: C.forest }}>Search Trend (12 months)</p>
            {tr && <PlatformToggle active={plats} onChange={setPlats} />}
          </div>
          {tr ? <TrendChart data={tr.trends} activePlatforms={plats} /> : <Skel h={108} />}
        </div>
        <div style={{ background: C.warmGray, borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: C.forest, marginBottom: 9 }}>Searchers by Country</p>
          {tr ? <CountryChart data={tr.countries} /> : <Skel h={108} />}
        </div>
      </div>

      {/* Keyword table */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0', fontSize: 13, color: C.forest }}>
          <div className="shimmer" style={{ width: 6, height: 6, borderRadius: '50%', background: C.forest }} />
          Fetching from Etsy...
        </div>
      )}
      {isError && (
        <div style={{ background: '#fff0f0', borderRadius: 10, padding: '14px 16px', color: '#c00', fontSize: 13 }}>
          ⚠ Failed to load keyword data. Ensure your APIFY_API_TOKEN is set in .env.local.
        </div>
      )}
      {kw && !isLoading && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.forest }}>
              Keywords related to &ldquo;{kw.query}&rdquo;
            </p>
            <span style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono',monospace", color: '#aaa' }}>
              {kw.related.length} found · {kw.cachedAt ? 'cached' : 'live'}
            </span>
          </div>
          <KeywordTable rows={kw.related} />
        </div>
      )}
    </div>
  )
}
