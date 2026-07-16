import { NextRequest, NextResponse } from 'next/server'
import { resolveShopId, getEtsyShop } from '@/lib/etsy'
import { getShopVelocity } from '@/lib/snapshots'
import type { ApiResponse, ShopVelocity } from '@/types'

export const runtime = 'nodejs'

/**
 * Sales velocity for a shop, derived from OUR snapshot history.
 *
 * Etsy publishes a lifetime total and no series, so "sold yesterday" only exists
 * if we captured the shop yesterday. A brand-new shop returns `days: 1` with
 * every delta null — the UI must say "tracking started today" rather than imply
 * a real zero.
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<ShopVelocity>>> {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('shop')?.trim()
  const days = Math.min(Math.max(Number(searchParams.get('days') ?? 90), 7), 400)

  if (!q) return NextResponse.json({ success: false, error: 'shop is required' }, { status: 400 })

  try {
    const shopId = await resolveShopId(q)

    // Reading the shop captures today's row, so a first-ever request still
    // returns a valid (single-point) series instead of a bare 404.
    const shop = await getEtsyShop(shopId)
    const velocity = await getShopVelocity(shopId, days)

    if (!velocity) {
      return NextResponse.json({
        success: true,
        data: {
          shopId, shopName: shop.shop_name, trackedSince: null, days: 0, points: [],
          soldYesterday: null, soldLast7: null, soldLast30: null, avgPerDay: null,
          latestSales: shop.sales ?? null,
        },
      })
    }
    return NextResponse.json({ success: true, data: velocity })
  } catch (e) {
    console.error('[Velocity] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not resolve that shop on Etsy.' }, { status: 502 })
  }
}
