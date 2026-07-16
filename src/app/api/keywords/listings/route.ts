import { NextRequest, NextResponse } from 'next/server'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { searchEtsyListingsPaged } from '@/lib/etsy'
import { KEYWORD_VERSION } from '@/lib/keywords'
import type { ApiResponse, EtsyListing } from '@/types'

export const runtime = 'nodejs'

/**
 * The same top listings as the core, but WITH images.
 *
 * Etsy's search endpoint returns no images — they need a second ~1.5s batch call
 * against /listings/batch. Only the Top Listings grid renders them, so that cost
 * is paid when the user opens that tab rather than on every keyword search.
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<EtsyListing[]>>> {
  const query = new URL(req.url).searchParams.get('q')?.trim().toLowerCase()
  if (!query || query.length < 2) {
    return NextResponse.json({ success: false, error: 'Query must be at least 2 characters' }, { status: 400 })
  }

  const key = cacheKey('keyword', KEYWORD_VERSION, 'listings', query)
  const hit = memCache.get<EtsyListing[]>(key)
  if (hit) return NextResponse.json({ success: true, data: hit, cached: true })

  try {
    const { listings } = await searchEtsyListingsPaged(query, 100, 0)
    memCache.set(key, listings, CACHE_TTL.KEYWORD)
    return NextResponse.json({ success: true, data: listings, cached: false })
  } catch (e) {
    console.error('[Keywords/listings] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not load listings from Etsy.' }, { status: 502 })
  }
}
