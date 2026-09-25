import { NextRequest, NextResponse } from 'next/server'
import { keywordListings } from '@/lib/keywords'
import { getKeywordMarketHistory, type KeywordMarketHistory } from '@/lib/snapshots'
import { cachedFlight, cacheKey, CACHE_TTL } from '@/lib/cache'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

/**
 * Measured monthly market activity for a keyword (Views/Favorites/Sales/Reviews),
 * from OUR snapshot history - the eHunt-style trend, real data only. Fired by the
 * Keyword Search page in parallel with the core search, so it never blocks paint.
 * Not search-gated (the core /api/keywords call already counts the search action).
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<KeywordMarketHistory>>> {
  const q = new URL(req.url).searchParams.get('q')?.trim().toLowerCase()
  if (!q || q.length < 2) return NextResponse.json({ success: false, error: 'Query must be at least 2 characters' }, { status: 400 })
  try {
    const data = await cachedFlight(cacheKey('kwmarket', 'v2', q), CACHE_TTL.SHOP, async () => {
      const listings = await keywordListings(q)   // shared with the core search, no extra Etsy call
      return getKeywordMarketHistory(listings.map(l => l.listing_id).filter(Boolean))
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error('[KW market history] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not load market activity.' }, { status: 502 })
  }
}
