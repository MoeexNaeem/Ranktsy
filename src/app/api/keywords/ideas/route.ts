import { NextRequest, NextResponse } from 'next/server'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { googleKeywordIdeas, googleAccountCurrency, isGoogleAdsConfigured, normalizeGeo } from '@/lib/google-ads'
import { guardSearch } from '@/lib/searchGate'
import type { ApiResponse, KeywordIdeasResponse } from '@/types'

export const runtime = 'nodejs'

/**
 * Google Keyword Ideas — genuine keyword DISCOVERY via generateKeywordIdeas.
 *
 * Unlike /api/keywords/related (which measures terms Etsy already surfaced),
 * Google returns keywords we never asked about, so this is the one place the tool
 * can point a seller at high-volume / low-competition long-tails that a 100-listing
 * Etsy sample simply can't contain. Every figure is real Google Ads data.
 *
 * Returns an empty `ideas` array (never an error) when Google Ads isn't configured,
 * so the client can render a "connect Google Ads" state instead of a failure.
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<KeywordIdeasResponse>>> {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim().toLowerCase()
  const geo = normalizeGeo(searchParams.get('geo'))
  if (!query || query.length < 2) {
    return NextResponse.json({ success: false, error: 'Query must be at least 2 characters' }, { status: 400 })
  }

  if (!isGoogleAdsConfigured()) {
    return NextResponse.json({ success: true, data: { seed: query, currency: null, ideas: [] } })
  }

  const key    = cacheKey('kwideas', 'v1', geo, query)
  const cached = memCache.get<KeywordIdeasResponse>(key)
  if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

  const gate = await guardSearch<KeywordIdeasResponse>(req)
  if (gate) return gate

  try {
    const [ideas, currency] = await Promise.all([googleKeywordIdeas(query, geo), googleAccountCurrency()])
    // Highest real demand first — the actionable order for discovery.
    ideas.sort((a, b) => (b.searches ?? 0) - (a.searches ?? 0))
    // GoogleIdea.competition is a raw string from the API; the response type
    // narrows it to the LOW/MEDIUM/HIGH/UNSPECIFIED union the client renders.
    const data: KeywordIdeasResponse = { seed: query, currency, ideas: ideas as KeywordIdeasResponse['ideas'] }
    memCache.set(key, data, CACHE_TTL.KEYWORD)
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error('[Keywords/ideas] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not fetch Google keyword ideas.' }, { status: 502 })
  }
}
