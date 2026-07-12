'use client'
import { useState, useCallback, useMemo } from 'react'
import { useTrends } from '@/hooks/useKeywords'
import { BarChart } from '@/components/charts/BarChart'
import { Card, SearchBar, SectionTitle, ErrorBox, Loading, StatCard, MONO } from '../kit'
import { C } from '@/utils'
import type { TrendData, TrendPoint } from '@/types'

export function MonthlyTrendsTab() {
  const [input, setInput] = useState('christmas ornament')
  const [query, setQuery] = useState('christmas ornament')
  const { data: tr, isLoading, isError } = useTrends(query)

  const go = useCallback(() => { const v = input.trim(); if (v.length >= 2) setQuery(v) }, [input])

  const points = useMemo<TrendPoint[]>(() => {
    const etsy = tr?.trends?.find((t: TrendData) => t.platform === 'etsy')
    return etsy?.points ?? []
  }, [tr])

  const { peak, low, colors } = useMemo(() => {
    if (!points.length) return { peak: null, low: null, colors: [] as string[] }
    const vals = points.map(p => p.value)
    const max = Math.max(...vals), min = Math.min(...vals)
    return {
      peak: points.find(p => p.value === max) ?? null,
      low:  points.find(p => p.value === min) ?? null,
      colors: points.map(p => p.value === max ? C.orange : p.value === min ? 'rgba(207,70,58,0.35)' : 'rgba(60,60,60,0.20)'),
    }
  }, [points])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <SearchBar value={input} onChange={setInput} onSubmit={go}
          placeholder="See a keyword's seasonal shape… e.g. christmas ornament" button="Chart it →" />
        <p style={{ fontSize: 11.5, color: '#9a9a92', marginTop: 8, fontFamily: MONO }}>
          Relative month-by-month interest derived from live Etsy listing engagement. Shows <em>when</em> demand rises, not absolute search counts.
        </p>
      </div>

      {isLoading && <Loading label="Mapping the seasons…" />}
      {isError && <ErrorBox>Couldn&apos;t load seasonal data. Please try again.</ErrorBox>}

      {tr && !isLoading && points.length > 0 && (
        <>
          <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            <StatCard label="Peak month"  value={peak?.month ?? '—'} accent={C.orange} sub="Best time to be ranking" />
            <StatCard label="Quietest month" value={low?.month ?? '—'} accent={C.charcoal} sub="Lowest relative demand" />
            <StatCard label="Prep by" value={prepMonth(peak?.month)} sub="List ~6 weeks before peak" />
          </div>

          <Card>
            <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080' }}>12-month shape</span>}>
              Seasonality — &ldquo;{query}&rdquo;
            </SectionTitle>
            <BarChart axis="x" height={240}
              labels={points.map(p => p.month)}
              values={points.map(p => p.value)}
              colors={colors} />
          </Card>

          {peak && (
            <div style={{ background: C.orange, borderRadius: 10, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18 }}>🗓️</span>
              <p style={{ fontSize: 12.5, color: C.snow, lineHeight: 1.5 }}>
                Interest in &ldquo;{query}&rdquo; peaks around <strong>{peak.month}</strong>. Have listings live and optimized by <strong>{prepMonth(peak.month)}</strong> so they gain traction before the rush.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function prepMonth(peak?: string): string {
  if (!peak) return '—'
  const i = MONTHS.indexOf(peak)
  if (i < 0) return '—'
  // ~6 weeks earlier ≈ 1.5 months
  return MONTHS[(i - 2 + 12) % 12]
}
