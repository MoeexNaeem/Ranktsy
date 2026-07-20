'use client'
import { memo, useMemo } from 'react'
import { Card, SectionTitle, MONO } from '../kit'
import { C, D, formatNumber } from '@/utils'

export interface ShopHealthInput {
  reviewAvg: number
  reviewCount: number
  activeListings: number
  sales: number | null
  salesPerListing: number | null
  yearOpened: number | null
  onVacation: boolean
}

interface Factor {
  label: string
  score: number      // points earned
  max: number        // points possible
  detail: string     // the real number behind it
}

/**
 * Shop Health Score — a 0–100 composite of REAL shop-record measurements. It is
 * explicitly an estimate (a weighted blend), never presented as an Etsy-official
 * figure, and every factor shows the real number it came from so the score is
 * auditable rather than a black box.
 *
 * Factors weighted by how much each actually signals a healthy shop:
 *   rating 30 · review volume 25 · sales traction 25 · catalog 15 · open 5
 */
function computeHealth(s: ShopHealthInput): { score: number; factors: Factor[] } {
  const factors: Factor[] = []

  // Rating — the strongest trust signal. 4.0→5.0 maps to 0→30; below 4.0 is a real problem.
  const ratingScore = s.reviewCount > 0
    ? Math.max(0, Math.min(30, Math.round((s.reviewAvg - 4.0) / 1.0 * 30)))
    : 0
  factors.push({
    label: 'Rating',
    score: ratingScore, max: 30,
    detail: s.reviewCount > 0 ? `${s.reviewAvg.toFixed(2)}★ average` : 'no reviews yet',
  })

  // Review volume — social proof. Log-scaled: ~5k reviews saturates.
  const volScore = s.reviewCount > 0
    ? Math.min(25, Math.round(Math.log10(s.reviewCount + 1) / Math.log10(5000) * 25))
    : 0
  factors.push({
    label: 'Review volume',
    score: volScore, max: 25,
    detail: `${formatNumber(s.reviewCount)} reviews`,
  })

  // Sales traction — how well the catalog actually converts. Sales-per-listing,
  // log-scaled (~200 sales/listing is excellent).
  const tracScore = s.salesPerListing != null && s.salesPerListing > 0
    ? Math.min(25, Math.round(Math.log10(s.salesPerListing + 1) / Math.log10(200) * 25))
    : 0
  factors.push({
    label: 'Sales traction',
    score: tracScore, max: 25,
    detail: s.salesPerListing != null ? `${s.salesPerListing.toFixed(0)} sales per listing` : 'sales not published',
  })

  // Catalog — enough surface to be found, without rewarding thin shops. Sweet
  // spot ~50+ active listings; caps at 15.
  const catScore = Math.min(15, Math.round(Math.log10(s.activeListings + 1) / Math.log10(300) * 15))
  factors.push({
    label: 'Catalog size',
    score: catScore, max: 15,
    detail: `${formatNumber(s.activeListings)} active listings`,
  })

  // Availability — a shop on vacation is invisible to buyers right now.
  factors.push({
    label: 'Open for business',
    score: s.onVacation ? 0 : 5, max: 5,
    detail: s.onVacation ? 'on vacation — hidden from search' : 'open',
  })

  const score = factors.reduce((sum, f) => sum + f.score, 0)
  return { score, factors }
}

const gradeColor = (s: number) => (s >= 75 ? D.good : s >= 50 ? D.mid : D.hard)
const gradeLabel = (s: number) => (s >= 85 ? 'Excellent' : s >= 70 ? 'Strong' : s >= 50 ? 'Fair' : 'Needs work')

export const ShopHealthPanel = memo(function ShopHealthPanel({ input }: { input: ShopHealthInput }) {
  const { score, factors } = useMemo(() => computeHealth(input), [input])
  const color = gradeColor(score)

  return (
    <Card>
      <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: C.stone }}>estimate · from real data</span>}>
        Shop Health Score
      </SectionTitle>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 52, fontWeight: 500, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{score}</span>
        <div>
          <span style={{ fontSize: 15, fontWeight: 600, color, textTransform: 'uppercase', fontFamily: MONO, letterSpacing: '0.04em' }}>{gradeLabel(score)}</span>
          <p style={{ fontSize: 13, color: C.graphite }}>out of 100</p>
        </div>
      </div>

      {/* Overall bar */}
      <div style={{ height: 8, background: C.bone, borderRadius: 999, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 999, transition: 'width 0.6s' }} />
      </div>

      {/* Factor breakdown — every score shows the real number behind it */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {factors.map(f => {
          const pct = (f.score / f.max) * 100
          const fc = pct >= 70 ? D.good : pct >= 40 ? D.mid : D.hard
          return (
            <div key={f.label}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
                <span style={{ fontSize: 13.5, color: C.ink }}>{f.label}</span>
                <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.graphite }}>
                  {f.detail} · <span style={{ color: fc, fontWeight: 600 }}>{f.score}/{f.max}</span>
                </span>
              </div>
              <div style={{ height: 5, background: C.bone, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: fc, borderRadius: 999 }} />
              </div>
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: 11, color: C.stone, marginTop: 16, fontFamily: MONO, lineHeight: 1.6 }}>
        A weighted blend of the shop&apos;s real Etsy record — rating, reviews, sales-per-listing, catalog size and
        availability. An estimate to compare shops at a glance, not an official Etsy metric.
      </p>
    </Card>
  )
})
