import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { KeywordCache, KeywordHistory } from '@/lib/models'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { searchEtsyListings, buildKeywordStats, buildTrendData, buildCountryData } from '@/lib/etsy'
import { getCurrentUser } from '@/lib/auth/session'
import type { ApiResponse, KeywordSearchResponse } from '@/types'

export const runtime = 'nodejs'

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<KeywordSearchResponse>>> {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim().toLowerCase()

  if (!query || query.length < 2) {
    return NextResponse.json({ success: false, error: 'Query must be at least 2 characters' }, { status: 400 })
  }

  const key = cacheKey('keyword', query)

  // Older cached entries stored null Search/Clicks/CTR for related keywords.
  // Treat those as stale so they rebuild with the new engagement-derived proxies.
  const isStale = (d?: KeywordSearchResponse) =>
    !!d && Array.isArray(d.related) && d.related.length > 0 && d.related[0].avgSearches == null

  // L1: in-memory
  const memHit = memCache.get<KeywordSearchResponse>(key)
  if (memHit && !isStale(memHit)) return NextResponse.json({ success: true, data: memHit, cached: true })

  // L2: MongoDB
  try {
    await connectDB()
    const dbHit = await KeywordCache.findOne({ keyword: query }).lean()
    if (dbHit) {
      const data = dbHit.data as KeywordSearchResponse
      if (!isStale(data)) {
        memCache.set(key, data, CACHE_TTL.KEYWORD)
        return NextResponse.json({ success: true, data, cached: true })
      }
    }
  } catch (e) { console.error('[Keywords] DB lookup:', e) }

  // L3: Real Etsy API
  let data: KeywordSearchResponse
  try {
    const listings = await searchEtsyListings(query, 25)
    data = buildKeywordStats(query, listings)
  } catch (err) {
    console.error('[Keywords] Etsy API error:', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch keyword data from Etsy. Check your ETSY_API_KEY.' }, { status: 502 })
  }

  const expiresAt = new Date(Date.now() + CACHE_TTL.KEYWORD * 1000)

  // Persist (non-blocking)
  const user = await getCurrentUser().catch(() => null)
  Promise.all([
    connectDB().then(() => KeywordCache.findOneAndUpdate(
      { keyword: query },
      { keyword: query, data, expiresAt },
      { upsert: true, new: true }
    )),
    connectDB().then(() => KeywordHistory.create({ keyword: query, userId: user?.id })),
  ]).catch(e => console.error('[Keywords] DB write:', e))

  memCache.set(key, data, CACHE_TTL.KEYWORD)
  return NextResponse.json({ success: true, data, cached: false })
}
