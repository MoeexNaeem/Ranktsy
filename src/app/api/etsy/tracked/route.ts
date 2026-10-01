import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { TrackedShop } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { resolveShopId, getEtsyShop } from '@/lib/etsy'
import type { ApiResponse } from '@/types'
import { withUsage } from '@/lib/track'

export const runtime = 'nodejs'

/**
 * Shops a user has asked us to track daily. Tracking is what guarantees an
 * unbroken sales history for a competitor - opportunistic capture only covers
 * shops someone happens to look at.
 */
async function handleGET(): Promise<NextResponse<ApiResponse<unknown>>> {
  const user = await getCurrentUser().catch(() => null)
  if (!user) return NextResponse.json({ success: false, error: 'Sign in to track shops' }, { status: 401 })
  try {
    await connectDB()
    const rows = await TrackedShop.find({ userId: user.id }).sort({ createdAt: -1 }).lean()
    return NextResponse.json({ success: true, data: rows.map(r => ({ shopId: r.shopId, shopName: r.shopName })) })
  } catch (e) {
    console.error('[Tracked] list failed:', e)
    return NextResponse.json({ success: false, error: 'Could not load tracked shops' }, { status: 500 })
  }
}

async function handlePOST(req: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  const user = await getCurrentUser().catch(() => null)
  if (!user) return NextResponse.json({ success: false, error: 'Sign in to track shops' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { shop?: string }
  const q = body.shop?.trim()
  if (!q) return NextResponse.json({ success: false, error: 'shop is required' }, { status: 400 })

  try {
    const shopId = await resolveShopId(q)
    const shop = await getEtsyShop(shopId)   // validates it exists + captures day one immediately
    await connectDB()
    await TrackedShop.updateOne(
      { userId: user.id, shopId },
      { $set: { shopName: shop.shop_name }, $setOnInsert: { userId: user.id, shopId } },
      { upsert: true },
    )
    return NextResponse.json({ success: true, data: { shopId, shopName: shop.shop_name, sales: shop.sales } })
  } catch (e) {
    console.error('[Tracked] add failed:', e)
    return NextResponse.json({ success: false, error: 'Could not find that shop on Etsy.' }, { status: 502 })
  }
}

async function handleDELETE(req: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  const user = await getCurrentUser().catch(() => null)
  if (!user) return NextResponse.json({ success: false, error: 'Sign in to track shops' }, { status: 401 })

  const shopId = Number(new URL(req.url).searchParams.get('shopId'))
  if (!shopId) return NextResponse.json({ success: false, error: 'shopId is required' }, { status: 400 })

  try {
    await connectDB()
    await TrackedShop.deleteOne({ userId: user.id, shopId })
    // Snapshots are deliberately kept: history is expensive to gather and
    // impossible to backfill, so untracking must not destroy it.
    return NextResponse.json({ success: true, data: { shopId } })
  } catch (e) {
    console.error('[Tracked] delete failed:', e)
    return NextResponse.json({ success: false, error: 'Could not untrack that shop' }, { status: 500 })
  }
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const GET = withUsage(handleGET)
export const POST = withUsage(handlePOST)
export const DELETE = withUsage(handleDELETE)
