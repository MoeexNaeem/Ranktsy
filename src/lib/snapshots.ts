/**
 * Snapshot recording + velocity derivation.
 *
 * Why this exists: Etsy's Open API returns STATE, never HISTORY. A shop record
 * carries `transaction_sold_count` (lifetime sales) and nothing about last week.
 * There is no historical endpoint and no way to backfill. So every time-based
 * feature - sales velocity, "sold yesterday", Competitor Sales, listing Changes,
 * honest monthly trends - depends on us recording state ourselves, starting now.
 *
 * Two capture paths, deliberately:
 *   1. Opportunistic (`recordShopSnapshot`) - fires whenever any surface reads a
 *      shop. History therefore accrues from day one with zero configuration, and
 *      popular shops get covered for free.
 *   2. Scheduled (`/api/cron/snapshot`) - guarantees a daily row for tracked
 *      shops even if nobody browses them.
 *
 * This is NOT the Etsy caching rule in cache.ts. We never re-serve stale Etsy
 * content as current; a snapshot is a dated measurement presented as history.
 */
import { connectDB } from '@/lib/db'
import { ShopSnapshot, ListingSnapshot, TrackedListing } from '@/lib/models'
import { reviewRate } from '@/lib/salesEstimate'
import type { EtsyListing, SalesPoint, ShopVelocity, ListingVelocity, ListingSalesPoint } from '@/types'

/** UTC day key - the dedupe unit. Local time would double-count across zones. */
export function dayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export function daysAgoKey(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return dayKey(d)
}

export interface ShopSnapshotInput {
  shopId: number
  shopName: string
  sales?: number | null
  favorers?: number | null
  reviewCount?: number | null
  reviewAverage?: number | null
  activeListings?: number | null
  isVacation?: boolean
}

/**
 * Record today's shop state. Idempotent per shop per UTC day via the unique
 * {shopId, day} index - safe to call on every read.
 *
 * Never throws: capture is a side-effect of someone else's request, so a snapshot
 * failure must not break the page they actually asked for.
 */
export async function recordShopSnapshot(s: ShopSnapshotInput): Promise<void> {
  if (!s.shopId) return
  try {
    await connectDB()
    const day = dayKey()
    await ShopSnapshot.updateOne(
      { shopId: s.shopId, day },
      {
        $set: {
          shopName:       s.shopName,
          sales:          s.sales ?? null,
          favorers:       s.favorers ?? null,
          reviewCount:    s.reviewCount ?? null,
          reviewAverage:  s.reviewAverage ?? null,
          activeListings: s.activeListings ?? null,
          isVacation:     s.isVacation ?? false,
          capturedAt:     new Date(),
        },
        $setOnInsert: { shopId: s.shopId, day },
      },
      { upsert: true },
    )
  } catch (e) {
    console.error('[Snapshots] shop capture failed:', e)
  }
}

/** Fire-and-forget bulk capture. Used by leaderboards that read many shops at once. */
export function recordShopSnapshots(shops: ShopSnapshotInput[]): void {
  if (!shops.length) return
  void (async () => {
    try {
      await connectDB()
      const day = dayKey()
      await ShopSnapshot.bulkWrite(
        shops.filter(s => s.shopId).map(s => ({
          updateOne: {
            filter: { shopId: s.shopId, day },
            update: {
              $set: {
                shopName: s.shopName,
                sales: s.sales ?? null,
                favorers: s.favorers ?? null,
                reviewCount: s.reviewCount ?? null,
                reviewAverage: s.reviewAverage ?? null,
                activeListings: s.activeListings ?? null,
                isVacation: s.isVacation ?? false,
                capturedAt: new Date(),
              },
              $setOnInsert: { shopId: s.shopId, day },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      )
    } catch (e) {
      console.error('[Snapshots] bulk shop capture failed:', e)
    }
  })()
}

/** Record listing state for change-tracking. Fire-and-forget. */
export function recordListingSnapshots(listings: EtsyListing[]): void {
  const rows = listings.filter(l => l.listing_id && l.shop_id)
  if (!rows.length) return
  void (async () => {
    try {
      await connectDB()
      const day = dayKey()
      await ListingSnapshot.bulkWrite(
        rows.map(l => ({
          updateOne: {
            filter: { listingId: l.listing_id, day },
            update: {
              $set: {
                shopId:   l.shop_id,
                title:    l.title,
                tags:     l.tags ?? [],
                price:    l.price.amount / (l.price.divisor || 100),
                currency: l.price.currency_code,
                views:    l.views ?? 0,
                favorers: l.num_favorers ?? 0,
                capturedAt: new Date(),
              },
              $setOnInsert: { listingId: l.listing_id, day },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      )
    } catch (e) {
      console.error('[Snapshots] listing capture failed:', e)
    }
  })()
}

// ─── Velocity ─────────────────────────────────────────────────────────────────

/**
 * Turn cumulative lifetime totals into per-day units sold.
 *
 * Gaps are real: if nobody read a shop for three days, there's no row. Rather
 * than inventing points, the delta is spread across the elapsed days so a
 * 3-day gap reads as an average, not a spike. Days before the first snapshot
 * are simply absent - we can't know them.
 */
function toPoints(rows: { day: string; sales: number | null }[]): SalesPoint[] {
  const known = rows.filter(r => r.sales != null) as { day: string; sales: number }[]
  return known.map((r, i) => {
    if (i === 0) return { day: r.day, sales: r.sales, sold: null } // nothing prior to diff against
    const prev = known[i - 1]
    const gap = Math.max(1, Math.round(
      (Date.parse(r.day + 'T00:00:00Z') - Date.parse(prev.day + 'T00:00:00Z')) / 86_400_000))
    const delta = r.sales - prev.sales
    // Etsy's total can tick down (cancellations/refunds). Clamp at 0 rather than
    // reporting negative units sold.
    return { day: r.day, sales: r.sales, sold: Math.max(0, Math.round(delta / gap)) }
  })
}

export async function getShopVelocity(shopId: number, days = 90): Promise<ShopVelocity | null> {
  try {
    await connectDB()
    const since = daysAgoKey(days)
    const rows = await ShopSnapshot.find({ shopId, day: { $gte: since } })
      .sort({ day: 1 })
      .select('day sales shopName')
      .lean()

    if (!rows.length) return null

    const points = toPoints(rows as { day: string; sales: number | null }[])
    const withSold = points.filter(p => p.sold != null) as { day: string; sold: number }[]

    const sumLast = (n: number) => {
      const cutoff = daysAgoKey(n)
      const inWindow = withSold.filter(p => p.day >= cutoff)
      return inWindow.length ? inWindow.reduce((s, p) => s + p.sold, 0) : null
    }

    const yesterday = withSold.find(p => p.day === daysAgoKey(1))?.sold
      ?? withSold[withSold.length - 1]?.sold
      ?? null

    return {
      shopId,
      shopName: String(rows[rows.length - 1].shopName ?? ''),
      trackedSince: rows[0].day,
      days: rows.length,
      points,
      soldYesterday: yesterday,
      soldLast7:  sumLast(7),
      soldLast30: sumLast(30),
      avgPerDay: withSold.length
        ? parseFloat((withSold.reduce((s, p) => s + p.sold, 0) / withSold.length).toFixed(1))
        : null,
      latestSales: points[points.length - 1]?.sales ?? null,
    }
  } catch (e) {
    console.error('[Snapshots] velocity read failed:', e)
    return null
  }
}

// ─── Listing changes ──────────────────────────────────────────────────────────

export interface ListingChange {
  day: string
  field: 'title' | 'tags' | 'price'
  from: string
  to: string
}

/** Diff consecutive listing snapshots into a human-readable edit log. */
export async function getListingChanges(listingId: number, days = 90): Promise<ListingChange[]> {
  try {
    await connectDB()
    const rows = await ListingSnapshot.find({ listingId, day: { $gte: daysAgoKey(days) } })
      .sort({ day: 1 })
      .select('day title tags price currency')
      .lean()

    const out: ListingChange[] = []
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1], b = rows[i]
      if (a.title !== b.title) out.push({ day: b.day, field: 'title', from: a.title, to: b.title })
      if (a.price !== b.price) out.push({ day: b.day, field: 'price', from: `${a.currency} ${a.price.toFixed(2)}`, to: `${b.currency} ${b.price.toFixed(2)}` })
      const at = [...(a.tags ?? [])].sort().join(', ')
      const bt = [...(b.tags ?? [])].sort().join(', ')
      if (at !== bt) out.push({ day: b.day, field: 'tags', from: at, to: bt })
    }
    return out.reverse()
  } catch (e) {
    console.error('[Snapshots] change read failed:', e)
    return []
  }
}

// ─── Crowd capture (extension) ─────────────────────────────────────────────────

export interface ObservedListing {
  listingId: number
  shopId: number
  title?: string
  tags?: string[]
  price?: number | null
  currency?: string
  views?: number | null
  favorers?: number | null
  reviewCount?: number | null
}

/**
 * Record listings observed by the extension as users browse Etsy - the crowd-
 * sourced data flywheel. One snapshot per listing per UTC day; only fields that
 * were actually observed are written, so a later, richer observation (e.g. the
 * listing page, which knows reviewCount) never gets clobbered by a thinner one
 * (a search card, which doesn't). Also upserts the TrackedListing watchlist so
 * the daily cron keeps hot listings' history unbroken. Returns rows captured.
 */
export async function recordObservedListings(rows: ObservedListing[]): Promise<number> {
  const valid = rows.filter(r => r.listingId && r.shopId)
  if (!valid.length) return 0
  try {
    await connectDB()
    const day = dayKey()
    const now = new Date()

    const snapOps = valid.map(r => {
      const set: Record<string, unknown> = { capturedAt: now, shopId: r.shopId }
      if (r.title != null) set.title = r.title
      if (r.tags != null) set.tags = r.tags
      if (r.price != null) { set.price = r.price; if (r.currency) set.currency = r.currency }
      if (r.views != null) set.views = r.views
      if (r.favorers != null) set.favorers = r.favorers
      if (r.reviewCount != null) set.reviewCount = r.reviewCount
      return {
        updateOne: {
          filter: { listingId: r.listingId, day },
          update: { $set: set, $setOnInsert: { listingId: r.listingId, day } },
          upsert: true,
        },
      }
    })

    const trackOps = valid.map(r => ({
      updateOne: {
        filter: { listingId: r.listingId },
        update: {
          $set: { shopId: r.shopId, lastSeenAt: now, ...(r.title != null ? { title: r.title } : {}) },
          $setOnInsert: { listingId: r.listingId },
          $inc: { observeCount: 1 },
        },
        upsert: true,
      },
    }))

    await ListingSnapshot.bulkWrite(snapOps, { ordered: false })
    await TrackedListing.bulkWrite(trackOps, { ordered: false })
    return valid.length
  } catch (e) {
    console.error('[Snapshots] observe capture failed:', e)
    return 0
  }
}

// ─── Per-listing velocity ──────────────────────────────────────────────────────

/**
 * Measured per-listing velocity from OUR snapshot history. Etsy exposes no
 * per-listing sales, so the review-count DELTA is the real signal: units sold ≈
 * (reviews gained) ÷ review-rate. Views/favorites deltas come along for free.
 *
 * A young or single-point series returns `measured:false` and null windows - the
 * caller must fall back to the point-in-time estimate and say "tracking started",
 * never imply a real zero.
 */
export async function getListingVelocity(listingId: number, days = 90): Promise<ListingVelocity | null> {
  try {
    await connectDB()
    const since = daysAgoKey(days)
    const rows = await ListingSnapshot.find({ listingId, day: { $gte: since } })
      .sort({ day: 1 })
      .select('day reviewCount views favorers')
      .lean<{ day: string; reviewCount: number | null; views: number | null; favorers: number | null }[]>()
    if (!rows.length) return null

    const rate = reviewRate()

    const points: ListingSalesPoint[] = rows.map((r, i) => {
      let soldEst: number | null = null
      if (r.reviewCount != null && i > 0) {
        for (let j = i - 1; j >= 0; j--) {
          const prev = rows[j]
          if (prev.reviewCount != null) {
            const gap = Math.max(1, Math.round(
              (Date.parse(r.day + 'T00:00:00Z') - Date.parse(prev.day + 'T00:00:00Z')) / 86_400_000))
            const delta = Math.max(0, r.reviewCount - prev.reviewCount)
            soldEst = Math.round(delta / gap / rate)
            break
          }
        }
      }
      return { day: r.day, reviews: r.reviewCount ?? null, soldEst, views: r.views ?? null, favorers: r.favorers ?? null }
    })

    // Reviews are SPARSE - a listing can go days without a new one - so a 30-day
    // sales figure is only trustworthy once the tracked span is wide enough for
    // review events to accrue. Below that we return `measured:false` and the client
    // keeps showing the point-in-time estimate (never a misleading tracked 0).
    const MIN_MEASURE_DAYS = 14

    const dayGap = (a: string, b: string) =>
      Math.max(0, Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000))

    // Growth of a cumulative field over the FULL tracked span, projected to 30 days.
    const projected30 = (field: 'reviewCount' | 'views' | 'favorers'): { per30: number; spanDays: number } | null => {
      const withField = rows.filter(r => r[field] != null)
      if (withField.length < 2) return null
      const first = withField[0], last = withField[withField.length - 1]
      const spanDays = dayGap(first.day, last.day)
      if (spanDays < 1) return null
      const delta = Math.max(0, (last[field] as number) - (first[field] as number))
      return { per30: Math.round((delta / spanDays) * 30), spanDays }
    }

    const reviewProj = projected30('reviewCount')
    const favProj = projected30('favorers')
    const viewProj = projected30('views')
    const measured = !!reviewProj && reviewProj.spanDays >= MIN_MEASURE_DAYS

    const reviewsLast30 = measured ? reviewProj!.per30 : null
    const reviewsLast7 = measured ? Math.round(reviewProj!.per30 * 7 / 30) : null
    const favsLast30 = measured ? favProj?.per30 ?? null : null
    const viewsLast30 = measured ? viewProj?.per30 ?? null : null
    const soldLast30Est = reviewsLast30 != null ? Math.round(reviewsLast30 / rate) : null

    return {
      listingId,
      trackedSince: rows[0].day,
      days: rows.length,
      points,
      reviewsLatest: [...rows].reverse().find(r => r.reviewCount != null)?.reviewCount ?? null,
      reviewsLast7,
      reviewsLast30,
      soldLast30Est,
      favsLast30,
      viewsLast30,
      measured,
    }
  } catch (e) {
    console.error('[Snapshots] listing velocity failed:', e)
    return null
  }
}
