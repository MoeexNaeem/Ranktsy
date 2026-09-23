import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import {
  recordObservedListings, recordShopSnapshots, recordSearchRanks, normalizeKeyword,
  type ObservedListing, type ShopSnapshotInput, type ObservedRank, type ObservedKeywordMarket,
} from '@/lib/snapshots'
import { recordExtensionUsage } from '@/lib/extension'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

const MAX_ITEMS = 120
const MAX_SHOPS = 40
const MAX_RANKS = 120

/**
 * Crowd-sourced snapshot capture - the data flywheel behind every time-based
 * figure in Rankkw.
 *
 * Etsy's API returns STATE, never HISTORY: a lifetime view count, a lifetime
 * sales total, today's relevance order. There is no historical endpoint and no
 * backfill, so a day nobody captured is a day gone for good. The extension sees
 * exactly what a shopper sees, which makes it the best (and for price and rank,
 * the only) honest source. Every request here is idempotent per UTC day, so the
 * same page viewed by ten users costs one row.
 *
 * Three streams, all optional in one call:
 *   items   - per-listing state (views, favorites, reviews, real price, rating,
 *             stock) plus stable attributes (shop, category, digital, created)
 *   shops   - shop totals, which power Competitor Sales velocity
 *   keyword + results - WHERE each listing ranked for a search term today, the
 *             one thing no Etsy endpoint can ever tell us after the fact
 *
 * Auth-gated so it cannot be scripted anonymously. Writes are fire-and-forget
 * where they are a side effect, and only fields actually observed are written -
 * a thin search-card observation never blanks out richer listing-page data.
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<{ captured: number; ranks: number }>>> {
  const user = await getCurrentUser().catch(() => null)
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  // This endpoint is only ever called by the extension, so record usage for the user.
  void recordExtensionUsage(req, user.id, true)

  const body = (await req.json().catch(() => ({}))) as {
    items?: unknown; shops?: unknown; keyword?: unknown; results?: unknown; market?: unknown
  }
  const items = Array.isArray(body.items) ? body.items : []
  const shopsIn = Array.isArray(body.shops) ? body.shops : []
  const ranksIn = Array.isArray(body.results) ? body.results : []
  const keyword = normalizeKeyword(body.keyword)

  if (!items.length && !shopsIn.length && !(keyword && ranksIn.length)) {
    return NextResponse.json({ success: false, error: 'Nothing to record' }, { status: 400 })
  }

  // `null` means "not observed" and must stay null. Number(null) and Number('')
  // are 0, so a bare Number() turned every unknown field the extension sent into
  // a real-looking 0: listing review counts were stored as 0 every day (which also
  // made measured velocity "0 sales"), and missing prices as $0.
  const toNum = (v: unknown): number => {
    if (v == null || typeof v === 'boolean') return NaN
    if (typeof v === 'string' && !v.trim()) return NaN
    return Number(v)
  }
  // Every numeric field here is a count or an amount, so negatives are malformed.
  const numOrNull = (v: unknown): number | null => {
    const n = toNum(v)
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  // A price of 0 is never a real Etsy price; it is a failed read.
  const priceOrNull = (v: unknown): number | null => {
    const n = toNum(v)
    return Number.isFinite(n) && n > 0 && n <= 1_000_000 ? n : null
  }
  // A bounded positive number, so a malformed or hostile payload cannot write a
  // nonsense figure into the shared research dataset.
  const boundedOrNull = (v: unknown, max: number): number | null => {
    const n = toNum(v)
    return Number.isFinite(n) && n >= 0 && n <= max ? n : null
  }
  const boolOrNull = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)
  const strOrNull = (v: unknown, max: number): string | null =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null

  // Shop-level rows (from listing pages' seller card + shop pages) feed ShopSnapshot,
  // which powers Competitor Sales velocity. Fire-and-forget, deduped per shop per day.
  const shops: ShopSnapshotInput[] = []
  for (const raw of shopsIn.slice(0, MAX_SHOPS)) {
    const r = raw as Record<string, unknown>
    const shopId = Number(r.shopId)
    if (!Number.isFinite(shopId) || shopId <= 0) continue
    shops.push({
      shopId,
      shopName: typeof r.shopName === 'string' ? r.shopName.slice(0, 120) : '',
      sales: numOrNull(r.sales),
      favorers: numOrNull(r.favorers),
      reviewCount: numOrNull(r.reviewCount),
      reviewAverage: numOrNull(r.reviewAverage),
      activeListings: numOrNull(r.activeListings),
    })
  }
  if (shops.length) recordShopSnapshots(shops)

  // Keyword rank rows. Captured before the listing pass so a search page's rank
  // history lands even if its listing payload is empty.
  let ranks = 0
  if (keyword && ranksIn.length) {
    const rows: ObservedRank[] = []
    for (const raw of ranksIn.slice(0, MAX_RANKS)) {
      const r = raw as Record<string, unknown>
      const listingId = Number(r.listingId)
      const position = Number(r.position)
      if (!Number.isFinite(listingId) || listingId <= 0) continue
      if (!Number.isFinite(position) || position <= 0 || position > 1000) continue
      rows.push({
        listingId,
        shopId: numOrNull(r.shopId),
        position: Math.round(position),
        page: boundedOrNull(r.page, 100) ?? 1,
        isAd: r.isAd === true,
      })
    }
    const m = (body.market ?? null) as Record<string, unknown> | null
    const market: ObservedKeywordMarket | undefined = m
      ? {
          totalResults: boundedOrNull(m.totalResults, 100_000_000),
          sampled: boundedOrNull(m.sampled, 1000),
          adCount: boundedOrNull(m.adCount, 1000),
          priceMin: priceOrNull(m.priceMin),
          priceMax: priceOrNull(m.priceMax),
          priceMedian: priceOrNull(m.priceMedian),
          currency: strOrNull(m.currency, 8),
        }
      : undefined
    if (rows.length || market) {
      recordSearchRanks(keyword, rows, market)
      ranks = rows.length
    }
  }

  if (!items.length) return NextResponse.json({ success: true, data: { captured: 0, ranks } })

  const clean: ObservedListing[] = []
  for (const raw of items.slice(0, MAX_ITEMS)) {
    const r = raw as Record<string, unknown>
    const listingId = Number(r.listingId)
    const shopId = Number(r.shopId)
    if (!Number.isFinite(listingId) || listingId <= 0) continue
    if (!Number.isFinite(shopId) || shopId <= 0) continue
    clean.push({
      listingId,
      shopId,
      title: typeof r.title === 'string' ? r.title.slice(0, 300) : undefined,
      tags: Array.isArray(r.tags)
        ? ((r.tags as unknown[]).filter(t => typeof t === 'string').slice(0, 13) as string[])
        : undefined,
      price: priceOrNull(r.price),
      currency: typeof r.currency === 'string' ? r.currency.slice(0, 8) : undefined,
      views: numOrNull(r.views),
      favorers: numOrNull(r.favorers),
      reviewCount: numOrNull(r.reviewCount),
      // Day-varying facts only the page can tell us.
      priceOriginal: priceOrNull(r.priceOriginal),
      onSale: boolOrNull(r.onSale),
      rating: boundedOrNull(r.rating, 5),
      quantity: boundedOrNull(r.quantity, 1_000_000),
      rank: boundedOrNull(r.rank, 1000),
      // Stable attributes, stored once per listing on TrackedListing.
      shopName: strOrNull(r.shopName, 120),
      categoryTop: strOrNull(r.categoryTop, 80),
      isDigital: boolOrNull(r.isDigital),
      createdTimestamp: boundedOrNull(r.createdTimestamp, 4_000_000_000),
    })
  }
  if (!clean.length) return NextResponse.json({ success: true, data: { captured: 0, ranks } })

  const captured = await recordObservedListings(clean)
  return NextResponse.json({ success: true, data: { captured, ranks } })
}
