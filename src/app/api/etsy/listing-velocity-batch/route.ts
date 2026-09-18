import { NextRequest, NextResponse } from 'next/server'
import { getListingVelocityBatch, type ListingVelocitySummary } from '@/lib/snapshots'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

/**
 * Measured velocity for a page of listings, from OUR crowd-sourced snapshot
 * history (see /api/etsy/observe). One DB read for the whole table.
 *
 * Listings we have not tracked long enough are simply absent from the response:
 * the client then keeps its point-in-time estimate and badges it as one. A
 * missing entry never means "zero sales".
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<Record<string, ListingVelocitySummary>>>> {
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; days?: unknown }
  const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(n => Number.isFinite(n) && n > 0) : []
  if (!ids.length) return NextResponse.json({ success: false, error: 'No listing ids' }, { status: 400 })
  const days = Math.min(Math.max(Number(body.days) || 120, 14), 400)

  const map = await getListingVelocityBatch(ids, days)
  const out: Record<string, ListingVelocitySummary> = {}
  for (const [id, v] of map) if (v.measured) out[String(id)] = v
  return NextResponse.json({ success: true, data: out })
}
