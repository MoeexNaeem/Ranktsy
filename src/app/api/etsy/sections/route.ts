import { NextRequest, NextResponse } from 'next/server'
import { getShopSections } from '@/lib/etsy'
import { cachedFlight, cacheKey, CACHE_TTL } from '@/lib/cache'
import { upstreamFailure } from '@/lib/upstream-errors'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')?.trim()
  if (!id) return NextResponse.json({ success: false, error: 'Missing shop id/name' }, { status: 400 })

  try {
    const sections = await cachedFlight(cacheKey('etsysections', 'v1', id), CACHE_TTL.SHOP, () => getShopSections(id))
    return NextResponse.json({ success: true, data: sections })
  } catch (err: unknown) {
    const fail = upstreamFailure(err)
    return NextResponse.json({ success: false, error: fail.message }, { status: fail.status })
  }
}
