import { NextRequest, NextResponse } from 'next/server'
import { getShopReviews } from '@/lib/etsy'
import { cachedFlight, cacheKey, CACHE_TTL } from '@/lib/cache'
import { upstreamFailure } from '@/lib/upstream-errors'
import { withUsage } from '@/lib/track'

async function handleGET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')?.trim()
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '12'), 1), 100)
  if (!id) return NextResponse.json({ success: false, error: 'Missing shop id/name' }, { status: 400 })

  try {
    const reviews = await cachedFlight(cacheKey('etsyreviews', 'v1', id, String(limit)), CACHE_TTL.SHOP, () => getShopReviews(id, limit))
    return NextResponse.json({ success: true, data: reviews })
  } catch (err: unknown) {
    const fail = upstreamFailure(err)
    return NextResponse.json({ success: false, error: fail.message }, { status: fail.status })
  }
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const GET = withUsage(handleGET)
