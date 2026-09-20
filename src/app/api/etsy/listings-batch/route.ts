import { NextRequest, NextResponse } from 'next/server'
import { getListingById, topCategoryForTaxonomy } from '@/lib/etsy'
import type { ApiResponse, EtsyListing } from '@/types'

export const runtime = 'nodejs'

const MAX_IDS = 100

/**
 * Many listings by id, in ONE request.
 *
 * The extension knows exactly which listings are on the Etsy page it is looking
 * at, so it should ask for those. Previously it relied on the keyword search
 * returning the same listings the page happened to be showing, which breaks the
 * moment the shopper applies an Etsy filter (?instant_download=false), changes
 * the sort, or pages past the first page: the search comes back with a different
 * set, nothing matches the cards, and the page shows no data at all. Cards that
 * missed out were then back-filled one at a time, capped and throttled, so most
 * of them never got their data.
 *
 * `getListingById` already micro-batches concurrent ids into a single Etsy
 * /listings/batch call and shares its cache across workers, so asking for 60 ids
 * here costs one upstream call, not sixty.
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<EtsyListing[]>>> {
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown }
  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.map(Number).filter(n => Number.isFinite(n) && n > 0))].slice(0, MAX_IDS)
    : []
  if (!ids.length) return NextResponse.json({ success: false, error: 'No listing ids' }, { status: 400 })

  // One settled promise per id: a listing that is gone or inactive resolves to
  // null and is simply left out, which must never fail the whole page.
  const results = await Promise.all(ids.map(id => getListingById(id).catch(() => null)))
  const listings = results
    .filter((l): l is EtsyListing => !!l)
    .map(l => ({ ...l, categoryTop: topCategoryForTaxonomy(l.taxonomy_id) }))

  return NextResponse.json({ success: true, data: listings })
}
