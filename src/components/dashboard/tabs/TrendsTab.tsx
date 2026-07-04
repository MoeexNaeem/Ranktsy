'use client'
import { useState, useCallback, useMemo } from 'react'
import { useTrends } from '@/hooks/useKeywords'
import { TrendChart }    from '@/components/charts/TrendChart'
import { CountryChart }  from '@/components/charts/CountryChart'
import { PlatformToggle } from '../PlatformToggle'
import { Card, SearchBar, SectionTitle, ErrorBox, MONO } from '../kit'
import { C } from '@/utils'
import type { TrendPlatform, TrendData, TrendPoint } from '@/types'

export function TrendsTab() {
  const [input, setInput]  = useState('handmade candles')
  const [query, setQuery]  = useState('handmade candles')
  const [plats, setPlats]  = useState<TrendPlatform[]>(['etsy', 'google'])

  const { data: tr, isLoading, isError } = useTrends(query)

  const go = useCallback(() => {
    const v = input.trim(); if (v.length < 2) return; setQuery(v)
  }, [input])

  const peakMonth = useMemo(() => {
    if (!tr) return null
    const etsyData = tr.trends.find((t: TrendData) => t.platform === 'etsy')
    if (!etsyData) return null
    const max = Math.max(...etsyData.points.map((p: TrendPoint) => p.value))
    return etsyData.points.find((p: TrendPoint) => p.value === max)?.month
  }, [tr])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SearchBar value={input} onChange={setInput} onSubmit={go} placeholder="Track trends for any keyword…" button="Track →" />

      {peakMonth && (
        <div style={{ background: C.orange, borderRadius: 10, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>📈</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.snow }}>Peak season: {peakMonth}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)' }}>Etsy searches for &ldquo;{query}&rdquo; peak in {peakMonth}. Start preparing listings 4–6 weeks earlier.</p>
          </div>
        </div>
      )}

      {isLoading && <div className="shimmer" style={{ height: 200, borderRadius: 10, background: '#e8e7e2' }} />}
      {isError && <ErrorBox>Failed to load trend data from Etsy. Please try again.</ErrorBox>}

      {tr && !isLoading && (
        <>
          <Card>
            <SectionTitle right={<PlatformToggle active={plats} onChange={setPlats} />}>Search Trend — &ldquo;{query}&rdquo;</SectionTitle>
            <TrendChart data={tr.trends} activePlatforms={plats} />
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card>
              <SectionTitle>Buyers by Country</SectionTitle>
              <CountryChart data={tr.countries} />
            </Card>
            <Card>
              <SectionTitle>Platform Breakdown</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tr.trends.map((t: TrendData) => {
                  const total = Math.max(...t.points.map((p: TrendPoint) => p.value))
                  const latest = t.points[t.points.length - 1]?.value ?? 0
                  const pct = Math.round((latest / (total || 1)) * 100)
                  const colors: Record<string, string> = { etsy: C.orange, google: C.charcoal, amazon: C.charcoalMid, ebay: C.inkFaint }
                  return (
                    <div key={t.platform}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontFamily: MONO, color: C.inkSoft, textTransform: 'capitalize' }}>{t.platform}</span>
                        <span style={{ fontSize: 12, fontFamily: MONO, color: colors[t.platform], fontWeight: 600 }}>{pct}%</span>
                      </div>
                      <div style={{ height: 5, background: '#EEEDE8', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: colors[t.platform], borderRadius: 999, transition: 'width 0.6s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
