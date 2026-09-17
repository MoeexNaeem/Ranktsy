'use client'
/**
 * Sampled market stats for a keyword (listings analysed, median price, hearts and
 * views), measured from the live top-100 listings currently ranking for it.
 *
 * Shared by Search Results Analysis and Market Activity so both read identically.
 * Tiles rather than the old divider rules: the rules broke across rows whenever the
 * strip wrapped, leaving stray vertical lines hanging beside Median Price.
 */
import { memo } from 'react'
import { Card, MONO } from '../kit'
import { C, D, formatNumber } from '@/utils'
import type { SearchAnalysis } from '@/types'

const sym = (c?: string) => (c === 'USD' ? '$' : c === 'EUR' ? '€' : c === 'GBP' ? '£' : c ? `${c} ` : '$')

function Tile({ label, value, hint, color = C.ink }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <div style={{ border: `1px solid ${C.hair}`, borderRadius: 12, padding: '12px 14px', background: C.paper, minWidth: 0 }}>
      <p style={{ fontSize: 11, fontFamily: MONO, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 600, color, letterSpacing: '-0.02em', lineHeight: 1.15, margin: '7px 0 0', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>
      {hint && <p style={{ fontSize: 11, color: C.stone, margin: '5px 0 0', lineHeight: 1.45 }}>{hint}</p>}
    </div>
  )
}

/** The tiles themselves, so a parent can place them inside its own card. */
export const SampledStatsGrid = memo(function SampledStatsGrid({ analysis }: { analysis: SearchAnalysis }) {
  const a = analysis
  const cur = sym(a.currency)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
      <Tile label="Listings Analyzed" value={formatNumber(a.listingsAnalyzed)} hint="live sample" />
      {/* Median leads, not the mean: a handful of collector-priced pieces drags
          the average far above what a typical listing actually sells for. */}
      <Tile label="Median Price" value={`${cur}${a.medianPrice.toFixed(2)}`} hint={`avg ${cur}${a.averagePrice.toFixed(2)} · ${a.priceSample} of ${a.listingsAnalyzed} in ${a.currency}`} color={C.orange} />
      <Tile label="Average Hearts" value={formatNumber(a.averageHearts)} hint="favorites / listing" color={D.hard} />
      <Tile label="Total Views" value={formatNumber(a.totalViews)} hint="lifetime, sampled" color="#2E6DB4" />
      <Tile label="Avg. Views" value={formatNumber(a.avgViews)} hint="per listing" color="#2E6DB4" />
      <Tile label="Avg. Daily Views" value={a.avgDailyViews != null ? a.avgDailyViews.toFixed(2) : '-'} hint={a.avgDailyViews != null ? 'views / day' : 'no listing dates'} color={D.good} />
      <Tile label="Avg. Weekly Views" value={a.avgWeeklyViews != null ? a.avgWeeklyViews.toFixed(2) : '-'} hint={a.avgWeeklyViews != null ? 'views / week' : 'no listing dates'} color={D.good} />
    </div>
  )
})

/** The same tiles wrapped in their own card (Search Results Analysis uses this). */
export const SampledStatsCard = memo(function SampledStatsCard({ analysis }: { analysis: SearchAnalysis }) {
  return <Card><SampledStatsGrid analysis={analysis} /></Card>
})
