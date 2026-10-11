import { NextRequest, NextResponse } from 'next/server'
import { cachedFlight, cacheKey, CACHE_TTL } from '@/lib/cache'
import { searchEtsyListingsPaged } from '@/lib/etsy'
import { guardSearch } from '@/lib/searchGate'
import { meterSearch } from '@/lib/credit-gate'
import type { SearchOpts as EtsySearchOpts } from '@/lib/etsy'
import type { ApiResponse, HotProduct, HotProductsResponse, EtsyListing } from '@/types'
import { withUsage } from '@/lib/track'
import { hotScoreOf } from '@/lib/hot-score'

export const runtime = 'nodejs'

/**
 * Find Hot Products - a product-research database over LIVE Etsy listings.
 *
 * Compliance (the product's whole identity): Etsy's API exposes no per-listing
 * sales, revenue, or history - so this tool never shows them. "Hot" is ranked
 * from REAL signals only: how strongly a listing engages buyers (favorites ÷
 * views) and how fast it accrues favorites for its age (favorites ÷ days live).
 * Everything returned is measured from the Etsy API. See no-fabricated-data-rule.
 */

type SortKey = 'hot' | 'favorites' | 'views' | 'newest' | 'price_low' | 'price_high' | 'engagement' | 'velocity'

// Map the UI sort to how we fetch from Etsy. Etsy can sort globally by relevance,
// created date and price - but NOT by views/favorites, so those are scored on the
// fetched sample (honest: "hottest among the top matches", stated in the UI).
function fetchSort(sort: SortKey): Pick<EtsySearchOpts, 'sortOn' | 'sortOrder'> {
  switch (sort) {
    case 'newest':     return { sortOn: 'created', sortOrder: 'desc' }
    case 'price_low':  return { sortOn: 'price', sortOrder: 'asc' }
    case 'price_high': return { sortOn: 'price', sortOrder: 'desc' }
    default:           return { sortOn: 'score' }   // hot / favorites / views
  }
}

/** Hot Score 0-100 from real fields only (shared with the product database). */
function hotScore(l: EtsyListing) {
  return hotScoreOf(l.views, l.num_favorers, l.created_timestamp)
}

async function handleGET(req: NextRequest): Promise<NextResponse<ApiResponse<HotProductsResponse>>> {
  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').trim().toLowerCase()
  const sort = (sp.get('sort') ?? 'hot') as SortKey
  const minPrice = Number(sp.get('minPrice')) || undefined
  const maxPrice = Number(sp.get('maxPrice')) || undefined
  const taxonomyId = Number(sp.get('taxonomyId')) || undefined
  const minFavorites = Number(sp.get('minFavorites')) || 0
  const releaseDays = sp.get('releaseDays') // '30' | '180' | '365' | null (all)
  const page = Math.max(1, Number(sp.get('page')) || 1)

  if (q.length < 2) {
    return NextResponse.json({ success: false, error: 'Enter a product, tag, or niche to search (2+ characters).' }, { status: 400 })
  }

  const gate = await guardSearch<HotProductsResponse>(req)
  if (gate) return gate

  // Server-side credits (1 per search, only on a usable result). Sort, release
  // filter and paging are free refinements of the same search, so not in the key.
  const meter = await meterSearch(req, 'hotproducts', JSON.stringify({ q, cat: taxonomyId ?? '', minP: minPrice ?? '', maxP: maxPrice ?? '', minFav: minFavorites || '' }))
  if (meter.deny) return meter.deny as NextResponse<ApiResponse<HotProductsResponse>>

  // Cache the raw Etsy scan (expensive) separately from the cheap re-sort/filter,
  // so changing sort or a client-side filter is instant.
  const scanKey = cacheKey('hot', 'v2', q, String(taxonomyId ?? ''), String(minPrice ?? ''), String(maxPrice ?? ''), sort, String(page))
  try {
    // Cache + coalesce the raw Etsy scan (expensive) separately from the cheap
    // re-sort/filter, so changing sort or a client-side filter is instant and a
    // cold popular niche costs one scan across all concurrent viewers, not N.
    const scan = await cachedFlight(scanKey, CACHE_TTL.TRENDING, () => {
      const opts: EtsySearchOpts = { ...fetchSort(sort), minPrice, maxPrice, taxonomyId }
      return searchEtsyListingsPaged(q, 100, (page - 1) * 100, opts)
    })

    const cutoff = releaseDays ? Date.now() - Number(releaseDays) * 86_400_000 : null

    const products: HotProduct[] = scan.listings
      .filter(l => (l.num_favorers ?? 0) >= minFavorites)
      .filter(l => !cutoff || (l.created_timestamp && l.created_timestamp * 1000 >= cutoff))
      .map(l => {
        const { score, favPerDay, engagementPct } = hotScore(l)
        return {
          listing_id: l.listing_id,
          title: l.title,
          url: l.url,
          image: l.images?.[0]?.url_570xN ?? null,
          price: l.price?.amount ? parseFloat((l.price.amount / (l.price.divisor || 100)).toFixed(2)) : null,
          currency: l.price?.currency_code ?? 'USD',
          views: l.views ?? 0,
          favorites: l.num_favorers ?? 0,
          engagementPct,
          favPerDay,
          hotScore: score,
          tags: (l.tags ?? []).slice(0, 8),
          shopName: l.shop_name ?? '',
          createdTimestamp: l.created_timestamp ?? null,
          quantity: l.quantity ?? 0,
        }
      })

    // Views/favorites/hot/newest are ordered on the sample (Etsy can't sort by
    // engagement, and its created sort proved unreliable). Price came globally
    // price-sorted from Etsy, so it's left in Etsy's order.
    if (sort === 'hot') products.sort((a, b) => b.hotScore - a.hotScore)
    else if (sort === 'favorites') products.sort((a, b) => b.favorites - a.favorites)
    else if (sort === 'views') products.sort((a, b) => b.views - a.views)
    else if (sort === 'newest') products.sort((a, b) => (b.createdTimestamp ?? 0) - (a.createdTimestamp ?? 0))
    else if (sort === 'engagement') products.sort((a, b) => b.engagementPct - a.engagementPct)
    else if (sort === 'velocity') products.sort((a, b) => (b.favPerDay ?? 0) - (a.favPerDay ?? 0))

    const state = products.length ? await meter.commit() : undefined
    return NextResponse.json({
      success: true,
      data: { products, total: scan.count, sampled: scan.listings.length },
      ...(state ? { state } : {}),
    })
  } catch (e) {
    console.error('[Hot Products] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not load products from Etsy.' }, { status: 502 })
  }
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const GET = withUsage(handleGET)
