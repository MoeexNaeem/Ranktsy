import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ProductStat } from '@/lib/models'
import { lastRollup, toProduct, type ProductLean as Lean } from '@/lib/product-db'
import { getListingById, etsyQuotaLow } from '@/lib/etsy'
import { guardSearch } from '@/lib/searchGate'
import { meterSearch } from '@/lib/credit-gate'
import { memCache } from '@/lib/cache'
import { withUsage } from '@/lib/track'
import type { ApiResponse, DbProduct, DbProductsResponse } from '@/types'

export const runtime = 'nodejs'

/**
 * Find Hot Products, browse mode: the product database (see lib/product-db.ts).
 *
 * Filters and sorts the daily-built `productstats` table, every sort backed by an
 * index. Gains are MEASURED from our own daily tracking; sales are measured from
 * stock drops where we have them, else a labelled review-based estimate.
 * Only the shown page is enriched from Etsy (photo + tags, one batched call,
 * cached), and the photo is saved back so the next viewer costs nothing.
 */

const PAGE_SIZE = 50
const CAP = 5000

const SORTS: Record<string, Record<string, 1 | -1>> = {
  sales7: { sales7: -1 }, rev7: { rev7: -1 }, f7: { f7: -1 }, v7: { v7: -1 }, r7: { r7: -1 },
  sales30: { sales30: -1 }, f30: { f30: -1 },
  newest: { created: -1 }, favs: { favs: -1 }, views: { views: -1 }, reviews: { reviews: -1 },
  hot: { hot: -1 }, price_low: { priceUsd: 1 }, price_high: { priceUsd: -1 },
}
// Range filters: ?rng_<field>=min~max (either side optional).
const RANGE_FIELDS = new Set(['priceUsd', 'favs', 'f7', 'reviews', 'r7', 'views', 'v7', 'sales7', 'sales30', 'salesTotal', 'rev7', 'rev30'])
const LABELS: Record<string, RegExp> = {
  bestseller: /^bestseller$/i,
  pick: /etsy.s pick/i,
  popular: /^popular now$/i,
  starseller: /^star seller$/i,
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const num = (v: string | undefined) => (v != null && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null)

/** A pasted listing URL / id or shop URL, instead of words. */
function parseLookup(q: string): { listingId?: number; shop?: string } {
  const lm = q.match(/etsy\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?listing\/(\d{5,})/i) ?? q.match(/^\s*(\d{6,})\s*$/)
  if (lm) return { listingId: Number(lm[1]) }
  const sm = q.match(/etsy\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?shop\/([A-Za-z0-9]+)/i) ?? q.match(/^([A-Za-z0-9]+)\.etsy\.com/i)
  if (sm) return { shop: sm[1] }
  return {}
}

function buildFilter(sp: URLSearchParams): { filter: Record<string, unknown>; text: boolean; keyParts: Record<string, string> } {
  const and: Record<string, unknown>[] = []
  const keyParts: Record<string, string> = {}
  const q = (sp.get('q') ?? '').trim().slice(0, 200)
  let text = false
  if (q) {
    keyParts.q = q.toLowerCase()
    const look = parseLookup(q)
    if (look.listingId) and.push({ listingId: look.listingId })
    else if (look.shop) and.push({ shopName: new RegExp(`^${esc(look.shop)}$`, 'i') })
    else {
      // Every word must appear (quoted terms are ANDed by Mongo's text search).
      const words = q.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/).filter(w => w.length > 1).slice(0, 8)
      if (words.length) { and.push({ $text: { $search: words.map(w => `"${w}"`).join(' ') } }); text = true }
    }
  }
  const ex = (sp.get('ex') ?? '').split(/[,\n]/).map(s => s.trim().toLowerCase()).filter(Boolean).slice(0, 15)
  if (ex.length) { and.push({ title: { $not: new RegExp(ex.map(esc).join('|'), 'i') } }); keyParts.ex = ex.join(',') }

  const cat = sp.get('cat')
  if (cat) { and.push({ cat }); keyParts.cat = cat }

  const types = (sp.get('type') ?? '').split(',').filter(Boolean)
  if (types.length) {
    const or: Record<string, unknown>[] = []
    if (types.includes('digital')) or.push({ digital: true })
    if (types.includes('physical')) or.push({ digital: false })
    if (types.includes('personal')) or.push({ personal: true })
    if (or.length) and.push(or.length === 1 ? or[0] : { $or: or })
    keyParts.type = types.sort().join(',')
  }

  const labels = (sp.get('labels') ?? '').split(',').filter(l => LABELS[l])
  for (const l of labels) and.push({ badges: LABELS[l] })
  if (sp.get('freeShip') === '1') and.push({ freeShip: true })
  if (sp.get('onSale') === '1') and.push({ onSale: true })
  if (labels.length) keyParts.labels = labels.sort().join(',')

  const rel = num(sp.get('release') ?? undefined)
  const from = sp.get('from'), to = sp.get('to')
  if (rel && rel > 0) and.push({ created: { $gte: Math.floor(Date.now() / 1000) - rel * 86_400 } })
  else if (from || to) {
    const c: Record<string, number> = {}
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) c.$gte = Math.floor(Date.parse(from + 'T00:00:00Z') / 1000)
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) c.$lte = Math.floor(Date.parse(to + 'T23:59:59Z') / 1000)
    if (Object.keys(c).length) and.push({ created: c })
  }

  for (const [k, v] of sp.entries()) {
    if (!k.startsWith('rng_')) continue
    const field = k.slice(4)
    if (!RANGE_FIELDS.has(field)) continue
    const [lo, hi] = v.split('~')
    const c: Record<string, number> = {}
    const l = num(lo), h = num(hi)
    if (l != null) c.$gte = l
    if (h != null) c.$lte = h
    if (Object.keys(c).length) { and.push({ [field]: c }); keyParts[k] = v }
  }
  return { filter: and.length ? { $and: and } : {}, text, keyParts }
}

/** Photo + tags for rows that have none yet: one batched, cached Etsy call; saved back. */
async function hydrate(rows: DbProduct[]): Promise<void> {
  const need = rows.filter(r => !r.image)
  if (!need.length || etsyQuotaLow()) return
  const got = await Promise.all(need.map(r => getListingById(r.listingId).catch(() => null)))
  const save: { updateOne: { filter: { listingId: number }; update: { $set: Record<string, unknown> } } }[] = []
  need.forEach((r, i) => {
    const l = got[i]
    if (!l) return
    const img = l.images?.[0]?.url_570xN || null
    if (img) r.image = img
    if (l.tags?.length) r.tags = l.tags
    if (!r.title && l.title) r.title = l.title
    if (img || l.tags?.length) save.push({ updateOne: { filter: { listingId: r.listingId }, update: { $set: { ...(img ? { img } : {}), ...(l.tags?.length ? { tags: l.tags } : {}) } } } })
  })
  if (save.length) await ProductStat.bulkWrite(save, { ordered: false }).catch(() => {})
}

/** Distinct categories (for the filter), cached an hour. */
async function categories(): Promise<string[]> {
  const hit = memCache.get<string[]>('productdb:cats')
  if (hit) return hit
  const cats = (await ProductStat.distinct('cat').catch(() => []) as (string | null)[]).filter((c): c is string => !!c).sort()
  memCache.set('productdb:cats', cats, 3600)
  return cats
}

async function handleGET(req: NextRequest): Promise<NextResponse<ApiResponse<DbProductsResponse>>> {
  const sp = req.nextUrl.searchParams
  const sortKey = SORTS[sp.get('sort') ?? ''] ? sp.get('sort')! : 'sales7'
  const page = Math.min(Math.max(1, Number(sp.get('page')) || 1), CAP / PAGE_SIZE)
  const { filter, text, keyParts } = buildFilter(sp)

  // A browse is a search: same human check, and 1 credit per distinct search
  // phrase per day. Filters, sort and paging are free refinements of it (they
  // only read our own table), so trying filters never burns credits.
  const gate = await guardSearch<DbProductsResponse>(req)
  if (gate) return gate
  const meter = await meterSearch(req, 'hotproducts', 'db|' + JSON.stringify({ q: keyParts.q ?? '', ex: keyParts.ex ?? '' }))
  if (meter.deny) return meter.deny as NextResponse<ApiResponse<DbProductsResponse>>

  try {
    await connectDB()
    const sort = SORTS[sortKey]
    // Rows with no value for the sorted field go last on a descending sort anyway;
    // on price ascending they would come first, so leave them out there.
    const f = sortKey === 'price_low' ? { $and: [filter, { priceUsd: { $ne: null } }] } : filter
    const hasFilter = Object.keys(filter).length > 0
    const [rows, total, dbSize, last, cats] = await Promise.all([
      ProductStat.find(f).sort({ ...sort, listingId: 1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE)
        .lean<Lean[]>().maxTimeMS(text ? 20_000 : 10_000),
      hasFilter ? ProductStat.countDocuments(f, { limit: CAP }).maxTimeMS(10_000).catch(() => CAP) : ProductStat.estimatedDocumentCount(),
      ProductStat.estimatedDocumentCount(),
      lastRollup(),
      sp.get('meta') === '1' ? categories() : Promise.resolve(undefined),
    ])
    const products = rows.map(toProduct)
    await hydrate(products)
    const state = products.length ? await meter.commit() : undefined
    return NextResponse.json({
      success: true,
      data: { products, total, cap: CAP, page, pageSize: PAGE_SIZE, dbSize, updatedAt: last?.at ?? null, ...(cats ? { categories: cats } : {}) },
      ...(state ? { state } : {}),
    })
  } catch (e) {
    console.error('[Hot Products DB] query failed:', e)
    return NextResponse.json({ success: false, error: 'The product database is busy. Try again in a moment.' }, { status: 503 })
  }
}

export const GET = withUsage(handleGET)
