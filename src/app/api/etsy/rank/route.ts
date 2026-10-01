import { NextRequest, NextResponse } from 'next/server'
import { checkKeywordRank, resolveShopId } from '@/lib/etsy'
import { upstreamFailure } from '@/lib/upstream-errors'
import { withUsage } from '@/lib/track'

async function handleGET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const shop = searchParams.get('shop')?.trim()
  if (!q || !shop) return NextResponse.json({ success: false, error: 'Missing keyword or shop' }, { status: 400 })

  try {
    const shopId = await resolveShopId(shop)
    const { scanned, totalResults, matches } = await checkKeywordRank(q, shopId)
    return NextResponse.json({ success: true, data: { keyword: q, shopId, scanned, totalResults, matches } })
  } catch (err: unknown) {
    const fail = upstreamFailure(err)
    return NextResponse.json({ success: false, error: fail.message }, { status: fail.status })
  }
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const GET = withUsage(handleGET)
