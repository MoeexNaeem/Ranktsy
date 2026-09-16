/**
 * Simple in-process LRU-style cache used as fallback when Redis is unavailable.
 * In production, replace with @upstash/redis for distributed caching.
 */

import { singleFlight } from '@/lib/concurrency'

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class InMemoryCache {
  private store = new Map<string, CacheEntry<unknown>>()
  private readonly maxSize: number

  constructor(maxSize = 500) {
    this.maxSize = maxSize
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.data as T
  }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    // Evict oldest entry if at capacity
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value
      if (firstKey) this.store.delete(firstKey)
    }
    this.store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 })
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  /** Drop every entry whose key starts with `prefix` (e.g. one user's reports after an edit). */
  deletePrefix(prefix: string): void {
    for (const k of [...this.store.keys()]) if (k.startsWith(prefix)) this.store.delete(k)
  }

  clear(): void {
    this.store.clear()
  }

  size(): number {
    return this.store.size
  }
}

// Singleton cache instance (shared across API route invocations in the same process).
// Sized generously: each entry is small, and a bigger cache means fewer repeat
// Etsy/Google calls when many users research overlapping keywords under load.
// Tunable via MEMCACHE_MAX_ENTRIES.
export const memCache = new InMemoryCache(Number(process.env.MEMCACHE_MAX_ENTRIES ?? 5000))

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
