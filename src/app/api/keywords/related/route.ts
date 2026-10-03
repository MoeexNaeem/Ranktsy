import { NextRequest, NextResponse } from 'next/server'
import { memCache, CACHE_TTL } from '@/lib/cache'
import { getKeywordCore, relatedKey } from '@/lib/keywords'
import { enrichRelatedCompetition, displayKdRows } from '@/lib/etsy'
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
  if (hit) return NextResponse.json({ success: true, data: displayKdRows(hit), cached: true })

  try {
    const core = await getKeywordCore(query, geo)
    if (!core.related.length) return NextResponse.json({ success: true, data: [] })

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

    // Always measured the same way, even when the core came from the shared
    // Collective store: rows saved there were measured on a smaller sample and
    // disagreed with the keyword once clicked (2026-10-03). Each keyword's
    // measurement is cached and shared, so repeats cost no Etsy calls.
    // Etsy probes and the Google volume batch run at the same time (they used to run
    // one after the other); both work from the same keyword list.
    const [enriched, metrics] = await Promise.all([
      enrichRelatedCompetition(core.related),
      isGoogleAdsConfigured() ? googleKeywordMetrics(core.related.map(r => r.keyword), geo, gmeta) : Promise.resolve(new Map<string, GoogleMetric>()),
    ])
    let related = enriched
    if (metrics.size) related = withGoogle(metrics, related)

    // Etsy competition is expensive to re-measure, so keep it; but a Google failure
    // must not pin "no data" for hours - expire soon so the volume fills in.
    memCache.set(key, related, gmeta.failed ? 90 : CACHE_TTL.KEYWORD)
    return NextResponse.json({ success: true, data: displayKdRows(related), cached: false })
  } catch (e) {
    console.error('[Keywords/related] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not measure related keywords.' }, { status: 502 })
  }
}
