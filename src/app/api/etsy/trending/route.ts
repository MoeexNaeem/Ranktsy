import { NextResponse } from 'next/server'
import { getTrendingListings } from '@/lib/etsy'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { upstreamFailure } from '@/lib/upstream-errors'

// Run only at request time, never prerendered at build. Next 16 otherwise tries to
// execute this param-less GET during the build to cache it, which fires live Etsy
// calls and times out (build fails). The in-memory memCache below already gives the
// 30-min caching at runtime, so we don't need Next's ISR revalidate here.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const key    = cacheKey('trending', 'featured')
  const cached = memCache.get(key)
  if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

  try {
    const listings = await getTrendingListings(25)
    memCache.set(key, listings, CACHE_TTL.TRENDING)
    return NextResponse.json({ success: true, data: listings })
  } catch (err: unknown) {
    const fail = upstreamFailure(err)
    return NextResponse.json({ success: false, error: fail.message }, { status: fail.status })
  }
}
