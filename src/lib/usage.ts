/**
 * Per-user API-usage tracking.
 *
 * Every Etsy request (etsyFetch / etsyAuthedFetch) and Google Ads request calls
 * recordEtsyCall() / recordGoogleCall(). Those attribute the call to the CURRENT
 * request's user via AsyncLocalStorage — set once per request by wrapping the
 * handler in runWithUsageContext() (see lib/track.ts). Counts are buffered in
 * memory and flushed to Mongo as a coalesced `$inc` at most every few seconds, so
 * a burst of API calls becomes one DB write per user/day (the cluster is slow, and
 * a write-per-call would be brutal). `$inc` is atomic, so multiple server
 * instances each flushing their own delta still sum correctly.
 *
 * One `apiusages` row per {day (UTC), userId}. `day` is the daily bucket, so the
 * numbers "reset" at 00:00 UTC simply because a new day writes a new row; history
 * is retained ~60 days (TTL on the model) so every user always has ≥7 days.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { connectDB } from '@/lib/db'
import { ApiUsage } from '@/lib/models'

export interface UsageCtx { userId: string; userEmail?: string }

const als = new AsyncLocalStorage<UsageCtx>()

/** Run `fn` with the given user attached, so any API calls inside it are attributed. */
export function runWithUsageContext<T>(ctx: UsageCtx, fn: () => T): T {
  return als.run(ctx, fn)
}

const current = (): UsageCtx => als.getStore() ?? { userId: 'anonymous' }
const dayKey = (d: Date = new Date()) => d.toISOString().slice(0, 10)

interface Bucket {
  day: string; userId: string; userEmail?: string
  etsy: number; google: number; searches: number; cacheHits: number; apiHits: number
  images: number; imageTokens: number; imageCostUsd: number   // Gemini image generation
}

const FLUSH_MS = 4000
const buffers = new Map<string, Bucket>()   // key: `${day}|${userId}`
let timer: ReturnType<typeof setTimeout> | null = null

function bucket(): Bucket {
  const { userId, userEmail } = current()
  const day = dayKey()
  const k = `${day}|${userId}`
  let b = buffers.get(k)
  if (!b) { b = { day, userId, userEmail, etsy: 0, google: 0, searches: 0, cacheHits: 0, apiHits: 0, images: 0, imageTokens: 0, imageCostUsd: 0 }; buffers.set(k, b) }
  else if (userEmail && !b.userEmail) b.userEmail = userEmail
  return b
}

function schedule() { if (!timer) timer = setTimeout(() => void flush(), FLUSH_MS) }

async function flush(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null }
  if (!buffers.size) return
  const pending = [...buffers.values()]
  buffers.clear()
  try {
    await connectDB()
    await Promise.all(pending.map(b => {
      const update: Record<string, unknown> = {
        $inc: { etsyCalls: b.etsy, googleCalls: b.google, searches: b.searches, cacheHits: b.cacheHits, apiHits: b.apiHits, imageCalls: b.images, imageTokens: b.imageTokens, imageCostUsd: b.imageCostUsd },
      }
      if (b.userEmail) update.$set = { userEmail: b.userEmail }
      return ApiUsage.updateOne({ day: b.day, userId: b.userId }, update, { upsert: true })
    }))
  } catch (e) {
    // Don't lose counts — fold them back for the next flush.
    for (const b of pending) {
      const k = `${b.day}|${b.userId}`
      const cur = buffers.get(k)
      if (!cur) { buffers.set(k, b); continue }
      cur.etsy += b.etsy; cur.google += b.google; cur.searches += b.searches; cur.cacheHits += b.cacheHits; cur.apiHits += b.apiHits
      cur.images += b.images; cur.imageTokens += b.imageTokens; cur.imageCostUsd += b.imageCostUsd
    }
    console.error('[Usage] flush failed:', e)
  }
}

export function recordEtsyCall(n = 1): void { bucket().etsy += n; schedule() }
export function recordGoogleCall(n = 1): void { bucket().google += n; schedule() }
export function recordSearch(n = 1): void { bucket().searches += n; schedule() }
export function recordCacheHit(n = 1): void { bucket().cacheHits += n; schedule() }
export function recordApiHit(n = 1): void { bucket().apiHits += n; schedule() }
/** Record a Gemini image generation: image count, token total, and USD cost. */
export function recordImage(images: number, tokens: number, costUsd: number): void {
  const b = bucket(); b.images += images; b.imageTokens += tokens; b.imageCostUsd += costUsd; schedule()
}

/** Etsy+Google calls attributed to the current request so far (for cache-vs-live detection). */
export function peekApiCalls(): number { const b = bucket(); return b.etsy + b.google }

export async function flushUsage(): Promise<void> { await flush() }
