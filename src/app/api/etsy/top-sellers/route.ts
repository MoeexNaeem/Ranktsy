import { NextRequest, NextResponse } from 'next/server'
import { getTopSellers } from '@/lib/etsy'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'

export const runtime = 'nodejs'
export const revalidate = 1800

export async function GET(req: NextRequest) {
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
    const msg = err instanceof Error ? err.message : 'Etsy API error'
    return NextResponse.json({ success: false, error: msg }, { status: 502 })
  }
}
