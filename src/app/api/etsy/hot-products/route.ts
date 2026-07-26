import { NextRequest, NextResponse } from 'next/server'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { searchEtsyListingsPaged } from '@/lib/etsy'
import { guardSearch } from '@/lib/searchGate'
import type { SearchOpts as EtsySearchOpts } from '@/lib/etsy'
import type { ApiResponse, HotProduct, HotProductsResponse, EtsyListing } from '@/types'

export const runtime = 'nodejs'

/**
 * Find Hot Products — a product-research database over LIVE Etsy listings.
 *
 * Compliance (the product's whole identity): Etsy's API exposes no per-listing
 * sales, revenue, or history — so this tool never shows them. "Hot" is ranked
 * from REAL signals only: how strongly a listing engages buyers (favorites ÷
 * views) and how fast it accrues favorites for its age (favorites ÷ days live).
 * Everything returned is measured from the Etsy API. See no-fabricated-data-rule.
 */

type SortKey = 'hot' | 'favorites' | 'views' | 'newest' | 'price_low' | 'price_high'

// Map the UI sort to how we fetch from Etsy. Etsy can sort globally by relevance,
// created date and price — but NOT by views/favorites, so those are scored on the
// fetched sample (honest: "hottest among the top matches", stated in the UI).
function fetchSort(sort: SortKey): Pick<EtsySearchOpts, 'sortOn' | 'sortOrder'> {
  switch (sort) {
    case 'newest':     return { sortOn: 'created', sortOrder: 'desc' }
    case 'price_low':  return { sortOn: 'price', sortOrder: 'asc' }
    case 'price_high': return { sortOn: 'price', sortOrder: 'desc' }
    default:           return { sortOn: 'score' }   // hot / favorites / views
  }
}

/** Hot Score 0–100 from real fields only — favorite-velocity + engagement. */
function hotScore(l: EtsyListing): { score: number; favPerDay: number | null; engagementPct: number } {
  const views = l.views ?? 0
  const favs = l.num_favorers ?? 0
  const engagementPct = views > 0 ? parseFloat((favs / views * 100).toFixed(1)) : 0

  let favPerDay: number | null = null
  if (l.created_timestamp) {
    const ageDays = Math.max(1, (Date.now() - l.created_timestamp * 1000) / 86_400_000)
    favPerDay = favs / ageDays
  }

  // velScore: 50 favorites/day ≈ maxed (log-scaled). engScore: 8% fav/view ≈ maxed.
  const velScore = favPerDay != null ? Math.min(Math.log10(favPerDay + 1) / Math.log10(51), 1) : Math.min(Math.log10(favs + 1) / Math.log10(20001), 1)
  const engScore = Math.min(engagementPct / 8, 1)
  const score = Math.round(100 * (0.6 * velScore + 0.4 * engScore))
  return { score, favPerDay: favPerDay != null ? parseFloat(favPerDay.toFixed(2)) : null, engagementPct }
}

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<HotProductsResponse>>> {
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

  // Cache the raw Etsy scan (expensive) separately from the cheap re-sort/filter,
  // so changing sort or a client-side filter is instant.
  const scanKey = cacheKey('hot', 'v2', q, String(taxonomyId ?? ''), String(minPrice ?? ''), String(maxPrice ?? ''), sort, String(page))
  let scan = memCache.get<{ listings: EtsyListing[]; count: number }>(scanKey)
  try {
    if (!scan) {
      const opts: EtsySearchOpts = { ...fetchSort(sort), minPrice, maxPrice, taxonomyId }
      scan = await searchEtsyListingsPaged(q, 100, (page - 1) * 100, opts)
      memCache.set(scanKey, scan, CACHE_TTL.TRENDING)
    }

    const cutoff = releaseDays ? Date.now() - Number(releaseDays) * 86_400_000 : null

    let products: HotProduct[] = scan.listings
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

    return NextResponse.json({
      success: true,
      data: { products, total: scan.count, sampled: scan.listings.length },
    })
  } catch (e) {
    console.error('[Hot Products] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not load products from Etsy.' }, { status: 502 })
  }
}
