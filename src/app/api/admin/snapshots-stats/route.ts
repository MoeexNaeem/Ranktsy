import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ListingSnapshot, ShopSnapshot, TrackedListing } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { dayKey } from '@/lib/snapshots'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

/**
 * Snapshot-database health for the admin overview - lets us watch the crowd-
 * sourced tracking dataset grow. `measuredListings` is the payoff metric: listings
 * with >= 2 dated review-count snapshots, i.e. ones now yielding REAL sales velocity.
 */
export async function GET(): Promise<NextResponse<ApiResponse<unknown>>> {
  const auth = await getCurrentUser().catch(() => null)
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  try {
    await connectDB()
    const today = dayKey()

    const [trackedListings, listingSnapshots, snapshotsToday, shopSnapshots] = await Promise.all([
      TrackedListing.estimatedDocumentCount(),
      ListingSnapshot.estimatedDocumentCount(),
      ListingSnapshot.countDocuments({ day: today }),
      ShopSnapshot.estimatedDocumentCount(),
    ])

    // Listings with >= 2 review-count snapshots → real measured sales velocity.
    const measuredAgg = await ListingSnapshot.aggregate<{ n: number }>([
      { $match: { reviewCount: { $ne: null } } },
      { $group: { _id: '$listingId', c: { $sum: 1 } } },
      { $match: { c: { $gte: 2 } } },
      { $count: 'n' },
    ])
    const measuredListings = measuredAgg[0]?.n ?? 0

    const recent = await TrackedListing.find({})
      .sort({ lastSeenAt: -1 })
      .limit(10)
      .select('listingId title observeCount lastSeenAt')
      .lean<{ listingId: number; title?: string; observeCount: number; lastSeenAt: Date }[]>()

    return NextResponse.json({
      success: true,
      data: {
        trackedListings,
        listingSnapshots,
        snapshotsToday,
        shopSnapshots,
        measuredListings,
        recent: recent.map(r => ({
          listingId: r.listingId,
          title: r.title ?? '',
          observeCount: r.observeCount,
          lastSeenAt: r.lastSeenAt,
        })),
      },
    })
  } catch (e) {
    console.error('[Admin] snapshots-stats failed:', e)
    return NextResponse.json({ success: false, error: 'Could not load snapshot stats' }, { status: 500 })
  }
}
