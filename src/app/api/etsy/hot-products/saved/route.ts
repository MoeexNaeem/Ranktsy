import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { HotProductSave, ProductStat, TrackedListing } from '@/lib/models'
import { toProduct, type ProductLean } from '@/lib/product-db'
import { getListingById } from '@/lib/etsy'
import type { ApiResponse, SavedItem } from '@/types'

export const runtime = 'nodejs'

/**
 * A user's Find Hot Products lists: favorites, tracked products and saved filters.
 * Tracking also puts the listing on the tracking watchlist so the daily refresh
 * (lib/product-db.ts) measures it every day, even when nobody browses it.
 */

const MAX_PER_KIND = 300
type Kind = SavedItem['kind']
const KINDS: Kind[] = ['fav', 'track', 'filter']

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<SavedItem[]>>> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Sign in first' }, { status: 401 })
  const kind = req.nextUrl.searchParams.get('kind') as Kind | null
  await connectDB()
  const rows = await HotProductSave.find({ userId: user.id, ...(kind && KINDS.includes(kind) ? { kind } : {}) })
    .sort({ createdAt: -1 }).limit(MAX_PER_KIND * 3).lean<(SavedItem & { createdAt?: Date })[]>()
  // Products come back with their latest database row (7-day gains etc.).
  const ids = [...new Set(rows.map(r => r.listingId).filter((n): n is number => !!n))]
  const stats = ids.length && req.nextUrl.searchParams.get('expand') === '1'
    ? await ProductStat.find({ listingId: { $in: ids } }).lean<ProductLean[]>()
    : []
  const byId = new Map(stats.map(s => [s.listingId, toProduct(s)]))
  return NextResponse.json({
    success: true,
    data: rows.map(r => ({
      kind: r.kind, key: r.key, listingId: r.listingId, title: r.title, image: r.image ?? null, params: r.params,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
      ...(r.listingId ? { product: byId.get(r.listingId) ?? null } : {}),
    })),
  })
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<SavedItem>>> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Sign in first' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { kind?: Kind; listingId?: number; shopId?: number; title?: string; image?: string | null; name?: string; params?: string }
  const kind = body.kind
  if (!kind || !KINDS.includes(kind)) return NextResponse.json({ success: false, error: 'Unknown list' }, { status: 400 })
  await connectDB()
  if (await HotProductSave.countDocuments({ userId: user.id, kind }) >= MAX_PER_KIND) {
    return NextResponse.json({ success: false, error: `You can keep up to ${MAX_PER_KIND} here. Remove some first.` }, { status: 400 })
  }

  if (kind === 'filter') {
    const name = String(body.name ?? '').trim().slice(0, 60)
    const params = String(body.params ?? '').slice(0, 2000)
    if (!name) return NextResponse.json({ success: false, error: 'Name the filter' }, { status: 400 })
    await HotProductSave.updateOne({ userId: user.id, kind, key: name }, { $set: { params } }, { upsert: true })
    return NextResponse.json({ success: true, data: { kind, key: name, params } })
  }

  const listingId = Number(body.listingId)
  if (!Number.isFinite(listingId) || listingId <= 0) return NextResponse.json({ success: false, error: 'Missing listing' }, { status: 400 })
  let shopId = Number(body.shopId) || 0
  let title = String(body.title ?? '').slice(0, 300)
  let image = body.image ? String(body.image).slice(0, 500) : null
  if (!shopId || !title) {
    const stat = await ProductStat.findOne({ listingId }).select('shopId title img').lean<{ shopId?: number; title?: string; img?: string }>()
    shopId ||= stat?.shopId ?? 0
    title ||= stat?.title ?? ''
    image ||= stat?.img ?? null
  }
  if (kind === 'track' && !shopId) {
    const l = await getListingById(listingId).catch(() => null)
    if (!l) return NextResponse.json({ success: false, error: 'That listing is not active on Etsy.' }, { status: 404 })
    shopId = l.shop_id ?? 0
    title ||= l.title
    image ||= l.images?.[0]?.url_570xN ?? null
  }
  await HotProductSave.updateOne(
    { userId: user.id, kind, key: String(listingId) },
    { $set: { listingId, ...(shopId ? { shopId } : {}), title, image } },
    { upsert: true },
  )
  if (kind === 'track' && shopId) {
    // On the watchlist: the daily refresh and the product database include it.
    await TrackedListing.updateOne(
      { listingId },
      { $set: { lastSeenAt: new Date() }, $setOnInsert: { listingId, shopId, title, firstSeenAt: new Date() } },
      { upsert: true },
    ).catch(() => {})
  }
  return NextResponse.json({ success: true, data: { kind, key: String(listingId), listingId, title, image } })
}

export async function DELETE(req: NextRequest): Promise<NextResponse<ApiResponse<null>>> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Sign in first' }, { status: 401 })
  const kind = req.nextUrl.searchParams.get('kind') as Kind | null
  const key = req.nextUrl.searchParams.get('key') ?? ''
  if (!kind || !KINDS.includes(kind) || !key) return NextResponse.json({ success: false, error: 'Missing item' }, { status: 400 })
  await connectDB()
  await HotProductSave.deleteOne({ userId: user.id, kind, key })
  return NextResponse.json({ success: true, data: null })
}
