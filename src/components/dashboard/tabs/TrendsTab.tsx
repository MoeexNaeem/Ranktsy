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

  // Peak season is only knowable from a REAL volume series. Etsy publishes none,
  // so this comes from Google or not at all — the old version read it off a
  // hardcoded curve that peaked in the same month for every keyword.
  const peak = useMemo(() => {
    const g = tr?.trends?.find((t: TrendData) => t.platform === 'google')
    if (!g?.points.length) return null
    const max = Math.max(...g.points.map((p: TrendPoint) => p.value))
    if (!max) return null
    return g.points.find((p: TrendPoint) => p.value === max)?.month ?? null
  }, [tr])

  const hasSeries = (tr?.trends?.length ?? 0) > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SearchBar value={input} onChange={setInput} onSubmit={go} placeholder="Track trends for any keyword…" button="Track →" />

      {peak && (
        <div style={{ background: C.orange, borderRadius: 12, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>📈</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: C.snow }}>Peak season: {peak}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)' }}>Google searches for &ldquo;{query}&rdquo; peak in {peak}. Start preparing listings 4–6 weeks earlier.</p>
          </div>
        </div>
      )}

      {isLoading && <div className="shimmer" style={{ height: 200, borderRadius: 10, background: '#e8e7e2' }} />}
      {isError && <ErrorBox>Failed to load trend data from Etsy. Please try again.</ErrorBox>}

      {tr && !isLoading && (
        <>
          <Card>
            <SectionTitle right={hasSeries ? <PlatformToggle active={plats} onChange={setPlats} /> : undefined}>
              Search Trend — &ldquo;{query}&rdquo;
            </SectionTitle>
            {hasSeries ? (
              <TrendChart data={tr.trends} activePlatforms={plats} />
            ) : (
              <div style={{ display: 'flex', gap: 12, padding: '18px 20px', background: C.canvas, borderRadius: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 17, lineHeight: 1.35 }}>📊</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: C.ink, marginBottom: 6 }}>No search-volume series available</p>
                  <p style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.65, maxWidth: 640 }}>
                    Etsy&apos;s API publishes no search volume and no history, so there is no honest Etsy demand curve to
                    plot. Connect <strong style={{ color: C.ink }}>Google Ads</strong> for real monthly volume, or see{' '}
                    <strong style={{ color: C.ink }}>Monthly Trends</strong> for when sellers actually list in this niche.
                  </p>
                </div>
              </div>
            )}
          </Card>

          <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card>
              <SectionTitle>Buyers by Country</SectionTitle>
              <CountryChart data={tr.countries} />
            </Card>
            <Card>
              <SectionTitle>Platform Breakdown</SectionTitle>
              {!hasSeries && (
                <p style={{ fontSize: 13, color: C.graphite, lineHeight: 1.6 }}>
                  Only platforms with a real volume series appear here. Etsy doesn&apos;t publish one.
                </p>
              )}
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
                        <span style={{ fontSize: 12, fontFamily: MONO, color: colors[t.platform], fontWeight: 500 }}>{pct}%</span>
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
