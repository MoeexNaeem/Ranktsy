import { NextRequest, NextResponse } from 'next/server'
import { getEtsyShop, getShopListings, resolveShopId } from '@/lib/etsy'
import { getCurrentUser } from '@/lib/auth/session'
import { listConnectedShops } from '@/lib/etsy-tokens'
import { cachedFlight, cacheKey, CACHE_TTL } from '@/lib/cache'
import { withUsage } from '@/lib/track'
import { upstreamFailure } from '@/lib/upstream-errors'

async function handleGET(req: NextRequest) {
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
    // A shop that genuinely doesn't exist is a 404 with a clear message; Etsy being
    // busy / out of quota / this user's daily budget is NOT "shop not found" (users
    // were told their real shop didn't exist during the quota outage).
    const raw = err instanceof Error ? err.message : ''
    if (/No Etsy shop found matching/i.test(raw)) {
      return NextResponse.json({ success: false, error: 'Shop not found. Check the shop name or paste the shop URL from Etsy.' }, { status: 404 })
    }
    const fail = upstreamFailure(err, 'Shop not found. Check the shop name or paste the shop URL from Etsy.')
    return NextResponse.json({ success: false, error: fail.message }, { status: fail.status })
  }
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const GET = withUsage(handleGET)
