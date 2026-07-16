import { NextRequest, NextResponse } from 'next/server'
import { memCache, CACHE_TTL } from '@/lib/cache'
import { getKeywordCore, relatedKey } from '@/lib/keywords'
import { enrichRelatedCompetition } from '@/lib/etsy'
import { googleKeywordMetrics, isGoogleAdsConfigured } from '@/lib/google-ads'
import type { ApiResponse, KeywordData } from '@/types'

export const runtime = 'nodejs'

/**
 * Related keywords with their REAL competition — the expensive stage (~24 live
 * Etsy searches, one per keyword, ~4s behind the rate gate).
 *
 * Split out of /api/keywords so the page can paint in ~1s and fill this in when
 * it lands. The core response is cached, so reading it here is free.
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<KeywordData[]>>> {
  const query = new URL(req.url).searchParams.get('q')?.trim().toLowerCase()
  if (!query || query.length < 2) {
    return NextResponse.json({ success: false, error: 'Query must be at least 2 characters' }, { status: 400 })
  }

  const key = relatedKey(query)
  const hit = memCache.get<KeywordData[]>(key)
  if (hit) return NextResponse.json({ success: true, data: hit, cached: true })

  try {
    const core = await getKeywordCore(query)
    if (!core.related.length) return NextResponse.json({ success: true, data: [] })

    let related = await enrichRelatedCompetition(core.related)

    if (isGoogleAdsConfigured()) {
      const metrics = await googleKeywordMetrics(related.map(r => r.keyword))
      if (metrics.size) {
        related = related.map(r => ({ ...r, googleSearches: metrics.get(r.keyword)?.searches ?? null }))
      }
    }

    memCache.set(key, related, CACHE_TTL.KEYWORD)
    return NextResponse.json({ success: true, data: related, cached: false })
  } catch (e) {
    console.error('[Keywords/related] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not measure related keywords.' }, { status: 502 })
  }
}
