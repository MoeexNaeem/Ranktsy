/**
 * Keyword pipeline, split by cost.
 *
 * One cold keyword needs ~33 Etsy calls, and the shared rate gate (8/sec) means
 * that's ~13s wall-clock. Only THREE of those calls are needed to render the
 * page — the base search, its image batch, and the taxonomy lookup. The other
 * ~30 are enrichment: a live search per related keyword, plus the near-match
 * variants.
 *
 * So the work is split into three independently-cached stages that the client
 * requests in parallel:
 *
 *   core     ~1–2s   stats, listings, analysis, related keywords (competition null)
 *   related  ~4s     the same related keywords with their real competition probed
 *   near     ~1s     morphological variants, each measured
 *
 * The page paints as soon as `core` lands and fills in as the rest arrive,
 * instead of showing a spinner for 13 seconds.
 */
import { connectDB } from '@/lib/db'
import { KeywordCache } from '@/lib/models'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { searchEtsyListingsPaged, buildKeywordStats, buildSearchAnalysis, warmTaxonomy } from '@/lib/etsy'
import { googleKeywordMetrics, isGoogleAdsConfigured } from '@/lib/google-ads'
import type { KeywordSearchResponse } from '@/types'

// v8: pipeline split into core/related/near. Bump when the CORE shape changes.
export const KEYWORD_VERSION = 'v8'

export function coreKey(query: string) { return cacheKey('keyword', KEYWORD_VERSION, 'core', query) }
export function relatedKey(query: string) { return cacheKey('keyword', KEYWORD_VERSION, 'related', query) }
export function nearKey(query: string) { return cacheKey('keyword', KEYWORD_VERSION, 'near', query) }

/**
 * The Mongo cache is keyed on the keyword alone, not the version — so this
 * predicate is the only thing retiring documents written under an older shape.
 * Every field added to the core response needs a probe here.
 */
function isStaleCore(d?: KeywordSearchResponse): boolean {
  if (!d) return true
  return (
    d.stats?.difficulty == null ||
    d.stats?.totalResults == null ||
    d.analysis == null ||
    d.analysis.priceSample == null ||
    d.analysis.ages == null ||
    // Cached before the taxonomy was warm, so its categories are empty only
    // because the names hadn't loaded. Without this it would serve "loading
    // categories" forever, long after the taxonomy became available.
    d.analysis.categoriesPending === true ||
    // Pre-v7 docs carry the fabricated shape (avgSearches / sine-wave trends).
    d.stats.avgViews == null ||
    d.stats.favPerView == null ||
    d.related.some(r => r.listingsByMonth == null || r.avgViews === undefined) ||
    (isGoogleAdsConfigured() && d.stats?.googleSearches == null)
  )
}

/**
 * Fast path: everything the page needs to paint. ~3 Etsy calls.
 *
 * `related` comes back with `competition: null` — that's honest, not lazy: a
 * 100-listing sample genuinely cannot know how many listings compete for a tag
 * across all of Etsy. getRelated() probes it for real.
 */
export async function getKeywordCore(query: string): Promise<KeywordSearchResponse> {
  const key = coreKey(query)

  // Kick the taxonomy fetch off in the background on every request. It's needed
  // only for category NAMES, so it must never block the response — but starting
  // it now means it's usually ready before anyone opens the Analysis tab.
  warmTaxonomy()

  const memHit = memCache.get<KeywordSearchResponse>(key)
  if (memHit && !isStaleCore(memHit)) return memHit

  try {
    await connectDB()
    const dbHit = await KeywordCache.findOne({ keyword: query }).lean()
    if (dbHit) {
      const data = dbHit.data as KeywordSearchResponse
      if (!isStaleCore(data)) {
        memCache.set(key, data, CACHE_TTL.KEYWORD)
        return data
      }
    }
  } catch (e) {
    console.error('[Keywords] DB lookup:', e)
  }

  // No images on the fast path: the image batch is a second ~1.5s round-trip and
  // only the Top Listings sub-tab renders them. /api/keywords/listings fetches
  // them on demand when that tab is opened.
  const { listings, count } = await searchEtsyListingsPaged(query, 100, 0, { skipImages: true })
  const data = buildKeywordStats(query, listings, count)

  // Analysis is computed from listings we already have. `false` = don't block on
  // the 365KB taxonomy fetch just to name categories; it warms for next time.
  data.analysis = await buildSearchAnalysis(listings, false)
    .catch(e => { console.error('[Keywords] analysis:', e); return undefined })

  if (isGoogleAdsConfigured()) {
    const metrics = await googleKeywordMetrics([query])
    if (metrics.size) data.stats.googleSearches = metrics.get(query)?.searches ?? null
  }

  memCache.set(key, data, CACHE_TTL.KEYWORD)

  // Persist without blocking the response.
  const expiresAt = new Date(Date.now() + CACHE_TTL.KEYWORD * 1000)
  connectDB()
    .then(() => KeywordCache.findOneAndUpdate(
      { keyword: query },
      { keyword: query, data, expiresAt },
      { upsert: true, new: true },
    ))
    .catch(e => console.error('[Keywords] DB write:', e))

  return data
}
