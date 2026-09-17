/**
 * Shared Etsy response cache: in-process memCache first, then MongoDB (EtsyCache).
 *
 * Why: each Etsy app key allows only ~10,000 requests per DAY. The per-worker
 * memCache means N PM2 workers can each fetch the same listing, and every deploy
 * throws the cache away, so the same popular listings were re-fetched all day. A
 * shared layer makes one fetch serve every worker, every user and every restart,
 * which is the difference between staying inside the daily quota and running out.
 *
 * TTLs must stay inside Etsy's caching policy (listing content up to 6 hours).
 */
import { connectDB } from '@/lib/db'
import { EtsyCache } from '@/lib/models'
import { memCache } from '@/lib/cache'

/** Read one cached value (memory first, then Mongo). `undefined` = not cached. */
export async function etsyCacheGet<T>(key: string): Promise<T | undefined> {
  const hit = memCache.get<T>(`etsyc:${key}`)
  if (hit !== null && hit !== undefined) return hit
  try {
    await connectDB()
    const doc = await EtsyCache.findOne({ key, expiresAt: { $gt: new Date() } }).lean<{ data: T } | null>()
    if (!doc) return undefined
    memCache.set(`etsyc:${key}`, doc.data, 300)   // short local copy; Mongo holds the real TTL
    return doc.data
  } catch { return undefined }
}

/** Read many keys at once (one Mongo round-trip for the misses). */
export async function etsyCacheGetMany<T>(keys: string[]): Promise<Map<string, T>> {
  const out = new Map<string, T>()
  const missing: string[] = []
  for (const k of keys) {
    const hit = memCache.get<T>(`etsyc:${k}`)
    if (hit !== null && hit !== undefined) out.set(k, hit); else missing.push(k)
  }
  if (!missing.length) return out
  try {
    await connectDB()
    const docs = await EtsyCache.find({ key: { $in: missing }, expiresAt: { $gt: new Date() } }).lean<{ key: string; data: T }[]>()
    for (const d of docs) {
      out.set(d.key, d.data)
      memCache.set(`etsyc:${d.key}`, d.data, 300)
    }
  } catch { /* DB blip: treat as a miss */ }
  return out
}

/** Store a value for `ttlSeconds` (best effort, never throws into the caller). */
export function etsyCacheSet<T>(key: string, data: T, ttlSeconds: number): void {
  memCache.set(`etsyc:${key}`, data, Math.min(ttlSeconds, 300))
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
  connectDB()
    .then(() => EtsyCache.updateOne({ key }, { $set: { data, expiresAt } }, { upsert: true }))
    .catch(() => {})
}

/** Store many values with the same TTL. */
export function etsyCacheSetMany<T>(entries: { key: string; data: T }[], ttlSeconds: number): void {
  if (!entries.length) return
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
  for (const e of entries) memCache.set(`etsyc:${e.key}`, e.data, Math.min(ttlSeconds, 300))
  connectDB()
    .then(() => EtsyCache.bulkWrite(entries.map(e => ({
      updateOne: { filter: { key: e.key }, update: { $set: { data: e.data, expiresAt } }, upsert: true },
    })), { ordered: false }))
    .catch(() => {})
}
