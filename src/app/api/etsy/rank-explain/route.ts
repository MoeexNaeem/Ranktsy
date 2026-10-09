import { NextRequest, NextResponse } from 'next/server'
import { explainRankMove, type RankExplanation } from '@/lib/rank-explain'
import { HistoryBusyError } from '@/lib/snapshots'
import { memCache, cacheKey } from '@/lib/cache'
import { singleFlight } from '@/lib/concurrency'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

/**
 * What changed on one listing around its rank move for one keyword (Rank
 * Movement → "Why it moved"). Read-only, from our own daily snapshots, so it is
 * not charged: it explains a row of a search the user already paid for.
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<RankExplanation>>> {
  const sp = new URL(req.url).searchParams
  const keyword = (sp.get('q') ?? '').trim()
  const id = Number(sp.get('id'))
  const from = sp.get('from') ?? ''
  const to = sp.get('to') ?? ''
  const country = sp.get('country') ?? undefined
  if (!keyword || !Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ success: false, error: 'Missing keyword or listing' }, { status: 400 })
  }

  const key = cacheKey('rank-explain', 'v1', keyword.toLowerCase(), String(id), from, to, country ?? '')
  const hit = memCache.get<RankExplanation>(key)
  if (hit) return NextResponse.json({ success: true, data: hit })

  try {
    const data = await singleFlight(key, async () => {
      const out = await explainRankMove(keyword, id, from, to, country)
      // Snapshots change once a day, so half an hour keeps it fresh enough.
      if (out) memCache.set(key, out, 30 * 60)
      return out
    })
    if (!data) return NextResponse.json({ success: false, error: 'Nothing measured for this listing yet' }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    if (e instanceof HistoryBusyError) {
      return NextResponse.json({ success: false, error: 'History is busy, try again in a moment' }, { status: 503 })
    }
    console.error('[rank-explain]', e)
    return NextResponse.json({ success: false, error: 'Could not load the change history' }, { status: 500 })
  }
}
