import { NextRequest, NextResponse } from 'next/server'
import { keywordListings } from '@/lib/keywords'
import { getKeywordMarketHistory, HistoryBusyError, type KeywordMarketHistory } from '@/lib/snapshots'
import { cachedFlight, cacheKey } from '@/lib/cache'
import { withUsage } from '@/lib/track'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

const MAX_TAGS = 13

/**
 * Measured market activity for each of a product's tags (Find Hot Products, Tag
 * performance): what the listings ranking for each tag gained in views, favorites,
 * reviews and estimated sales, per day and per month, from our tracking. The same
 * data and cache as Keyword Search's market panel (key kwmarket:v2), fetched one tag
 * at a time so a product's 13 tags never flood the snapshot reads. A tag that fails
 * is null; the others still come back.
 */
async function handleGET(req: NextRequest): Promise<NextResponse<ApiResponse<Record<string, KeywordMarketHistory | null>>>> {
  const raw = req.nextUrl.searchParams.get('tags') ?? ''
  const tags = [...new Set(raw.split('|').map(t => t.trim().toLowerCase()).filter(t => t.length >= 2))].slice(0, MAX_TAGS)
  if (!tags.length) return NextResponse.json({ success: false, error: 'No tags' }, { status: 400 })
  const out: Record<string, KeywordMarketHistory | null> = {}
  let busy = 0
  for (const q of tags) {
    try {
      out[q] = await cachedFlight(cacheKey('kwmarket', 'v2', q), 60 * 60 * 3, async () => {
        const listings = await keywordListings(q)
        return getKeywordMarketHistory(listings.map(l => l.listing_id).filter(Boolean))
      })
    } catch (e) {
      if (e instanceof HistoryBusyError) busy++
      else console.error('[Tag market] failed for', q, e)
      out[q] = null
    }
  }
  if (busy === tags.length) {
    return NextResponse.json({ success: false, error: 'Market activity is busy right now, try again in a minute.' }, { status: 503 })
  }
  return NextResponse.json({ success: true, data: out })
}

export const GET = withUsage(handleGET)
