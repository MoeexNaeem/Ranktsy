import { NextRequest, NextResponse } from 'next/server'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { countriesForGeo, isGoogleAdsConfigured, normalizeGeo, googleStatusOf, type GoogleMetricsMeta } from '@/lib/google-ads'
import { guardSearch } from '@/lib/searchGate'
import { withUsage } from '@/lib/track'
import type { CountryData } from '@/types'

export const runtime = 'nodejs'
export const GET = withUsage(getHandler)

/**
 * Searchers by Country for a keyword: Google search volume in each tracked country.
 * Split out of /api/trends because it needs one Keyword Planner request per country
 * (Google rate-limits these, so they run one after another, ~10 s for a new keyword);
 * the graphs no longer wait for it. Each country answer is cached for 30 days in
 * the Google cache, and the finished breakdown for 6 hours here.
 */
async function getHandler(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim().toLowerCase()
  const geo = normalizeGeo(searchParams.get('geo'))
  if (!query) return NextResponse.json({ success: false, error: 'Missing query' }, { status: 400 })

  // Same search as the keyword itself: never counted twice for the human check.
  const gate = await guardSearch(req, `keyword|${query}`)
  if (gate) return gate

  if (!isGoogleAdsConfigured()) {
    return NextResponse.json({ success: true, data: { countries: [] as CountryData[], googleStatus: 'unconfigured', googleRetryAt: null } })
  }

  const key = cacheKey('trend-countries', 'v1', geo, query)
  const cached = memCache.get(key)
  if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

  try {
    const gmeta: GoogleMetricsMeta = {}
    const countries = await countriesForGeo(query, geo, gmeta)
    const data = { countries, googleStatus: googleStatusOf(gmeta), googleRetryAt: gmeta.retryAt ?? null }
    memCache.set(key, data, gmeta.failed ? 90 : CACHE_TTL.TRENDING)
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error('[Trends/countries] failed:', e)
    return NextResponse.json({ success: false, error: 'Country data is temporarily unavailable.' }, { status: 503 })
  }
}
