import { NextRequest, NextResponse } from 'next/server'
import { searchEtsyListingsPaged, type SearchOpts } from '@/lib/etsy'
import { guardSearch } from '@/lib/searchGate'
import { cachedFlight, cacheKey, CACHE_TTL } from '@/lib/cache'

// Etsy caps offset-based paging; keep it within a sane range.
const MAX_OFFSET = 12000
const SORTS = new Set(['score', 'price', 'created', 'updated'])

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '24'), 1), 100)
  const offset = Math.min(Math.max(parseInt(searchParams.get('offset') ?? '0') || 0, 0), MAX_OFFSET)
  if (!q) return NextResponse.json({ success: false, error: 'Missing query' }, { status: 400 })

  const gate = await guardSearch(req)
  if (gate) return gate

  const sortRaw = searchParams.get('sort') ?? ''
  const opts: SearchOpts = {
    minPrice: Number(searchParams.get('minPrice')) || undefined,
    maxPrice: Number(searchParams.get('maxPrice')) || undefined,
    sortOn: SORTS.has(sortRaw) ? (sortRaw as SearchOpts['sortOn']) : undefined,
    taxonomyId: Number(searchParams.get('taxonomyId')) || undefined,
  }

  try {
    // Cache + coalesce: Competitors, Listings, Category Report and Tag Optimizer
    // all hit this route, so the same popular query from many users must not each
    // fire live Etsy calls. Keyed on every param that changes the result.
    const key = cacheKey('etsysearch', 'v1', q, String(limit), String(offset),
      opts.sortOn ?? 'score', String(opts.minPrice ?? ''), String(opts.maxPrice ?? ''), String(opts.taxonomyId ?? ''))
    const { listings, count } = await cachedFlight(key, CACHE_TTL.TRENDING, () => searchEtsyListingsPaged(q, limit, offset, opts))
    return NextResponse.json({
      success: true,
      data: listings,
      count,
      offset,
      limit,
      hasMore: offset + listings.length < count,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Etsy API error'
    return NextResponse.json({ success: false, error: msg }, { status: 502 })
  }
}
