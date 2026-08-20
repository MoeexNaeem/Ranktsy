import { NextRequest, NextResponse } from 'next/server'
import { getEtsyShop } from '@/lib/etsy'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

export interface ShopSummary {
  name: string; url: string; sales: number | null; reviewCount: number
  reviewAverage: number; activeListings: number; yearOpened: number | null
}

// Lightweight, cached shop-level stats for the listing-detail panel — real
// numbers (lifetime sales, reviews, rating, shop age) that give a single listing
// honest context, especially when its per-listing review count is low.
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<ShopSummary>>> {
  const name = new URL(req.url).searchParams.get('shop')?.trim()
  if (!name) return NextResponse.json({ success: false, error: 'Missing shop' }, { status: 400 })

  const key = cacheKey('shopsum', 'v1', name)
  const cached = memCache.get<ShopSummary>(key)
  if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

  try {
    const s = await getEtsyShop(name)
    const data: ShopSummary = {
      name: s.shop_name ?? name, url: s.url ?? '', sales: s.sales ?? null, reviewCount: s.review_count ?? 0,
      reviewAverage: s.review_average ?? 0, activeListings: s.listing_active_count ?? 0, yearOpened: s.yearOpened ?? null,
    }
    memCache.set(key, data, CACHE_TTL.SHOP)
    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: 'Shop not found' }, { status: 502 })
  }
}
