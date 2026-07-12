import { NextRequest, NextResponse } from 'next/server'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { searchEtsyListings, buildTrendData, buildCountryData } from '@/lib/etsy'
import { googleKeywordMetrics, googleCountryBreakdown, isGoogleAdsConfigured } from '@/lib/google-ads'
import type { TrendData, TrendPoint, CountryData } from '@/types'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim().toLowerCase()
  if (!query) return NextResponse.json({ success: false, error: 'Missing query' }, { status: 400 })

  // v2: real Google trend line + Google country breakdown when configured.
  const key    = cacheKey('trends', 'v2', query)
  const cached = memCache.get(key)
  if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

  try {
    const listings = await searchEtsyListings(query, 25)
    const trends: TrendData[] = buildTrendData(listings)
    let countries: CountryData[] = buildCountryData()

    // Overlay real Google data when Google Ads is configured.
    if (isGoogleAdsConfigured()) {
      const labels = trends[0]?.points.map(p => p.month) ?? []
      const [metrics, geo] = await Promise.all([
        googleKeywordMetrics([query]),
        googleCountryBreakdown(query),
      ])
      const monthly = metrics.get(query)?.monthly ?? []
      if (monthly.length) {
        // Align Google's monthly volumes to the 12 rolling month labels.
        const last12 = monthly.slice(-labels.length)
        const points: TrendPoint[] = labels.map((month, i) => ({ month, value: last12[i] ?? 0 }))
        trends.push({ platform: 'google', points })
      }
      if (geo.length) countries = geo
    }

    const data = { trends, countries }
    memCache.set(key, data, CACHE_TTL.TRENDING)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[Trends] Etsy API error:', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch trend data.' }, { status: 502 })
  }
}
