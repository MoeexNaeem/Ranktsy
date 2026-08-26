import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { recordObservedListings, type ObservedListing } from '@/lib/snapshots'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

const MAX_ITEMS = 120

/**
 * Crowd-sourced snapshot capture. The rankkw extension POSTs the listings a user
 * is looking at on Etsy - {listingId, shopId, views, favorers, reviewCount, price} -
 * and we record one snapshot per listing per UTC day. As the user base browses,
 * this quietly builds the per-listing history that powers real sales velocity
 * (see getListingVelocity). Auth-gated so it can't be scripted anonymously; the
 * capture itself is deduped per day and only writes the fields actually observed.
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<{ captured: number }>>> {
  const user = await getCurrentUser().catch(() => null)
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { items?: unknown }
  const items = Array.isArray(body.items) ? body.items : []
  if (!items.length) return NextResponse.json({ success: false, error: 'No items supplied' }, { status: 400 })

  const numOrNull = (v: unknown): number | null => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

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
      price: numOrNull(r.price),
      currency: typeof r.currency === 'string' ? r.currency.slice(0, 8) : undefined,
      views: numOrNull(r.views),
      favorers: numOrNull(r.favorers),
      reviewCount: numOrNull(r.reviewCount),
    })
  }
  if (!clean.length) return NextResponse.json({ success: false, error: 'No valid items' }, { status: 400 })

  const captured = await recordObservedListings(clean)
  return NextResponse.json({ success: true, data: { captured } })
}
