/**
 * Keyword pipeline, split by cost.
 *
 * One cold keyword needs ~33 Etsy calls, and the shared rate gate (8/sec) means
 * that's ~13s wall-clock. Only THREE of those calls are needed to render the
 * page - the base search, its image batch, and the taxonomy lookup. The other
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
import { KeywordCache, SearchRankSnapshot } from '@/lib/models'
import { packCache, unpackCache } from '@/lib/keyword-cache-codec'
import { getCollectivePackage } from '@/lib/collective-read'
import { memCache, cacheKey, CACHE_TTL, cachedFlight } from '@/lib/cache'
import { singleFlight } from '@/lib/concurrency'
import { buildKeywordStats, buildSearchAnalysis, warmTaxonomy, searchEtsyTop100, authenticKdPackage } from '@/lib/etsy'
import { googleKeywordMetrics, googleAccountCurrency, isGoogleAdsConfigured, googleStatusOf, type GoogleMetricsMeta, type GoogleMetric } from '@/lib/google-ads'
import type { KeywordSearchResponse, EtsyListing } from '@/types'

// v9: core/related now carry Google competition + CPC (account currency), not just
// volume. Bump when the CORE shape changes.
export const KEYWORD_VERSION = 'v9'

// Google volume/CPC/competition are country-specific, so the core & related keys
// carry the geo. Near matches are pure Etsy (geo-independent), so they don't.
export function coreKey(query: string, geo = 'US') { return cacheKey('keyword', KEYWORD_VERSION, 'core', geo, query) }
export function relatedKey(query: string, geo = 'US') { return cacheKey('keyword', KEYWORD_VERSION, 'related', geo, query) }
export function nearKey(query: string) { return cacheKey('keyword', KEYWORD_VERSION, 'near', query) }

/**
 * The Mongo cache is keyed on the keyword alone, not the version - so this
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
    // Missing Google volume means stale only if the lookup didn't succeed. When Google
    // answered 'ok' with no data for this keyword, rebuilding returns the same blank,
    // and used to rewrite a ~300 KB doc (plus Etsy + Google calls) on every search.
    (isGoogleAdsConfigured() && d.stats?.googleSearches == null && d.stats?.googleStatus !== 'ok') ||
    // Pre-v9 docs carry Google volume but not competition/CPC/currency. The Mongo
    // cache keys on the keyword alone, so bumping KEYWORD_VERSION doesn't retire
    // them - this probe does. A fresh configured doc always SETS googleCurrency
    // (to the code or null), so `undefined` uniquely marks the old shape.
    (isGoogleAdsConfigured() && d.stats?.googleCurrency === undefined)
  )
}

/**
 * The copy of a keyword package we cache, store and send. Listing descriptions and
 * every image after the first are never shown on the keyword pages (they render
 * images[0] only; the AI and compare tools fetch listings fresh), yet they were ~75%
 * of each ~300 KB cached doc and the biggest source of database write volume.
 * The analysis is already computed from the full listings before this runs.
 */
function slimForStorage(d: KeywordSearchResponse): KeywordSearchResponse {
  return {
    ...d,
    listings: d.listings.map(l => ({ ...l, description: '', images: l.images?.slice(0, 1) ?? [] })),
  }
}

/**
 * Fast path: everything the page needs to paint. ~3 Etsy calls.
 *
 * `related` comes back with `competition: null` - that's honest, not lazy: a
 * 100-listing sample genuinely cannot know how many listings compete for a tag
 * across all of Etsy. getRelated() probes it for real.
 */
export async function getKeywordCore(query: string, geo = 'US'): Promise<KeywordSearchResponse> {
  const key = coreKey(query, geo)

  // Fast, cheap in-memory hit returns immediately (no need to coalesce).
  const memHit = memCache.get<KeywordSearchResponse>(key)
  if (memHit && !isStaleCore(memHit)) return authenticKdPackage(memHit)

  // Otherwise collapse concurrent identical requests into ONE upstream fetch:
  // when a keyword trends, N users don't each fire ~3 Etsy + Google calls - the
  // first does the work and the rest await the same result.
  const data = await singleFlight(key, () => computeKeywordCore(query, geo, key))
  rememberKeywordListings(query, data.listings)
  // Cached packages may hold the old squashed KD: recompute it from its inputs.
  return authenticKdPackage(data)
}

// ─── One Etsy search per keyword, shared by every keyword panel ──────────────────
// The trends, market-activity, keyword-gap and listings panels all need the same
// top-100 relevance search the core already fetched, and each used to fetch it
// again (4 extra Etsy calls per keyword). They now read it from here: the core's
// own listings when present, otherwise one fetch, cached under Etsy's 6h limit.
const kwListKey = (q: string) => cacheKey('kwlist', q.toLowerCase().trim())

function rememberKeywordListings(query: string, listings?: EtsyListing[]) {
  if (listings?.length) memCache.set(kwListKey(query), listings, CACHE_TTL.KEYWORD)
}

/** The keyword's top-100 Etsy listings (relevance order, no images). */
export function keywordListings(query: string): Promise<EtsyListing[]> {
  return cachedFlight(kwListKey(query), CACHE_TTL.KEYWORD, async () =>
    (await searchEtsyTop100(query, { skipImages: true })).listings)
}

/**
 * Ids of the listings ranking for a keyword, for measured-history panels (market
 * activity, Hot Products tag performance). Etsy's live top 100 when it answers;
 * when Etsy is unavailable (keys locked) the organic ranking our extension saw for
 * this keyword on its latest day in the last week, so those panels keep working
 * on our own data instead of failing (they 502'd while Etsy was locked, 2026-10-11).
 */
export async function keywordListingIds(query: string): Promise<number[]> {
  try {
    return (await keywordListings(query)).map(l => l.listing_id).filter(Boolean)
  } catch (e) {
    const kw = query.replace(/\s+/g, ' ').trim().toLowerCase()
    await connectDB()
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
    const rows = await SearchRankSnapshot.find({ keyword: kw, day: { $gte: since }, isAd: { $ne: true } })
      .sort({ day: -1, position: 1 }).limit(400).select('listingId day -_id')
      .maxTimeMS(5000).lean<{ listingId: number; day: string }[]>()
    if (!rows.length) throw e
    const latest = rows[0].day
    return [...new Set(rows.filter(r => r.day === latest).map(r => r.listingId))].slice(0, 100)
  }
}

// A failed lookup that still produced numbers (served from the stored Google cache)
// is good enough to cache normally.
const g_has = (m: Map<string, unknown>, q: string) => m.has(q.toLowerCase())

async function computeKeywordCore(query: string, geo: string, key: string): Promise<KeywordSearchResponse> {
  // Re-check the cache inside the flight - an earlier coalesced call may have
  // just populated it.
  const memHit = memCache.get<KeywordSearchResponse>(key)
  if (memHit && !isStaleCore(memHit)) return memHit

  // Kick the taxonomy fetch off in the background. It's needed only for category
  // NAMES, so it must never block the response - but starting it now means it's
  // usually ready before anyone opens the Analysis tab.
  warmTaxonomy()

  // Shared permanent store first (populated by Ranktsy's Bulk Keyword Search). If
  // the keyword is there, serve the complete package with ZERO API calls. This is
  // a full package - its related keywords are already enriched and its listings
  // carry images + reviews - a superset of the normal core, which the page renders.
  // Both stores are read at once (each is a ~150 ms round trip to the database).
  const dbHitP = connectDB().then(() => KeywordCache.findOne({ keyword: query, geo }).lean()).catch(e => { console.error('[Keywords] DB lookup:', e); return null })
  const shared = await getCollectivePackage(query, geo)
  if (shared) {
    // The shared package can predate Google enrichment (or have been saved while
    // Google was failing) → its Avg. Searches would be blank. Backfill the Google
    // stats live so the keyword never shows empty just because the cached package
    // lacked them.
    if (isGoogleAdsConfigured() && shared.stats?.googleSearches == null) {
      const gmeta: GoogleMetricsMeta = {}
      const [metrics, currency] = await Promise.all([googleKeywordMetrics([query], geo, gmeta), googleAccountCurrency()])
      const g = metrics.get(query)
      if (g) {
        shared.stats.googleSearches         = g.searches ?? null
        shared.stats.googleCompetition      = g.competition as KeywordSearchResponse['stats']['googleCompetition']
        shared.stats.googleCompetitionIndex = g.competitionIndex
        shared.stats.googleCpcLow           = g.cpcLow
        shared.stats.googleCpcHigh          = g.cpcHigh
      }
      shared.stats.googleCurrency = currency
      shared.stats.googleStatus = googleStatusOf(gmeta)
      shared.stats.googleRetryAt = gmeta.retryAt ?? null
      // Only cache long-term once the backfill actually succeeded.
      memCache.set(key, shared, gmeta.failed ? 120 : CACHE_TTL.KEYWORD)
      return shared
    }
    memCache.set(key, shared, CACHE_TTL.KEYWORD)
    return shared
  }

  try {
    const dbHit = await dbHitP
    const data = dbHit ? await unpackCache<KeywordSearchResponse>(dbHit) : null
    if (data) {
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
  // Google's volume is asked for NOW, alongside Etsy, not after it: at busy hours it
  // queues for a few seconds, and that wait now overlaps Etsy's instead of following it.
  const gmeta: GoogleMetricsMeta = {}
  const google = isGoogleAdsConfigured()
    ? Promise.all([googleKeywordMetrics([query], geo, gmeta), googleAccountCurrency()])
    : null
  google?.catch(() => {})
  const { listings, count } = await searchEtsyTop100(query, { skipImages: true })
  let data = buildKeywordStats(query, listings, count)

  // Analysis is computed from listings we already have. `false` = don't block on
  // the 365KB taxonomy fetch just to name categories; it warms for next time.
  data.analysis = await buildSearchAnalysis(listings, false)
    .catch(e => { console.error('[Keywords] analysis:', e); return undefined })

  // Track whether the Google lookup actually FAILED (vs. genuinely no data) so a
  // transient blip isn't cached for hours as permanent blanks.
  let googleFailed = false
  let googlePending = false
  if (google) {
    const applyGoogle = (d: KeywordSearchResponse, [metrics, currency]: [Map<string, GoogleMetric>, string | null]) => {
      d.stats.googleStatus = googleStatusOf(gmeta)
      d.stats.googleRetryAt = gmeta.retryAt ?? null
      const g = metrics.get(query)
      if (g) {
        d.stats.googleSearches         = g.searches ?? null
        d.stats.googleCompetition      = g.competition as KeywordSearchResponse['stats']['googleCompetition']
        d.stats.googleCompetitionIndex = g.competitionIndex
        d.stats.googleCpcLow           = g.cpcLow
        d.stats.googleCpcHigh          = g.cpcHigh
      }
      d.stats.googleCurrency = currency
      return !!gmeta.failed && !g_has(metrics, query)
    }
    // The Etsy numbers are ready now; Google's volume can sit in its queue (one
    // request per second per Ads account) for several seconds at peak. Wait a
    // little, then answer without it: the page asks /api/keywords/google for the
    // volume and fills it in when it lands (no second charge).
    const answered = await Promise.race([google, new Promise<null>(r => setTimeout(() => r(null), GOOGLE_CORE_WAIT_MS))])
    if (answered) {
      googleFailed = applyGoogle(data, answered)
    } else {
      googlePending = true
      data.stats.googleStatus = 'pending'
      // When Google does answer, complete the cached copy so later readers get it whole.
      void google.then(res => {
        const later = slimForStorage({ ...data, stats: { ...data.stats } })
        if (applyGoogle(later, res)) return
        memCache.set(key, later, CACHE_TTL.KEYWORD)
        persistCore(query, geo, later)
      }).catch(() => {})
    }
  }

  data = slimForStorage(data)

  // If Google failed, cache only BRIEFLY (2 min) in memory and do NOT persist to
  // the DB - so the next request retries and can fill the real numbers, instead
  // of the keyword staying blank for the full 5-hour TTL.
  if (googleFailed || googlePending) {
    memCache.set(key, data, googlePending ? 30 : 120)
    return data
  }

  memCache.set(key, data, CACHE_TTL.KEYWORD)
  persistCore(query, geo, data)
  return data
}

/** Longest the keyword's own stats wait for Google before answering without it. */
const GOOGLE_CORE_WAIT_MS = 2500

/** Persist a complete core package without blocking the response. */
function persistCore(query: string, geo: string, data: KeywordSearchResponse) {
  const expiresAt = new Date(Date.now() + CACHE_TTL.KEYWORD * 1000)
  Promise.all([connectDB(), packCache(data)])
    .then(([, dataZ]) => KeywordCache.updateOne(
      { keyword: query, geo },
      // Compressed (keyword-cache-codec.ts); drop any old uncompressed copy.
      { $set: { keyword: query, geo, dataZ, expiresAt }, $unset: { data: '' } },
      { upsert: true },
    ))
    .catch(e => console.error('[Keywords] DB write:', e))
}
