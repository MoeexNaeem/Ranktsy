/**
 * Etsy Open API v3 — Official Integration
 * Docs: https://developers.etsy.com/documentation/
 *
 * This module uses ONLY the official Etsy Open API.
 * No scraping, no third-party proxy actors, no Apify.
 *
 * Endpoints used:
 *   GET /v3/application/listings/active  → keyword/trending search
 *   GET /v3/application/shops/{shop_id}  → shop info
 *   GET /v3/application/shops/{shop_id}/listings/active → shop listings
 */
import { recordShopSnapshots, recordListingSnapshots, recordShopSnapshot } from '@/lib/snapshots'
import type {
  EtsyListing, EtsyShop, KeywordData,
  KeywordSearchResponse, TrendData, CountryData,
  SearchAnalysis, NearMatch, TagCloudItem, CategoryItem, PriceBucket, ProcessingBucket, AgeBucket,
  ListingMarketStats,
} from '@/types'

const ETSY_API_KEY       = process.env.ETSY_API_KEY ?? ''
const ETSY_SHARED_SECRET = process.env.ETSY_SHARED_SECRET ?? ''
const ETSY_BASE          = 'https://openapi.etsy.com/v3/application'

// This app requires the shared secret to be appended to the keystring in the
// x-api-key header (format: "<keystring>:<shared_secret>"). Using the keystring
// alone returns: 403 "Shared secret is required in x-api-key header."
const ETSY_KEY_HEADER = ETSY_SHARED_SECRET
  ? `${ETSY_API_KEY}:${ETSY_SHARED_SECRET}`
  : ETSY_API_KEY

if (!ETSY_API_KEY && process.env.NODE_ENV === 'production') {
  console.warn('[Etsy] ETSY_API_KEY is not set — API calls will fail.')
}

// ─── Core fetcher ─────────────────────────────────────────────────────────────

// Etsy allows roughly 10 requests/second. A single keyword search fans out into
// dozens of calls (the search, image batches, per-keyword competition probes,
// near-match variants), which sails past that ceiling and comes back 429. Every
// public call funnels through this gate so the whole app shares one budget.
const RATE_LIMIT_PER_SEC = 8   // headroom under Etsy's ~10/sec
const MIN_GAP_MS = 1000 / RATE_LIMIT_PER_SEC

let lastCallAt = 0
let gateChain: Promise<void> = Promise.resolve()

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Serialise callers just long enough to keep MIN_GAP_MS between departures. */
function rateGate(): Promise<void> {
  gateChain = gateChain.then(async () => {
    const wait = lastCallAt + MIN_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastCallAt = Date.now()
  })
  return gateChain
}

async function etsyFetch<T = unknown>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${ETSY_BASE}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  }

  // Retry 429/5xx with backoff. Without this, a burst silently degrades whole
  // columns to fallback values that look like real data.
  const MAX_ATTEMPTS = 4
  let lastErr: Error | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await rateGate()
    const res = await fetch(url.toString(), {
      headers: {
        'x-api-key': ETSY_KEY_HEADER,
        'Accept':    'application/json',
      },
      // Next.js fetch cache — revalidate every 30 minutes
      next: { revalidate: 1800 },
    })

    if (res.ok) return res.json() as Promise<T>

    const text = await res.text().catch(() => res.statusText)
    lastErr = new Error(`Etsy API error ${res.status}: ${text}`)

    const retryable = res.status === 429 || res.status >= 500
    if (!retryable || attempt === MAX_ATTEMPTS - 1) throw lastErr

    const retryAfter = Number(res.headers.get('retry-after')) * 1000
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 400 * 2 ** attempt)
  }

  throw lastErr ?? new Error('Etsy API error')
}

// ─── HTML entity decoding ─────────────────────────────────────────────────────
// Etsy returns listing titles HTML-encoded ("Women&#39;s Necklace"). React escapes
// text nodes, so rendering that raw prints the entity literally. Decoded here at
// the boundary — one pass, so a decoded "&" can't be re-decoded into something else.

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
}

function decodeEntities(s: string): string {
  if (!s || !s.includes('&')) return s
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const num = code[1].toLowerCase() === 'x'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10)
      return Number.isFinite(num) && num > 0 && num <= 0x10FFFF ? String.fromCodePoint(num) : match
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match
  })
}

// ─── Map Etsy API listing → internal EtsyListing ─────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapListing(item: Record<string, any>): EtsyListing {
  const price = item.price ?? {}
  const images: { url_570xN: string; url_75x75: string }[] = (item.images ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (img: any) => ({ url_570xN: img.url_570xN ?? '', url_75x75: img.url_75x75 ?? '' })
  )

  // Etsy has used several names for the creation timestamp across API revisions.
  const created = item.original_creation_timestamp ?? item.original_creation_tsz ?? item.creation_timestamp ?? item.creation_tsz

  return {
    listing_id:   Number(item.listing_id ?? 0),
    title:        decodeEntities(String(item.title ?? '')),
    description:  decodeEntities(String(item.description ?? '')),
    price: {
      amount:        Number(price.amount ?? 0),
      divisor:       Number(price.divisor ?? 100),
      currency_code: String(price.currency_code ?? 'USD'),
    },
    quantity:     Number(item.quantity ?? 1),
    views:        Number(item.views ?? 0),
    num_favorers: Number(item.num_favorers ?? 0),
    tags:         Array.isArray(item.tags) ? (item.tags as string[]).map(decodeEntities) : [],
    images,
    url:          String(item.url ?? ''),
    shop_name:    decodeEntities(String(item.shop?.shop_name ?? '')),
    state:        String(item.state ?? 'active'),
    shop_id:           item.shop_id != null ? Number(item.shop_id) : undefined,
    taxonomy_id:       item.taxonomy_id != null ? Number(item.taxonomy_id) : undefined,
    created_timestamp: created != null ? Number(created) : undefined,
    processing_min:    item.processing_min != null ? Number(item.processing_min) : undefined,
    processing_max:    item.processing_max != null ? Number(item.processing_max) : undefined,
  }
}

// ─── Image enrichment ─────────────────────────────────────────────────────────
// The keyword-search and shop-listing endpoints do NOT return images. We fetch
// them in a single batch call to /listings/batch?includes=Images,Shop (up to 100
// ids) and merge them back onto the listings by listing_id.

async function attachImages(listings: EtsyListing[]): Promise<EtsyListing[]> {
  const ids = listings.map(l => l.listing_id).filter(Boolean)
  if (!ids.length) return listings
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await etsyFetch<{ results: Record<string, any>[] }>('/listings/batch', {
      listing_ids: ids.slice(0, 100).join(','),
      includes:    'Images,Shop',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byId = new Map<number, any>()
    for (const r of data.results ?? []) byId.set(Number(r.listing_id), r)

    return listings.map(l => {
      const full = byId.get(l.listing_id)
      if (!full) return l
      const images: { url_570xN: string; url_75x75: string }[] = (full.images ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (img: any) => ({ url_570xN: img.url_570xN ?? '', url_75x75: img.url_75x75 ?? '' })
      )
      // Backfill analysis fields — the batch payload is the fuller object, so it
      // fills gaps left by whichever endpoint produced `l`.
      const merged = mapListing(full)
      return {
        ...l,
        images:    images.length ? images : l.images,
        shop_name: merged.shop_name || l.shop_name,
        taxonomy_id:       l.taxonomy_id       ?? merged.taxonomy_id,
        created_timestamp: l.created_timestamp ?? merged.created_timestamp,
        processing_min:    l.processing_min    ?? merged.processing_min,
        processing_max:    l.processing_max    ?? merged.processing_max,
        tags:              l.tags?.length ? l.tags : merged.tags,
      }
    })
  } catch (e) {
    console.error('[Etsy] image enrichment failed:', e)
    return listings
  }
}

// ─── Search listings ──────────────────────────────────────────────────────────

// Optional advanced filters (all documented on Etsy's findAllListingsActive).
export interface SearchOpts {
  minPrice?: number
  maxPrice?: number
  sortOn?: 'score' | 'price' | 'created' | 'updated'
  taxonomyId?: number
  /** Skip the /listings/batch image call when the caller only needs stats. */
  skipImages?: boolean
}

// Paged search — returns listings for the requested page plus Etsy's total match
// count, so the UI can build server-side pagination via the Etsy `offset` param.
export async function searchEtsyListingsPaged(query: string, limit = 24, offset = 0, opts: SearchOpts = {}): Promise<{ listings: EtsyListing[]; count: number }> {
  const params: Record<string, string | number> = {
    keywords: query,
    limit:    Math.min(Math.max(limit, 1), 100),
    offset:   Math.max(0, offset),
    sort_on:  opts.sortOn ?? 'score',
  }
  if (opts.minPrice != null && opts.minPrice > 0) params.min_price = opts.minPrice
  if (opts.maxPrice != null && opts.maxPrice > 0) params.max_price = opts.maxPrice
  if (opts.taxonomyId != null && opts.taxonomyId > 0) params.taxonomy_id = opts.taxonomyId
  const data = await etsyFetch<{ count?: number; results: Record<string, unknown>[] }>('/listings/active', params)
  const mapped = (data.results ?? []).map(mapListing)
  const listings = opts.skipImages ? mapped : await attachImages(mapped)
  return { listings, count: Number(data.count ?? 0) }
}

export async function searchEtsyListings(query: string, limit = 25): Promise<EtsyListing[]> {
  return (await searchEtsyListingsPaged(query, limit, 0)).listings
}

// Etsy seller taxonomy (category tree) — public, key-only. Flattened to a
// searchable list with each node's full category path.
export interface TaxonomyItem { id: number; name: string; fullPath: string; level: number }
export async function getSellerTaxonomy(): Promise<TaxonomyItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await etsyFetch<{ results: any[] }>('/seller-taxonomy/nodes')
  const flat: TaxonomyItem[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (nodes: any[], trail: string[]) => {
    for (const n of nodes ?? []) {
      const path = [...trail, String(n.name)]
      flat.push({ id: Number(n.id), name: String(n.name), fullPath: path.join(' › '), level: path.length })
      if (n.children?.length) walk(n.children, path)
    }
  }
  walk(data.results ?? [], [])
  return flat
}

// Rank check — scans the top `scan` (max 100) active listings for a keyword
// (Etsy relevance order) and returns the positions where the given shop's
// listings appear. Uses only the official search endpoint; no scraping.
export async function checkKeywordRank(query: string, shopId: number, scan = 100): Promise<{
  scanned: number; totalResults: number; matches: { position: number; listing_id: number; title: string; url: string }[]
}> {
  const limit = Math.min(Math.max(scan, 1), 100)
  const data = await etsyFetch<{ count?: number; results: Record<string, unknown>[] }>('/listings/active', {
    keywords: query, limit, offset: 0, sort_on: 'score',
  } as Record<string, string | number>)
  const results = data.results ?? []
  const matches = results
    .map((r, i) => ({ position: i + 1, listing_id: Number(r.listing_id ?? 0), title: String(r.title ?? ''), url: String(r.url ?? ''), shop_id: Number(r.shop_id ?? 0) }))
    .filter(r => r.shop_id === shopId)
    .map(({ position, listing_id, title, url }) => ({ position, listing_id, title, url }))
  return { scanned: results.length, totalResults: Number(data.count ?? 0), matches }
}

// Fetch a single active listing by id (title, tags, description, price…) and
// enrich it with images. Used by the Listing Audit tool.
export async function getListingById(id: number): Promise<EtsyListing | null> {
  const data = await etsyFetch<Record<string, unknown>>(`/listings/${id}`)
  if (!data || !data.listing_id) return null
  const [enriched] = await attachImages([mapListing(data)])
  return enriched ?? null
}

// ─── Keyword stats (derived from listing data) ────────────────────────────────

// Keyword difficulty (0–100) — an ESTIMATE of how hard it is to rank, derived
// from the real total supply of competing listings plus how strongly the
// incumbents already engage buyers. Not an eRank-identical score; labelled as
// an estimate in the UI.
function difficultyScore(totalResults: number, avgEngagementPct: number): number {
  const compFactor = Math.min(1, Math.log10(Math.max(totalResults, 1) + 1) / 6) // 10^6 listings → 1.0
  const engFactor  = Math.min(1, avgEngagementPct / 8)                          // ~8% fav/view is very strong
  return Math.max(1, Math.min(100, Math.round(100 * (0.7 * compFactor + 0.3 * engFactor))))
}

export function buildKeywordStats(query: string, listings: EtsyListing[], totalResults = 0): KeywordSearchResponse {
  if (!listings.length) {
    return {
      query,
      stats: { avgViews: 0, avgFavorites: 0, favPerView: 0, etsyCompetition: 0, totalResults, difficulty: 0, difficultyLabel: 'Easy', avgPrice: 0, currency: 'USD', googleSearches: null },
      related: [],
      listings: [],
    }
  }

  // All measured, none modelled. Etsy returns `views` (lifetime views per
  // listing) and `num_favorers` — these are those, averaged. They are NOT search
  // volume or clicks; Etsy publishes neither, and this file no longer pretends
  // otherwise.
  const totalViews     = listings.reduce((s, l) => s + (l.views ?? 0), 0)
  const totalFavorites = listings.reduce((s, l) => s + (l.num_favorers ?? 0), 0)
  const avgViews       = Math.round(totalViews / listings.length)
  const avgFavorites   = Math.round(totalFavorites / listings.length)
  const favPerView     = parseFloat((totalFavorites / Math.max(totalViews, 1) * 100).toFixed(1))
  const competition    = listings.length
  const total          = totalResults || competition

  // Median price — robust to the occasional very-high-priced outlier that skews a
  // mean. Scoped to the dominant currency: Etsy prices each listing in its own
  // shop currency with no FX rate, so a mixed set would compare VND to USD.
  const { currency, prices } = dominantCurrencyPrices(listings)
  const avgPrice  = prices.length ? parseFloat((prices[Math.floor((prices.length - 1) / 2)]).toFixed(2)) : 0
  const difficulty = difficultyScore(total, favPerView)
  const difficultyLabel: 'Easy' | 'Medium' | 'Hard' = difficulty < 34 ? 'Easy' : difficulty < 67 ? 'Medium' : 'Hard'

  // Related keywords come from the REAL tags Etsy returns. Track which listings
  // carry each tag so every metric below can be measured from those listings
  // rather than modelled from the parent query.
  const tagListings = new Map<string, EtsyListing[]>()
  const stopWords = new Set(['with','from','this','that','your','have','will','been','they','their','what','when'])
  listings.forEach(l => {
    const tagSource = l.tags?.length
      ? l.tags
      : l.title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3)

    for (const w of new Set(tagSource.map(t => t.toLowerCase().trim()))) {
      if (w.length > 2 && !query.toLowerCase().includes(w) && !stopWords.has(w)) {
        const arr = tagListings.get(w) ?? []
        arr.push(l)
        tagListings.set(w, arr)
      }
    }
  })

  const topEntries = [...tagListings.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 24)

  const related: KeywordData[] = topEntries.map(([word, ls]) => {
    // Measured from the listings that actually carry this tag.
    const v = ls.reduce((s, l) => s + (l.views ?? 0), 0)
    const f = ls.reduce((s, l) => s + (l.num_favorers ?? 0), 0)
    return {
      keyword:          word,
      // A 100-listing sample cannot reveal how many listings compete for this
      // tag across all of Etsy. enrichRelatedCompetition probes that for real;
      // until then it's unknown — never a stand-in.
      competition:      null,
      competitionLevel: null,
      difficulty:       null,
      avgViews:         Math.round(v / ls.length),
      avgFavorites:     Math.round(f / ls.length),
      favPerView:       parseFloat((f / Math.max(v, 1) * 100).toFixed(1)),
      tagOccurrences:   ls.length,
      charCount:        word.length,
      wordCount:        word.split(/\s+/).filter(Boolean).length,
      googleSearches:   null,   // real Google volume only, filled in by the route when configured
      listingsByMonth:  listingsByMonth(ls),
    }
  })

  return {
    query,
    stats: {
      avgViews, avgFavorites, favPerView,
      etsyCompetition: competition, totalResults: total,
      difficulty, difficultyLabel, avgPrice, currency,
      googleSearches: null,
    },
    related,
    listings,
    cachedAt: new Date().toISOString(),
  }
}

// ─── Taxonomy name lookup (module-cached — the tree is large and near-static) ──

// The full seller taxonomy is ~365KB and takes ~2.5s to fetch — the single
// slowest call in the keyword pipeline, and it's needed only for the Categories
// panel. Module-cached for 24h, but a serverless cold start would otherwise pay
// it again, so `warmTaxonomy()` lets callers kick it off without blocking and
// `taxonomyNames()` returns whatever is ready.
let taxonomyCache: { at: number; byId: Map<number, string> } | null = null
let taxonomyInFlight: Promise<Map<number, string>> | null = null
const TAXONOMY_TTL = 24 * 60 * 60 * 1000

function taxonomyFresh(): boolean {
  return !!taxonomyCache && Date.now() - taxonomyCache.at < TAXONOMY_TTL
}

async function taxonomyNames(): Promise<Map<number, string>> {
  if (taxonomyFresh()) return taxonomyCache!.byId
  // Collapse concurrent callers onto one fetch — 10 parallel requests must not
  // each pull 365KB.
  if (!taxonomyInFlight) {
    taxonomyInFlight = (async () => {
      try {
        const flat = await getSellerTaxonomy()
        const byId = new Map<number, string>(flat.map(t => [t.id, t.fullPath]))
        taxonomyCache = { at: Date.now(), byId }
        return byId
      } catch (e) {
        console.error('[Etsy] taxonomy fetch failed:', e)
        return taxonomyCache?.byId ?? new Map<number, string>()
      } finally {
        taxonomyInFlight = null
      }
    })()
  }
  return taxonomyInFlight
}

/** Start the taxonomy fetch without waiting for it. Safe to call on every request. */
export function warmTaxonomy(): void {
  if (!taxonomyFresh()) void taxonomyNames().catch(() => {})
}

/** Cached taxonomy if it's ready, otherwise null — never blocks. */
function taxonomyIfReady(): Map<number, string> | null {
  return taxonomyFresh() ? taxonomyCache!.byId : null
}

// ─── Search Results Analysis ──────────────────────────────────────────────────
// Everything here is computed from the sampled live listings the official search
// endpoint returned — no external data, no estimation beyond what's labelled.

const SYMBOLS: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$', JPY: '¥' }
export function currencySymbol(code: string): string { return SYMBOLS[code] ?? `${code} ` }

/**
 * Etsy returns each listing priced in its OWN shop currency and the Open API
 * exposes no FX rate — a search for "crochet" comes back with USD, GBP, EUR,
 * TRY and VND side by side. Averaging those raw numbers is meaningless (a
 * 410,000 VND listing is ~$16, not $410,000, and it would wreck every price
 * statistic).
 *
 * Since we're Etsy-API-only, the honest move is to report prices for the single
 * most common currency in the sample and tell the user how many listings that
 * covers, rather than silently mixing or inventing a conversion.
 */
export function dominantCurrencyPrices(listings: EtsyListing[]): { currency: string; prices: number[] } {
  const byCur = new Map<string, number[]>()
  for (const l of listings) {
    if (!l.price?.amount) continue
    const code = l.price.currency_code || 'USD'
    const arr = byCur.get(code) ?? []
    arr.push(l.price.amount / (l.price.divisor || 100))
    byCur.set(code, arr)
  }
  if (!byCur.size) return { currency: 'USD', prices: [] }

  const [currency, prices] = [...byCur.entries()].sort((a, b) => b[1].length - a[1].length)[0]
  return { currency, prices: prices.sort((a, b) => a - b) }
}

/** Round a raw step up to a human-friendly 1 / 2 / 2.5 / 5 × 10ⁿ increment. */
function niceStep(raw: number): number {
  if (raw <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  return step * mag
}

/** `prices` must be sorted ascending and all in the SAME currency. */
function priceHistogram(prices: number[], sym: string): { buckets: PriceBucket[]; medianBucket: string | null; outliers: number } {
  if (!prices.length) return { buckets: [], medianBucket: null, outliers: 0 }

  // A handful of £400 listings among £5 ones would otherwise flatten every real
  // bar to invisibility, so the domain is clipped at the 95th percentile and the
  // tail is lumped into a final "+" bucket rather than dropped (dropping would
  // misreport the population).
  const p95 = prices[Math.min(prices.length - 1, Math.floor(prices.length * 0.95))]
  const lo = prices[0]
  const inRange = prices.filter(p => p <= p95)
  const outliers = prices.length - inRange.length
  const span = p95 - lo

  // Tight, low-value ranges (the common Etsy case) bucket per whole currency
  // unit, which is what makes eRank's $1/$2/$3… histogram readable. Wider ranges
  // fall back to a nice adaptive step.
  const step = span <= 25 ? 1 : niceStep(span / 14)
  const fmt = (v: number) => `${sym}${step < 1 ? v.toFixed(2) : Math.round(v)}`

  const counts = new Map<number, number>()
  for (const p of inRange) {
    const b = Math.floor(p / step) * step
    counts.set(b, (counts.get(b) ?? 0) + 1)
  }

  const buckets: PriceBucket[] = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([b, count]) => ({ label: fmt(b), value: b, count }))

  if (outliers > 0) buckets.push({ label: `${fmt(p95)}+`, value: p95 + step, count: outliers })

  const median = prices[Math.floor((prices.length - 1) / 2)]
  const medianBucket = median > p95 ? `${fmt(p95)}+` : fmt(Math.floor(median / step) * step)
  return { buckets, medianBucket, outliers }
}

/**
 * Calendar-month histogram (Jan→Dec) of when these listings were created.
 *
 * Real: `created_timestamp` is present on 100% of search results. This replaced
 * sine-wave "trend" arrays whose shape depended on the row's array index —
 * decoration that looked like a search-history sparkline.
 *
 * Returns [] when no listing exposes a date, so callers can hide the column
 * rather than draw twelve zeroes.
 */
export function listingsByMonth(listings: EtsyListing[]): number[] {
  const counts = new Array(12).fill(0)
  let dated = 0
  for (const l of listings) {
    if (!l.created_timestamp) continue
    counts[new Date(l.created_timestamp * 1000).getUTCMonth()]++
    dated++
  }
  return dated ? counts : []
}

/** Bucket a listing's age in days into a human band. */
function ageBand(days: number): { label: string; order: number } {
  if (days < 30)  return { label: '< 1 month', order: 0 }
  if (days < 90)  return { label: '1–3 months', order: 1 }
  if (days < 180) return { label: '3–6 months', order: 2 }
  if (days < 365) return { label: '6–12 months', order: 3 }
  if (days < 730) return { label: '1–2 years', order: 4 }
  return { label: '2+ years', order: 5 }
}

function processingLabel(min?: number, max?: number): string | null {
  if (min == null && max == null) return null
  const a = min ?? max!
  const b = max ?? min!
  const unit = (n: number) => `${n} day${n === 1 ? '' : 's'}`
  return a === b ? unit(a) : `${a} - ${unit(b)}`
}

/**
 * @param waitForTaxonomy  When false, categories are filled only if the taxonomy
 *   is already cached — the analysis never blocks ~2.5s on a 365KB fetch just to
 *   name categories. The fetch is still kicked off, so the next request has it.
 */
export async function buildSearchAnalysis(listings: EtsyListing[], waitForTaxonomy = true): Promise<SearchAnalysis> {
  const { currency, prices } = dominantCurrencyPrices(listings)
  const sym = currencySymbol(currency)

  const empty: SearchAnalysis = {
    listingsAnalyzed: 0, averagePrice: 0, medianPrice: 0, averageHearts: 0,
    totalViews: 0, avgViews: 0, avgDailyViews: null, avgWeeklyViews: null,
    currency, priceSample: 0, tagCloud: [], categories: [], categoriesPending: false,
    priceBuckets: [], medianBucket: null, priceOutliers: 0, ages: [], medianAgeDays: null,
    processing: [], avgProcessing: null,
  }
  if (!listings.length) return empty

  const n = listings.length
  const totalViews = listings.reduce((s, l) => s + (l.views ?? 0), 0)
  const totalHearts = listings.reduce((s, l) => s + (l.num_favorers ?? 0), 0)

  // Views per day — only meaningful for listings that expose a creation date, so
  // it's averaged across that subset and reported as null when none do.
  const now = Date.now() / 1000
  const dated = listings.filter(l => l.created_timestamp && l.created_timestamp > 0 && l.created_timestamp < now)
  const ageDays = dated.map(l => (now - l.created_timestamp!) / 86_400).sort((a, b) => a - b)
  const dailies = dated.map(l => (l.views ?? 0) / Math.max(1, (now - l.created_timestamp!) / 86_400))
  const avgDailyViews = dailies.length
    ? parseFloat((dailies.reduce((s, d) => s + d, 0) / dailies.length).toFixed(2))
    : null

  // How entrenched the incumbents are. If the whole first page is 2+ years old,
  // a new listing is fighting established ranking history.
  const ageCount = new Map<string, { count: number; order: number }>()
  for (const d of ageDays) {
    const { label, order } = ageBand(d)
    const cur = ageCount.get(label) ?? { count: 0, order }
    cur.count++
    ageCount.set(label, cur)
  }
  const ages: AgeBucket[] = [...ageCount.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([label, v]) => ({ label, count: v.count }))
  const medianAgeDays = ageDays.length ? Math.round(ageDays[Math.floor((ageDays.length - 1) / 2)]) : null

  // Tag cloud — real tags off the official API, as a share of sampled listings.
  const tagCount = new Map<string, number>()
  for (const l of listings) {
    for (const t of new Set((l.tags ?? []).map(t => t.toLowerCase().trim()).filter(Boolean))) {
      tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
    }
  }
  const tagCloud: TagCloudItem[] = [...tagCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([tag, count]) => ({ tag, count, pct: parseFloat(((count / n) * 100).toFixed(1)) }))

  // Categories — resolve taxonomy ids to their full Etsy category path. On the
  // fast path we use the taxonomy only if it's already cached, and warm it for
  // next time rather than making the user wait 2.5s for category names.
  const ready = taxonomyIfReady()
  const names = waitForTaxonomy ? await taxonomyNames() : (ready ?? (warmTaxonomy(), new Map<number, string>()))
  // Distinguish "names not fetched yet" from "these listings have no category" —
  // the listings DO carry taxonomy_id either way.
  const categoriesPending = !waitForTaxonomy && !ready && listings.some(l => l.taxonomy_id != null)
  const catCount = new Map<string, number>()
  for (const l of listings) {
    if (l.taxonomy_id == null) continue
    const name = names.get(l.taxonomy_id)
    if (!name) continue
    catCount.set(name, (catCount.get(name) ?? 0) + 1)
  }
  const catTotal = [...catCount.values()].reduce((s, c) => s + c, 0)
  const categories: CategoryItem[] = [...catCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([category, count]) => ({ category, count, pct: Math.round((count / Math.max(catTotal, 1)) * 100) }))

  // Processing times — the seller-stated dispatch window.
  const procCount = new Map<string, number>()
  let procWeighted = 0, procN = 0
  for (const l of listings) {
    const label = processingLabel(l.processing_min, l.processing_max)
    if (!label) continue
    procCount.set(label, (procCount.get(label) ?? 0) + 1)
    procWeighted += ((l.processing_min ?? 0) + (l.processing_max ?? l.processing_min ?? 0)) / 2
    procN++
  }
  const processing: ProcessingBucket[] = [...procCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }))
  const avgProcessing = procN ? `${(procWeighted / procN).toFixed(1)} days avg` : null

  const { buckets, medianBucket, outliers } = priceHistogram(prices, sym)

  return {
    listingsAnalyzed: n,
    averagePrice: prices.length ? parseFloat((prices.reduce((s, p) => s + p, 0) / prices.length).toFixed(2)) : 0,
    medianPrice:  prices.length ? parseFloat(prices[Math.floor((prices.length - 1) / 2)].toFixed(2)) : 0,
    averageHearts: Math.round(totalHearts / n),
    totalViews,
    avgViews: Math.round(totalViews / n),
    avgDailyViews,
    avgWeeklyViews: avgDailyViews != null ? parseFloat((avgDailyViews * 7).toFixed(2)) : null,
    currency,
    priceSample: prices.length,
    tagCloud,
    categories,
    categoriesPending,
    priceBuckets: buckets,
    medianBucket,
    priceOutliers: outliers,
    ages,
    medianAgeDays,
    processing,
    avgProcessing,
  }
}

// ─── Real competition for related keywords ────────────────────────────────────
// buildKeywordStats can only set `competition` to how many SAMPLED listings use
// a tag (0–100) — it has no idea how many listings compete for that tag across
// all of Etsy. That made the "Etsy Competition" column a duplicate of "Tag
// Occurrences" under a misleading name.
//
// Etsy returns the true total in `count` on any search, and a limit=1 search is
// cheap, so we probe each related keyword for its real total. Runs through a
// small concurrency pool to stay under Etsy's ~10 req/sec ceiling; results are
// cached upstream for 30 minutes.

async function pooled<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++
      if (i >= items.length) return
      out[i] = await fn(items[i])
    }
  }))
  return out
}

/** Real active-listing total for a keyword. Returns null if the probe fails. */
export async function keywordCount(keyword: string): Promise<number | null> {
  try {
    const data = await etsyFetch<{ count?: number }>('/listings/active', { keywords: keyword, limit: 1, offset: 0 })
    return Number(data.count ?? 0)
  } catch (e) {
    console.error(`[Etsy] count probe "${keyword}" failed:`, e)
    return null
  }
}

/**
 * One search per keyword, returning everything measurable about it: the real
 * listing total AND the engagement of the listings that actually rank for it.
 *
 * Costs the same round-trip the count probe already spent — the sample is free
 * — and it's what lets related keywords carry their OWN measured views and
 * favourites instead of the parent query's numbers scaled by a made-up factor.
 */
async function keywordFacts(keyword: string): Promise<{
  count: number; avgViews: number; avgFavorites: number; favPerView: number; byMonth: number[]
} | null> {
  try {
    const { listings, count } = await searchEtsyListingsPaged(keyword, 20, 0, { skipImages: true })
    if (!listings.length) {
      return { count, avgViews: 0, avgFavorites: 0, favPerView: 0, byMonth: [] }
    }
    const v = listings.reduce((s, l) => s + (l.views ?? 0), 0)
    const f = listings.reduce((s, l) => s + (l.num_favorers ?? 0), 0)
    return {
      count,
      avgViews: Math.round(v / listings.length),
      avgFavorites: Math.round(f / listings.length),
      favPerView: parseFloat((f / Math.max(v, 1) * 100).toFixed(1)),
      byMonth: listingsByMonth(listings),
    }
  } catch (e) {
    console.error(`[Etsy] facts probe "${keyword}" failed:`, e)
    return null
  }
}

/**
 * Single source of truth for competition banding. Every surface must use this —
 * Bulk Keywords previously used its own 50k/500k thresholds, so the same keyword
 * could read "Med" on one screen and "Low" on another.
 */
export function levelForCount(count: number): 'Low' | 'Med' | 'High' {
  return count > 250_000 ? 'High' : count > 25_000 ? 'Med' : 'Low'
}

export { difficultyScore }

/**
 * Give each related keyword its OWN measured figures, from its own Etsy search.
 *
 * Everything set here is measured: `competition` is the real listing total,
 * views/favourites come from the listings that actually rank for THAT keyword
 * (not the parent query's numbers scaled by a factor), and difficulty is
 * computed from those real inputs.
 *
 * A keyword whose probe fails keeps its nulls and renders "—". A keyword with
 * zero listings keeps competition 0 but no difficulty: zero competition means
 * zero market, and scoring it "easy" would make a dead keyword the most
 * attractive row on the page.
 */
export async function enrichRelatedCompetition(related: KeywordData[]): Promise<KeywordData[]> {
  if (!related.length) return related
  const facts = await pooled(related, 4, r => keywordFacts(r.keyword))
  return related.map((r, i) => {
    const f = facts[i]
    if (!f) return r                       // probe failed → stays unknown
    if (f.count <= 0) return { ...r, competition: 0, competitionLevel: null, difficulty: null }
    return {
      ...r,
      competition:      f.count,
      competitionLevel: levelForCount(f.count),
      difficulty:       difficultyScore(f.count, f.favPerView),
      avgViews:         f.avgViews,
      avgFavorites:     f.avgFavorites,
      favPerView:       f.favPerView,
      listingsByMonth:  f.byMonth.length ? f.byMonth : r.listingsByMonth,
    }
  })
}

// ─── Near Matches ─────────────────────────────────────────────────────────────
// Morphological variants of the query (plural/singular, hyphenation, word
// order), each measured against its OWN real Etsy search — so `competition` here
// is a true active-listing total, not an interpolation.

function pluralize(w: string): string {
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies'
  if (/(s|x|z|ch|sh)$/.test(w)) return w + 'es'
  return w + 's'
}

function singularize(w: string): string | null {
  if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + 'y'
  if (/(ses|xes|zes|ches|shes)$/.test(w)) return w.slice(0, -2)
  if (/[^s]s$/.test(w)) return w.slice(0, -1)
  return null
}

function keywordVariants(query: string): { keyword: string; kind: NearMatch['kind'] }[] {
  const q = query.toLowerCase().trim().replace(/\s+/g, ' ')
  const out: { keyword: string; kind: NearMatch['kind'] }[] = [{ keyword: q, kind: 'exact' }]
  const push = (keyword: string, kind: NearMatch['kind']) => {
    const k = keyword.trim()
    if (k && k !== q && k.length > 1 && !out.some(o => o.keyword === k)) out.push({ keyword: k, kind })
  }

  const words = q.split(' ')
  const last = words[words.length - 1]
  const head = words.slice(0, -1)

  // Inflect the head noun — that's the word Etsy shoppers actually vary.
  push([...head, pluralize(last)].join(' '), 'plural')
  const sing = singularize(last)
  if (sing) push([...head, sing].join(' '), 'singular')

  if (q.includes('-')) push(q.replace(/-/g, ' '), 'hyphen')
  else if (words.length > 1) push(words.join('-'), 'hyphen')

  if (words.length > 1) push(words.join(''), 'spacing')
  if (words.length === 2) push(`${words[1]} ${words[0]}`, 'order')

  return out.slice(0, 6)
}

export async function getNearMatches(query: string): Promise<NearMatch[]> {
  const variants = keywordVariants(query)

  const results = await Promise.all(variants.map(async ({ keyword, kind }): Promise<NearMatch | null> => {
    try {
      // A small sample is enough — `count` (the real total) is the headline
      // number here, and the sample only anchors the engagement proxies.
      // No images: this table never renders one.
      const { listings, count } = await searchEtsyListingsPaged(keyword, 25, 0, { skipImages: true })
      if (!listings.length) return null

      // Every figure measured from this variant's own listings.
      const views = listings.reduce((s, l) => s + (l.views ?? 0), 0)
      const faves = listings.reduce((s, l) => s + (l.num_favorers ?? 0), 0)
      const favPerView = parseFloat((faves / Math.max(views, 1) * 100).toFixed(1))
      const tagOccurrences = listings.reduce(
        (s, l) => s + ((l.tags ?? []).some(t => t.toLowerCase().trim() === keyword) ? 1 : 0), 0)

      return {
        keyword,
        variantOf: query,
        kind,
        competition: count,
        competitionLevel: levelForCount(count),
        avgViews: Math.round(views / listings.length),
        avgFavorites: Math.round(faves / listings.length),
        favPerView,
        difficulty: difficultyScore(count, favPerView),
        tagOccurrences,
        listingsByMonth: listingsByMonth(listings),
      }
    } catch (e) {
      console.error(`[Etsy] near-match "${keyword}" failed:`, e)
      return null
    }
  }))

  // Most competitive first — that's the real, measured axis.
  return results.filter((r): r is NearMatch => r !== null).sort((a, b) => b.competition - a.competition)
}

// ─── Shop ─────────────────────────────────────────────────────────────────────

// Etsy's /shops/{shop_id} endpoint requires a NUMERIC shop id. When the user
// types a shop name (e.g. "silvercraft") we resolve it to an id via the
// findShops endpoint (GET /shops?shop_name=...) first.
export async function resolveShopId(shopIdOrName: string | number): Promise<number> {
  if (typeof shopIdOrName === 'number' || /^\d+$/.test(String(shopIdOrName).trim())) {
    return Number(shopIdOrName)
  }
  const data = await etsyFetch<{ results: { shop_id: number; shop_name: string }[] }>('/shops', {
    shop_name: String(shopIdOrName).trim(),
    limit:     1,
  })
  const first = data.results?.[0]
  if (!first) throw new Error(`No Etsy shop found matching "${shopIdOrName}".`)
  return first.shop_id
}

export async function getEtsyShop(shopIdOrName: string | number): Promise<EtsyShop> {
  const shopId = await resolveShopId(shopIdOrName)
  const data = await etsyFetch<Record<string, unknown>>(`/shops/${shopId}`)
  const created = Number(data.create_date ?? data.created_timestamp ?? 0)

  const shop: EtsyShop = {
    shop_id:              Number(data.shop_id ?? shopId),
    shop_name:            decodeEntities(String(data.shop_name ?? shopIdOrName)),
    title:                decodeEntities(String(data.title ?? data.shop_name ?? shopIdOrName)),
    listing_active_count: Number(data.listing_active_count ?? 0),
    num_favorers:         Number(data.num_favorers ?? 0),
    icon_url_fullxfull:   String(data.icon_url_fullxfull ?? ''),
    review_count:         Number(data.review_count ?? 0),
    review_average:       Number(data.review_average ?? 0),
    is_vacation:          Boolean(data.is_vacation),
    url:                  String(data.url ?? `https://www.etsy.com/shop/${encodeURIComponent(String(data.shop_name ?? ''))}`),
    sales:                data.transaction_sold_count != null ? Number(data.transaction_sold_count) : null,
    countryIso:           data.shop_location_country_iso ? String(data.shop_location_country_iso) : null,
    yearOpened:           created > 0 ? new Date(created * 1000).getFullYear() : null,
    createdAt:            created > 0 ? created : null,
    currencyCode:         String(data.currency_code ?? 'USD'),
    announcement:         decodeEntities(String(data.announcement ?? '')),
    digitalListingCount:  Number(data.digital_listing_count ?? 0),
  }

  // Every shop read contributes a day of history. See lib/snapshots.ts.
  recordShopSnapshot({
    shopId: shop.shop_id, shopName: shop.shop_name, sales: shop.sales,
    favorers: shop.num_favorers, reviewCount: shop.review_count,
    reviewAverage: shop.review_average, activeListings: shop.listing_active_count,
    isVacation: shop.is_vacation,
  }).catch(() => {})

  return shop
}

// ─── Shop reviews (public — key only) ─────────────────────────────────────────
// GET /v3/application/shops/{shop_id}/reviews. Buyer names are not exposed by the
// public API; we surface rating, review text, timestamp and the listing it's for.
export interface ShopReview {
  rating: number
  review: string
  language: string
  created_timestamp: number
  listing_id: number
}
export async function getShopReviews(shopIdOrName: string | number, limit = 12): Promise<ShopReview[]> {
  const shopId = await resolveShopId(shopIdOrName)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await etsyFetch<{ results: Record<string, any>[] }>(`/shops/${shopId}/reviews`, { limit: Math.min(Math.max(limit, 1), 100) })
  return (data.results ?? []).map((r) => ({
    rating:            Number(r.rating ?? 0),
    review:            String(r.review ?? ''),
    language:          String(r.language ?? ''),
    created_timestamp: Number(r.created_timestamp ?? 0),
    listing_id:        Number(r.listing_id ?? 0),
  }))
}

// ─── Shop sections (public — key only) ────────────────────────────────────────
// GET /v3/application/shops/{shop_id}/sections. The seller's own category tabs.
export interface ShopSection { section_id: number; title: string; active_listing_count: number }
export async function getShopSections(shopIdOrName: string | number): Promise<ShopSection[]> {
  const shopId = await resolveShopId(shopIdOrName)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await etsyFetch<{ results: Record<string, any>[] }>(`/shops/${shopId}/sections`)
  return (data.results ?? [])
    .map((s) => ({
      section_id:           Number(s.shop_section_id ?? s.section_id ?? 0),
      title:                String(s.title ?? ''),
      active_listing_count: Number(s.active_listing_count ?? 0),
    }))
    .sort((a, b) => b.active_listing_count - a.active_listing_count)
}

// ─── Listing variations / inventory (for Listing Audit) ───────────────────────
// GET /v3/application/listings/{listing_id}/inventory. Aggregates the distinct
// option properties (e.g. Size, Colour) and their values across the products.
// Degrades gracefully (empty) if the endpoint requires owner auth for a listing.
export interface ListingVariation { property: string; values: string[] }
export async function getListingVariations(listingId: number): Promise<{ hasVariations: boolean; variations: ListingVariation[] }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await etsyFetch<{ products?: any[] }>(`/listings/${listingId}/inventory`)
    const map = new Map<string, Set<string>>()
    for (const p of data.products ?? []) {
      for (const pv of p.property_values ?? []) {
        const name = String(pv.property_name ?? '').trim()
        if (!name) continue
        const set = map.get(name) ?? new Set<string>()
        for (const v of pv.values ?? []) set.add(String(v))
        map.set(name, set)
      }
    }
    const variations = [...map.entries()].map(([property, vals]) => ({ property, values: [...vals] }))
    return { hasVariations: variations.length > 0, variations }
  } catch (e) {
    console.error('[Etsy] listing inventory unavailable:', e)
    return { hasVariations: false, variations: [] }
  }
}

export async function getShopListings(shopIdOrName: string | number, limit = 25): Promise<EtsyListing[]> {
  const shopId = await resolveShopId(shopIdOrName)
  const data = await etsyFetch<{ results: Record<string, unknown>[] }>(
    `/shops/${shopId}/listings/active`,
    { limit: Math.min(limit, 100) }
  )
  return attachImages((data.results ?? []).map(mapListing))
}

// ─── Trending ─────────────────────────────────────────────────────────────────

export async function getTrendingListings(limit = 25): Promise<EtsyListing[]> {
  // Uses the official active listings endpoint sorted by score (Etsy's relevance)
  const data = await etsyFetch<{ results: Record<string, unknown>[] }>('/listings/active', {
    sort_on:  'score',
    limit:    Math.min(limit, 100),
  } as Record<string, string | number>)
  return attachImages((data.results ?? []).map(mapListing))
}

// ─── Trend chart + country (derived) ─────────────────────────────────────────

/**
 * REMOVED: the fabricated Etsy "seasonality" curve.
 *
 * This used to multiply average views by a hardcoded array
 * `[0.7,0.65,0.75,0.85,0.9,1.0,1.05,1.0,0.95,1.1,1.2,1.3]`, which produced an
 * IDENTICAL 12-month shape for every keyword — only the scale changed. Verified
 * 2026-07-15: "christmas ornament", "swimsuit" and "halloween costume" all
 * returned the same normalized curve and all peaked in the same month. The UI
 * then told sellers when to list, which is a confidently wrong answer to the one
 * question the tab exists to answer.
 *
 * Etsy's Open API exposes no search volume and no time series, so this signal
 * cannot be derived from Etsy alone. Real seasonality now comes from either
 * Google Ads monthly volumes (when configured) or our own snapshot history.
 * `buildListingSupplyByMonth` below is the honest Etsy-only alternative.
 */
export function buildTrendData(): TrendData[] {
  return []
}

/**
 * When sellers CREATED the listings that rank for a keyword, bucketed by
 * calendar month.
 *
 * This is real — `created_timestamp` has 100% coverage — but it measures SELLER
 * behaviour, not buyer demand. Sellers list ahead of the season they're chasing,
 * so it's a genuine planning signal as long as it's labelled for what it is and
 * never dressed up as search volume.
 */
/**
 * Rich market snapshot measured from a live listing sample — the real detail
 * behind the deeper tool views. Every field is computed from what Etsy returned
 * (price/views/num_favorers/tags/created_timestamp/shop_name); nothing is
 * modelled. Prices are scoped to the dominant currency (Etsy gives no FX rate),
 * so a mixed set never compares e.g. VND to USD.
 */
export function buildListingMarketStats(listings: EtsyListing[]): ListingMarketStats | null {
  if (!listings.length) return null
  const quantile = (sorted: number[], q: number): number => {
    if (!sorted.length) return 0
    const i = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)))
    return sorted[i]
  }

  const { currency, prices } = dominantCurrencyPrices(listings)   // already sorted asc
  const priceMedian = prices.length ? quantile(prices, 0.5) : 0
  const priceP25 = prices.length ? quantile(prices, 0.25) : 0
  const priceP75 = prices.length ? quantile(prices, 0.75) : 0
  const priceMin = prices.length ? prices[0] : 0
  const priceMax = prices.length ? prices[prices.length - 1] : 0

  // Price histogram: 6 bands spanning min→max of the dominant-currency prices.
  const priceBands: { band: string; count: number }[] = []
  if (prices.length && priceMax > priceMin) {
    const BANDS = 6
    const step = (priceMax - priceMin) / BANDS
    const counts = new Array(BANDS).fill(0)
    for (const p of prices) {
      const idx = Math.min(BANDS - 1, Math.floor((p - priceMin) / step))
      counts[idx]++
    }
    for (let i = 0; i < BANDS; i++) {
      const lo = priceMin + step * i
      const hi = i === BANDS - 1 ? priceMax : priceMin + step * (i + 1)
      priceBands.push({ band: `${Math.round(lo)}–${Math.round(hi)}`, count: counts[i] })
    }
  }

  const views = listings.map(l => l.views ?? 0).sort((a, b) => a - b)
  const favs  = listings.map(l => l.num_favorers ?? 0).sort((a, b) => a - b)
  const viewsMedian = quantile(views, 0.5)
  const viewsMax = views[views.length - 1] ?? 0
  const favMedian = quantile(favs, 0.5)
  const favTotal = favs.reduce((s, f) => s + f, 0)

  // Median of per-listing favorites/views — a real engagement ratio, not CTR.
  const engRatios = listings
    .filter(l => (l.views ?? 0) > 0)
    .map(l => (l.num_favorers ?? 0) / (l.views ?? 1) * 100)
    .sort((a, b) => a - b)
  const engagementPct = engRatios.length ? parseFloat(quantile(engRatios, 0.5).toFixed(1)) : 0

  const uniqueShops = new Set(listings.map(l => l.shop_name).filter(Boolean)).size

  // Median listing age in months, from real created timestamps.
  const now = Date.now()
  const ages = listings
    .filter(l => l.created_timestamp)
    .map(l => (now - (l.created_timestamp as number) * 1000) / (1000 * 60 * 60 * 24 * 30.44))
    .sort((a, b) => a - b)
  const ageMonthsMedian = ages.length ? parseFloat(quantile(ages, 0.5).toFixed(1)) : null

  // Tag adoption across the sample.
  const n = listings.length
  const tagCounts = new Map<string, number>()
  for (const l of listings) {
    for (const t of new Set((l.tags ?? []).map(x => x.toLowerCase().trim()).filter(Boolean))) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
    }
  }
  const topTags = [...tagCounts.entries()]
    .map(([tag, c]) => ({ tag, pct: Math.round((c / n) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 12)

  // Top listings by real views.
  const topListings = [...listings]
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 5)
    .map(l => ({
      title: decodeEntities(l.title ?? ''),
      url: l.url,
      price: l.price?.amount ? parseFloat((l.price.amount / (l.price.divisor || 100)).toFixed(2)) : null,
      views: l.views ?? 0,
      favorites: l.num_favorers ?? 0,
    }))

  return {
    sample: n, currency,
    priceMin: parseFloat(priceMin.toFixed(2)), priceMax: parseFloat(priceMax.toFixed(2)),
    priceMedian: parseFloat(priceMedian.toFixed(2)),
    priceP25: parseFloat(priceP25.toFixed(2)), priceP75: parseFloat(priceP75.toFixed(2)),
    priceBands, viewsMedian, viewsMax, favMedian, favTotal, engagementPct,
    uniqueShops, ageMonthsMedian, topTags, topListings,
  }
}

export function buildListingSupplyByMonth(listings: EtsyListing[]): { month: string; value: number }[] {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const counts = new Array(12).fill(0)
  let dated = 0
  for (const l of listings) {
    if (!l.created_timestamp) continue
    counts[new Date(l.created_timestamp * 1000).getUTCMonth()]++
    dated++
  }
  if (!dated) return []
  return months.map((month, i) => ({ month, value: counts[i] }))
}

export function buildCountryData(): CountryData[] {
  // The Etsy Open API does not expose buyer country breakdowns.
  // This section is not available and should not be displayed.
  return []
}

// ─── Owner-scoped (OAuth) calls ───────────────────────────────────────────────
// These use the shop owner's access token (Authorization: Bearer) in addition to
// the app key, and are never shared-cached (per-user private data).

class EtsyAuthError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

async function etsyAuthedFetch<T = unknown>(path: string, accessToken: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${ETSY_BASE}${path}`)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  const res = await fetch(url.toString(), {
    headers: {
      'x-api-key':     ETSY_KEY_HEADER,
      'Authorization': `Bearer ${accessToken}`,
      'Accept':        'application/json',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new EtsyAuthError(res.status, `Etsy API error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export function isEtsyAuthExpired(err: unknown): boolean {
  return err instanceof EtsyAuthError && (err.status === 401 || err.status === 403)
}

export interface OwnerShop {
  shop_id: number
  shop_name: string
  currency_code: string
  listing_active_count: number
  num_favorers: number
  icon_url_fullxfull: string
  review_count: number
  review_average: number
  url: string
}

// getShopByOwnerUserId → GET /users/{user_id}/shops
export async function getShopByOwner(accessToken: string, userId: string): Promise<OwnerShop> {
  const d = await etsyAuthedFetch<Record<string, unknown>>(`/users/${userId}/shops`, accessToken)
  // Endpoint returns the Shop object directly (some accounts wrap in results[]).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s: any = Array.isArray((d as any).results) ? (d as any).results[0] : d
  return {
    shop_id:              Number(s?.shop_id ?? 0),
    shop_name:            String(s?.shop_name ?? ''),
    currency_code:        String(s?.currency_code ?? 'USD'),
    listing_active_count: Number(s?.listing_active_count ?? 0),
    num_favorers:         Number(s?.num_favorers ?? 0),
    icon_url_fullxfull:   String(s?.icon_url_fullxfull ?? ''),
    review_count:         Number(s?.review_count ?? 0),
    review_average:       Number(s?.review_average ?? 0),
    url:                  String(s?.url ?? ''),
  }
}

// Owner listings by state (active/draft/inactive/expired/sold_out). Requires listings_r.
export async function getOwnerListings(accessToken: string, shopId: number, state = 'active', limit = 100): Promise<EtsyListing[]> {
  const d = await etsyAuthedFetch<{ results: Record<string, unknown>[] }>(
    `/shops/${shopId}/listings`, accessToken,
    { state, limit: Math.min(limit, 100), includes: 'Images' },
  )
  return (d.results ?? []).map(mapListing)
}

export interface ShopReceipt {
  receipt_id: number
  created_timestamp: number
  grandtotal: number   // in currency units
  currency: string
  country_iso: string
  is_paid: boolean
  is_shipped: boolean
}

/**
 * Page through receipts. Etsy caps `limit` at 100 per call, so a single request
 * gives at most 100 orders — enough for a total, too thin for a country map or
 * a fulfilment breakdown. Stops early when a short page proves the end.
 */
export async function getShopReceiptsPaged(accessToken: string, shopId: number, max = 400): Promise<ShopReceipt[]> {
  const out: ShopReceipt[] = []
  const target = Math.min(Math.max(max, 1), 1000)
  for (let offset = 0; out.length < target; offset += 100) {
    const page = await getShopReceipts(accessToken, shopId, 100, offset)
    out.push(...page)
    if (page.length < 100) break     // last page
  }
  return out.slice(0, target)
}

// getShopReceipts → GET /shops/{shop_id}/receipts. Requires transactions_r.
export async function getShopReceipts(accessToken: string, shopId: number, limit = 100, offset = 0): Promise<ShopReceipt[]> {
  const d = await etsyAuthedFetch<{ results: Record<string, unknown>[] }>(
    `/shops/${shopId}/receipts`, accessToken,
    { limit: Math.min(limit, 100), offset: Math.max(0, offset) },
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (d.results ?? []).map((r: any) => {
    const gt = r.grandtotal ?? r.total_price ?? {}
    return {
      receipt_id:        Number(r.receipt_id ?? 0),
      created_timestamp: Number(r.created_timestamp ?? r.create_timestamp ?? 0),
      grandtotal:        Number(gt.amount ?? 0) / Number(gt.divisor ?? 100),
      currency:          String(gt.currency_code ?? 'USD'),
      country_iso:       String(r.country_iso ?? ''),
      is_paid:           Boolean(r.is_paid),
      is_shipped:        Boolean(r.is_shipped),
    }
  })
}

// ─── Top Sellers (real-sales leaderboard) ─────────────────────────────────────
// Scans the top active listings for a keyword/niche, groups them by shop, then
// resolves each shop for its REAL lifetime sales.
//
// Correcting a long-standing wrong assumption in this file: the Etsy Open API
// DOES expose sales. `/shops/{id}.transaction_sold_count` is the shop's real
// lifetime transaction count — verified 2026-07-15 against CaitlynMinimalist:
// we read 3,799,140 where eRank displayed 3,798,477 (ours is fresher). This
// leaderboard used to rank by favorites because of that mistaken belief.
//
// Still genuinely unavailable: per-LISTING sales (listings expose `quantity`,
// which is stock, not sales), and any historical sales series — Etsy returns
// only a lifetime total, so a sales *trend* requires snapshotting over time.
export interface TopSeller {
  shop_id:     number
  shop_name:   string
  sales:       number | null   // real lifetime transactions; null if the shop lookup failed
  listings:    number          // sampled listings appearing for this keyword
  activeListings: number | null
  totalViews:  number
  totalFaves:  number
  favorers:    number | null
  reviewCount: number | null
  reviewAverage: number | null
  countryIso:  string | null
  yearOpened:  number | null
  isVacation:  boolean
  avgPrice:    number
  currency:    string
  topListing:  { title: string; url: string; views: number }
  shopUrl:     string
}

/** Real shop facts behind a Top Sellers row. Null on lookup failure — never faked. */
async function shopFacts(shopId: number): Promise<Partial<TopSeller> | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = await etsyFetch<Record<string, any>>(`/shops/${shopId}`)
    const created = Number(s.create_date ?? s.created_timestamp ?? 0)
    return {
      sales:          s.transaction_sold_count != null ? Number(s.transaction_sold_count) : null,
      activeListings: s.listing_active_count != null ? Number(s.listing_active_count) : null,
      favorers:       s.num_favorers != null ? Number(s.num_favorers) : null,
      reviewCount:    s.review_count != null ? Number(s.review_count) : null,
      reviewAverage:  s.review_average != null ? Number(s.review_average) : null,
      countryIso:     s.shop_location_country_iso ? String(s.shop_location_country_iso) : null,
      yearOpened:     created > 0 ? new Date(created * 1000).getFullYear() : null,
      isVacation:     Boolean(s.is_vacation),
    }
  } catch (e) {
    console.error(`[Etsy] shop ${shopId} lookup failed:`, e)
    return null
  }
}

export async function getTopSellers(query: string, scan = 100): Promise<TopSeller[]> {
  const { listings } = await searchEtsyListingsPaged(query, Math.min(Math.max(scan, 1), 100), 0)

  // Group by shop_id (stable) rather than shop_name (display text).
  const byShop = new Map<number, EtsyListing[]>()
  for (const l of listings) {
    if (!l.shop_id) continue
    const arr = byShop.get(l.shop_id) ?? []
    arr.push(l)
    byShop.set(l.shop_id, arr)
  }

  const base = [...byShop.entries()].map(([shop_id, ls]) => {
    const totalViews = ls.reduce((s, l) => s + (l.views ?? 0), 0)
    const totalFaves = ls.reduce((s, l) => s + (l.num_favorers ?? 0), 0)
    const priced     = ls.filter(l => l.price?.amount)
    // Prices here are within one shop, so a single currency — safe to mean.
    const avgPrice   = priced.length
      ? priced.reduce((s, l) => s + l.price.amount / (l.price.divisor || 100), 0) / priced.length
      : 0
    const top = [...ls].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0]
    const shop_name = (ls[0]?.shop_name ?? '').trim()
    return {
      shop_id, shop_name, ls, totalViews, totalFaves,
      avgPrice: parseFloat(avgPrice.toFixed(2)),
      currency: priced[0]?.price?.currency_code ?? 'USD',
      topListing: { title: top?.title ?? '', url: top?.url ?? '', views: top?.views ?? 0 },
    }
  })

  // Resolve real sales for the shops most present in this niche. Capped because
  // each is its own request against a ~10/sec budget.
  const ranked = base.sort((a, b) => (b.totalFaves - a.totalFaves) || (b.totalViews - a.totalViews)).slice(0, 40)
  const facts = await pooled(ranked, 4, r => shopFacts(r.shop_id))

  // Record today's state for every shop we just read. Etsy publishes no sales
  // history, so this opportunistic capture IS the history — it accrues from
  // ordinary traffic without waiting on a scheduled job.
  recordShopSnapshots(ranked.map((r, i) => ({
    shopId: r.shop_id,
    shopName: r.shop_name,
    sales: facts[i]?.sales ?? null,
    favorers: facts[i]?.favorers ?? null,
    reviewCount: facts[i]?.reviewCount ?? null,
    reviewAverage: facts[i]?.reviewAverage ?? null,
    activeListings: facts[i]?.activeListings ?? null,
    isVacation: facts[i]?.isVacation ?? false,
  })))
  recordListingSnapshots(listings)

  const sellers: TopSeller[] = ranked.map((r, i) => {
    const f = facts[i] ?? {}
    return {
      shop_id:       r.shop_id,
      shop_name:     r.shop_name,
      sales:         f.sales ?? null,
      listings:      r.ls.length,
      activeListings: f.activeListings ?? null,
      totalViews:    r.totalViews,
      totalFaves:    r.totalFaves,
      favorers:      f.favorers ?? null,
      reviewCount:   f.reviewCount ?? null,
      reviewAverage: f.reviewAverage ?? null,
      countryIso:    f.countryIso ?? null,
      yearOpened:    f.yearOpened ?? null,
      isVacation:    f.isVacation ?? false,
      avgPrice:      r.avgPrice,
      currency:      r.currency,
      topListing:    r.topListing,
      shopUrl:       `https://www.etsy.com/shop/${encodeURIComponent(r.shop_name)}`,
    }
  })

  // Rank by REAL sales. Shops whose lookup failed have unknown sales and sort
  // last rather than being silently treated as zero.
  return sellers.sort((a, b) => {
    if (a.sales == null && b.sales == null) return b.totalFaves - a.totalFaves
    if (a.sales == null) return 1
    if (b.sales == null) return -1
    return b.sales - a.sales
  })
}

// ─── Trend Buzz (emerging tags/keywords) ──────────────────────────────────────
// Aggregates the REAL tags the official API returns across a sample of listings
// (trending, or scoped to a keyword). `heat` is a relative index computed from
// two real measurements — how many sampled listings use the tag × how well those
// listings engage — and is labelled an index, not a search volume. Etsy exposes
// no search counts.
export interface BuzzItem {
  keyword:    string
  listings:   number   // sampled listings using this tag — real
  avgViews:   number   // real, from those listings
  avgFavorites: number // real
  heat:       number   // relative 0–100 index over real inputs
  competition: 'Low' | 'Med' | 'High'
  /** Real creation-month histogram of the listings using this tag (Jan→Dec). */
  listingsByMonth: number[]
  /** Median age in days of the listings using this tag — a real "is this new?" signal. */
  medianAgeDays: number | null
}

export async function getTrendBuzz(query?: string, scan = 100): Promise<BuzzItem[]> {
  const listings = query && query.trim().length >= 2
    ? (await searchEtsyListingsPaged(query.trim(), Math.min(scan, 100), 0)).listings
    : await getTrendingListings(Math.min(scan, 100))

  const stop = new Set(['with','from','this','that','your','have','will','handmade','gift','gifts','custom','personalized'])
  // Keep the listings per tag so every metric is measured from them.
  const agg = new Map<string, EtsyListing[]>()
  for (const l of listings) {
    const tags = (l.tags ?? []).map(t => t.toLowerCase().trim()).filter(t => t.length > 2 && !stop.has(t))
    for (const t of new Set(tags)) {
      const arr = agg.get(t) ?? []
      arr.push(l)
      agg.set(t, arr)
    }
  }

  const now = Date.now() / 1000
  const entries = [...agg.entries()].filter(([, ls]) => ls.length >= 2)
  const scoreOf = (ls: EtsyListing[]) =>
    ls.length * Math.log10((ls.reduce((s, l) => s + (l.views ?? 0), 0) / ls.length) + 10)
  const maxScore = Math.max(1, ...entries.map(([, ls]) => scoreOf(ls)))

  return entries
    .map(([keyword, ls]) => {
      const views = ls.reduce((s, l) => s + (l.views ?? 0), 0)
      const faves = ls.reduce((s, l) => s + (l.num_favorers ?? 0), 0)
      const ages = ls
        .filter(l => l.created_timestamp && l.created_timestamp < now)
        .map(l => (now - l.created_timestamp!) / 86_400)
        .sort((a, b) => a - b)
      return {
        keyword,
        listings: ls.length,
        avgViews: Math.round(views / ls.length),
        avgFavorites: Math.round(faves / ls.length),
        heat: Math.round((scoreOf(ls) / maxScore) * 100),
        competition: (ls.length >= 12 ? 'High' : ls.length >= 6 ? 'Med' : 'Low') as BuzzItem['competition'],
        listingsByMonth: listingsByMonth(ls),
        // Genuinely emerging tags are carried by young listings — a real signal,
        // where the old sine-wave sparkline was none.
        medianAgeDays: ages.length ? Math.round(ages[Math.floor((ages.length - 1) / 2)]) : null,
      }
    })
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 30)
}
