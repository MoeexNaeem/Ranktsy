import { NextRequest, NextResponse } from 'next/server'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { searchEtsyListings, buildTrendData, buildCountryData } from '@/lib/etsy'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim().toLowerCase()
  if (!query) return NextResponse.json({ success: false, error: 'Missing query' }, { status: 400 })

  const key    = cacheKey('trends', query)
  const cached = memCache.get(key)
  if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

  try {
    const listings = await searchEtsyListings(query, 25)
    const data = { trends: buildTrendData(listings), countries: buildCountryData() }
    memCache.set(key, data, CACHE_TTL.TRENDING)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[Trends] Etsy API error:', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch trend data.' }, { status: 502 })
  }
}
