/**
 * Product database for Find Hot Products (server only).
 *
 * Once a day, one PM2 worker rebuilds `productstats`: a row per listing seen in
 * the last ~45 days, combining TrackedListing (title, shop, category, badges...)
 * with that listing's daily ListingSnapshot rows. From those rows it MEASURES how
 * much each listing gained in views, favorites and reviews over the last 7 and 30
 * days, and how many units left its stock. The browse API then filters and sorts
 * this small table instead of the snapshot history, so a user request never scans
 * millions of rows (that took the site down on 2026-10-03).
 *
 * Honesty rules (see no-fabricated-data-rule):
 *  - A gain needs a real baseline row 5-10 days back (7d) or 21-40 days back (30d);
 *    the difference is scaled to exactly 7 / 30 days. No baseline = null, never 0.
 *  - views/favorers are stored as 0 when a day's observation did not include them,
 *    so 0 is treated as "not observed", never as a real starting value.
 *  - Sales: units that left stock (measured) when we have stock readings, else
 *    reviews gained / review rate (an estimate). `salesEst` says which one it is.
 */
import { connectDB } from '@/lib/db'
import { TrackedListing, ListingSnapshot, ProductStat, AppSetting, HotProductSave, type IProductStat } from '@/lib/models'
import { dayKey, trustedReviews, recordObservedListings } from '@/lib/snapshots'
import { getListingById, etsyQuotaLow, topCategoryForTaxonomy } from '@/lib/etsy'
import { reviewRate } from '@/lib/salesEstimate'
import { hotScoreOf } from '@/lib/hot-score'
import type { DbProduct } from '@/types'
import type { RankEvent } from '@/lib/rank-explain'

const BATCH = Number(process.env.PRODUCT_DB_BATCH) || 400
const PAUSE_MS = Number(process.env.PRODUCT_DB_PAUSE_MS) || 150
const WINDOW_DAYS = 45
const LEASE_KEY = 'productdb:lease'
const LAST_KEY = 'productdb:last'
const LEASE_MS = 15 * 60_000          // renewed every batch; a killed run frees it within 15 min
// Bump when the row maths changes: the scheduler rebuilds the same day instead of
// waiting for tomorrow (v2 2026-10-11: views-based stock-edit rule, sale price fix).
const ROLLUP_V = 2

// ─── Pure maths (unit-tested) ─────────────────────────────────────────────────

export interface SnapRow {
  day: string
  views?: number | null
  favorers?: number | null
  reviewCount?: number | null
  quantity?: number | null
  price?: number | null
  currency?: string | null
  priceOriginal?: number | null
  onSale?: boolean | null
  rating?: number | null
  bestRank?: number | null
  bought24h?: number | null
}
export interface Pt { d: number; v: number }

const dayNum = (day: string) => Math.round(Date.parse(day + 'T00:00:00Z') / 86_400_000)

/** Points (oldest first) for one metric, keeping only real observations. */
export function seriesOf(rows: SnapRow[], pick: (r: SnapRow) => number | null | undefined, zeroIsUnknown: boolean): Pt[] {
  const out: Pt[] = []
  for (const r of rows) {
    const v = pick(r)
    if (v == null || !Number.isFinite(v) || v < 0 || (zeroIsUnknown && v === 0)) continue
    out.push({ d: dayNum(r.day), v })
  }
  return out.sort((a, b) => a.d - b.d)
}

/** The point whose distance back from `from` is in [lo, hi] and closest to `target`. */
function baseline(pts: Pt[], from: number, target: number, lo: number, hi: number): Pt | null {
  let best: Pt | null = null
  for (const p of pts) {
    const gap = from - p.d
    if (gap < lo || gap > hi) continue
    if (!best || Math.abs(gap - target) < Math.abs(from - best.d - target)) best = p
  }
  return best
}

/** Gain over the last `n` days, scaled from the nearest real baseline in [lo, hi] days back. */
export function gainOver(pts: Pt[], n: number, lo: number, hi: number): number | null {
  if (pts.length < 2) return null
  const last = pts[pts.length - 1]
  const b = baseline(pts, last.d, n, lo, hi)
  if (!b) return null
  return Math.max(0, Math.round((last.v - b.v) * n / (last.d - b.d)))
}

/** Gain over the 7 days BEFORE the last 7 (for "rising" = this week vs last week). */
export function prevGain7(pts: Pt[]): number | null {
  if (pts.length < 3) return null
  const last = pts[pts.length - 1]
  const b1 = baseline(pts, last.d, 7, 5, 10)
  const b2 = baseline(pts, last.d, 14, 12, 18)
  if (!b1 || !b2 || b1.d <= b2.d) return null
  return Math.max(0, Math.round((b1.v - b2.v) * 7 / (b1.d - b2.d)))
}

/**
 * A stock drop that is the seller editing stock, not sales:
 *  - more units gone than half the views it gained over the same days (you cannot
 *    sell 1,082 units to 300 visitors: 2026-10-11, listing 4465311900; real hot
 *    listings measured 8-13% units per view, multi-unit orders included), or
 *  - 40% or more of a stock of 100+ gone at once (999 -> 20, 999 -> 500).
 * One order can be several units (bridesmaid sets), so units may exceed orders.
 */
export const isStockEdit = (prev: number, drop: number, viewsGain?: number | null) =>
  (viewsGain != null && drop > viewsGain * 0.5 + 5) || (prev >= 100 && drop >= prev * 0.4)

/** The latest value at or before day `d` (null if none). */
function valueAt(pts: Pt[] | undefined, d: number): number | null {
  if (!pts) return null
  let v: number | null = null
  for (const p of pts) { if (p.d <= d) v = p.v; else break }
  return v
}

/**
 * Units that left stock over the last `n` days: the sum of day-to-day drops in
 * quantity (restocks are increases and are ignored). A big one-off cut on a
 * large stock (999 -> 20) is the seller editing stock, not 979 sales, so those
 * drops are skipped (isStockEdit). Needs readings spanning `minSpan` days.
 */
export function stockSold(pts: Pt[], n: number, minSpan: number, views?: Pt[]): number | null {
  if (pts.length < 2) return null
  const last = pts[pts.length - 1]
  const win = pts.filter(p => last.d - p.d <= n)
  if (win.length < 2) return null
  const span = last.d - win[0].d
  if (span < minSpan) return null
  // Only stretches we can read count: a restock (stock went up) or a stock edit
  // hides that stretch's sales, so its days are left out rather than read as 0,
  // and the rate from the readable days is scaled to `n` days.
  let sold = 0, days = 0
  for (let i = 1; i < win.length; i++) {
    const prev = win[i - 1].v
    const drop = prev - win[i].v
    const gap = win[i].d - win[i - 1].d
    if (drop < 0) continue
    if (drop > 0) {
      const va = valueAt(views, win[i - 1].d), vb = valueAt(views, win[i].d)
      if (isStockEdit(prev, drop, va != null && vb != null ? vb - va : null)) continue
    }
    sold += drop
    days += gap
  }
  if (days < minSpan) return null
  return Math.round(sold * n / days)
}

export interface TrackedFacts {
  listingId: number
  shopId: number
  shopName?: string | null
  title?: string | null
  categoryTop?: string | null
  isDigital?: boolean | null
  personalisable?: boolean | null
  badges?: string[] | null
  freeShipping?: boolean | null
  hasVideo?: boolean | null
  starSeller?: boolean | null
  createdTimestamp?: number | null
  currency?: string | null
  lastPrice?: number | null
  lastViews?: number | null
  lastFavorers?: number | null
  lastReviewCount?: number | null
  inCarts?: number | null
  lastSeenAt?: Date | string | null
  image?: string | null
  shipsFrom?: string | null
  madeType?: string | null
}

type Row = Omit<IProductStat, 'img' | 'tags'>

/** One product row from a listing's facts and its snapshot rows (any order). */
export function buildProductRow(t: TrackedFacts, snaps: SnapRow[], usdPerUnit: (cur: string) => number | null, runDay: string, nowMs = Date.now()): Row {
  const rows = [...snaps].sort((a, b) => a.day.localeCompare(b.day))
  const views = seriesOf(rows, r => r.views, true)
  const favs = seriesOf(rows, r => r.favorers, true)
  // Review counts stored before the observe fix are not trustworthy (see trustedReviews).
  const revs = seriesOf(rows, r => trustedReviews(r.day, r.reviewCount), false)
  const qty = seriesOf(rows, r => r.quantity, false)
  const lastOf = (pts: Pt[]) => (pts.length ? pts[pts.length - 1].v : null)
  const latest = <K extends keyof SnapRow>(k: K): SnapRow[K] | null => {
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i][k] != null) return rows[i][k]
    return null
  }

  const lastDay = rows.length ? rows[rows.length - 1].day : dayKey(t.lastSeenAt ? new Date(t.lastSeenAt) : new Date(nowMs))
  const vNow = lastOf(views) ?? (t.lastViews || null)
  const fNow = lastOf(favs) ?? (t.lastFavorers || null)
  const rNow = lastOf(revs) ?? t.lastReviewCount ?? null

  // Price: the latest day it was seen with a price, else the tracked last price.
  // The original (pre-sale) price only from the SAME reading as the price, so both
  // are in one currency (a sale price in USD with an original in PLN read as 90% off).
  let price: number | null = null, cur: string | null = null
  let priceOrig: number | null = null, onSale: boolean | null = null
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].price != null && rows[i].price! > 0) {
      price = rows[i].price!; cur = rows[i].currency ?? t.currency ?? null
      priceOrig = rows[i].priceOriginal ?? null; onSale = rows[i].onSale ?? null
      break
    }
  }
  if (price == null && t.lastPrice != null && t.lastPrice > 0) { price = t.lastPrice; cur = t.currency ?? null }
  const rate = cur ? usdPerUnit(cur) : null
  const priceUsd = price != null && rate != null ? Math.round(price * rate * 100) / 100 : null

  const lastD = dayNum(lastDay)
  let bestRank: number | null = null
  for (const r of rows) if (r.bestRank != null && r.bestRank > 0 && lastD - dayNum(r.day) <= 7) bestRank = bestRank == null ? r.bestRank : Math.min(bestRank, r.bestRank)

  const v7 = gainOver(views, 7, 5, 10), f7 = gainOver(favs, 7, 5, 10), r7 = gainOver(revs, 7, 5, 10)
  const v30 = gainOver(views, 30, 21, 40), f30 = gainOver(favs, 30, 21, 40), r30 = gainOver(revs, 30, 21, 40)
  const rr = reviewRate()
  const est = (g: number | null) => (g == null ? null : Math.round(g / rr))
  const sold7 = stockSold(qty, 7, 4, views), sold30 = stockSold(qty, 30, 18, views)
  const sales7 = sold7 ?? est(r7)
  const sales30 = sold30 ?? est(r30)
  const r7p = prevGain7(revs)
  const f7p = prevGain7(favs)
  const sales7p = r7p == null ? null : est(r7p)
  // Growth this week vs last, only when last week was big enough to compare with
  // (2 -> 10 favorites is "+400%" but means nothing).
  const growth = (now: number | null, prev: number | null, min: number) =>
    now != null && prev != null && prev >= min ? Math.round((now - prev) / prev * 100) : null
  const usd = (n: number | null) => (n != null && priceUsd != null ? Math.round(n * priceUsd) : null)
  const { score, engagementPct } = hotScoreOf(vNow, fNow, t.createdTimestamp, nowMs)
  // Etsy's own recent-purchase counter: the latest one seen in the last 7 days.
  let bought: { v: number; day: string } | null = null
  for (const r of rows) if (r.bought24h != null && r.bought24h >= 0 && lastD - dayNum(r.day) <= 7) bought = { v: r.bought24h, day: r.day }

  return {
    listingId: t.listingId,
    shopId: t.shopId,
    shopName: t.shopName ?? null,
    title: t.title ?? '',
    cat: t.categoryTop ?? null,
    digital: t.isDigital ?? null,
    personal: t.personalisable ?? null,
    badges: t.badges?.length ? t.badges : undefined,
    freeShip: t.freeShipping ?? null,
    video: t.hasVideo ?? null,
    starSeller: t.starSeller ?? null,
    created: t.createdTimestamp ?? null,
    price, cur, priceUsd,
    priceOrig, onSale,
    views: vNow, favs: fNow, reviews: rNow,
    qty: lastOf(qty),
    rating: latest('rating') ?? null,
    bestRank,
    inCarts: t.inCarts ?? null,
    ship: t.shipsFrom ?? null,
    made: t.madeType ?? null,
    bought24h: bought?.v ?? null,
    boughtDay: bought?.day ?? null,
    eng: vNow ? engagementPct : null,
    hot: score,
    v7, f7, r7, v30, f30, r30,
    f7p, sales7p,
    fg7: growth(f7, f7p, 10),
    sg7: growth(sales7, sales7p, 3),
    sold7, sold30, sales7, sales30,
    salesEst: sold7 == null,
    salesEst30: sold30 == null,
    // Never below the units we measured leaving stock (a listing with few or pooled
    // reviews read "~0 total" next to "+1.7K units this week", 2026-10-11).
    salesTotal: rNow != null || sold30 != null || sold7 != null ? Math.max(rNow != null ? Math.round(rNow / rr) : 0, sold30 ?? 0, sold7 ?? 0) : null,
    rev7: usd(sales7), rev30: usd(sales30),
    lastDay, runDay,
  }
}

export type ProductLean = IProductStat & { _id?: unknown }

/** A productstats row as the API returns it. */
export function toProduct(r: ProductLean): DbProduct {
  return {
    listingId: r.listingId, title: r.title, url: `https://www.etsy.com/listing/${r.listingId}`,
    image: r.img ?? null, shopName: r.shopName ?? null, cat: r.cat ?? null,
    digital: r.digital ?? null, personal: r.personal ?? null, badges: r.badges ?? [],
    freeShip: r.freeShip ?? null, onSale: r.onSale ?? null, created: r.created ?? null,
    price: r.price ?? null, cur: r.cur ?? null, priceUsd: r.priceUsd ?? null, priceOrig: r.priceOrig ?? null,
    views: r.views ?? null, favs: r.favs ?? null, reviews: r.reviews ?? null, qty: r.qty ?? null,
    rating: r.rating ?? null, bestRank: r.bestRank ?? null, hot: r.hot ?? 0, eng: r.eng ?? null,
    v7: r.v7 ?? null, f7: r.f7 ?? null, r7: r.r7 ?? null, v30: r.v30 ?? null, f30: r.f30 ?? null, r30: r.r30 ?? null,
    sales7: r.sales7 ?? null, sales30: r.sales30 ?? null, salesEst: r.salesEst ?? true, salesEst30: r.salesEst30 ?? true,
    fg7: r.fg7 ?? null, sg7: r.sg7 ?? null,
    salesTotal: r.salesTotal ?? null, rev7: r.rev7 ?? null, rev30: r.rev30 ?? null,
    lastDay: r.lastDay, tags: r.tags ?? [],
    ship: r.ship ?? null, made: r.made ?? null, bought24h: r.bought24h ?? null, boughtDay: r.boughtDay ?? null,
  }
}

// ─── One listing's daily history (product detail chart) ──────────────────────

export interface HistoryRow extends SnapRow { listPrice?: number | null; listCurrency?: string | null }
export interface HistoryPoint {
  day: string
  views: number | null; favs: number | null; reviews: number | null
  /** The seller's list price when recorded (2026-10-09 on), else the price seen that day. */
  price: number | null; cur: string | null
  priceOrig: number | null; onSale: boolean | null
  qty: number | null; rank: number | null
  /** Average per day since the previous reading (null on the first one). */
  dViews: number | null; dFavs: number | null; dReviews: number | null
  /** Units that left stock per day (measured); reviews gained per day / review rate (estimate). */
  sold: number | null; salesEst: number | null
}

export interface ProductItemData {
  stat: DbProduct | null
  days: number
  series: HistoryPoint[]
  /** What changed on the listing in the window, newest first (measured, never causes). */
  events: RankEvent[]
  trackedSince: string | null
}

/** Daily points for a chart, oldest first, from a listing's snapshot rows. */
export function listingSeries(rowsIn: HistoryRow[]): HistoryPoint[] {
  const rows = [...rowsIn].sort((a, b) => a.day.localeCompare(b.day))
  const rr = reviewRate()
  const last: Record<string, { d: number; v: number } | null> = { views: null, favs: null, reviews: null, qty: null }
  // Views as they stood at each stock reading, to tell sales from stock edits.
  let viewsAtQty: number | null = null
  let listPrice: { v: number; cur: string | null } | null = null
  const r1 = (n: number) => Math.round(n * 10) / 10
  const step = (k: string, v: number | null, d: number): number | null => {
    if (v == null) return null
    const prev = last[k]
    last[k] = { d, v }
    if (!prev || d <= prev.d) return null
    return r1(Math.max(0, v - prev.v) / (d - prev.d))
  }
  return rows.map(r => {
    const d = dayNum(r.day)
    if (r.listPrice != null && r.listPrice > 0) listPrice = { v: r.listPrice, cur: r.listCurrency ?? null }
    const views = r.views != null && r.views > 0 ? r.views : null
    const favs = r.favorers != null && r.favorers > 0 ? r.favorers : null
    const reviews = trustedReviews(r.day, r.reviewCount)
    const qty = r.quantity != null && r.quantity >= 0 ? r.quantity : null
    const prevQty = last.qty
    const prevViewsAtQty = viewsAtQty
    const dViews = step('views', views, d)
    const dFavs = step('favs', favs, d)
    const dReviews = step('reviews', reviews, d)
    step('qty', qty, d)
    let sold: number | null = null
    if (qty != null && prevQty && d > prevQty.d) {
      const drop = prevQty.v - qty
      // A big cut on a large stock is the seller editing stock, not sales (see stockSold).
      const vNow = last.views?.v ?? null
      const viewsGain = vNow != null && prevViewsAtQty != null ? vNow - prevViewsAtQty : null
      // Restock (stock went up) or a stock edit: that stretch's sales are unknown, not 0.
      sold = drop < 0 || (drop > 0 && isStockEdit(prevQty.v, drop, viewsGain)) ? null : r1(drop / (d - prevQty.d))
    }
    if (qty != null) viewsAtQty = last.views?.v ?? null
    const lp = listPrice as { v: number; cur: string | null } | null
    return {
      day: r.day,
      views, favs, reviews,
      price: lp ? lp.v : (r.price != null && r.price > 0 ? r.price : null),
      cur: lp ? lp.cur : (r.currency ?? null),
      priceOrig: r.priceOriginal ?? null,
      onSale: r.onSale ?? null,
      qty,
      rank: r.bestRank != null && r.bestRank > 0 ? r.bestRank : null,
      dViews, dFavs, dReviews,
      sold,
      salesEst: dReviews == null ? null : r1(dReviews / rr),
    }
  })
}

// ─── Currency ────────────────────────────────────────────────────────────────

/** 1 unit of each currency in USD, from a live public rate table (null when unknown). */
async function usdRates(): Promise<(cur: string) => number | null> {
  let perUsd: Record<string, number> = {}
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })
    const j = await res.json() as { result?: string; rates?: Record<string, number> }
    if (j.result === 'success' && j.rates) perUsd = j.rates
  } catch (e) {
    console.error('[ProductDB] FX rates unavailable, non-USD prices left unconverted:', e)
  }
  return (cur: string) => {
    const c = cur.toUpperCase()
    if (c === 'USD') return 1
    const r = perUsd[c]
    return r && r > 0 ? 1 / r : null
  }
}

// ─── The daily run ───────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function renewLease(holder: string): Promise<boolean> {
  const now = Date.now()
  try {
    const r = await AppSetting.updateOne(
      { key: LEASE_KEY, $or: [{ num: { $lt: now } }, { num: { $exists: false } }, { str: holder }] },
      { $set: { num: now + LEASE_MS, str: holder } },
      { upsert: true },
    )
    return r.modifiedCount === 1 || r.upsertedCount === 1 || r.matchedCount === 1
  } catch {
    return false   // duplicate key: another worker holds a live lease
  }
}

export interface RollupResult { day: string; listings: number; written: number; removed: number; ms: number; at: string; v?: number }

/** Rebuild the product table. Holds a renewing cross-worker lease; returns null if another worker has it. */
export async function runProductRollup(): Promise<RollupResult | null> {
  await connectDB()
  const holder = `${process.pid}:${Date.now()}`
  if (!(await renewLease(holder))) return null
  const started = Date.now()
  const runDay = dayKey()
  const since = new Date(started - WINDOW_DAYS * 86_400_000)
  const fromDay = dayKey(new Date(started - (WINDOW_DAYS + 1) * 86_400_000))
  const usdPerUnit = await usdRates()
  let lastId: unknown = null
  let listings = 0, written = 0
  console.log(`[ProductDB] rollup started for ${runDay}`)
  try {
    for (;;) {
      const q: Record<string, unknown> = { lastSeenAt: { $gte: since } }
      if (lastId) q._id = { $gt: lastId }
      const tl = await TrackedListing.find(q)
        .sort({ _id: 1 }).limit(BATCH)
        .select('listingId shopId shopName title categoryTop isDigital personalisable badges freeShipping hasVideo starSeller createdTimestamp currency lastPrice lastViews lastFavorers lastReviewCount inCarts lastSeenAt image shipsFrom madeType')
        .lean<(TrackedFacts & { _id: unknown })[]>()
        .maxTimeMS(120_000)
      if (!tl.length) break
      lastId = tl[tl.length - 1]._id
      const ids = tl.map(t => t.listingId)
      const snaps = await ListingSnapshot.find({ listingId: { $in: ids }, day: { $gte: fromDay } })
        .select('listingId day views favorers reviewCount quantity price currency priceOriginal onSale rating bestRank bought24h -_id')
        .lean<(SnapRow & { listingId: number })[]>()
        .maxTimeMS(120_000)
      const byId = new Map<number, SnapRow[]>()
      for (const s of snaps) {
        const list = byId.get(s.listingId)
        if (list) list.push(s); else byId.set(s.listingId, [s])
      }
      const ops = tl.map(t => {
        const row = buildProductRow(t, byId.get(t.listingId) ?? [], usdPerUnit, runDay)
        // A photo the extension saw saves an Etsy call when the row is shown.
        return { updateOne: { filter: { listingId: t.listingId }, update: { $set: t.image ? { ...row, img: t.image } : row }, upsert: true } }
      })
      if (ops.length) await ProductStat.bulkWrite(ops, { ordered: false })
      listings += tl.length
      written += ops.length
      if (!(await renewLease(holder))) throw new Error('lease lost to another worker')
      if (listings % (BATCH * 50) === 0) console.log(`[ProductDB] ${listings} listings so far`)
      await sleep(PAUSE_MS)
    }
    // Listings that dropped out of tracking were not refreshed this run.
    const removed = (await ProductStat.deleteMany({ runDay: { $ne: runDay } })).deletedCount ?? 0
    const result: RollupResult = { day: runDay, listings, written, removed, ms: Date.now() - started, at: new Date().toISOString(), v: ROLLUP_V }
    await AppSetting.updateOne({ key: LAST_KEY }, { $set: { str: JSON.stringify(result), num: Date.now() } }, { upsert: true })
    console.log(`[ProductDB] rollup done: ${listings} listings in ${Math.round(result.ms / 1000)} s, ${removed} removed`)
    return result
  } catch (e) {
    console.error(`[ProductDB] rollup failed after ${listings} listings:`, e)
    return null
  } finally {
    await AppSetting.updateOne({ key: LEASE_KEY, str: holder }, { $set: { num: 0 } }).catch(() => {})
  }
}

/**
 * Products users chose to track are read from Etsy once a day, even when nobody
 * browses them, so their history never has gaps. Listings are fetched through
 * getListingById, which batches up to 100 ids into one Etsy call. Stops early when
 * the Etsy quota runs low. Returns how many were recorded.
 */
export async function refreshTrackedProducts(): Promise<number> {
  await connectDB()
  const ids = (await HotProductSave.distinct('listingId', { kind: 'track' }) as (number | null)[]).filter((n): n is number => !!n)
  let recorded = 0
  for (let i = 0; i < ids.length; i += 100) {
    if (etsyQuotaLow()) break
    const chunk = ids.slice(i, i + 100)
    const got = await Promise.all(chunk.map(id => getListingById(id).catch(() => null)))
    const rows = got.filter((l): l is NonNullable<typeof l> => !!l && !!l.shop_id).map(l => ({
      listingId: l.listing_id,
      shopId: l.shop_id!,
      title: l.title,
      tags: l.tags ?? [],
      price: l.price ? l.price.amount / (l.price.divisor || 100) : null,
      currency: l.price?.currency_code,
      views: l.views ?? null,
      favorers: l.num_favorers ?? null,
      quantity: typeof l.quantity === 'number' ? l.quantity : null,
      shopName: l.shop_name ?? null,
      categoryTop: topCategoryForTaxonomy(l.taxonomy_id),
      createdTimestamp: l.created_timestamp ?? null,
      listPrice: l.price ? l.price.amount / (l.price.divisor || 100) : null,
      listCurrency: l.price?.currency_code ?? null,
      modTs: l.modified_timestamp ?? null,
      endTs: l.ending_timestamp ?? null,
    }))
    if (rows.length) recorded += await recordObservedListings(rows)
    await sleep(PAUSE_MS)
  }
  if (ids.length) console.log(`[ProductDB] refreshed ${recorded} of ${ids.length} user-tracked products`)
  return recorded
}

/** The last completed run (for the "updated" line on the page), or null. */
export async function lastRollup(): Promise<RollupResult | null> {
  try {
    await connectDB()
    const s = await AppSetting.findOne({ key: LAST_KEY }).lean<{ str?: string }>()
    return s?.str ? JSON.parse(s.str) as RollupResult : null
  } catch { return null }
}

/**
 * Daily scheduler. Runs in PM2 worker 0 only (the lease also stops overlaps):
 * checks every 15 minutes whether today's table has been built and builds it if
 * not, so a fresh deploy builds within minutes and then once per UTC day.
 * PRODUCT_DB_ROLLUP=off disables it.
 */
export function startProductRollup(): void {
  if ((process.env.NODE_APP_INSTANCE ?? '0') !== '0') return
  if (process.env.PRODUCT_DB_ROLLUP === 'off') return
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const last = await lastRollup()
      if (last?.day !== dayKey() || last.v !== ROLLUP_V) {
        // Today's readings for user-tracked products first, so the rebuild includes them.
        await refreshTrackedProducts().catch(e => console.error('[ProductDB] tracked refresh failed:', e))
        await runProductRollup()
      }
    } catch (e) {
      console.error('[ProductDB] scheduler tick failed:', e)
    } finally {
      running = false
    }
  }
  setTimeout(() => { void tick() }, 3 * 60_000).unref()
  setInterval(() => { void tick() }, 15 * 60_000).unref()
}
