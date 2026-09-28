/**
 * Simple in-process LRU-style cache used as fallback when Redis is unavailable.
 * In production, replace with @upstash/redis for distributed caching.
 */

import { singleFlight } from '@/lib/concurrency'

interface CacheEntry<T> {
  data: T
  expiresAt: number
  bytes: number   // approximate size, so the cache can be capped by memory, not count
}

/** Rough in-memory size of a value (JSON length ≈ bytes of payload). */
function approxBytes(v: unknown): number {
  if (typeof v === 'string') return v.length * 2
  try { return (JSON.stringify(v)?.length ?? 0) * 2 + 64 } catch { return 1024 }
}

/**
 * Per-process LRU cache capped by BOTH entry count and approximate bytes.
 *
 * It used to be capped by count alone (5,000). Entries include whole keyword
 * packages of a few hundred KB, so a worker's cache could grow past PM2's 700 MB
 * max_memory_restart: workers were killed and restarted over and over (14 in one
 * sitting), and every restart threw away the cache and made the next requests slow
 * and CPU-heavy. A byte budget keeps each worker well under that limit.
 */
class InMemoryCache {
  private store = new Map<string, CacheEntry<unknown>>()
  private bytes = 0

  constructor(private readonly maxSize: number, private readonly maxBytes: number) {}

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.drop(key)
      return null
    }
    // True LRU: a hit moves the entry to the newest end.
    this.store.delete(key)
    this.store.set(key, entry)
    return entry.data as T
  }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    const bytes = approxBytes(data)
    // One value bigger than a quarter of the budget would evict everything else: skip it.
    if (bytes > this.maxBytes / 4) return
    this.drop(key)
    this.store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000, bytes })
    this.bytes += bytes
    if (this.store.size > this.maxSize || this.bytes > this.maxBytes) this.evict()
  }

  /** Expired entries first, then least-recently-used, until back under both caps. */
  private evict(): void {
    const now = Date.now()
    for (const [k, e] of this.store) if (now > e.expiresAt) this.drop(k)
    for (const k of this.store.keys()) {
      if (this.store.size <= this.maxSize && this.bytes <= this.maxBytes) break
      this.drop(k)
    }
  }

  private drop(key: string): void {
    const e = this.store.get(key)
    if (!e) return
    this.bytes -= e.bytes
    this.store.delete(key)
  }

  delete(key: string): void {
    this.drop(key)
  }

  /** Drop every entry whose key starts with `prefix` (e.g. one user's reports after an edit). */
  deletePrefix(prefix: string): void {
    for (const k of [...this.store.keys()]) if (k.startsWith(prefix)) this.drop(k)
  }

  clear(): void {
    this.store.clear()
    this.bytes = 0
  }

  size(): number {
    return this.store.size
  }

  /** Approximate bytes held (for diagnostics). */
  sizeBytes(): number {
    return this.bytes
  }
}

// ONE cache per process. Next bundles this module into many route chunks, and a
// plain module-level `new` gave every chunk its own private cache (each with the
// full budget); pinning it on globalThis makes them all share one.
// Tunable: MEMCACHE_MAX_ENTRIES (default 5000) and MEMCACHE_MAX_MB (default 150).
const g = globalThis as typeof globalThis & { __rkMemCache?: InMemoryCache }
export const memCache: InMemoryCache = g.__rkMemCache ??= new InMemoryCache(
  Number(process.env.MEMCACHE_MAX_ENTRIES ?? 5000),
  Number(process.env.MEMCACHE_MAX_MB ?? 150) * 1024 * 1024,
)

// Cache TTLs (seconds)
//
// Etsy API Terms of Use (Section 1) caching policy:
//   • Listing content must NOT be displayed more than 6 hours older than Etsy.
//   • Any other Etsy content must NOT be displayed more than 24 hours older.
// All values below are kept safely UNDER those ceilings so cached data is always
// refreshed before it can breach Etsy's limits.
export const CACHE_TTL = {
  KEYWORD:  60 * 60 * 5,   // 5 h  - listing-derived data (Etsy limit: 6 h)
  TRENDING: 60 * 60 * 1,   // 1 h  - listing content (Etsy limit: 6 h)
  SHOP:     60 * 15,       // 15 m - shop + listing content (Etsy limit: 6 h)
} as const

export function cacheKey(...parts: string[]): string {
  return parts.join(':').toLowerCase().replace(/\s+/g, '_')
}

// ─── Cache + coalesce in one call ─────────────────────────────────────────────
// The single most valuable pattern for the raw Etsy passthrough routes (search,
// shop, reviews, sections, listing). Without it, N users viewing the SAME
// trending shop or niche each fire their own live Etsy calls - burning the daily
// key quota and making those tools slow. With it:
//   1. a fresh in-memory hit returns instantly (0 Etsy calls),
//   2. concurrent misses for the same key collapse onto ONE upstream fetch
//      (singleFlight), so a thundering herd costs one call, not N,
//   3. the result is cached for `ttlSeconds` (kept under Etsy's 6h/24h limits).
// Errors are never cached: `fn` only reaches `memCache.set` after it resolves,
// and singleFlight drops the in-flight entry when it rejects.
export async function cachedFlight<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const hit = memCache.get<T>(key)
  if (hit != null) return hit
  return singleFlight(key, async () => {
    const again = memCache.get<T>(key)   // a coalesced caller may have just filled it
    if (again != null) return again
    const data = await fn()
    if (data != null) memCache.set(key, data, ttlSeconds)   // don't cache null (e.g. not-found)
    return data
  })
}
