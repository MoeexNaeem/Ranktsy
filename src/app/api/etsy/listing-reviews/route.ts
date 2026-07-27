import { NextRequest, NextResponse } from 'next/server'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { getListingReviewCount } from '@/lib/etsy'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

const MAX_IDS = 100

/**
 * Real review count per listing — the honest stand-in for eRank's fabricated
 * "Est. Sales" (a review is a verified purchase, so the count is a lower bound on
 * units sold). Returns { [id]: count | null }.
 *
 * Each id is a separate Etsy call, so counts are cached 24h per listing and the
 * shared Etsy rate gate throttles the fan-out. The client fetches this LAZILY
 * after the table paints, so the rest of the page never waits on it.
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<Record<number, number | null>>>> {
  const raw = new URL(req.url).searchParams.get('ids') ?? ''
  const ids = [...new Set(raw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n > 0))].slice(0, MAX_IDS)
  if (!ids.length) return NextResponse.json({ success: false, error: 'Provide ?ids=1,2,3' }, { status: 400 })

  const out: Record<number, number | null> = {}
  const misses: number[] = []
  for (const id of ids) {
    // memCache.get returns null on a MISS (not undefined), and we only ever store
    // real numeric counts — so a non-null hit is a genuine cached value (0 reviews
    // included) and null means "not cached → fetch". The earlier `!== undefined`
    // check treated every miss as a cached null and never fetched anything.
    const hit = memCache.get<number>(cacheKey('lreview', 'v1', String(id)))
    if (hit !== null) out[id] = hit
    else misses.push(id)
  }

  // Fetch only the uncached ids. etsyFetch's internal rate gate serialises these,
  // so Promise.all here won't exceed Etsy's limit — it just avoids idle waiting.
  await Promise.all(misses.map(async id => {
    const count = await getListingReviewCount(id)
    // Only cache a real count. A null (failed/unavailable) is left uncached so it
    // retries next time rather than being pinned as "—" for hours.
    if (count !== null) memCache.set(cacheKey('lreview', 'v1', String(id)), count, CACHE_TTL.KEYWORD)
    out[id] = count
  }))

  return NextResponse.json({ success: true, data: out })
}
