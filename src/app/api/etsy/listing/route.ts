import { NextRequest, NextResponse } from 'next/server'
import { getListingById } from '@/lib/etsy'
import { cachedFlight, cacheKey, CACHE_TTL } from '@/lib/cache'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = parseInt(searchParams.get('id') ?? '', 10)
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ success: false, error: 'Missing or invalid listing id' }, { status: 400 })
  }
  try {
    // Cache + coalesce: Listing Audit, Compare Listings and Spell Checker all pull
    // listings by id. Not-found (null) is never cached, so a listing that later
    // goes active isn't stuck as missing.
    const listing = await cachedFlight(cacheKey('etsylisting', 'v1', String(id)), CACHE_TTL.SHOP, () => getListingById(id))
    if (!listing) return NextResponse.json({ success: false, error: 'Listing not found or inactive' }, { status: 404 })
    return NextResponse.json({ success: true, data: listing })
  } catch (err: unknown) {
    // etsyFetch throws on a non-OK Etsy response (e.g. "Etsy API error 404: ...").
    // Map it to the RIGHT status so the client can show an accurate reason: a real
    // 404 (listing gone/inactive) vs a transient 429/5xx (Etsy busy) vs anything else.
    const msg = err instanceof Error ? err.message : 'Etsy API error'
    if (/error 404/i.test(msg)) return NextResponse.json({ success: false, error: 'Listing not found or inactive' }, { status: 404 })
    if (/error 429|error 5\d\d/i.test(msg)) return NextResponse.json({ success: false, error: 'Etsy is busy right now. Please try again shortly.' }, { status: 429 })
    return NextResponse.json({ success: false, error: msg }, { status: 502 })
  }
}
