import { NextRequest, NextResponse } from 'next/server'
import { memCache, CACHE_TTL } from '@/lib/cache'
import { getKeywordCore, nearKey } from '@/lib/keywords'
import { getNearMatches, authenticKdRows } from '@/lib/etsy'
import { withUsage } from '@/lib/track'
import type { ApiResponse, NearMatch } from '@/types'

export const runtime = 'nodejs'
export const GET = withUsage(getHandler)

/**
 * Near matches - plural/hyphen/word-order variants, each measured against its
 * OWN live Etsy search (~6 calls, ~1s behind the rate gate).
 *
 * Split out of /api/keywords so it can't hold up the first paint.
 */
async function getHandler(req: NextRequest): Promise<NextResponse<ApiResponse<NearMatch[]>>> {
  const query = new URL(req.url).searchParams.get('q')?.trim().toLowerCase()
  if (!query || query.length < 2) {
    return NextResponse.json({ success: false, error: 'Query must be at least 2 characters' }, { status: 400 })
  }

  const key = nearKey(query)
  const hit = memCache.get<NearMatch[]>(key)
  if (hit) return NextResponse.json({ success: true, data: authenticKdRows(hit), cached: true })

  // Not read from the shared Collective store: matches saved there were measured on
  // a 25-listing sample and disagreed with the variant once searched (2026-10-03).

  try {
    const matches = await getNearMatches(query)

    // The "exact" row is the query itself. Both now use the top 100, but they are
    // separate fetches (possibly minutes apart), so the row is set from the core to
    // guarantee one number per keyword on one screen. The core is cached, so this
    // costs nothing.
    const core = await getKeywordCore(query).catch(() => null)
    const reconciled = core
      ? matches.map(m => m.kind === 'exact'
          ? {
              ...m,
              difficulty:   core.stats.difficulty,
              competition:  core.stats.totalResults,
              avgViews:     core.stats.avgViews,
              avgFavorites: core.stats.avgFavorites,
              favPerView:   core.stats.favPerView,
            }
          : m)
      : matches

    memCache.set(key, reconciled, CACHE_TTL.KEYWORD)
    return NextResponse.json({ success: true, data: authenticKdRows(reconciled), cached: false })
  } catch (e) {
    console.error('[Keywords/near-matches] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not measure near matches.' }, { status: 502 })
  }
}
