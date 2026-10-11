import { NextRequest, NextResponse } from 'next/server'
import { keywordListings } from '@/lib/keywords'
import { getKeywordMarketHistory, HistoryBusyError, type KeywordMarketHistory } from '@/lib/snapshots'
import { cachedFlight, cacheKey } from '@/lib/cache'
import type { ApiResponse } from '@/types'
import { withUsage } from '@/lib/track'

export const runtime = 'nodejs'

/**
 * Measured monthly market activity for a keyword (Views/Favorites/Sales/Reviews),
 * from OUR snapshot history - the eHunt-style trend, real data only. Fired by the
 * Keyword Search page in parallel with the core search, so it never blocks paint.
 * Not search-gated (the core /api/keywords call already counts the search action).
 */
async function handleGET(req: NextRequest): Promise<NextResponse<ApiResponse<KeywordMarketHistory>>> {
  const q = new URL(req.url).searchParams.get('q')?.trim().toLowerCase()
  if (!q || q.length < 2) return NextResponse.json({ success: false, error: 'Query must be at least 2 characters' }, { status: 400 })
  try {
    // Snapshots are taken once a day, so 3 h of caching loses nothing and saves a
    // large disk read on every repeat search.
    const data = await cachedFlight(cacheKey('kwmarket', 'v3', q), 60 * 60 * 3, async () => {
      const listings = await keywordListings(q)   // shared with the core search, no extra Etsy call
      return getKeywordMarketHistory(listings.map(l => l.listing_id).filter(Boolean))
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    if (e instanceof HistoryBusyError) {
      return NextResponse.json({ success: false, error: 'Market activity is busy right now, try again in a minute.' }, { status: 503 })
    }
    console.error('[KW market history] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not load market activity.' }, { status: 502 })
  }
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const GET = withUsage(handleGET)
