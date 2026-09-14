import { NextRequest, NextResponse } from 'next/server'
import { getEtsyShop, getShopListings, resolveShopId } from '@/lib/etsy'
import { getCurrentUser } from '@/lib/auth/session'
import { listConnectedShops } from '@/lib/etsy-tokens'
import { cachedFlight, cacheKey, CACHE_TTL } from '@/lib/cache'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('id')

  // If no shopId, default to the user's first connected shop.
  let resolvedId = shopId
  if (!resolvedId) {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    const shops = await listConnectedShops(user.id)
    if (!shops[0]) {
      return NextResponse.json({ success: false, error: 'No shop connected. Please link your Etsy shop.' }, { status: 400 })
    }
    resolvedId = shops[0].shopId
  }

  try {
    // Resolve a shop name (e.g. "silvercraft") to its numeric id once, so both
    // calls below reuse it instead of each hitting the findShops endpoint.
    const numericId = await resolveShopId(resolvedId)
    // Cache + coalesce on the numeric id: Shop Analytics, Competitor Sales and
    // Competitor Tags all pull the same shop, so many users viewing one popular
    // shop cost one pair of Etsy calls per 15 min, not one pair each.
    const key = cacheKey('etsyshop', 'v1', String(numericId))
    const data = await cachedFlight(key, CACHE_TTL.SHOP, async () => {
      const [shop, listings] = await Promise.all([
        getEtsyShop(numericId),
        getShopListings(numericId, 25),
      ])
      return { shop, listings }
    })
    return NextResponse.json({ success: true, data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Shop not found'
    return NextResponse.json({ success: false, error: msg }, { status: 502 })
  }
}
