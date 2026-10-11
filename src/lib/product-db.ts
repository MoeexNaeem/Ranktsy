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
import { TrackedListing, ListingSnapshot, ProductStat, AppSetting, type IProductStat } from '@/lib/models'
import { dayKey } from '@/lib/snapshots'
import { reviewRate } from '@/lib/salesEstimate'
import { hotScoreOf } from '@/lib/hot-score'

const BATCH = Number(process.env.PRODUCT_DB_BATCH) || 400
const PAUSE_MS = Number(process.env.PRODUCT_DB_PAUSE_MS) || 150
const WINDOW_DAYS = 45
const LEASE_KEY = 'productdb:lease'
const LAST_KEY = 'productdb:last'
const LEASE_MS = 15 * 60_000          // renewed every batch; a killed run frees it within 15 min

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
 * Units that left stock over the last `n` days: the sum of day-to-day drops in
 * quantity (restocks are increases and are ignored). A big one-off cut on a
 * large stock (999 -> 20) is the seller editing stock, not 979 sales, so a drop
 * of half or more of a 100+ stock is skipped. Needs readings spanning `minSpan` days.
 */
export function stockSold(pts: Pt[], n: number, minSpan: number): number | null {
  if (pts.length < 2) return null
  const last = pts[pts.length - 1]
  const win = pts.filter(p => last.d - p.d <= n)
  if (win.length < 2) return null
  const span = last.d - win[0].d
  if (span < minSpan) return null
  let sold = 0
  for (let i = 1; i < win.length; i++) {
    const prev = win[i - 1].v
    const drop = prev - win[i].v
    if (drop <= 0) continue
    if (prev >= 100 && drop >= prev / 2) continue
    sold += drop
  }
  return Math.round(sold * n / span)
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
}

type Row = Omit<IProductStat, 'img' | 'tags'>

/** One product row from a listing's facts and its snapshot rows (any order). */
export function buildProductRow(t: TrackedFacts, snaps: SnapRow[], usdPerUnit: (cur: string) => number | null, runDay: string, nowMs = Date.now()): Row {
  const rows = [...snaps].sort((a, b) => a.day.localeCompare(b.day))
  const views = seriesOf(rows, r => r.views, true)
  const favs = seriesOf(rows, r => r.favorers, true)
  const revs = seriesOf(rows, r => r.reviewCount, false)
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
  let price: number | null = null, cur: string | null = null
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].price != null && rows[i].price! > 0) { price = rows[i].price!; cur = rows[i].currency ?? t.currency ?? null; break }
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
  const sold7 = stockSold(qty, 7, 4), sold30 = stockSold(qty, 30, 18)
  const sales7 = sold7 ?? est(r7)
  const sales30 = sold30 ?? est(r30)
  const r7p = prevGain7(revs)
  const usd = (n: number | null) => (n != null && priceUsd != null ? Math.round(n * priceUsd) : null)
  const { score, engagementPct } = hotScoreOf(vNow, fNow, t.createdTimestamp, nowMs)

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
    priceOrig: latest('priceOriginal') ?? null,
    onSale: latest('onSale') ?? null,
    views: vNow, favs: fNow, reviews: rNow,
    qty: lastOf(qty),
    rating: latest('rating') ?? null,
    bestRank,
    inCarts: t.inCarts ?? null,
    eng: vNow ? engagementPct : null,
    hot: score,
    v7, f7, r7, v30, f30, r30,
    f7p: prevGain7(favs),
    sales7p: r7p == null ? null : est(r7p),
    sold7, sold30, sales7, sales30,
    salesEst: sold7 == null,
    salesEst30: sold30 == null,
    salesTotal: rNow != null ? Math.round(rNow / rr) : null,
    rev7: usd(sales7), rev30: usd(sales30),
    lastDay, runDay,
  }
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

export interface RollupResult { day: string; listings: number; written: number; removed: number; ms: number; at: string }

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
        .select('listingId shopId shopName title categoryTop isDigital personalisable badges freeShipping hasVideo starSeller createdTimestamp currency lastPrice lastViews lastFavorers lastReviewCount inCarts lastSeenAt')
        .lean<(TrackedFacts & { _id: unknown })[]>()
        .maxTimeMS(120_000)
      if (!tl.length) break
      lastId = tl[tl.length - 1]._id
      const ids = tl.map(t => t.listingId)
      const snaps = await ListingSnapshot.find({ listingId: { $in: ids }, day: { $gte: fromDay } })
        .select('listingId day views favorers reviewCount quantity price currency priceOriginal onSale rating bestRank -_id')
        .lean<(SnapRow & { listingId: number })[]>()
        .maxTimeMS(120_000)
      const byId = new Map<number, SnapRow[]>()
      for (const s of snaps) {
        const list = byId.get(s.listingId)
        if (list) list.push(s); else byId.set(s.listingId, [s])
      }
      const ops = tl.map(t => {
        const row = buildProductRow(t, byId.get(t.listingId) ?? [], usdPerUnit, runDay)
        return { updateOne: { filter: { listingId: t.listingId }, update: { $set: row }, upsert: true } }
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
    const result: RollupResult = { day: runDay, listings, written, removed, ms: Date.now() - started, at: new Date().toISOString() }
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
      if (last?.day !== dayKey()) await runProductRollup()
    } catch (e) {
      console.error('[ProductDB] scheduler tick failed:', e)
    } finally {
      running = false
    }
  }
  setTimeout(() => { void tick() }, 3 * 60_000).unref()
  setInterval(() => { void tick() }, 15 * 60_000).unref()
}
