import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ListingSnapshot, ProductStat } from '@/lib/models'
import { historyRead, HistoryBusyError, HISTORY_MAX_MS, daysAgoKey } from '@/lib/snapshots'
import { listingSeries, toProduct, type HistoryRow, type ProductLean, type ProductItemData } from '@/lib/product-db'
import { buildEvents } from '@/lib/rank-explain'
import { cachedFlight, cacheKey } from '@/lib/cache'
import { withUsage } from '@/lib/track'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

const FIELDS = 'day title tags price currency views favorers reviewCount priceOriginal onSale rating quantity bestRank listPrice listCurrency modTs endTs freeShipping hasVideo imageCount badges -_id'

/**
 * One product's tracked history for the Find Hot Products detail page: its row in
 * the product database (7/30-day gains), its daily series (views, favorites,
 * reviews, price, stock, best search rank) and the changes we recorded. Read-only,
 * one indexed read of one listing, cached 30 minutes. Not metered: it is the
 * detail view of a product the user already found.
 */
async function handleGET(req: NextRequest): Promise<NextResponse<ApiResponse<ProductItemData>>> {
  const sp = req.nextUrl.searchParams
  const id = Number(sp.get('id'))
  const days = sp.get('days') === '30' ? 30 : 90
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ success: false, error: 'Missing listing id' }, { status: 400 })
  try {
    const data = await cachedFlight(cacheKey('hotitem', 'v1', String(id), String(days)), 1800, async (): Promise<ProductItemData> => {
      await connectDB()
      const since = daysAgoKey(days)
      const [rows, stat] = await Promise.all([
        historyRead(() => ListingSnapshot.find({ listingId: id, day: { $gte: since } })
          .sort({ day: 1 }).select(FIELDS).maxTimeMS(HISTORY_MAX_MS).lean<HistoryRow[]>()),
        ProductStat.findOne({ listingId: id }).lean<ProductLean>(),
      ])
      // An empty keyword: the title / tag events are listed without keyword-fit notes.
      const { events } = buildEvents('', rows as never, undefined, undefined, since)
      return {
        stat: stat ? toProduct(stat) : null,
        days,
        series: listingSeries(rows),
        events,
        trackedSince: rows[0]?.day ?? null,
      }
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    if (e instanceof HistoryBusyError) {
      return NextResponse.json({ success: false, error: 'Product history is busy right now, try again in a minute.' }, { status: 503 })
    }
    console.error('[Hot Products item] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not load this product\'s history.' }, { status: 502 })
  }
}

export const GET = withUsage(handleGET)
