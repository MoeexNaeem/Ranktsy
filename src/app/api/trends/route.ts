import { NextRequest, NextResponse } from 'next/server'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { buildTrendData, buildListingSupplyByMonth, buildListingMarketStats } from '@/lib/etsy'
import { keywordListings } from '@/lib/keywords'
import { googleKeywordMetrics, googleBroaderKeyword, isGoogleAdsConfigured, normalizeGeo, googleStatusOf, type GoogleMetricsMeta } from '@/lib/google-ads'
import { guardSearch } from '@/lib/searchGate'
import { getCollectivePackage } from '@/lib/collective-read'
import { withUsage } from '@/lib/track'
import type { TrendData, TrendPoint, CountryData, EtsyListing } from '@/types'

export const runtime = 'nodejs'
export const GET = withUsage(getHandler)

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
/** Longest the graph waits for Google before answering 'pending'. */
const TREND_GOOGLE_WAIT_MS = 6000

/**
 * v3 - the fabricated Etsy seasonality curve is gone (see buildTrendData).
 *
 * `trends` now contains ONLY real series: a Google line when Google Ads is
 * configured, and nothing otherwise. `supplyByMonth` is the honest Etsy-only
 * signal - when sellers created the competing listings. Callers must not treat
 * an empty `trends` as an error; it means "Etsy doesn't publish this".
 */
async function getHandler(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim().toLowerCase()
  const geo = normalizeGeo(searchParams.get('geo'))
  if (!query) return NextResponse.json({ success: false, error: 'Missing query' }, { status: 400 })

  const gate = await guardSearch(req, `keyword|${query}`)
  if (gate) return gate

  // v4: rate-limit fix (sequential Google calls) - retire v3 docs that cached an
  // empty/partial Google result when the concurrent calls were being throttled.
  // v5: countries moved to /api/trends/countries (they took ~10 s and held up the
  // graphs); this response now carries only the monthly series and market data.
  // v6 (2026-10-06): months come from Google's own calendar (see monthlyEnd).
  const key    = cacheKey('trends', 'v6', geo, query)
  const cached = memCache.get(key)
  if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

  // Shared Collective store first - trends are geo-specific, so look up this geo's
  // saved package; if it carries trends, serve them with no Etsy/Google calls.
  const shared = await getCollectivePackage(query, geo)
  // A package saved while Google was failing has no Google series/countries; don't
  // serve that blank forever - recompute (Google answers come from its own cache).
  const sharedHasGoogle = !isGoogleAdsConfigured() || (shared?.trends?.googleAvailable && (shared.trends.countries?.length ?? 0) > 0)
  if (shared?.trends && sharedHasGoogle) {
    memCache.set(key, shared.trends, CACHE_TTL.TRENDING)
    return NextResponse.json({ success: true, data: shared.trends, cached: true })
  }

  try {
    // 100 listings so the supply-by-month distribution has a real population.
    // One unavailable source must not blank the panels fed by the other: if the
    // marketplace sample can't be fetched, the search-volume chart and the country
    // breakdown (both search-demand data) are still returned.
    // Independent sources, fetched at the same time. Searchers-by-Country is NOT
    // here any more: the client loads it from /api/trends/countries in parallel,
    // so the graphs show as soon as the monthly volume is ready.
    const gmeta: GoogleMetricsMeta = {}
    let marketplaceAvailable = true
    const countries: CountryData[] = []
    // Google can sit in its queue at busy hours. Wait a few seconds at most: the graph
    // then answers 'pending' and the page asks again (the lookup keeps running and
    // lands in the shared Google cache, so the next ask is quick).
    let googlePending = false
    const googleP = isGoogleAdsConfigured() ? googleKeywordMetrics([query], geo, gmeta) : Promise.resolve(null)
    const [listings, metrics] = await Promise.all([
      keywordListings(query).catch(e => {   // shared with the core search, no extra Etsy call
        marketplaceAvailable = false
        console.error('[Trends] marketplace sample unavailable:', e instanceof Error ? e.message : e)
        return [] as EtsyListing[]
      }),
      Promise.race([googleP, new Promise<null>(r => setTimeout(() => { googlePending = true; r(null) }, TREND_GOOGLE_WAIT_MS))]),
    ])
    if (googlePending) googleP.catch(() => {})
    const trends: TrendData[] = buildTrendData()
    const supplyByMonth = marketplaceAvailable ? buildListingSupplyByMonth(listings) : []
    // Real market detail measured from the same 100-listing sample.
    const market = marketplaceAvailable ? buildListingMarketStats(listings) : null

    let googleAvailable = false
    let gm = metrics?.get(query)
    // Google tracks no volume for this exact phrase (about half of sellers' longer
    // searches): graph the closest broader phrase it does track, named on the page.
    let googleFallback: string | null = null
    if (!gm && !googlePending && !gmeta.failed && isGoogleAdsConfigured()) {
      const broader = await googleBroaderKeyword(query, geo, gmeta).catch(() => null)
      if (broader) { gm = broader.metric; googleFallback = broader.keyword }
    }
    const monthly = gm?.monthly ?? []
    if (monthly.length) {
      // Google returns 12 months oldest→newest, ending at its newest PUBLISHED month,
      // which trails today by one to two months. Each value is labelled with Google's
      // own month. Labelling the series as ending "this month" moved every peak two
      // months late (Thanksgiving in January, Christmas in February; 2026-10-06).
      // A row without its end month (Google failed, stale copy served) falls back to
      // two months back, the usual publication lag.
      const now = new Date()
      const [ey, em] = (gm?.monthlyEnd ?? '').split('-').map(Number)
      const endIdx = ey && em ? ey * 12 + (em - 1) : now.getFullYear() * 12 + now.getMonth() - 2
      const last12 = monthly.slice(-12)
      const points: TrendPoint[] = last12.map((value, i) => ({
        month: MONTHS[(endIdx - (last12.length - 1 - i)) % 12],
        value,
      }))
      trends.push({ platform: 'google', points })
      googleAvailable = true
    }

    const data = {
      trends,
      countries,
      supplyByMonth,
      market,
      googleAvailable,
      // The phrase the Google line is for, when it is not the keyword itself.
      googleFallback,
      // Stated explicitly so the UI never has to guess why a series is missing.
      note: googleAvailable
        ? 'Search-volume seasonality is real Google Ads monthly data. Etsy publishes no search volume.'
        : 'Etsy publishes no search volume or history, so no Etsy demand curve is shown. “Listings created by month” is real, but reflects seller behaviour, not buyer demand.',
      googleStatus: googlePending && !googleAvailable ? 'pending' : googleStatusOf(gmeta),
      googleRetryAt: gmeta.retryAt ?? null,
      marketplaceAvailable,
    }
    // Incomplete answers are not kept: the page re-asks and gets the Google line.
    // Never cache a partial result for hours. Google still answering: not kept at all,
    // the page re-asks in a few seconds and gets the Google line.
    const partial = (gmeta.failed && !googleAvailable) || !marketplaceAvailable
    if (!(googlePending && !googleAvailable)) memCache.set(key, data, partial ? 90 : CACHE_TTL.TRENDING)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[Trends] failed:', err)
    return NextResponse.json({ success: false, error: 'This data is temporarily unavailable. Please try again in a moment.' }, { status: 503 })
  }
}
