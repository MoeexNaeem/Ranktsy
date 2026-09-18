import { NextRequest, NextResponse } from 'next/server'
import { getListingById, topCategoryForTaxonomy } from '@/lib/etsy'
import { cachedFlight, cacheKey, CACHE_TTL } from '@/lib/cache'
import { upstreamFailure } from '@/lib/upstream-errors'

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
    const listing = await cachedFlight(cacheKey('etsylisting', 'v2', String(id)), CACHE_TTL.KEYWORD, () => getListingById(id))
    if (!listing) return NextResponse.json({ success: false, error: 'Listing not found or inactive' }, { status: 404 })
    return NextResponse.json({ success: true, data: { ...listing, categoryTop: topCategoryForTaxonomy(listing.taxonomy_id) } })
  } catch (err: unknown) {
    // Map the failure to the RIGHT status so the client can show an accurate reason:
    // a real 404 (listing gone/inactive) vs a transient one. The provider's own error
    // text is logged, never shown.
    const fail = upstreamFailure(err, 'Listing not found or inactive')
    return NextResponse.json({ success: false, error: fail.message }, { status: fail.status })
  }
}
