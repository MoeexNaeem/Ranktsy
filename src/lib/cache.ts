/**
 * Simple in-process LRU-style cache used as fallback when Redis is unavailable.
 * In production, replace with @upstash/redis for distributed caching.
 */

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

  clear(): void {
    this.store.clear()
  }

  size(): number {
    return this.store.size
  }
}

// Singleton cache instance (shared across API route invocations in the same process)
export const memCache = new InMemoryCache(500)

// Cache TTLs (seconds)
//
// Etsy API Terms of Use (Section 1) caching policy:
//   • Listing content must NOT be displayed more than 6 hours older than Etsy.
//   • Any other Etsy content must NOT be displayed more than 24 hours older.
// All values below are kept safely UNDER those ceilings so cached data is always
// refreshed before it can breach Etsy's limits.
export const CACHE_TTL = {
  KEYWORD:  60 * 60 * 5,   // 5 h  — listing-derived data (Etsy limit: 6 h)
  TRENDING: 60 * 60 * 1,   // 1 h  — listing content (Etsy limit: 6 h)
  SHOP:     60 * 15,       // 15 m — shop + listing content (Etsy limit: 6 h)
} as const

export function cacheKey(...parts: string[]): string {
  return parts.join(':').toLowerCase().replace(/\s+/g, '_')
}
