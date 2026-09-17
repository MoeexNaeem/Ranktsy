import { NextRequest, NextResponse } from 'next/server'
import { cacheKey, CACHE_TTL } from '@/lib/cache'
import { etsyCacheGetMany, etsyCacheSetMany } from '@/lib/etsy-cache'
import { getListingReviewStats, etsyKeyLocks } from '@/lib/etsy'
import { withUsage } from '@/lib/track'
import type { ApiResponse, ListingReviewStats } from '@/types'

export const runtime = 'nodejs'
export const GET = withUsage(getHandler)

const MAX_IDS = 100
// Etsy has no batch reviews endpoint: every uncached listing costs one Etsy call,
// and each key allows only ~10,000 a DAY. Normally we fetch every requested id, so
// users always see complete data. ONLY when a key is already locked out for the day
// (quota trouble) do we limit new lookups, so the last of the quota is spread across
// users instead of one page view spending it all - the rest come back unknown ("-")
// and fill in from the shared cache on later views.
const MAX_NEW_UNDER_PRESSURE = Math.max(1, Number(process.env.ETSY_REVIEWS_MAX_NEW) || 12)

/**
 * Real review stats per listing - lifetime `count` (a verified units-sold floor)
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
  // v2 key: cached shape changed from a bare count to { count, last30d }.
  const keyOf = (id: number) => cacheKey('lreview', 'v2', String(id))
  const cached = await etsyCacheGetMany<ListingReviewStats>(ids.map(keyOf))
  for (const id of ids) {
    const hit = cached.get(keyOf(id))
    if (hit) out[id] = hit
    else misses.push(id)
  }

  // Fetch only the uncached ids. etsyFetch's internal rate gate serialises these,
  // so Promise.all here won't exceed Etsy's limit - it just avoids idle waiting.
  // Full data normally; capped only while the Etsy pool is out of quota.
  const limit = etsyKeyLocks().length ? MAX_NEW_UNDER_PRESSURE : misses.length
  const fetchNow = misses.slice(0, limit)
  for (const id of misses.slice(limit)) out[id] = { count: null, last30d: null }

  await Promise.all(fetchNow.map(async id => {
    const stats = await getListingReviewStats(id)
    // Only cache a real lookup (count resolved). A total miss is left uncached so it
    // retries next time rather than being pinned as "-" for hours.
    if (stats.count !== null) etsyCacheSetMany([{ key: keyOf(id), data: stats }], CACHE_TTL.KEYWORD)
    out[id] = stats
  }))

  return NextResponse.json({ success: true, data: out })
}
