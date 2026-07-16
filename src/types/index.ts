// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface IUser {
  _id: string
  name: string
  email: string
  password: string
  role: 'user' | 'admin'
  plan: 'free' | 'grow' | 'scale'
  isVerified: boolean
  etsyShopId?: string
  etsyAccessToken?: string
  etsyRefreshToken?: string
  createdAt: Date
  updatedAt: Date
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'user' | 'admin'
  plan: 'free' | 'grow' | 'scale'
  isVerified: boolean
  etsyShopId?: string
}

export interface IOTP {
  _id?: string
  email: string
  code: string
  type: 'reset' | 'verify'
  expiresAt: Date
  createdAt: Date
}

// ─── Keyword ──────────────────────────────────────────────────────────────────
//
// EVERY field here is measured from the Etsy Open API. Nothing is scaled,
// interpolated or shaped by a formula-with-invented-coefficients.
//
// Deliberately ABSENT: search volume, clicks and CTR. Etsy publishes none of
// them. Earlier versions shipped `avgSearches` (which was really listing views
// multiplied by an invented factor) and `avgClicks` (really favourites). Both
// are gone rather than relabelled-but-kept, because a plausible number is worse
// than a missing one. Real Google volume appears in `googleSearches` when the
// Google Ads credentials are present, and is null otherwise.
export interface KeywordData {
  keyword: string
  /** Real total of active Etsy listings for this keyword, from its own search. */
  competition: number | null
  competitionLevel: 'Low' | 'Med' | 'High' | null
  /** Mean lifetime views of the listings ranking for this keyword. Etsy's own `views`. */
  avgViews: number | null
  /** Mean `num_favorers` of those listings. */
  avgFavorites: number | null
  /** favourites ÷ views, as a %. Real ratio of two real Etsy fields. */
  favPerView: number | null
  /** How many of the sampled listings for the parent query carry this exact tag. */
  tagOccurrences: number
  charCount: number
  wordCount: number
  /** 0–100 estimate computed FROM real inputs (listing supply + engagement). Labelled as an estimate everywhere. */
  difficulty: number | null
  googleSearches: number | null
  /**
   * Calendar-month histogram (Jan→Dec) of when the listings using this tag were
   * created — real, from `created_timestamp` (100% field coverage). Replaces a
   * sine wave whose shape was a function of the row's index in the array.
   */
  listingsByMonth: number[]
}

export interface KeywordStats {
  /** Mean lifetime views across the sampled listings. Real — Etsy returns `views`. */
  avgViews: number
  /** Mean favourites across the sampled listings. Real — Etsy returns `num_favorers`. */
  avgFavorites: number
  /** favourites ÷ views as a %. A real ratio, not a click-through rate — Etsy exposes no clicks. */
  favPerView: number
  etsyCompetition: number       // sampled listings used to derive the stats
  totalResults: number          // real total active Etsy listings for the keyword
  difficulty: number            // keyword difficulty 0–100 (estimate from real inputs)
  difficultyLabel: 'Easy' | 'Medium' | 'Hard'
  avgPrice: number
  currency: string
  /** Real Google monthly search volume. null unless Google Ads is configured — never faked. */
  googleSearches: number | null
}

// ─── Search Results Analysis (all derived from the sampled live listings) ─────
export interface TagCloudItem  { tag: string; count: number; pct: number }
export interface CategoryItem  { category: string; count: number; pct: number }
export interface PriceBucket   { label: string; value: number; count: number }
export interface ProcessingBucket { label: string; count: number }

export interface AgeBucket { label: string; count: number }

export interface SearchAnalysis {
  listingsAnalyzed: number
  averagePrice: number
  medianPrice: number
  averageHearts: number
  totalViews: number
  avgViews: number
  avgDailyViews: number | null    // null when no listing exposes a creation date
  avgWeeklyViews: number | null
  // Etsy returns each listing in its OWN currency and exposes no FX rate, so
  // every price figure below covers only the `priceSample` listings priced in
  // `currency` (the most common one). Mixing them would be meaningless.
  currency: string
  priceSample: number
  tagCloud: TagCloudItem[]
  categories: CategoryItem[]
  /**
   * True when the category names weren't resolved because the taxonomy (a 365KB,
   * ~2.5s fetch) wasn't cached yet — NOT because these listings lack categories.
   * The UI must say "loading", not "none", or it reports a fetch delay as a fact
   * about the data.
   */
  categoriesPending?: boolean
  priceBuckets: PriceBucket[]
  medianBucket: string | null
  /** Listings above the histogram's clipped domain, lumped into the last bucket. */
  priceOutliers: number
  ages: AgeBucket[]
  medianAgeDays: number | null
  processing: ProcessingBucket[]
  avgProcessing: string | null
}

// A morphological variant of the query (plural, hyphenation, word order…),
// each measured against its OWN real Etsy search — no interpolation from the parent.
export interface NearMatch {
  keyword: string
  variantOf: string
  kind: 'plural' | 'singular' | 'hyphen' | 'spacing' | 'order' | 'exact'
  competition: number          // real total active listings
  competitionLevel: 'Low' | 'Med' | 'High'
  avgViews: number | null      // real, from this variant's own listings
  avgFavorites: number | null  // real
  favPerView: number | null    // real ratio
  difficulty: number
  tagOccurrences: number
  listingsByMonth: number[]    // real creation-month histogram
}

/** One row of the Bulk Keyword comparison. Nulls mean the probe failed — never zero. */
export interface BulkKeywordRow {
  keyword: string
  competition: number | null          // real total active Etsy listings
  competitionLevel: 'Low' | 'Med' | 'High' | null
  difficulty: number | null
  avgViews: number | null
  avgFavorites: number | null
  favPerView: number | null
  medianPrice: number | null
  currency: string
  charCount: number
  wordCount: number
  googleSearches: number | null
  error: boolean
  /**
   * No live Etsy listings match at all. Critically NOT the same as "easy":
   * zero competition means zero market. Left unflagged, such a keyword scores
   * the lowest difficulty on the page and reads as the best opportunity.
   */
  noMarket: boolean
}

/**
 * A listing measured against its real competitors, not against generic advice.
 * `enoughData: false` when the niche returned too few rivals to median.
 */
export interface ListingBenchmark {
  niche: string
  sample: number
  enoughData: boolean
  totalCompetition?: number
  currency?: string
  medianTags?: number
  medianTitle?: number
  medianImages?: number
  medianViews?: number
  medianFavorites?: number
  medianPrice?: number | null
  priceSample?: number
  yourPricePercentile?: number | null
  yourViewsPercentile?: number
  yourFavoritesPercentile?: number
  /** False when the listing's currency differs from the niche's dominant one. */
  priceComparable?: boolean
}

export interface KeywordSearchResponse {
  query: string
  stats: KeywordStats
  related: KeywordData[]
  listings: EtsyListing[]
  analysis?: SearchAnalysis
  nearMatches?: NearMatch[]
  cachedAt?: string
}

// ─── Etsy ─────────────────────────────────────────────────────────────────────
export interface EtsyListing {
  listing_id: number
  title: string
  description: string
  price: { amount: number; divisor: number; currency_code: string }
  quantity: number
  views: number
  num_favorers: number
  tags: string[]
  images: { url_570xN: string; url_75x75: string }[]
  url: string
  shop_name: string
  state: string
  // Optional — present on search/batch results, used by Search Results Analysis.
  shop_id?: number
  taxonomy_id?: number
  created_timestamp?: number   // epoch seconds; listing age → views/day
  processing_min?: number      // seller's stated processing window, in days
  processing_max?: number
}

export interface EtsyShop {
  shop_id: number
  shop_name: string
  title: string
  listing_active_count: number
  num_favorers: number
  icon_url_fullxfull?: string
  review_count?: number
  review_average?: number
  is_vacation?: boolean
  url?: string
  // Real figures straight off the shop record. `sales` is Etsy's own
  // transaction_sold_count — the API DOES expose this (an older comment in
  // etsy.ts wrongly claimed it didn't).
  sales?: number | null
  countryIso?: string | null
  yearOpened?: number | null
  createdAt?: number | null
  currencyCode?: string
  announcement?: string
  digitalListingCount?: number
}

export interface EtsyShopAnalytics {
  shop: EtsyShop
  listings: EtsyListing[]
  totalViews: number
  totalFavorites: number
  totalSales: number
}

export interface TrendPoint { month: string; value: number }
export type TrendPlatform = 'etsy' | 'google' | 'amazon' | 'ebay'
export interface TrendData { platform: TrendPlatform; points: TrendPoint[] }
export interface CountryData { country: string; percentage: number; color: string }

// ─── Snapshots (our own history — Etsy returns state, never a series) ─────────
// Etsy exposes a shop's LIFETIME sales total and nothing else: no per-day series,
// no backfill. Sales velocity, "yesterday", rank history and listing-change
// tracking are therefore only possible if we record state ourselves, daily, from
// now on. One row per shop per UTC day.
//
// Note this is NOT the Etsy caching rule in cache.ts: we never re-display stale
// Etsy content as current. A snapshot is a dated measurement, shown as history.
export interface IShopSnapshot {
  _id?: string
  shopId: number
  shopName: string
  day: string              // YYYY-MM-DD (UTC) — the dedupe key
  sales: number | null     // transaction_sold_count at capture time
  favorers: number | null
  reviewCount: number | null
  reviewAverage: number | null
  activeListings: number | null
  isVacation: boolean
  capturedAt: Date
}

export interface IListingSnapshot {
  _id?: string
  listingId: number
  shopId: number
  day: string
  title: string
  tags: string[]
  price: number
  currency: string
  views: number
  favorers: number
  capturedAt: Date
}

export interface ITrackedShop {
  _id?: string
  userId: string
  shopId: number
  shopName: string
  createdAt?: Date
}

/** A day-over-day delta derived from two snapshots. */
export interface SalesPoint {
  day: string
  sales: number          // cumulative lifetime total that day
  sold: number | null    // units sold that day; null for the first day (no prior to diff)
}

export interface ShopVelocity {
  shopId: number
  shopName: string
  trackedSince: string | null
  days: number
  points: SalesPoint[]
  soldYesterday: number | null
  soldLast7: number | null
  soldLast30: number | null
  avgPerDay: number | null
  latestSales: number | null
}

// ─── Orders (own shop, OAuth) ─────────────────────────────────────────────────
// Receipts are the ONLY place Etsy exposes buyer country, and only for your own
// shop under OAuth. There's no public buyer-geography endpoint for other shops.
export interface OrderCountry { iso: string; name: string; orders: number; revenue: number; pct: number }
export interface UnshippedOrder {
  receiptId: number; createdAt: number; ageDays: number
  total: number; currency: string; countryIso: string | null
}

export interface OrdersInsight {
  connected: boolean
  /** True when the caller isn't signed in at all — a different fix from "connect your shop". */
  needsAuth?: boolean
  sampled?: number
  currency?: string
  revenue?: number
  orders?: number
  avgOrder?: number
  countries?: OrderCountry[]
  fulfilment?: { paid: number; unpaid: number; shipped: number; unshipped: number; awaitingShipment: number }
  unshippedList?: UnshippedOrder[]
  oldestOrder?: number | null
  newestOrder?: number | null
}

// ─── MongoDB Document Types ───────────────────────────────────────────────────
export interface IKeywordCache {
  _id?: string
  keyword: string
  data: KeywordSearchResponse
  createdAt: Date
  expiresAt: Date
}

export interface IKeywordHistory {
  _id?: string
  keyword: string
  searchedAt: Date
  userId?: string
}

// ─── API Response ─────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  errors?: Record<string, string>
  cached?: boolean
}
