import { NextRequest, NextResponse } from 'next/server'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { getListingReviewStats } from '@/lib/etsy'
import { withUsage } from '@/lib/track'
import type { ApiResponse, ListingReviewStats } from '@/types'

export const runtime = 'nodejs'
export const GET = withUsage(getHandler)

const MAX_IDS = 100

/**
 * Real review stats per listing — lifetime `count` (a verified units-sold floor)
 * plus trailing-30-day velocity (`last30d`). Both are REAL Etsy data; the sales
 * ESTIMATE built on them (salesEstimate.ts) is what's labelled an estimate.
 * Returns { [id]: { count, last30d } }.
 *
 * Each id is a separate Etsy call, so stats are cached 24h per listing and the
 * shared Etsy rate gate throttles the fan-out. The client fetches this LAZILY
 * after the table paints, so the rest of the page never waits on it.
 */
async function getHandler(req: NextRequest): Promise<NextResponse<ApiResponse<Record<number, ListingReviewStats>>>> {
  const raw = new URL(req.url).searchParams.get('ids') ?? ''
  const ids = [...new Set(raw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n > 0))].slice(0, MAX_IDS)
  if (!ids.length) return NextResponse.json({ success: false, error: 'Provide ?ids=1,2,3' }, { status: 400 })

  const out: Record<number, ListingReviewStats> = {}
  const misses: number[] = []
  for (const id of ids) {
    // v2 key: cached shape changed from a bare count to { count, last30d }.
    const hit = memCache.get<ListingReviewStats>(cacheKey('lreview', 'v2', String(id)))
    if (hit !== null) out[id] = hit
    else misses.push(id)
  }

  // Fetch only the uncached ids. etsyFetch's internal rate gate serialises these,
  // so Promise.all here won't exceed Etsy's limit — it just avoids idle waiting.
  await Promise.all(misses.map(async id => {
    const stats = await getListingReviewStats(id)
    // Only cache a real lookup (count resolved). A total miss is left uncached so it
    // retries next time rather than being pinned as "—" for hours.
    if (stats.count !== null) memCache.set(cacheKey('lreview', 'v2', String(id)), stats, CACHE_TTL.KEYWORD)
    out[id] = stats
  }))

  return NextResponse.json({ success: true, data: out })
}
