import { NextRequest, NextResponse } from 'next/server'
import { getKeywordRankMovers, getKeywordRankCoverage, getKeywordPageSignals, HistoryBusyError, type RankMover, type KeywordPageSignals } from '@/lib/snapshots'
import { memCache, cacheKey } from '@/lib/cache'
import { singleFlight } from '@/lib/concurrency'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

interface RankMoversResponse {
  movers: RankMover[]
  /** False when captures exist but are not yet a trustworthy ranking. */
  reliable: boolean
  reason: 'ok' | 'none' | 'ambiguous'
  /** The market these positions belong to, e.g. 'us'. */
  country?: string
  coverage: { keyword: string; days: number; listings: number; fromDay: string | null } | null
  /** What the ranking listings have in common: free shipping, video, badges. */
  signals: KeywordPageSignals | null
}

/**
 * Who climbed and who fell for a keyword, from OUR own daily captures.
 *
 * Etsy publishes today's ordering and no history whatsoever, so this cannot be
 * fetched on demand from anywhere: it exists only because the extension recorded
 * the real ordering shoppers saw, day after day. A keyword we have not captured
 * on at least two days returns an empty list and the UI says tracking has
 * started, rather than implying nothing moved.
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<RankMoversResponse>>> {
  const { searchParams } = new URL(req.url)
  const keyword = (searchParams.get('q') ?? '').trim()
  const days = Math.min(Math.max(Number(searchParams.get('days') ?? 30), 7), 400)
  // Optional: pin to one market. Omitted, the library picks the best-covered one.
  const country = searchParams.get('country') ?? undefined
  if (!keyword) return NextResponse.json({ success: false, error: 'Missing keyword' }, { status: 400 })

  // Captures arrive through the day, so a short cache keeps this close to live
  // while sparing the database the same large read on every open of the panel.
  const key = cacheKey('rank-movers', 'v1', keyword.toLowerCase(), String(days), country ?? '')
  const hit = memCache.get<RankMoversResponse>(key)
  if (hit) return NextResponse.json({ success: true, data: hit })

  const data = await singleFlight(key, async () => {
    let busy = false
    const [result, coverage, signals] = await Promise.all([
      getKeywordRankMovers(keyword, days, 40, country),
      getKeywordRankCoverage(keyword, days),
      getKeywordPageSignals(keyword, days).catch(e => {
        if (e instanceof HistoryBusyError) { busy = true; return null }
        throw e
      }),
    ])
    const out: RankMoversResponse = { movers: result.movers, reliable: result.reliable, reason: result.reason, country: result.country, coverage, signals }
    // A busy answer (signals skipped) is kept only briefly, so the full one follows soon.
    memCache.set(key, out, busy ? 60 : 30 * 60)
    return out
  })
  return NextResponse.json({ success: true, data })
}
