import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { compareMovers, type MoverComparison } from '@/lib/rank-explain'
import { HistoryBusyError } from '@/lib/snapshots'
import { memCache, cacheKey } from '@/lib/cache'
import { singleFlight } from '@/lib/concurrency'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

interface Body {
  q?: string
  movers?: { listingId?: unknown; change?: unknown; firstDay?: unknown; latestDay?: unknown }[]
}

/**
 * Rank Movement → "What climbers did differently": the measured traits of the
 * listings that climbed vs the ones that dropped for one keyword. The client sends
 * the movers it already has (from /api/etsy/rank-movers), so this never repeats
 * the large rank read. Read-only and not charged, like the rest of the panel.
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<MoverComparison>>> {
  const body = (await req.json().catch(() => ({}))) as Body
  const keyword = String(body.q ?? '').trim()
  const movers = (Array.isArray(body.movers) ? body.movers : []).slice(0, 40).map(m => ({
    listingId: Number(m.listingId),
    change: Number(m.change),
    firstDay: String(m.firstDay ?? ''),
    latestDay: String(m.latestDay ?? ''),
  })).filter(m => Number.isFinite(m.listingId) && m.listingId > 0 && Number.isFinite(m.change))
  if (!keyword || !movers.length) return NextResponse.json({ success: false, error: 'Missing keyword or listings' }, { status: 400 })

  const fp = createHash('sha1').update(movers.map(m => `${m.listingId}:${m.change}:${m.firstDay}:${m.latestDay}`).join('|')).digest('hex').slice(0, 16)
  const key = cacheKey('rank-compare', 'v1', keyword.toLowerCase(), fp)
  const hit = memCache.get<MoverComparison>(key)
  if (hit) return NextResponse.json({ success: true, data: hit })

  try {
    const data = await singleFlight(key, async () => {
      const out = await compareMovers(keyword, movers)
      if (out) memCache.set(key, out, 30 * 60)
      return out
    })
    if (!data) return NextResponse.json({ success: false, error: 'Nothing to compare yet' }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    if (e instanceof HistoryBusyError) {
      return NextResponse.json({ success: false, error: 'History is busy, try again in a moment' }, { status: 503 })
    }
    console.error('[rank-compare]', e)
    return NextResponse.json({ success: false, error: 'Could not compare these listings' }, { status: 500 })
  }
}
