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
import { ShopSnapshot, ListingSnapshot, TrackedListing, SearchRankSnapshot, KeywordMarketSnapshot, KeywordSuggestion } from '@/lib/models'
import { reviewRate } from '@/lib/salesEstimate'
import type { EtsyListing, SalesPoint, ShopVelocity, ListingVelocity, ListingSalesPoint, ListingRankHistory, ListingRankPoint } from '@/types'

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
  // ── Day-varying facts the buyer actually saw ───────────────────────────────
  /** Pre-discount price, when the page showed a struck-through original. */
  priceOriginal?: number | null
  onSale?: boolean | null
  /** Star rating for this listing (not the shop). */
  rating?: number | null
  quantity?: number | null
  /** Best organic rank this listing held in the observed keyword. */
  rank?: number | null
  // ── Page-only signals ──────────────────────────────────────────────────────
  // Buyer-visible, but absent from every Etsy API field. Undefined/null means we
  // did not see it, which is NOT the same as "no".
  freeShipping?: boolean | null
  badges?: string[]
  starSeller?: boolean | null
  hasVideo?: boolean | null
  imageCount?: number | null
  inCarts?: number | null
  variationCount?: number | null
  priceMaxVariant?: number | null
  personalisable?: boolean | null
  returnsAccepted?: boolean | null
  reviewStars?: number[]
  // ── Stable attributes, stored once on TrackedListing ──────────────────────
  shopName?: string | null
  categoryTop?: string | null
  isDigital?: boolean | null
  createdTimestamp?: number | null
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
      // Only fields actually observed are written, so a thin search-card
      // observation can never blank out what a listing page already told us.
      const set: Record<string, unknown> = { capturedAt: now, shopId: r.shopId }
      if (r.title != null) set.title = r.title
      if (r.tags != null) set.tags = r.tags
      if (r.price != null) { set.price = r.price; if (r.currency) set.currency = r.currency }
      if (r.views != null) set.views = r.views
      if (r.favorers != null) set.favorers = r.favorers
      if (r.reviewCount != null) set.reviewCount = r.reviewCount
      if (r.priceOriginal != null) set.priceOriginal = r.priceOriginal
      if (r.onSale != null) set.onSale = r.onSale
      if (r.rating != null) set.rating = r.rating
      if (r.quantity != null) set.quantity = r.quantity

      const update: Record<string, unknown> = {
        $set: set,
        $setOnInsert: { listingId: r.listingId, day },
      }
      // Rank is a "best of the day" figure: several users searching different
      // terms can see the same listing, and the strongest placement is the one
      // worth keeping. $min does that atomically without a read.
      if (r.rank != null && r.rank > 0) update.$min = { bestRank: r.rank }

      return {
        updateOne: { filter: { listingId: r.listingId, day }, update, upsert: true },
      }
    })

    const trackOps = valid.map(r => {
      // Stable attributes live once per listing. $set (not $setOnInsert) so a
      // richer later observation fills gaps, but only for fields we actually saw.
      const set: Record<string, unknown> = { shopId: r.shopId, lastSeenAt: now }
      if (r.title != null) set.title = r.title
      if (r.tags != null && r.tags.length) set.tags = r.tags
      if (r.shopName != null) set.shopName = r.shopName
      if (r.categoryTop != null) set.categoryTop = r.categoryTop
      if (r.isDigital != null) set.isDigital = r.isDigital
      if (r.currency != null) set.currency = r.currency
      if (r.createdTimestamp != null) set.createdTimestamp = r.createdTimestamp
      if (r.price != null) set.lastPrice = r.price
      if (r.views != null) set.lastViews = r.views
      if (r.favorers != null) set.lastFavorers = r.favorers
      if (r.reviewCount != null) set.lastReviewCount = r.reviewCount
      // Page-only signals. Same rule: written only when actually observed, so a
      // search card (which shows none of these) cannot erase what a listing page
      // already told us.
      if (r.freeShipping != null) set.freeShipping = r.freeShipping
      if (r.badges != null && r.badges.length) set.badges = r.badges
      if (r.starSeller != null) set.starSeller = r.starSeller
      if (r.hasVideo != null) set.hasVideo = r.hasVideo
      if (r.imageCount != null) set.imageCount = r.imageCount
      if (r.inCarts != null) set.inCarts = r.inCarts
      if (r.variationCount != null) set.variationCount = r.variationCount
      if (r.priceMaxVariant != null) set.priceMaxVariant = r.priceMaxVariant
      if (r.personalisable != null) set.personalisable = r.personalisable
      if (r.returnsAccepted != null) set.returnsAccepted = r.returnsAccepted
      if (r.reviewStars != null && r.reviewStars.length === 5) set.reviewStars = r.reviewStars
      return {
        updateOne: {
          filter: { listingId: r.listingId },
          update: {
            $set: set,
            $setOnInsert: { listingId: r.listingId, firstSeenAt: now },
            $inc: { observeCount: 1 },
          },
          upsert: true,
        },
      }
    })

    await ListingSnapshot.bulkWrite(snapOps, { ordered: false })
    await TrackedListing.bulkWrite(trackOps, { ordered: false })
    return valid.length
  } catch (e) {
    console.error('[Snapshots] observe capture failed:', e)
    return 0
  }
}

// ─── Keyword rank capture (extension) ──────────────────────────────────────────

export interface ObservedRank {
  listingId: number
  shopId?: number | null
  /** 1-based organic position on the results page. */
  position: number
  page?: number
  isAd?: boolean
}

export interface ObservedKeywordMarket {
  totalResults?: number | null
  sampled?: number | null
  adCount?: number | null
  priceMin?: number | null
  priceMax?: number | null
  priceMedian?: number | null
  currency?: string | null
}

/** Keywords worth storing: a real search term, not a stray heading or a URL. */
export function normalizeKeyword(raw: unknown): string | null {
  const k = String(raw ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
  if (k.length < 2 || k.length > 120) return null
  if (/^https?:\/\//.test(k)) return null
  return k
}

/**
 * Record where listings ranked for a keyword today.
 *
 * Etsy has no rank-history endpoint and no backfill, so this is the only way the
 * question "did my rank move" can ever be answered - and the extension is the
 * only place the true shopper-facing order is visible. One row per
 * (keyword, listing, day), and a listing seen twice in a day keeps its BEST
 * position, so a user who scrolls deep on a second search cannot make a
 * listing's history look worse than it was.
 *
 * Fire-and-forget: this is a side effect of someone else's page view and must
 * never fail their request.
 */
/** Two letters, lowercase, or 'xx' when the page did not say. */
export function normalizeCountry(raw: unknown): string {
  const c = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return /^[a-z]{2}$/.test(c) ? c : 'xx'
}

export function recordSearchRanks(keywordRaw: string, rows: ObservedRank[], market?: ObservedKeywordMarket, countryRaw?: unknown): void {
  const keyword = normalizeKeyword(keywordRaw)
  if (!keyword) return
  const valid = rows.filter(r => r.listingId > 0 && r.position > 0 && r.position <= 1000)
  if (!valid.length && !market) return

  const country = normalizeCountry(countryRaw)

  void (async () => {
    try {
      await connectDB()
      const day = dayKey()
      const now = new Date()

      if (valid.length) {
        await SearchRankSnapshot.bulkWrite(
          valid.map(r => ({
            updateOne: {
              // Country is part of the key: the same listing legitimately holds
              // different positions in different markets on the same day.
              filter: { keyword, listingId: r.listingId, day, country },
              update: {
                // Best position seen in THIS market today; two shoppers in one
                // country see near-identical ordering, so $min is safe here.
                $min: { position: r.position },
                $set: { shopId: r.shopId ?? null, page: r.page ?? 1, isAd: !!r.isAd, capturedAt: now },
                $setOnInsert: { keyword, listingId: r.listingId, day, country },
              },
              upsert: true,
            },
          })),
          { ordered: false },
        )
      }

      if (market) {
        const set: Record<string, unknown> = { capturedAt: now }
        if (market.totalResults != null) set.totalResults = market.totalResults
        if (market.sampled != null) set.sampled = market.sampled
        if (market.adCount != null) set.adCount = market.adCount
        if (market.priceMin != null) set.priceMin = market.priceMin
        if (market.priceMax != null) set.priceMax = market.priceMax
        if (market.priceMedian != null) set.priceMedian = market.priceMedian
        if (market.currency != null) set.currency = market.currency
        await KeywordMarketSnapshot.updateOne(
          { keyword, day },
          { $set: set, $setOnInsert: { keyword, day } },
          { upsert: true },
        )
      }
    } catch (e) {
      console.error('[Snapshots] rank capture failed:', e)
    }
  })()
}

/**
 * One listing's rank history for one keyword, from our own captures.
 *
 * Gaps are real and left as gaps: a day with no capture is not a rank of zero
 * and is never interpolated.
 */
export async function getListingRankHistory(keywordRaw: string, listingId: number, days = 90): Promise<ListingRankHistory | null> {
  const keyword = normalizeKeyword(keywordRaw)
  if (!keyword || !listingId) return null
  try {
    await connectDB()
    const rows = await SearchRankSnapshot.find({ keyword, listingId, day: { $gte: daysAgoKey(days) } })
      .sort({ day: 1 })
      .select('day position isAd country')
      .lean<{ day: string; position: number; isAd?: boolean }[]>()
    if (!rows.length) return null

    const points: ListingRankPoint[] = rows.map(r => ({ day: r.day, position: r.position, isAd: r.isAd }))
    const positions = points.map(p => p.position)
    const latest = points[points.length - 1].position
    return {
      keyword,
      listingId,
      points,
      best: Math.min(...positions),
      worst: Math.max(...positions),
      latest,
      // Negative = moved up the page (a lower position number is better).
      change: points.length > 1 ? latest - points[0].position : null,
      trackedDays: points.length,
    }
  } catch (e) {
    console.error('[Snapshots] rank history failed:', e)
    return null
  }
}

/** One listing's rank movement for a keyword, built from our own daily captures. */
export interface RankMover {
  listingId: number
  shopId: number | null
  title: string
  shopName: string | null
  first: number          // position on the earliest captured day in the window
  latest: number         // position on the most recent captured day
  best: number
  worst: number
  /** first - latest. POSITIVE = climbed (toward position 1), negative = fell. */
  change: number
  days: number           // distinct days captured
  firstDay: string
  latestDay: string
  series: { day: string; position: number }[]
}

/**
 * `reliable: false` means we hold captures but they do not form a trustworthy
 * ranking yet, so the UI must say so instead of drawing numbers.
 *   'none'      - nothing captured for this keyword
 *   'ambiguous' - captures collide (several listings sharing one position on a
 *                 day), so a "move" could be an artefact of merging different
 *                 shoppers' result sets rather than a real change
 */
export interface RankMoversResult {
  movers: RankMover[]
  reliable: boolean
  reason: 'ok' | 'none' | 'ambiguous'
  /** Which market these positions are for. 'xx' = captured before we recorded it. */
  country?: string
}

/**
 * Who climbed and who fell for a keyword, measured from our own rank captures.
 *
 * This is the one question no Etsy endpoint can answer after the fact: the API
 * returns today's ordering and keeps no history, so a day nobody captured is
 * gone. Everything here comes from SearchRankSnapshot rows the extension
 * recorded while real shoppers browsed.
 *
 * Only listings captured on two or more DIFFERENT days are returned. A single
 * capture is a position, not a movement, and showing it as "0 change" would
 * invent a stability we never observed.
 */
export async function getKeywordRankMovers(keywordRaw: string, days = 30, limit = 40, countryRaw?: string): Promise<RankMoversResult> {
  const keyword = normalizeKeyword(keywordRaw)
  if (!keyword) return { movers: [], reliable: false, reason: 'none' }
  try {
    await connectDB()
    const since = daysAgoKey(days)

    // ONE market at a time. Etsy orders results differently per country, so a
    // series mixing them is not a ranking. Without an explicit country, use the
    // market we hold the most captures for.
    let country = countryRaw ? normalizeCountry(countryRaw) : ''
    if (!country) {
      const byCountry = await SearchRankSnapshot.aggregate<{ _id: string; n: number }>([
        { $match: { keyword, day: { $gte: since } } },
        { $group: { _id: { $ifNull: ['$country', 'xx'] }, n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 1 },
      ])
      country = byCountry[0]?._id ?? 'xx'
    }

    // Rows captured before `country` existed have no such field at all, and
    // { country: 'xx' } does NOT match a missing field - without this they would
    // silently vanish from every series the day the field was introduced.
    const countryFilter: Record<string, unknown> = country === 'xx'
      ? { $or: [{ country: 'xx' }, { country: { $exists: false } }] }
      : { country }

    // Ads are excluded: a promoted placement is bought, not earned, and mixing it
    // with organic order turns "was an ad yesterday" into a fake 40-place drop.
    const rows = await SearchRankSnapshot.find({ keyword, ...countryFilter, isAd: { $ne: true }, day: { $gte: since } })
      .sort({ day: 1 })
      .select('listingId shopId day position')
      .lean<{ listingId: number; shopId: number | null; day: string; position: number }[]>()
    if (!rows.length) return { movers: [], reliable: false, reason: 'none', country }

    // INTEGRITY GATE. A day's capture is only a ranking if each position belongs
    // to one listing. Today it often does not: captures from different shoppers,
    // pages and countries are merged with $min, so several listings can each end
    // up "position 1". Rather than present that as precise movement, refuse it.
    const seen = new Map<string, Set<number>>()
    let collisions = 0
    for (const r of rows) {
      const k = `${r.day}|${r.position}`
      let set = seen.get(k)
      if (!set) { set = new Set(); seen.set(k, set) }
      if (set.size > 0 && !set.has(r.listingId)) collisions++
      set.add(r.listingId)
    }
    if (collisions > 0) return { movers: [], reliable: false, reason: 'ambiguous', country }

    const byListing = new Map<number, { shopId: number | null; pts: { day: string; position: number }[] }>()
    for (const r of rows) {
      let e = byListing.get(r.listingId)
      if (!e) { e = { shopId: r.shopId ?? null, pts: [] }; byListing.set(r.listingId, e) }
      e.pts.push({ day: r.day, position: r.position })
    }

    const movers: RankMover[] = []
    for (const [listingId, e] of byListing) {
      // Two captures on the SAME day are one observation, not a trend.
      if (new Set(e.pts.map(p => p.day)).size < 2) continue
      const pts = e.pts
      const positions = pts.map(p => p.position)
      const first = pts[0].position
      const latest = pts[pts.length - 1].position
      movers.push({
        listingId,
        shopId: e.shopId,
        title: '',
        shopName: null,
        first,
        latest,
        best: Math.min(...positions),
        worst: Math.max(...positions),
        // A lower position number is better, so a DROP in the number is a climb.
        change: first - latest,
        days: new Set(pts.map(p => p.day)).size,
        firstDay: pts[0].day,
        latestDay: pts[pts.length - 1].day,
        series: pts,
      })
    }

    // Biggest absolute movement first: the story is who moved, either way.
    movers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || a.latest - b.latest)
    const top = movers.slice(0, limit)

    // Titles live on TrackedListing, not on the rank rows.
    const meta = await TrackedListing.find({ listingId: { $in: top.map(m => m.listingId) } })
      .select('listingId title shopName')
      .lean<{ listingId: number; title?: string; shopName?: string | null }[]>()
    const byId = new Map(meta.map(m => [m.listingId, m]))
    for (const m of top) {
      const t = byId.get(m.listingId)
      m.title = t?.title ?? ''
      m.shopName = t?.shopName ?? null
    }
    return { movers: top, reliable: true, reason: 'ok', country }
  } catch (e) {
    console.error('[Snapshots] rank movers failed:', e)
    return { movers: [], reliable: false, reason: 'none' }
  }
}

export interface ObservedSuggestion { suggestion: string; position?: number }

/**
 * Record the phrases ETSY suggested for a search term.
 *
 * Etsy's related-search row and its autocomplete are the marketplace naming the
 * words its own shoppers use. No Etsy API returns either, and Google's keyword
 * ideas are a different population (web searchers, not Etsy buyers), so this is
 * the only route to Etsy-native keyword expansion.
 *
 * Upserted per (seed, suggestion, source, country) with a seenCount, so a phrase
 * Etsy shows on every visit ranks above one seen once. Fire-and-forget: a
 * suggestion write must never slow down or fail a shopper's page.
 */
export function recordKeywordSuggestions(
  seedRaw: string,
  rows: ObservedSuggestion[],
  source: 'related' | 'autocomplete',
  countryRaw?: unknown,
): void {
  const seed = normalizeKeyword(seedRaw)
  if (!seed || !rows.length) return
  const country = normalizeCountry(countryRaw)

  // Dedupe within the payload and drop anything that is just the seed again.
  const seen = new Map<string, number>()
  for (const r of rows) {
    const phrase = normalizeKeyword(r.suggestion)
    if (!phrase || phrase === seed || phrase.length > 120) continue
    if (!seen.has(phrase)) seen.set(phrase, Number(r.position) > 0 ? Math.round(Number(r.position)) : seen.size + 1)
  }
  if (!seen.size) return

  void (async () => {
    try {
      await connectDB()
      const now = new Date()
      await KeywordSuggestion.bulkWrite(
        [...seen.entries()].map(([suggestion, position]) => ({
          updateOne: {
            filter: { seed, suggestion, source, country },
            update: {
              $inc: { seenCount: 1 },
              // Etsy reorders these, so the newest position is the current truth.
              $set: { position, lastSeenAt: now },
              $setOnInsert: { seed, suggestion, source, country, firstSeenAt: now },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      )
    } catch (e) {
      console.error('[Snapshots] keyword suggestions failed:', e)
    }
  })()
}

export interface KeywordSuggestionRow {
  suggestion: string
  source: 'related' | 'autocomplete'
  position: number
  seenCount: number
  lastSeenAt: string
}

/** Etsy's own suggestions for a seed term, strongest (most often seen) first. */
export async function getKeywordSuggestions(seedRaw: string, limit = 40): Promise<KeywordSuggestionRow[]> {
  const seed = normalizeKeyword(seedRaw)
  if (!seed) return []
  try {
    await connectDB()
    const rows = await KeywordSuggestion.find({ seed })
      .sort({ seenCount: -1, position: 1 })
      .limit(limit)
      .select('suggestion source position seenCount lastSeenAt')
      .lean<{ suggestion: string; source: 'related' | 'autocomplete'; position: number; seenCount: number; lastSeenAt: Date }[]>()
    return rows.map(r => ({
      suggestion: r.suggestion,
      source: r.source,
      position: r.position,
      seenCount: r.seenCount,
      lastSeenAt: new Date(r.lastSeenAt).toISOString(),
    }))
  } catch (e) {
    console.error('[Snapshots] keyword suggestions read failed:', e)
    return []
  }
}

export interface KeywordPageSignals {
  sample: number                 // listings in our store that rank for this keyword
  freeShippingPct: number | null // share offering free shipping
  withVideoPct: number | null
  badgePct: number | null        // share carrying any Etsy badge
  starSellerPct: number | null
  medianImages: number | null
  topBadges: { badge: string; count: number }[]
  inCartsMedian: number | null
}

/**
 * Aggregate the PAGE-ONLY signals across the listings ranking for a keyword.
 *
 * Free shipping, Etsy's own badges, whether a listing has video: all visible to
 * any shopper, none of them in the API. Answering "what do the listings winning
 * this keyword have in common" needs them, and this is the only place they exist.
 *
 * Every percentage is computed over the listings that ACTUALLY reported the
 * field, not over the whole sample. Treating "not observed" as "no" would
 * understate every share and quietly invent a fact we never checked.
 */
export async function getKeywordPageSignals(keywordRaw: string, days = 30): Promise<KeywordPageSignals | null> {
  const keyword = normalizeKeyword(keywordRaw)
  if (!keyword) return null
  try {
    await connectDB()
    const ids = await SearchRankSnapshot.distinct('listingId', {
      keyword, isAd: { $ne: true }, day: { $gte: daysAgoKey(days) },
    }) as number[]
    if (!ids.length) return null

    const rows = await TrackedListing.find({ listingId: { $in: ids.slice(0, 500) } })
      .select('freeShipping hasVideo badges starSeller imageCount inCarts')
      .lean<{ freeShipping?: boolean | null; hasVideo?: boolean | null; badges?: string[]; starSeller?: boolean | null; imageCount?: number | null; inCarts?: number | null }[]>()
    if (!rows.length) return null

    // Share of the listings that reported the field, never of the whole sample.
    const share = (pred: (r: typeof rows[number]) => boolean | null | undefined): number | null => {
      const known = rows.filter(r => pred(r) != null)
      if (!known.length) return null
      return Math.round((known.filter(r => pred(r) === true).length / known.length) * 100)
    }
    const median = (vals: number[]): number | null => {
      if (!vals.length) return null
      const v = [...vals].sort((a, b) => a - b)
      return v[Math.floor(v.length / 2)]
    }

    const badgeCounts = new Map<string, number>()
    for (const r of rows) for (const b of r.badges ?? []) badgeCounts.set(b, (badgeCounts.get(b) ?? 0) + 1)

    return {
      sample: rows.length,
      freeShippingPct: share(r => r.freeShipping),
      withVideoPct: share(r => r.hasVideo),
      starSellerPct: share(r => r.starSeller),
      badgePct: rows.some(r => r.badges != null)
        ? Math.round((rows.filter(r => (r.badges ?? []).length > 0).length / rows.length) * 100)
        : null,
      medianImages: median(rows.map(r => r.imageCount).filter((n): n is number => n != null)),
      inCartsMedian: median(rows.map(r => r.inCarts).filter((n): n is number => n != null)),
      topBadges: [...badgeCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([badge, count]) => ({ badge, count })),
    }
  } catch (e) {
    console.error('[Snapshots] keyword page signals failed:', e)
    return null
  }
}

/** How much rank history we hold for a keyword - coverage, not a leaderboard. */
export async function getKeywordRankCoverage(keywordRaw: string, days = 90): Promise<{ keyword: string; days: number; listings: number; fromDay: string | null } | null> {
  const keyword = normalizeKeyword(keywordRaw)
  if (!keyword) return null
  try {
    await connectDB()
    const since = daysAgoKey(days)
    const [dayList, listings] = await Promise.all([
      SearchRankSnapshot.distinct('day', { keyword, day: { $gte: since } }) as Promise<string[]>,
      SearchRankSnapshot.distinct('listingId', { keyword, day: { $gte: since } }) as Promise<number[]>,
    ])
    if (!dayList.length) return { keyword, days: 0, listings: 0, fromDay: null }
    const sorted = [...dayList].sort()
    return { keyword, days: sorted.length, listings: listings.length, fromDay: sorted[0] }
  } catch (e) {
    console.error('[Snapshots] rank coverage failed:', e)
    return null
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
    for (const r of rows) r.reviewCount = trustedReviews(r.day, r.reviewCount)

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
    // review events to accrue (reviewGrowth enforces that, plus a consistent
    // series and at least one real review). Otherwise `measured:false` and the
    // client keeps the point-in-time estimate (never a misleading tracked 0).
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

    const reviewProj = reviewGrowth(rows)
    const favProj = projected30('favorers')
    const viewProj = projected30('views')
    const measured = !!reviewProj

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

/**
 * First day whose stored reviewCount can be trusted. Before it, /api/etsy/observe
 * turned every `null` the extension sent into 0 (Number(null) === 0), so the
 * history is full of fake zeros; a series reading 0,0,0 then the real 5 would
 * otherwise "gain" 5 reviews and print invented measured sales. Set it to the
 * day the observe fix went live (override with REVIEW_HISTORY_FROM=YYYY-MM-DD).
 */
const REVIEW_HISTORY_FROM = /^\d{4}-\d{2}-\d{2}$/.test(process.env.REVIEW_HISTORY_FROM ?? '')
  ? (process.env.REVIEW_HISTORY_FROM as string)
  : '2026-09-24'

/** A stored reviewCount, or null when it predates REVIEW_HISTORY_FROM. Applied
 *  wherever review deltas are computed, so no consumer sees the fake zeros. */
const trustedReviews = (day: string, n: number | null | undefined): number | null =>
  n != null && day >= REVIEW_HISTORY_FROM ? n : null

/**
 * Review growth over a tracked series, projected to 30 days - or null when the
 * series can't support a measurement.
 *
 * Two rules on top of the MIN_MEASURE_DAYS span:
 *
 *  - The series must behave like ONE cumulative count. A real count only dips
 *    when a review is removed (a couple at most) and never leaps by orders of
 *    magnitude between snapshots. Older extension builds stored the SHOP's review
 *    total (the stars on a search card) as the listing's, so a history can mix
 *    6 (the listing) with 20,796 (its shop); deltas across that are noise.
 *  - At least one review must actually have been gained. Sales are inferred as
 *    reviews ÷ review-rate, so zero reviews over two weeks cannot tell 0 sales
 *    from 9 - a "measured 0" there was printed as fact on listings with hundreds
 *    of thousands of views. The model's estimate stands until a review lands.
 */
function reviewGrowth(rows: { day: string; reviewCount: number | null }[]): { per30: number; spanDays: number; gained: number } | null {
  const pts = rows.filter(r => trustedReviews(r.day, r.reviewCount) != null) as { day: string; reviewCount: number }[]
  if (pts.length < 2) return null
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1].reviewCount
    const cur = pts[i].reviewCount
    const gap = Math.max(1, gapDays(pts[i - 1].day, pts[i].day))
    if (cur < prev - Math.max(2, prev * 0.02)) return null
    if (cur > prev * 3 + 30 + 3 * gap) return null
  }
  const first = pts[0], last = pts[pts.length - 1]
  const spanDays = gapDays(first.day, last.day)
  if (spanDays < MIN_MEASURE_DAYS) return null
  const gained = Math.max(0, last.reviewCount - first.reviewCount)
  if (gained < 1) return null
  return { per30: Math.round((gained / spanDays) * 30), spanDays, gained }
}

/** Compact measured summary for one listing - what a table row needs. */
export interface ListingVelocitySummary {
  listingId: number
  measured: boolean
  soldLast30Est: number | null
  reviewsLast30: number | null
  favsLast30: number | null
  viewsLast30: number | null
  trackedSince: string | null
  spanDays: number
  days: number
}

/** Same MIN_MEASURE_DAYS rule as getListingVelocity - reviews are sparse, so a
 *  30-day figure is only honest once the tracked span is wide enough. */
const MIN_MEASURE_DAYS = 14

type VelRow = { day: string; reviewCount: number | null; views: number | null; favorers: number | null }

const gapDays = (a: string, b: string) =>
  Math.max(0, Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000))

/** Growth of a cumulative field over the full tracked span, projected to 30 days. */
function per30(rows: VelRow[], field: keyof VelRow): { per30: number; spanDays: number } | null {
  const withField = rows.filter(r => r[field] != null)
  if (withField.length < 2) return null
  const first = withField[0], last = withField[withField.length - 1]
  const spanDays = gapDays(first.day, last.day)
  if (spanDays < 1) return null
  const delta = Math.max(0, (last[field] as number) - (first[field] as number))
  return { per30: Math.round((delta / spanDays) * 30), spanDays }
}

function summarise(listingId: number, rows: VelRow[]): ListingVelocitySummary {
  const rate = reviewRate()
  const rev = reviewGrowth(rows)
  const measured = !!rev
  const reviewsLast30 = measured ? rev!.per30 : null
  return {
    listingId,
    measured,
    soldLast30Est: reviewsLast30 != null ? Math.round(reviewsLast30 / rate) : null,
    reviewsLast30,
    favsLast30: measured ? per30(rows, 'favorers')?.per30 ?? null : null,
    viewsLast30: measured ? per30(rows, 'views')?.per30 ?? null : null,
    trackedSince: rows[0]?.day ?? null,
    spanDays: rev?.spanDays ?? 0,
    days: rows.length,
  }
}

/**
 * Measured velocity for MANY listings in one query - what the dashboard tables
 * need so their monthly sales column shows the same measured number the
 * extension shows on Etsy, instead of a point-in-time estimate beside it.
 *
 * One `$in` read plus in-memory grouping: a 50-row table costs one round trip,
 * not fifty. Listings with no (or too little) history are simply absent from the
 * map, and the caller keeps its estimate and says so.
 */
export async function getListingVelocityBatch(listingIds: number[], days = 120): Promise<Map<number, ListingVelocitySummary>> {
  const out = new Map<number, ListingVelocitySummary>()
  const ids = [...new Set(listingIds.filter(id => Number.isFinite(id) && id > 0))].slice(0, 120)
  if (!ids.length) return out
  try {
    await connectDB()
    const since = daysAgoKey(days)
    const rows = await ListingSnapshot.find({ listingId: { $in: ids }, day: { $gte: since } })
      .sort({ listingId: 1, day: 1 })
      .select('listingId day reviewCount views favorers')
      .lean<{ listingId: number; day: string; reviewCount: number | null; views: number | null; favorers: number | null }[]>()

    const byListing = new Map<number, VelRow[]>()
    for (const r of rows) {
      const arr = byListing.get(r.listingId)
      const row: VelRow = { day: r.day, reviewCount: r.reviewCount ?? null, views: r.views ?? null, favorers: r.favorers ?? null }
      if (arr) arr.push(row)
      else byListing.set(r.listingId, [row])
    }
    for (const [listingId, listRows] of byListing) out.set(listingId, summarise(listingId, listRows))
    return out
  } catch (e) {
    console.error('[Snapshots] batch listing velocity failed:', e)
    return out
  }
}

// ─── Keyword market history (eHunt-style measured monthly activity) ────────────
export interface KeywordMonth { month: string; views: number; favorites: number; sales: number; reviews: number }
export interface KeywordDay { day: string; views: number; favorites: number; sales: number; reviews: number }
export interface KeywordMarketHistory {
  months: KeywordMonth[]           // calendar-month rollup, oldest→newest, gaps filled with 0
  daily: KeywordDay[]              // per-day gains over the tracked window (the populated sparkline)
  totals: KeywordMonth             // summed GAINS over the whole window
  thisMonth: KeywordMonth          // gains within the current calendar month
  last30: KeywordMonth             // gains within the trailing 30 days
  sampledListings: number          // ranking listings we looked up
  measuredListings: number         // how many had >=2 snapshots (a real delta)
  trackedDays: number              // distinct days with any measured activity
  fromDay: string | null           // first day with measured activity
}

const zeroMonth = (): KeywordMonth => ({ month: '', views: 0, favorites: 0, sales: 0, reviews: 0 })
const gainOf = (a: number | null, b: number | null) => (a != null && b != null ? Math.max(0, b - a) : 0)

/**
 * Measured market activity for a keyword, from OUR snapshot history.
 *
 * Given the listing ids that rank for a keyword, aggregate the DAY-over-day GAIN
 * in views / favorites / reviews across them (sales = review gain ÷ review rate,
 * same basis as getListingVelocity). Returns a populated per-day series (the
 * sparkline), a calendar-month rollup, and window / this-month / last-30 totals.
 * This is the eHunt-style trend - real and measured, never search volume (which
 * we cannot observe). Depth grows as snapshots accrue; the daily granularity
 * means it shows real dots from the first days of tracking instead of a flat
 * near-empty monthly line.
 */
export async function getKeywordMarketHistory(listingIds: number[], daysBack = 90): Promise<KeywordMarketHistory> {
  const empty: KeywordMarketHistory = { months: [], daily: [], totals: zeroMonth(), thisMonth: zeroMonth(), last30: zeroMonth(), sampledListings: 0, measuredListings: 0, trackedDays: 0, fromDay: null }
  const ids = [...new Set(listingIds.filter(Boolean))].slice(0, 200)
  if (!ids.length) return empty
  try {
    await connectDB()
    const since = daysAgoKey(daysBack)   // 'YYYY-MM-DD'
    // Raw daily snapshots (deduped to 1/listing/day by the unique index). Uses the
    // {listingId, day} index. Bounded: <= 200 listings * daysBack rows.
    const rows = await ListingSnapshot.find({ listingId: { $in: ids }, day: { $gte: since } })
      .sort({ listingId: 1, day: 1 })
      .select('listingId day views favorers reviewCount')
      .lean<{ listingId: number; day: string; views: number | null; favorers: number | null; reviewCount: number | null }[]>()
    if (!rows.length) return { ...empty, sampledListings: ids.length }

    const byListing = new Map<number, { day: string; views: number | null; favorers: number | null; reviewCount: number | null }[]>()
    for (const r of rows) {
      const arr = byListing.get(r.listingId) ?? []
      arr.push({ day: r.day, views: r.views, favorers: r.favorers, reviewCount: trustedReviews(r.day, r.reviewCount) })
      byListing.set(r.listingId, arr)
    }

    const rate = reviewRate()
    const dayAgg = new Map<string, KeywordDay>()
    const bump = (m: Map<string, KeywordDay>, key: string, k: 'views' | 'favorites' | 'sales' | 'reviews', v: number) => {
      const cur = m.get(key) ?? { day: key, views: 0, favorites: 0, sales: 0, reviews: 0 }
      cur[k] += v; m.set(key, cur)
    }
    let measured = 0
    for (const series of byListing.values()) {
      if (series.length < 2) continue           // need >=2 snapshots to measure a gain
      series.sort((a, b) => a.day.localeCompare(b.day))
      let contributed = false
      for (let i = 1; i < series.length; i++) {
        const prev = series[i - 1], cur = series[i]
        const vG = gainOf(prev.views, cur.views)
        const fG = gainOf(prev.favorers, cur.favorers)
        const rG = gainOf(prev.reviewCount, cur.reviewCount)
        if (vG || fG || rG) contributed = true
        bump(dayAgg, cur.day, 'views', vG); bump(dayAgg, cur.day, 'favorites', fG); bump(dayAgg, cur.day, 'reviews', rG)
        if (rG) bump(dayAgg, cur.day, 'sales', Math.round(rG / rate))
      }
      if (contributed) measured++
    }

    // Continuous daily series across the window (fill gaps with 0) so the sparkline
    // is a real, evenly-spaced line with a dot per day.
    const daily: KeywordDay[] = []
    for (let i = daysBack - 1; i >= 0; i--) {
      const key = daysAgoKey(i)
      daily.push(dayAgg.get(key) ?? { day: key, views: 0, favorites: 0, sales: 0, reviews: 0 })
    }

    // Calendar-month rollup from the daily gains.
    const monthAgg = new Map<string, KeywordMonth>()
    for (const d of daily) {
      const m = d.day.slice(0, 7)
      const cur = monthAgg.get(m) ?? { month: m, views: 0, favorites: 0, sales: 0, reviews: 0 }
      cur.views += d.views; cur.favorites += d.favorites; cur.sales += d.sales; cur.reviews += d.reviews
      monthAgg.set(m, cur)
    }
    const months = [...monthAgg.values()].sort((a, b) => a.month.localeCompare(b.month))

    const sum = (arr: KeywordDay[]): KeywordMonth => arr.reduce<KeywordMonth>((t, x) => ({ month: '', views: t.views + x.views, favorites: t.favorites + x.favorites, sales: t.sales + x.sales, reviews: t.reviews + x.reviews }), zeroMonth())
    const totals = sum(daily)
    const last30 = sum(daily.slice(-30))
    const thisMonthKey = new Date().toISOString().slice(0, 7)
    const thisMonth = daily.filter(d => d.day.slice(0, 7) === thisMonthKey).length ? sum(daily.filter(d => d.day.slice(0, 7) === thisMonthKey)) : zeroMonth()
    const active = [...dayAgg.values()].filter(d => d.views || d.favorites || d.sales || d.reviews)
    const fromDay = active.length ? active.map(d => d.day).sort()[0] : null

    return { months, daily, totals, thisMonth, last30, sampledListings: ids.length, measuredListings: measured, trackedDays: active.length, fromDay }
  } catch (e) {
    console.error('[Snapshots] keyword market history failed:', e)
    return empty
  }
}

// ─── Batch keyword trends (for eHunt-style per-row sparklines in tables) ───────
export interface KeywordTrend { views: number[]; favorites: number[]; sales: number[] }

/**
 * Compact daily-gain trend (last `days`) for MANY keywords at once, from ONE
 * snapshot query over the union of their ranking listing ids. Used to draw a
 * sparkline per row in the related-keywords table without any extra Etsy calls
 * (the caller already searched each keyword). Arrays are length `days`, oldest→newest.
 */
export async function getKeywordTrendsBatch(keywordToIds: Map<string, number[]>, days = 30): Promise<Map<string, KeywordTrend>> {
  const out = new Map<string, KeywordTrend>()
  const allIds = [...new Set([...keywordToIds.values()].flat().filter(Boolean))]
  if (!allIds.length) return out
  try {
    await connectDB()
    const since = daysAgoKey(days + 1)
    const rows = await ListingSnapshot.find({ listingId: { $in: allIds }, day: { $gte: since } })
      .sort({ listingId: 1, day: 1 })
      .select('listingId day views favorers reviewCount')
      .lean<{ listingId: number; day: string; views: number | null; favorers: number | null; reviewCount: number | null }[]>()
    if (!rows.length) return out

    const rate = reviewRate()
    const byListing = new Map<number, { day: string; views: number | null; favorers: number | null; reviewCount: number | null }[]>()
    for (const r of rows) { const a = byListing.get(r.listingId) ?? []; a.push({ ...r, reviewCount: trustedReviews(r.day, r.reviewCount) }); byListing.set(r.listingId, a) }

    // Per-listing map of day → gains.
    const perListing = new Map<number, Map<string, { v: number; f: number; s: number }>>()
    for (const [lid, series] of byListing) {
      series.sort((a, b) => a.day.localeCompare(b.day))
      const m = new Map<string, { v: number; f: number; s: number }>()
      for (let i = 1; i < series.length; i++) {
        const p = series[i - 1], c = series[i]
        const rg = gainOf(p.reviewCount, c.reviewCount)
        const cur = m.get(c.day) ?? { v: 0, f: 0, s: 0 }
        cur.v += gainOf(p.views, c.views); cur.f += gainOf(p.favorers, c.favorers); cur.s += Math.round(rg / rate)
        m.set(c.day, cur)
      }
      perListing.set(lid, m)
    }

    const axis: string[] = []
    for (let i = days - 1; i >= 0; i--) axis.push(daysAgoKey(i))

    for (const [kw, ids] of keywordToIds) {
      const views = new Array(days).fill(0), favorites = new Array(days).fill(0), sales = new Array(days).fill(0)
      let any = false
      for (const id of ids) {
        const m = perListing.get(id); if (!m) continue
        axis.forEach((day, idx) => { const g = m.get(day); if (g) { views[idx] += g.v; favorites[idx] += g.f; sales[idx] += g.s; any = true } })
      }
      if (any) out.set(kw, { views, favorites, sales })
    }
    return out
  } catch (e) {
    console.error('[Snapshots] keyword trends batch failed:', e)
    return out
  }
}
