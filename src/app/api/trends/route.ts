import { NextRequest, NextResponse } from 'next/server'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { searchEtsyListingsPaged, buildTrendData, buildCountryData, buildListingSupplyByMonth, buildListingMarketStats } from '@/lib/etsy'
import { googleKeywordMetrics, googleCountryBreakdown, isGoogleAdsConfigured, normalizeGeo } from '@/lib/google-ads'
import { guardSearch } from '@/lib/searchGate'
import type { TrendData, TrendPoint, CountryData } from '@/types'

export const runtime = 'nodejs'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/**
 * v3 — the fabricated Etsy seasonality curve is gone (see buildTrendData).
 *
 * `trends` now contains ONLY real series: a Google line when Google Ads is
 * configured, and nothing otherwise. `supplyByMonth` is the honest Etsy-only
 * signal — when sellers created the competing listings. Callers must not treat
 * an empty `trends` as an error; it means "Etsy doesn't publish this".
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim().toLowerCase()
  const geo = normalizeGeo(searchParams.get('geo'))
  if (!query) return NextResponse.json({ success: false, error: 'Missing query' }, { status: 400 })

  const gate = await guardSearch(req)
  if (gate) return gate

  // v4: rate-limit fix (sequential Google calls) — retire v3 docs that cached an
  // empty/partial Google result when the concurrent calls were being throttled.
  const key    = cacheKey('trends', 'v4', geo, query)
  const cached = memCache.get(key)
  if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

  try {
    // 100 listings so the supply-by-month distribution has a real population.
    const { listings } = await searchEtsyListingsPaged(query, 100, 0, { skipImages: true })
    const trends: TrendData[] = buildTrendData()
    let countries: CountryData[] = buildCountryData()
    const supplyByMonth = buildListingSupplyByMonth(listings)
    // Real market detail measured from the same 100-listing sample.
    const market = buildListingMarketStats(listings)

    let googleAvailable = false
    if (isGoogleAdsConfigured()) {
      // Sequential, not Promise.all: the trend-line call plus the six geo calls
      // inside googleCountryBreakdown otherwise fire together and trip Google's
      // rate limit (429), which silently blanks whichever call loses. The trend
      // line is fetched first so it always wins.
      const metrics = await googleKeywordMetrics([query], geo)
      const geoBreakdown = await googleCountryBreakdown(query)
      const monthly = metrics.get(query)?.monthly ?? []
      if (monthly.length) {
        // Google returns the trailing 12 months oldest→newest; label them as
        // rolling months ending with the current one.
        const nowMonth = new Date().getMonth()
        const last12 = monthly.slice(-12)
        const points: TrendPoint[] = last12.map((value, i) => ({
          month: MONTHS[(nowMonth - last12.length + 1 + i + 24) % 12],
          value,
        }))
        trends.push({ platform: 'google', points })
        googleAvailable = true
      }
      if (geoBreakdown.length) countries = geoBreakdown
    }

    const data = {
      trends,
      countries,
      supplyByMonth,
      market,
      googleAvailable,
      // Stated explicitly so the UI never has to guess why a series is missing.
      note: googleAvailable
        ? 'Search-volume seasonality is real Google Ads monthly data. Etsy publishes no search volume.'
        : 'Etsy publishes no search volume or history, so no Etsy demand curve is shown. “Listings created by month” is real, but reflects seller behaviour, not buyer demand.',
    }
    memCache.set(key, data, CACHE_TTL.TRENDING)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[Trends] Etsy API error:', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch trend data.' }, { status: 502 })
  }
}
