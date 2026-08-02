/**
 * Read-only access to the shared `collectivekeyworddatas` store.
 *
 * That collection is written PERMANENTLY by Ranktsy's Bulk Keyword Search — a full
 * package per keyword: core stats, related keywords WITH competition/KD/Google,
 * top listings WITH images, and a review count on every listing. Rankkw's single
 * Keyword Search reads it here: if a keyword is present it's served straight from
 * the DB (zero Etsy/Google calls); otherwise the caller falls back to live APIs.
 *
 * An in-memory layer sits in front so repeats within a process skip the (slow)
 * Mongo round-trip.
 */
import { connectDB } from '@/lib/db'
import { CollectiveKeywordData } from '@/lib/models'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import type { KeywordSearchResponse } from '@/types'

const memKey = (kw: string, geo: string) => cacheKey('collread', 'v1', geo, kw)

/** The saved package for {keyword, geo}, or null if it isn't in the shared store. */
export async function getCollectivePackage(keyword: string, geo = 'US'): Promise<KeywordSearchResponse | null> {
  const kw = keyword.trim().toLowerCase()

  const mem = memCache.get<KeywordSearchResponse>(memKey(kw, geo))
  if (mem) return mem

  try {
    await connectDB()
    const hit = await CollectiveKeywordData.findOne({ keyword: kw, geo }).lean()
    const data = hit?.data as KeywordSearchResponse | undefined
    if (data && data.stats && data.stats.totalResults != null) {
      memCache.set(memKey(kw, geo), data, CACHE_TTL.KEYWORD)
      return data
    }
  } catch (e) {
    console.error('[CollectiveRead] lookup failed:', e)
  }
  return null
}

/** True when a package's related keywords already carry their enrichment. */
export function isRelatedEnriched(data: KeywordSearchResponse): boolean {
  return (data.related ?? []).some(r => r.competition != null)
}
