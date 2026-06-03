import { NextResponse } from 'next/server'
import { getTrendingListings } from '@/lib/etsy'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'

export const revalidate = 1800

export async function GET() {
  const key    = cacheKey('trending', 'featured')
  const cached = memCache.get(key)
  if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

  try {
    const listings = await getTrendingListings(25)
    memCache.set(key, listings, CACHE_TTL.TRENDING)
    return NextResponse.json({ success: true, data: listings })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Etsy API error'
    return NextResponse.json({ success: false, error: msg }, { status: 502 })
  }
}
