import { NextRequest, NextResponse } from 'next/server'
import { getListingVelocity } from '@/lib/snapshots'
import type { ApiResponse, ListingVelocity } from '@/types'

export const runtime = 'nodejs'

/**
 * Measured per-listing sales velocity from OUR crowd-sourced snapshot history
 * (see /api/etsy/observe). Etsy publishes no per-listing sales and no history, so
 * "sold last 30 days" only exists once we've captured the listing across days.
 *
 * A listing we've never captured (or captured only once) returns `measured:false`
 * with null windows - the client must fall back to the point-in-time estimate and
 * say "tracking started", never imply a real zero.
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<ListingVelocity>>> {
  const { searchParams } = new URL(req.url)
  const id = parseInt(searchParams.get('id') ?? '', 10)
  const days = Math.min(Math.max(Number(searchParams.get('days') ?? 90), 7), 400)
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ success: false, error: 'Missing or invalid listing id' }, { status: 400 })
  }

  const velocity = await getListingVelocity(id, days)
  if (!velocity) {
    return NextResponse.json({
      success: true,
      data: {
        listingId: id, trackedSince: null, days: 0, points: [], reviewsLatest: null,
        reviewsLast7: null, reviewsLast30: null, soldLast30Est: null, favsLast30: null,
        viewsLast30: null, measured: false,
      },
    })
  }
  return NextResponse.json({ success: true, data: velocity })
}
