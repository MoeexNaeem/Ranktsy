import { NextRequest, NextResponse } from 'next/server'
import { memCache, CACHE_TTL } from '@/lib/cache'
import { getKeywordCore, relatedKey } from '@/lib/keywords'
import { enrichRelatedCompetition } from '@/lib/etsy'
import { googleKeywordMetrics, isGoogleAdsConfigured, normalizeGeo, type GoogleMetricsMeta, type GoogleMetric } from '@/lib/google-ads'
import { withUsage } from '@/lib/track'
import type { ApiResponse, KeywordData } from '@/types'

export const runtime = 'nodejs'
export const GET = withUsage(getHandler)

/**
 * Related keywords with their REAL competition - the expensive stage (~24 live
 * Etsy searches, one per keyword, ~4s behind the rate gate).
 *
 * Split out of /api/keywords so the page can paint in ~1s and fill this in when
 * it lands. The core response is cached, so reading it here is free.
 */
async function getHandler(req: NextRequest): Promise<NextResponse<ApiResponse<KeywordData[]>>> {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim().toLowerCase()
  const geo = normalizeGeo(searchParams.get('geo'))
  if (!query || query.length < 2) {
    return NextResponse.json({ success: false, error: 'Query must be at least 2 characters' }, { status: 400 })
  }

  const key = relatedKey(query, geo)
  const hit = memCache.get<KeywordData[]>(key)
  if (hit) return NextResponse.json({ success: true, data: hit, cached: true })

  try {
    const core = await getKeywordCore(query, geo)
    if (!core.related.length) return NextResponse.json({ success: true, data: [] })

    // If the core came from the shared Collective store, its related keywords are
    // already enriched (competition/KD/Google) - return them as-is, no re-probe,
    // no API calls.
    const gmeta: GoogleMetricsMeta = {}
    const withGoogle = (metrics: Map<string, GoogleMetric>, rows: KeywordData[]) => rows.map(r => {
      const g = metrics.get(r.keyword.toLowerCase())
      return g ? {
        ...r,
        googleSearches:         g.searches ?? null,
        googleCompetition:      g.competition as KeywordData['googleCompetition'],
        googleCompetitionIndex: g.competitionIndex,
        googleCpcLow:           g.cpcLow,
        googleCpcHigh:          g.cpcHigh,
      } : r
    })

    if (core.related.some(r => r.competition != null)) {
      let rows = core.related
      // Shared packages saved while Google was failing lack volume - backfill it
      // (from the stored Google cache when possible) instead of "no data yet" forever.
      if (isGoogleAdsConfigured() && rows.every(r => r.googleSearches == null)) {
        rows = withGoogle(await googleKeywordMetrics(rows.map(r => r.keyword), geo, gmeta), rows)
      }
      memCache.set(key, rows, gmeta.failed ? 90 : CACHE_TTL.KEYWORD)
      return NextResponse.json({ success: true, data: rows, cached: true })
    }

    let related = await enrichRelatedCompetition(core.related)

    if (isGoogleAdsConfigured()) {
      const metrics = await googleKeywordMetrics(related.map(r => r.keyword), geo, gmeta)
      if (metrics.size) related = withGoogle(metrics, related)
    }

    // Etsy competition is expensive to re-measure, so keep it; but a Google failure
    // must not pin "no data" for hours - expire soon so the volume fills in.
    memCache.set(key, related, gmeta.failed ? 90 : CACHE_TTL.KEYWORD)
    return NextResponse.json({ success: true, data: related, cached: false })
  } catch (e) {
    console.error('[Keywords/related] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not measure related keywords.' }, { status: 502 })
  }
}
