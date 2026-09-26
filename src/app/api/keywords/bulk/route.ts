import { NextRequest, NextResponse } from 'next/server'
import { levelForCount } from '@/lib/etsy'
import { googleKeywordMetrics, isGoogleAdsConfigured, normalizeGeo } from '@/lib/google-ads'
import { getKeywordCore } from '@/lib/keywords'
import { guardSearch } from '@/lib/searchGate'
import type { ApiResponse, BulkKeywordRow } from '@/types'

export const runtime = 'nodejs'

const MAX_KEYWORDS = 25

/**
 * Bulk keyword comparison against REAL Etsy figures.
 *
 * Every row is read from the SAME keyword package the single Keyword Search
 * shows (getKeywordCore: top-100 listing sample, shared cache, same country's
 * Google numbers), so a keyword reads identically on both screens. It used to
 * run its own top-20 search with US-only Google volume, which is why the two
 * tools disagreed. A bonus: a keyword already searched on either screen costs
 * no new API calls here.
 */
async function analyzeOne(keyword: string, geo: string): Promise<BulkKeywordRow> {
  const base = {
    keyword,
    charCount: keyword.length,
    wordCount: keyword.split(/\s+/).filter(Boolean).length,
  }
  try {
    const { stats: s, listings } = await getKeywordCore(keyword, geo)
    const count = s.totalResults ?? 0

    // Nothing sells here. Reporting KD 4 / "Low" would make a dead keyword the
    // most attractive row on the page, so difficulty is withheld instead.
    const noMarket = count === 0 || !listings?.length

    return {
      ...base,
      competition: count,
      competitionLevel: noMarket ? null : levelForCount(count),
      difficulty: noMarket ? null : s.difficulty,
      avgViews: s.avgViews,
      avgFavorites: s.avgFavorites,
      favPerView: s.favPerView,
      // Keyword Search's price is the same median, scoped to one currency.
      medianPrice: noMarket || !s.avgPrice ? null : s.avgPrice,
      currency: s.currency ?? 'USD',
      googleSearches: s.googleSearches ?? null,
      googleCompetition: (s.googleCompetition ?? null) as BulkKeywordRow['googleCompetition'],
      googleCpcLow: s.googleCpcLow ?? null,
      googleCpcHigh: s.googleCpcHigh ?? null,
      error: false,
      noMarket,
    }
  } catch (e) {
    console.error(`[Bulk] "${keyword}" failed:`, e)
    // A failed row is reported as failed - never as zero competition, which
    // would read as a wide-open keyword.
    return {
      ...base, competition: null, competitionLevel: null, difficulty: null,
      avgViews: null, avgFavorites: null, favPerView: null, medianPrice: null,
      currency: 'USD', googleSearches: null, error: true, noMarket: false,
    }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<BulkKeywordRow[]>>> {
  const body = await req.json().catch(() => ({})) as { keywords?: string[]; geo?: string }
  const keywords = [...new Set((body.keywords ?? [])
    .map(k => String(k).trim().toLowerCase())
    .filter(k => k.length >= 2))]
    .slice(0, MAX_KEYWORDS)
  // Same country list and default (Global) as the single Keyword Search.
  const geo = normalizeGeo(body.geo ?? 'GLO')

  if (!keywords.length) {
    return NextResponse.json({ success: false, error: 'Provide at least one keyword (2+ characters).' }, { status: 400 })
  }

  const gate = await guardSearch<BulkKeywordRow[]>(req)
  if (gate) return gate

  try {
    // One batched Google lookup first. Answers are stored per keyword, so each
    // keyword package below reads its Google numbers from that store instead of
    // spending a separate Google request per keyword.
    if (isGoogleAdsConfigured()) await googleKeywordMetrics(keywords, geo).catch(() => null)

    // Concurrency 4: each uncached keyword is one Etsy search, and the shared
    // rate gate in etsy.ts is what actually keeps us under the ~10/sec ceiling.
    const rows: BulkKeywordRow[] = []
    const queue = [...keywords]
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length) {
        const kw = queue.shift()
        if (!kw) return
        rows.push(await analyzeOne(kw, geo))
      }
    }))

    // Lowest real competition first - the actionable order.
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
