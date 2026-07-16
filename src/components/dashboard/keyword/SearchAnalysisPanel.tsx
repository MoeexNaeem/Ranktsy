'use client'
import { memo, useMemo } from 'react'
import { BarChart } from '@/components/charts/BarChart'
import { TagCloud } from '@/components/charts/TagCloud'
import { Card, SectionTitle, EmptyState, MONO } from '../kit'
import { Shimmer } from '../skeletons'
import { C, D, formatNumber } from '@/utils'
import type { SearchAnalysis } from '@/types'

const CUR: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$' }
const sym = (c?: string) => CUR[c ?? 'USD'] ?? (c ? c + ' ' : '$')

// ─── Top metric strip ────────────────────────────────────────────────────────
function Metric({ label, value, hint, color = C.ink, last }: {
  label: string; value: string; hint?: string; color?: string; last?: boolean
}) {
  return (
    <div style={{ flex: '1 1 130px', minWidth: 118, padding: '4px 18px 4px 0', borderRight: last ? 'none' : `1px solid ${C.hair}` }}>
      <p style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: 500, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 9 }}>{label}</p>
      <p style={{ fontSize: 30, fontWeight: 500, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</p>
      {hint && <p style={{ fontSize: 11.5, color: C.stone, marginTop: 6 }}>{hint}</p>}
    </div>
  )
}

export const SearchAnalysisPanel = memo(function SearchAnalysisPanel({
  analysis, onSelectTag,
}: { analysis?: SearchAnalysis; onSelectTag?: (tag: string) => void }) {
  const cur = sym(analysis?.currency)

  const priceChart = useMemo(() => {
    if (!analysis?.priceBuckets.length) return null
    const max = Math.max(...analysis.priceBuckets.map(b => b.count))
    return {
      labels: analysis.priceBuckets.map(b => b.label),
      values: analysis.priceBuckets.map(b => b.count),
      // Modal bucket in orange; everything else in a calm blue so the peak pops.
      colors: analysis.priceBuckets.map(b =>
        b.label === analysis.medianBucket ? C.orange : b.count === max ? '#2E6DB4' : 'rgba(46,109,180,0.42)'),
    }
  }, [analysis])

  const procChart = useMemo(() => {
    if (!analysis?.processing.length) return null
    const order = [...analysis.processing.slice(0, 8)].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
    return {
      labels: order.map(p => p.label),
      values: order.map(p => p.count),
      colors: order.map((_, i) => D.series[i % D.series.length] as string),
    }
  }, [analysis])

  const ageChart = useMemo(() => {
    if (!analysis?.ages.length) return null
    // Newer → older reads green → red: a page full of 2-year-old listings is a
    // harder room to walk into than one full of last month's.
    const ramp = [D.good, D.fair, D.mid, D.warm, D.hard, D.hard]
    return {
      labels: analysis.ages.map(a => a.label),
      values: analysis.ages.map(a => a.count),
      colors: analysis.ages.map((_, i) => ramp[Math.min(i, ramp.length - 1)]),
    }
  }, [analysis])

  if (!analysis || !analysis.listingsAnalyzed) {
    return <EmptyState icon="📊" title="No analysis available" sub="Etsy returned no listings to analyse for this keyword." />
  }

  const a = analysis

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Metric strip */}
      <Card>
        <div className="rwrap-sm" style={{ display: 'flex', flexWrap: 'wrap', gap: '22px 0' }}>
          <Metric label="Listings Analyzed" value={formatNumber(a.listingsAnalyzed)} hint="live sample" />
          {/* Median leads, not the mean: a handful of collector-priced pieces drags
              the average far above what a typical listing actually sells for. */}
          <Metric label="Median Price" value={`${cur}${a.medianPrice.toFixed(2)}`} hint={`avg ${cur}${a.averagePrice.toFixed(2)} · ${a.priceSample} of ${a.listingsAnalyzed} in ${a.currency}`} color={C.orange} />
          <Metric label="Average Hearts" value={formatNumber(a.averageHearts)} hint="favorites / listing" color={D.hard} />
          <Metric label="Total Views"    value={formatNumber(a.totalViews)} hint="lifetime, sampled" color="#2E6DB4" />
          <Metric label="Avg. Views"     value={formatNumber(a.avgViews)} hint="per listing" color="#2E6DB4" />
          <Metric label="Avg. Daily Views"  value={a.avgDailyViews != null ? a.avgDailyViews.toFixed(2) : '—'} hint={a.avgDailyViews != null ? 'views / day' : 'no listing dates'} color={D.good} />
          <Metric label="Avg. Weekly Views" value={a.avgWeeklyViews != null ? a.avgWeeklyViews.toFixed(2) : '—'} hint={a.avgWeeklyViews != null ? 'views / week' : 'no listing dates'} color={D.good} last />
        </div>
      </Card>

      {/* Tags + categories */}
      <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 12, alignItems: 'start' }}>
        <Card>
          <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>{a.tagCloud.length} tags</span>}>Most Popular Tags</SectionTitle>
          <TagCloud tags={a.tagCloud} onSelect={onSelectTag} />
          <p style={{ fontSize: 11.5, color: C.stone, marginTop: 8, lineHeight: 1.55 }}>
            Size and colour show how many of the top {a.listingsAnalyzed} listings use each tag. Click a tag to research it.
          </p>
        </Card>

        <Card>
          <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>%</span>}>Most Popular Categories</SectionTitle>
          {a.categories.length ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {a.categories.map((c, i) => (
                <div key={c.category} style={{ padding: '11px 0', borderBottom: i === a.categories.length - 1 ? 'none' : `1px solid ${C.hair}` }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 7 }}>
                    <span style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.4 }}>{c.category}</span>
                    <span style={{ fontSize: 14, fontFamily: MONO, fontWeight: 600, color: D.series[i % D.series.length], flexShrink: 0 }}>{c.pct}%</span>
                  </div>
                  <div style={{ height: 5, background: C.bone, borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${c.pct}%`, background: D.series[i % D.series.length], borderRadius: 999, transition: 'width 0.6s' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : a.categoriesPending ? (
            /* The names just aren't fetched yet — saying "no categories" would
               report a fetch delay as a fact about the listings. */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i}>
                  <Shimmer h={12} w={`${70 - i * 8}%`} r={3} />
                  <div style={{ height: 7 }} />
                  <Shimmer h={5} r={999} />
                  <div style={{ height: 8 }} />
                </div>
              ))}
              <p style={{ fontSize: 11.5, color: C.stone, lineHeight: 1.5 }}>
                Loading Etsy&apos;s category names (a one-off 365 KB fetch — instant from here on).
              </p>
            </div>
          ) : (
            <EmptyState icon="🗂️" title="No categories" sub="These listings don't expose a taxonomy." />
          )}
        </Card>
      </div>

      {/* Price + processing */}
      <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 12, alignItems: 'start' }}>
        <Card>
          <SectionTitle right={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.graphite }}>
              Median Price
              <span style={{ fontFamily: MONO, fontWeight: 600, color: C.orange, background: C.orangeFaint, padding: '3px 11px', borderRadius: 100 }}>
                {cur}{a.medianPrice.toFixed(2)}
              </span>
            </span>
          }>Price Range</SectionTitle>
          {priceChart
            ? <BarChart labels={priceChart.labels} values={priceChart.values} colors={priceChart.colors} height={280} />
            : <EmptyState icon="💲" title="No price data" />}
          <p style={{ fontSize: 11.5, color: C.stone, marginTop: 8, lineHeight: 1.55 }}>
            How many of the sampled listings sit at each price. The <strong style={{ color: C.orange }}>orange</strong> bar is the median.
            {' '}Covers the <strong style={{ color: C.graphite }}>{a.priceSample}</strong> listings priced in {a.currency} — Etsy prices each
            listing in its own shop currency and publishes no exchange rate, so mixing them would compare apples to oranges.
            {a.priceOutliers > 0 && <> The final <strong style={{ color: C.graphite }}>{a.medianBucket?.endsWith('+') ? '' : ''}“+”</strong> bar holds {a.priceOutliers} listing{a.priceOutliers === 1 ? '' : 's'} above the top of the range.</>}
          </p>
        </Card>

        <Card>
          <SectionTitle right={a.medianAgeDays != null ? (
            <span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite, background: C.bone, padding: '4px 11px', borderRadius: 100 }}>
              median {a.medianAgeDays >= 365 ? `${(a.medianAgeDays / 365).toFixed(1)}y` : `${a.medianAgeDays}d`}
            </span>
          ) : undefined}>Listing Age</SectionTitle>
          {ageChart
            ? <BarChart labels={ageChart.labels} values={ageChart.values} colors={ageChart.colors} height={280} />
            : <EmptyState icon="📅" title="No listing dates" />}
          <p style={{ fontSize: 11.5, color: C.stone, marginTop: 8, lineHeight: 1.55 }}>
            How long the listings ranking for this keyword have been live. A page dominated by
            <strong style={{ color: D.hard }}> older</strong> listings means entrenched ranking history to displace;
            <strong style={{ color: D.good }}> newer</strong> ones mean the door is still open.
          </p>
        </Card>
      </div>

      {/* Etsy leaves processing_min/max null on the public search endpoint, so this
          card stays hidden rather than sitting permanently empty. */}
      {procChart && (
        <Card>
          <SectionTitle right={a.avgProcessing ? (
            <span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite, background: C.bone, padding: '4px 11px', borderRadius: 100 }}>{a.avgProcessing}</span>
          ) : undefined}>Processing Times</SectionTitle>
          <BarChart labels={procChart.labels} values={procChart.values} colors={procChart.colors} height={240} />
          <p style={{ fontSize: 11.5, color: C.stone, marginTop: 8 }}>
            The dispatch window sellers advertise. Beating the common window is a cheap competitive edge.
          </p>
        </Card>
      )}
    </div>
  )
})
