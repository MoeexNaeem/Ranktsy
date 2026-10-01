import { NextRequest, NextResponse } from 'next/server'
import { requireAutomationUser } from '@/lib/automation/guard'
import { getValidEtsyAuth } from '@/lib/etsy-tokens'
import { getShopListingOptions } from '@/lib/etsy'
import { withUsage } from '@/lib/track'

// Shipping profiles, processing profiles, return policies and sections of one
// connected shop, for the builder's Delivery node.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handleGET(req: NextRequest) {
  const { error, user } = await requireAutomationUser()
  if (error || !user) return error

  const shopId = req.nextUrl.searchParams.get('shopId') || undefined
  const auth = await getValidEtsyAuth(user.id, shopId)
  if (!auth) return NextResponse.json({ success: false, error: 'Connect this shop in My Shop first.' }, { status: 400 })
  const data = await getShopListingOptions(auth.accessToken, auth.shopId)
  return NextResponse.json({ success: true, data })
}

export const GET = withUsage(handleGET)
