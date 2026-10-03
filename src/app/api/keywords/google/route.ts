import { NextRequest, NextResponse } from 'next/server'
import { googleKeywordMetrics, googleAccountCurrency, isGoogleAdsConfigured, normalizeGeo, googleStatusOf, type GoogleMetricsMeta } from '@/lib/google-ads'
import { withUsage } from '@/lib/track'
import type { ApiResponse, KeywordStats } from '@/types'

export const runtime = 'nodejs'
export const GET = withUsage(getHandler)

type GoogleFill = Pick<KeywordStats, 'googleSearches' | 'googleCompetition' | 'googleCompetitionIndex' | 'googleCpcLow' | 'googleCpcHigh' | 'googleCurrency' | 'googleStatus' | 'googleRetryAt'>

/**
 * Google volume for ONE keyword, for when the keyword's main stats were answered
 * before Google (/api/keywords waits ~2.5 s, then marks it 'pending'). Not charged:
 * the search itself already was. Joins the request already queued for this keyword,
 * so it costs no extra Google call.
 */
async function getHandler(req: NextRequest): Promise<NextResponse<ApiResponse<GoogleFill>>> {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim().toLowerCase()
  const geo = normalizeGeo(searchParams.get('geo'))
  if (!query || query.length < 2) {
    return NextResponse.json({ success: false, error: 'Query must be at least 2 characters' }, { status: 400 })
  }
  if (!isGoogleAdsConfigured()) {
    return NextResponse.json({ success: true, data: { googleSearches: null, googleStatus: 'unconfigured' } })
  }
  const gmeta: GoogleMetricsMeta = {}
  const [metrics, currency] = await Promise.all([googleKeywordMetrics([query], geo, gmeta), googleAccountCurrency()])
  const g = metrics.get(query)
  return NextResponse.json({
    success: true,
    data: {
      googleSearches:         g?.searches ?? null,
      googleCompetition:      (g?.competition ?? undefined) as GoogleFill['googleCompetition'],
      googleCompetitionIndex: g?.competitionIndex ?? null,
      googleCpcLow:           g?.cpcLow ?? null,
      googleCpcHigh:          g?.cpcHigh ?? null,
      googleCurrency:         currency,
      googleStatus:           googleStatusOf(gmeta),
      googleRetryAt:          gmeta.retryAt ?? null,
    },
  })
}
