import { NextRequest, NextResponse } from 'next/server'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { searchEtsyListingsPaged, levelForCount, difficultyScore, dominantCurrencyPrices } from '@/lib/etsy'
import { googleKeywordMetrics, isGoogleAdsConfigured } from '@/lib/google-ads'
import type { ApiResponse, BulkKeywordRow } from '@/types'

export const runtime = 'nodejs'

const MAX_KEYWORDS = 25

/**
 * Bulk keyword comparison against REAL Etsy figures.
 *
 * Each keyword gets its own live search, so every figure is measured from that
 * keyword's own listings — `count` is the true active-listing total, and views /
 * favourites come from the listings that actually rank for it. Competition
 * banding and KD use the same shared helpers as the Keyword Tool, so one keyword
 * can't read differently on two screens.
 */
async function analyzeOne(keyword: string): Promise<BulkKeywordRow> {
  const key = cacheKey('bulk', 'v1', keyword)
  const hit = memCache.get<BulkKeywordRow>(key)
  if (hit) return hit

  try {
    // 20 listings is enough to anchor engagement; `count` is the headline and
    // costs nothing extra. No images — this table never renders one.
    const { listings, count } = await searchEtsyListingsPaged(keyword, 20, 0, { skipImages: true })

    const views = listings.reduce((s, l) => s + (l.views ?? 0), 0)
    const faves = listings.reduce((s, l) => s + (l.num_favorers ?? 0), 0)
    const avgViews = listings.length ? Math.round(views / listings.length) : 0
    const avgFavs  = listings.length ? Math.round(faves / listings.length) : 0
    const favPerView = parseFloat((faves / Math.max(views, 1) * 100).toFixed(1))

    // Prices are scoped to one currency — a keyword search returns many, and
    // Etsy publishes no FX rate.
    const { currency, prices } = dominantCurrencyPrices(listings)
    const medianPrice = prices.length ? parseFloat(prices[Math.floor((prices.length - 1) / 2)].toFixed(2)) : null

    // Nothing sells here. Reporting KD 4 / "Low" would make a dead keyword the
    // most attractive row on the page, so difficulty is withheld instead.
    const noMarket = count === 0 || listings.length === 0

    const row: BulkKeywordRow = {
      keyword,
      competition: count,
      competitionLevel: noMarket ? null : levelForCount(count),
      difficulty: noMarket ? null : difficultyScore(count, favPerView),
      avgViews,
      avgFavorites: avgFavs,
      favPerView,
      medianPrice,
      currency,
      charCount: keyword.length,
      wordCount: keyword.split(/\s+/).filter(Boolean).length,
      googleSearches: null,
      error: false,
      noMarket,
    }
    memCache.set(key, row, CACHE_TTL.KEYWORD)
    return row
  } catch (e) {
    console.error(`[Bulk] "${keyword}" failed:`, e)
    // A failed row is reported as failed — never as zero competition, which
    // would read as a wide-open keyword.
    return {
      keyword, competition: null, competitionLevel: null, difficulty: null,
      avgViews: null, avgFavorites: null, favPerView: null, medianPrice: null,
      currency: 'USD', charCount: keyword.length,
      wordCount: keyword.split(/\s+/).filter(Boolean).length,
      googleSearches: null, error: true, noMarket: false,
    }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<BulkKeywordRow[]>>> {
  const body = await req.json().catch(() => ({})) as { keywords?: string[] }
  const keywords = [...new Set((body.keywords ?? [])
    .map(k => String(k).trim().toLowerCase())
    .filter(k => k.length >= 2))]
    .slice(0, MAX_KEYWORDS)

  if (!keywords.length) {
    return NextResponse.json({ success: false, error: 'Provide at least one keyword (2+ characters).' }, { status: 400 })
  }

  try {
    // Concurrency 4: each keyword is its own Etsy search, and the shared rate
    // gate in etsy.ts is what actually keeps us under the ~10/sec ceiling.
    const rows: BulkKeywordRow[] = []
    const queue = [...keywords]
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length) {
        const kw = queue.shift()
        if (!kw) return
        rows.push(await analyzeOne(kw))
      }
    }))

    if (isGoogleAdsConfigured()) {
      const metrics = await googleKeywordMetrics(keywords)
      if (metrics.size) {
        for (const r of rows) r.googleSearches = metrics.get(r.keyword)?.searches ?? null
      }
    }

    // Lowest real competition first — the actionable order.
    rows.sort((a, b) => {
      if (a.competition == null && b.competition == null) return 0
      if (a.competition == null) return 1
      if (b.competition == null) return -1
      return a.competition - b.competition
    })

    return NextResponse.json({ success: true, data: rows })
  } catch (e) {
    console.error('[Bulk] failed:', e)
    return NextResponse.json({ success: false, error: 'Bulk analysis failed.' }, { status: 502 })
  }
}
