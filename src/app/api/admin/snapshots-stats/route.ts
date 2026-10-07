import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ListingSnapshot, ShopSnapshot, TrackedListing, SearchRankSnapshot, KeywordMarketSnapshot, AppSetting } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { singleFlight } from '@/lib/concurrency'
import { readDaily } from '@/lib/dailyCounters'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

/**
 * Snapshot-database health for the admin overview - lets us watch the crowd-
 * sourced tracking dataset grow. `measuredListings` is the payoff metric: listings
 * with >= 2 dated review-count snapshots, i.e. ones now yielding REAL sales velocity.
 *
 * Everything here must stay cheap: the dashboard loads it on every visit. With ~19M
 * listing snapshots, counting "today" took 60 s+ and "keywords tracked" (a distinct)
 * 23 s, so the request timed out and the Overview showed zeros (2026-10-08).
 *   - "today" counts come from daily counters bumped by the snapshot writers;
 *   - "keywords tracked" and the two "measured" totals need full scans, so they run
 *     in the background at most once a day (one worker, via a lease) and the last
 *     saved result is served instantly.
 */
const HEAVY_KEY = 'snapshot-stats-heavy'
const HEAVY_LOCK_KEY = 'snapshot-stats-heavy-lock'
// Once a day is plenty for an admin growth number; each run scans millions of rows.
const HEAVY_TTL_MS = 24 * 3600_000
// A run holds this lease; another worker can only start once it has expired. As long
// as the TTL: a scan that fails (it timed out daily from 2026-09-27) is retried once
// a day, not restarted on every admin visit (it was every 30 min, slowing the DB).
const HEAVY_LEASE_MS = HEAVY_TTL_MS
const KW_KEY = 'snapshot-stats-keywords'
const KW_LOCK_KEY = 'snapshot-stats-keywords-lock'

interface HeavyStats { measuredListings: number; measuredRankPairs: number; computedAt: string }

/**
 * Claim the right to run the heavy scan, across ALL PM2 workers (singleFlight only
 * covers one process: with 4 workers, admin dashboard visits started several full
 * scans at once and slowed the database for every user, 2026-10-03).
 */
async function claimLease(lockKey: string, ms: number): Promise<boolean> {
  const now = Date.now()
  try {
    const r = await AppSetting.updateOne(
      { key: lockKey, $or: [{ num: { $lt: now } }, { num: { $exists: false } }] },
      { $set: { num: now + ms } },
      { upsert: true },
    )
    return r.modifiedCount === 1 || r.upsertedCount === 1
  } catch {
    return false   // duplicate key: another worker holds a live lease
  }
}

async function computeHeavy(): Promise<HeavyStats | null> {
  if (!(await claimLease(HEAVY_LOCK_KEY, HEAVY_LEASE_MS))) return null
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

/** Distinct keywords with rank history: saved once a day, served from the last run. */
async function keywordsTrackedCount(): Promise<number | null> {
  const doc = await AppSetting.findOne({ key: KW_KEY }).lean<{ num?: number; updatedAt?: Date; str?: string }>()
  const at = doc?.str ? Number(doc.str) : 0
  if (!doc || Date.now() - at > HEAVY_TTL_MS) {
    void singleFlight(KW_KEY, async () => {
      if (!(await claimLease(KW_LOCK_KEY, HEAVY_TTL_MS))) return
      const n = await SearchRankSnapshot.distinct('keyword').maxTimeMS(5 * 60_000).then(k => k.length)
      await AppSetting.updateOne({ key: KW_KEY }, { $set: { num: n, str: String(Date.now()) } }, { upsert: true })
    }).catch(e => console.error('[Admin] keywords-tracked count failed:', e))
  }
  return typeof doc?.num === 'number' ? doc.num : null
}

export async function GET(): Promise<NextResponse<ApiResponse<unknown>>> {
  const auth = await getCurrentUser().catch(() => null)
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  try {
    await connectDB()

    const [
      trackedListings, listingSnapshots, snapshotsToday, shopSnapshots,
      rankSnapshots, rankSnapshotsToday, keywordsTracked, keywordMarketDays, heavy,
    ] = await Promise.all([
      TrackedListing.estimatedDocumentCount(),
      ListingSnapshot.estimatedDocumentCount(),
      readDaily('listingSnapshots'),
      ShopSnapshot.estimatedDocumentCount(),
      // Keyword rank history - the dataset no Etsy endpoint can ever backfill.
      SearchRankSnapshot.estimatedDocumentCount(),
      readDaily('rankSnapshots'),
      keywordsTrackedCount(),
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
