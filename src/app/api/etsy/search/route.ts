import { NextRequest, NextResponse } from 'next/server'
import { searchEtsyListingsPaged, type SearchOpts } from '@/lib/etsy'

// Etsy caps offset-based paging; keep it within a sane range.
const MAX_OFFSET = 12000
const SORTS = new Set(['score', 'price', 'created', 'updated'])

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '24'), 1), 100)
  const offset = Math.min(Math.max(parseInt(searchParams.get('offset') ?? '0') || 0, 0), MAX_OFFSET)
  if (!q) return NextResponse.json({ success: false, error: 'Missing query' }, { status: 400 })

  const sortRaw = searchParams.get('sort') ?? ''
  const opts: SearchOpts = {
    minPrice: Number(searchParams.get('minPrice')) || undefined,
    maxPrice: Number(searchParams.get('maxPrice')) || undefined,
    sortOn: SORTS.has(sortRaw) ? (sortRaw as SearchOpts['sortOn']) : undefined,
    taxonomyId: Number(searchParams.get('taxonomyId')) || undefined,
  }

  try {
    const { listings, count } = await searchEtsyListingsPaged(q, limit, offset, opts)
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
