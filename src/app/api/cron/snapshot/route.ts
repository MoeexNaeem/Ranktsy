import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { TrackedShop, ShopSnapshot, TrackedListing, ListingSnapshot } from '@/lib/models'
import { getEtsyShop, getListingById, getListingReviewStats } from '@/lib/etsy'
import { dayKey, recordObservedListings } from '@/lib/snapshots'
import type { ApiResponse } from '@/types'

// Cap the nightly per-listing refresh so it can't blow the Etsy rate budget.
// Each listing costs 2 calls (listing + reviews); 200 → ~400 calls/night.
const LISTING_CAP = Math.min(Math.max(Number(process.env.CRON_LISTING_CAP) || 200, 0), 1000)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Daily snapshot job - guarantees a row for every tracked shop even when nobody
 * browses it. Ordinary traffic already captures shops opportunistically (see
 * lib/snapshots.ts); this closes the gap for shops users are tracking but not
 * actively viewing.
 *
 * Schedule once per day. On Vercel, add to vercel.json:
 *   { "crons": [{ "path": "/api/cron/snapshot", "schedule": "0 3 * * *" }] }
 *
 * Auth: set CRON_SECRET and send `Authorization: Bearer <secret>`. Vercel Cron
 * sends this header automatically. Without CRON_SECRET set, the route refuses to
 * run rather than sitting open - an unauthenticated endpoint that burns the Etsy
 * rate budget is a liability.
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'CRON_SECRET is not configured - refusing to run unauthenticated.' },
      { status: 503 },
    )
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const day = dayKey()
  try {
    await connectDB()

    // Distinct shops across all users - two users tracking the same shop is one fetch.
    const tracked = await TrackedShop.find({}).select('shopId shopName').lean()
    const unique = [...new Map(tracked.map(t => [t.shopId, t])).values()]

    // Skip shops already captured today so a re-run is cheap and idempotent.
    const done = await ShopSnapshot.find({ day, shopId: { $in: unique.map(u => u.shopId) } })
      .select('shopId').lean()
    const doneIds = new Set(done.map(d => d.shopId))
    const todo = unique.filter(u => !doneIds.has(u.shopId))

    let captured = 0
    const failed: number[] = []

    // Sequential on purpose: getEtsyShop already goes through the shared rate
    // gate, and a nightly job has no reason to contend with live user requests.
    for (const t of todo) {
      try {
        await getEtsyShop(t.shopId)   // records the snapshot as a side-effect
        captured++
      } catch (e) {
        console.error(`[Cron] shop ${t.shopId} failed:`, e)
        failed.push(t.shopId)
      }
    }

    // ── Listings pass ──────────────────────────────────────────────────────────
    // Refresh the hottest crowd-observed listings so their per-listing history
    // (reviewCount over time → real sales velocity) stays unbroken even on days
    // nobody views them. Newest-observed first; capped; skips ones done today.
    let listingsCaptured = 0
    const listingsFailed: number[] = []
    if (LISTING_CAP > 0) {
      const hot = await TrackedListing.find({}).sort({ lastSeenAt: -1 }).limit(LISTING_CAP)
        .select('listingId shopId').lean()
      const hotIds = hot.map(h => h.listingId)
      const doneL = await ListingSnapshot.find({ day, listingId: { $in: hotIds } }).select('listingId').lean()
      const doneLIds = new Set(doneL.map(d => d.listingId))
      const todoL = hot.filter(h => !doneLIds.has(h.listingId))

      for (const l of todoL) {
        try {
          const listing = await getListingById(l.listingId)
          if (!listing) continue // inactive/removed - leave its history as-is
          const reviews = await getListingReviewStats(l.listingId).catch(() => null)
          await recordObservedListings([{
            listingId: l.listingId,
            shopId: listing.shop_id ?? l.shopId,
            title: listing.title,
            tags: listing.tags ?? [],
            price: listing.price ? listing.price.amount / (listing.price.divisor || 100) : null,
            currency: listing.price?.currency_code,
            views: listing.views ?? null,
            favorers: listing.num_favorers ?? null,
            reviewCount: reviews?.count ?? null,
          }])
          listingsCaptured++
        } catch (e) {
          console.error(`[Cron] listing ${l.listingId} failed:`, e)
          listingsFailed.push(l.listingId)
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        day,
        shops: { tracked: unique.length, alreadyCaptured: doneIds.size, captured, failed: failed.length, failedIds: failed },
        listings: { cap: LISTING_CAP, captured: listingsCaptured, failed: listingsFailed.length, failedIds: listingsFailed },
      },
    })
  } catch (e) {
    console.error('[Cron] snapshot job failed:', e)
    return NextResponse.json({ success: false, error: 'Snapshot job failed' }, { status: 500 })
  }
}
