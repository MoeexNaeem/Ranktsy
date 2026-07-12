import { NextRequest, NextResponse } from 'next/server'
import { getTrendBuzz } from '@/lib/etsy'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'

export const runtime = 'nodejs'
export const revalidate = 1800

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim().toLowerCase() ?? ''

  const key    = cacheKey('trend-buzz', query || 'featured')
  const cached = memCache.get(key)
  if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

  try {
    const buzz = await getTrendBuzz(query, 100)
    memCache.set(key, buzz, CACHE_TTL.TRENDING)
    return NextResponse.json({ success: true, data: buzz })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Etsy API error'
    return NextResponse.json({ success: false, error: msg }, { status: 502 })
  }
}
