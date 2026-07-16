import { NextRequest, NextResponse } from 'next/server'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { getListingById, searchEtsyListingsPaged, dominantCurrencyPrices } from '@/lib/etsy'
import type { ApiResponse, ListingBenchmark } from '@/types'

export const runtime = 'nodejs'

const median = (a: number[]) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)] : 0)

/** Percentile rank of `v` within `pool` — "you're better than X% of rivals". */
function percentile(pool: number[], v: number): number {
  if (!pool.length) return 50
  const below = pool.filter(x => x < v).length
  return Math.round((below / pool.length) * 100)
}

/**
 * Score a listing against the listings it actually competes with, rather than
 * against generic advice.
 *
 * "Use all 13 tags" is true everywhere and therefore says nothing about whether
 * you can win THIS search. The niche's real medians do: if the top listings for
 * your keyword average 9 images and you have 4, that's an actionable gap.
 *
 * The niche is inferred from the listing's own most specific tag (Etsy tags are
 * seller-authored and describe the product), falling back to its title.
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<ListingBenchmark>>> {
  const id = parseInt(new URL(req.url).searchParams.get('id') ?? '', 10)
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ success: false, error: 'Missing or invalid listing id' }, { status: 400 })
  }

  try {
    const listing = await getListingById(id)
    if (!listing) return NextResponse.json({ success: false, error: 'Listing not found or inactive' }, { status: 404 })

    // Longest multi-word tag = the most specific description of what this is.
    const tags = (listing.tags ?? []).filter(t => t.trim().length > 2)
    const multi = tags.filter(t => t.trim().split(/\s+/).length >= 2)
    const niche = (multi.sort((a, b) => b.length - a.length)[0]
      ?? tags[0]
      ?? listing.title.split(/[,|-]/)[0].trim().split(/\s+/).slice(0, 4).join(' ')).toLowerCase()

    const key = cacheKey('benchmark', 'v1', niche)
    let peers = memCache.get<Awaited<ReturnType<typeof searchEtsyListingsPaged>>>(key)
    if (!peers) {
      peers = await searchEtsyListingsPaged(niche, 100, 0)
      memCache.set(key, peers, CACHE_TTL.KEYWORD)
    }

    // Don't benchmark a listing against itself.
    const rivals = peers.listings.filter(l => l.listing_id !== listing.listing_id)
    if (rivals.length < 5) {
      return NextResponse.json({
        success: true,
        data: { niche, sample: rivals.length, enoughData: false } as ListingBenchmark,
      })
    }

    const tagCounts   = rivals.map(l => (l.tags ?? []).length)
    const titleLens   = rivals.map(l => l.title.length)
    const imageCounts = rivals.map(l => l.images?.length ?? 0)
    const viewCounts  = rivals.map(l => l.views ?? 0)
    const favCounts   = rivals.map(l => l.num_favorers ?? 0)

    // Price only within the dominant currency — Etsy mixes currencies with no
    // FX rate, so a cross-currency median would be meaningless.
    const { currency, prices } = dominantCurrencyPrices(rivals)
    const yourPrice = listing.price?.amount ? listing.price.amount / (listing.price.divisor || 100) : null
    const sameCurrency = listing.price?.currency_code === currency

    return NextResponse.json({
      success: true,
      data: {
        niche,
        sample: rivals.length,
        enoughData: true,
        totalCompetition: peers.count,
        currency,
        medianTags:   median(tagCounts),
        medianTitle:  median(titleLens),
        medianImages: median(imageCounts),
        medianViews:  median(viewCounts),
        medianFavorites: median(favCounts),
        medianPrice:  prices.length ? parseFloat(median(prices).toFixed(2)) : null,
        priceSample:  prices.length,
        // Percentiles only where the comparison is apples-to-apples.
        yourPricePercentile: yourPrice != null && sameCurrency && prices.length ? percentile(prices, yourPrice) : null,
        yourViewsPercentile: percentile(viewCounts, listing.views ?? 0),
        yourFavoritesPercentile: percentile(favCounts, listing.num_favorers ?? 0),
        priceComparable: sameCurrency,
      },
    })
  } catch (e) {
    console.error('[Benchmark] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not benchmark this listing.' }, { status: 502 })
  }
}
