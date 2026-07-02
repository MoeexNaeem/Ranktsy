'use client'
import { useState, useCallback, useMemo } from 'react'
import { useTrends } from '@/hooks/useKeywords'
import { TrendChart }    from '@/components/charts/TrendChart'
import { CountryChart }  from '@/components/charts/CountryChart'
import { PlatformToggle } from '../PlatformToggle'
import { C } from '@/utils'
import type { TrendPlatform } from '@/types'

export function TrendsTab() {
  const [input, setInput]  = useState('handmade candles')
  const [query, setQuery]  = useState('handmade candles')
  const [plats, setPlats]  = useState<TrendPlatform[]>(['etsy', 'google'])

  const { data: tr, isLoading, isError } = useTrends(query)

  const go = useCallback(() => {
    const v = input.trim(); if (v.length < 2) return; setQuery(v)
  }, [input])

  // Peak month detection
  const peakMonth = useMemo(() => {
    if (!tr) return null
    const etsyData = tr.trends.find((t: import("@/types").TrendData) => t.platform === 'etsy')
    if (!etsyData) return null
    const max = Math.max(...(etsyData as import("@/types").TrendData).points.map((p: import("@/types").TrendPoint) => p.value))
    return etsyData.points.find((p: import("@/types").TrendPoint) => p.value === max)?.month
  }, [tr])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Search */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', background: C.warmGray, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.09)', maxWidth: 480 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()}
            placeholder="Track trends for any keyword..."
            style={{ background: 'transparent', border: 'none', padding: '9px 14px', fontSize: 13, fontFamily: 'inherit', outline: 'none', flex: 1, color: '#1a1a1a' }} />
        </div>
        <button onClick={go}
          style={{ background: C.charcoal, color: C.snow, border: 'none', padding: '0 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          Track →
        </button>
      </div>

      {peakMonth && (
        <div style={{ background: C.orange, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📈</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.snow }}>Peak season: {peakMonth}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>Etsy searches for &ldquo;{query}&rdquo; peak in {peakMonth}. Start preparing listings 4-6 weeks earlier.</p>
          </div>
        </div>
      )}

      {isLoading && <div className="shimmer" style={{ height: 200, borderRadius: 12, background: '#ddd' }} />}
      {isError && <div style={{ background: '#fff0f0', borderRadius: 10, padding: '14px 16px', color: '#c00', fontSize: 13 }}>⚠ Failed. Check APIFY_API_TOKEN.</div>}

      {tr && !isLoading && (
        <>
          <div style={{ background: C.warmGray, borderRadius: 12, padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.charcoal }}>Search Trend — &ldquo;{query}&rdquo;</p>
              <PlatformToggle active={plats} onChange={setPlats} />
            </div>
            <TrendChart data={tr.trends} activePlatforms={plats} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: C.warmGray, borderRadius: 12, padding: '16px' }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: C.charcoal, marginBottom: 12 }}>Buyers by Country</p>
              <CountryChart data={tr.countries} />
            </div>
            <div style={{ background: C.warmGray, borderRadius: 12, padding: '16px' }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: C.charcoal, marginBottom: 12 }}>Platform Breakdown</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tr.trends.map((t: import("@/types").TrendData) => {
                  const total = Math.max(...t.points.map((p: import("@/types").TrendPoint) => p.value))
                  const latest= t.points[t.points.length - 1]?.value ?? 0
                  const pct   = Math.round((latest / (total || 1)) * 100)
                  const colors: Record<string,string> = { etsy: C.charcoal, google: C.orangeLight, amazon: C.charcoal, ebay: C.lightGray }
                  return (
                    <div key={t.platform}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", color: '#555', textTransform: 'capitalize' }}>{t.platform}</span>
                        <span style={{ fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", color: colors[t.platform], fontWeight: 600 }}>{pct}%</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(0,0,0,0.07)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: colors[t.platform], borderRadius: 999, transition: 'width 0.6s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
