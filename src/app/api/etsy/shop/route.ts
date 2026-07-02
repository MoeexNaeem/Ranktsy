import { NextRequest, NextResponse } from 'next/server'
import { getEtsyShop, getShopListings, resolveShopId } from '@/lib/etsy'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('id')

  // If no shopId, use authenticated user's shop
  let resolvedId = shopId
  if (!resolvedId) {
    const user = await getCurrentUser()
    if (!user?.etsyShopId) {
      return NextResponse.json({ success: false, error: 'No shop connected. Please link your Etsy shop.' }, { status: 400 })
    }
    resolvedId = user.etsyShopId
  }

  try {
    // Resolve a shop name (e.g. "silvercraft") to its numeric id once, so both
    // calls below reuse it instead of each hitting the findShops endpoint.
    const numericId = await resolveShopId(resolvedId)
    const [shop, listings] = await Promise.all([
      getEtsyShop(numericId),
      getShopListings(numericId, 25),
    ])
    return NextResponse.json({ success: true, data: { shop, listings } })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Shop not found'
    return NextResponse.json({ success: false, error: msg }, { status: 502 })
  }
}
