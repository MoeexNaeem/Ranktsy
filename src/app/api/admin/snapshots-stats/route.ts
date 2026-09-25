import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ListingSnapshot, ShopSnapshot, TrackedListing, SearchRankSnapshot, KeywordMarketSnapshot, AppSetting } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { singleFlight } from '@/lib/concurrency'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

/**
 * Snapshot-database health for the admin overview - lets us watch the crowd-
 * sourced tracking dataset grow. `measuredListings` is the payoff metric: listings
 * with >= 2 dated review-count snapshots, i.e. ones now yielding REAL sales velocity.
 *
 * Everything here must stay cheap: the dashboard loads it on every visit, and the old
 * version scanned all ~3.6M snapshots twice per load (49s for "today" alone), which
 * timed out (the dashboard showed zeros) and slowed the database for every user.
 *   - "today" counts use the capturedAt index (each day's row is stamped that day);
 *   - the two "measured" totals need a full group-by, so they are computed in the
 *     background at most every HEAVY_TTL_MS and served from the last saved result.
 */
const HEAVY_KEY = 'snapshot-stats-heavy'
const HEAVY_TTL_MS = 6 * 3600_000

interface HeavyStats { measuredListings: number; measuredRankPairs: number; computedAt: string }

async function computeHeavy(): Promise<HeavyStats> {
  const [measuredAgg, rankMeasuredAgg] = await Promise.all([
    // Listings with >= 2 review-count snapshots → real measured sales velocity.
    ListingSnapshot.aggregate<{ n: number }>([
      { $match: { reviewCount: { $ne: null } } },
      { $group: { _id: '$listingId', c: { $sum: 1 } } },
      { $match: { c: { $gte: 2 } } },
      { $count: 'n' },
    ]).option({ maxTimeMS: 10 * 60_000, allowDiskUse: true }),
    // Listings whose rank we captured on >= 2 days for the same keyword → real movement.
    SearchRankSnapshot.aggregate<{ n: number }>([
      { $group: { _id: { k: '$keyword', l: '$listingId' }, c: { $sum: 1 } } },
      { $match: { c: { $gte: 2 } } },
      { $count: 'n' },
    ]).option({ maxTimeMS: 10 * 60_000, allowDiskUse: true }),
  ])
  const heavy: HeavyStats = {
    measuredListings: measuredAgg[0]?.n ?? 0,
    measuredRankPairs: rankMeasuredAgg[0]?.n ?? 0,
    computedAt: new Date().toISOString(),
  }
  await AppSetting.updateOne({ key: HEAVY_KEY }, { $set: { str: JSON.stringify(heavy) } }, { upsert: true })
  return heavy
}

/** Last saved heavy totals (null before the first run); refreshes in the background when old. */
async function heavyStats(): Promise<HeavyStats | null> {
  const doc = await AppSetting.findOne({ key: HEAVY_KEY }).lean<{ str?: string }>()
  const saved: HeavyStats | null = doc?.str ? JSON.parse(doc.str) : null
  if (!saved || Date.now() - new Date(saved.computedAt).getTime() > HEAVY_TTL_MS) {
    void singleFlight(HEAVY_KEY, computeHeavy).catch(e => console.error('[Admin] heavy snapshot stats failed:', e))
  }
  return saved
}

export async function GET(): Promise<NextResponse<ApiResponse<unknown>>> {
  const auth = await getCurrentUser().catch(() => null)
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  try {
    await connectDB()
    const startOfDay = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')

    const [
      trackedListings, listingSnapshots, snapshotsToday, shopSnapshots,
      rankSnapshots, rankSnapshotsToday, keywordsTracked, keywordMarketDays, heavy,
    ] = await Promise.all([
      TrackedListing.estimatedDocumentCount(),
      ListingSnapshot.estimatedDocumentCount(),
      ListingSnapshot.countDocuments({ capturedAt: { $gte: startOfDay } }),
      ShopSnapshot.estimatedDocumentCount(),
      // Keyword rank history - the dataset no Etsy endpoint can ever backfill.
      SearchRankSnapshot.estimatedDocumentCount(),
      SearchRankSnapshot.countDocuments({ capturedAt: { $gte: startOfDay } }),
      SearchRankSnapshot.distinct('keyword').then(k => k.length).catch(() => 0),
      KeywordMarketSnapshot.estimatedDocumentCount(),
      heavyStats(),
    ])

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
        // null until the first background run finishes (a few minutes after first load).
        measuredListings: heavy?.measuredListings ?? null,
        rankSnapshots,
        rankSnapshotsToday,
        keywordsTracked,
        keywordMarketDays,
        measuredRankPairs: heavy?.measuredRankPairs ?? null,
        measuredAt: heavy?.computedAt ?? null,
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
