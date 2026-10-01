import { NextRequest, NextResponse } from 'next/server'
import { getTopSellers } from '@/lib/etsy'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { upstreamFailure } from '@/lib/upstream-errors'
import { withUsage } from '@/lib/track'

export const runtime = 'nodejs'
export const revalidate = 1800

async function handleGET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim().toLowerCase()
  if (!query || query.length < 2) {
    return NextResponse.json({ success: false, error: 'Enter a keyword or niche (2+ characters).' }, { status: 400 })
  }

  const key    = cacheKey('top-sellers', query)
  const cached = memCache.get(key)
  if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

  try {
    const sellers = await getTopSellers(query, 100)
    memCache.set(key, sellers, CACHE_TTL.TRENDING)
    return NextResponse.json({ success: true, data: sellers })
  } catch (err) {
    const fail = upstreamFailure(err)
    return NextResponse.json({ success: false, error: fail.message }, { status: fail.status })
  }
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const GET = withUsage(handleGET)
