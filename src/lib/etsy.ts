/**
 * Apify Etsy Scraper — shahidirfan/Etsy-Scraper
 * Actor ID: o5ps1KPZEaZtgWoe0
 * Pricing: Pay per usage
 * Confirmed output fields from live run:
 *   listingId, title, price (number), currency (symbol e.g. "€"),
 *   priceFormatted, image, imageUrls (array), url,
 *   seller, shopId, shopName, rating, reviewCount
 */
import type {
  EtsyListing, EtsyShop, KeywordData,
  KeywordSearchResponse, TrendData, CountryData,
} from '@/types'

const APIFY_TOKEN = process.env.APIFY_API_TOKEN ?? ''
const APIFY_BASE  = 'https://api.apify.com/v2'
const ACTOR_ID    = 'shahidirfan~Etsy-Scraper'

if (!APIFY_TOKEN && process.env.NODE_ENV === 'production') {
  console.warn('[Apify] APIFY_API_TOKEN is not set — API calls will fail.')
}

// ─── Currency symbol → ISO code ───────────────────────────────────────────────
const SYMBOL_TO_CODE: Record<string, string> = {
  '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY',
  'CA$': 'CAD', 'AU$': 'AUD', 'kr': 'SEK', 'zł': 'PLN',
}
function toCurrencyCode(sym: string): string {
  return SYMBOL_TO_CODE[sym.trim()] ?? sym.trim() ?? 'USD'
}

// ─── Core runner ─────────────────────────────────────────────────────────────

interface ApifyInput {
  searchQuery?:        string
  searchUrl?:          string
  results_wanted?:     number
  maxPages?:           number
  proxyConfiguration?: { useApifyProxy: boolean; apifyProxyGroups?: string[] }
}

async function runActor(input: ApifyInput): Promise<Record<string, unknown>[]> {
  const url = `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      ...input,
      proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Apify error ${res.status}: ${text}`)
  }

  const data = await res.json()
  return Array.isArray(data) ? data : []
}

// ─── Map Apify output → EtsyListing ──────────────────────────────────────────

function mapItem(item: Record<string, unknown>): EtsyListing {
  const rawPrice = parseFloat(String(item.price ?? 0))
  const divisor  = 100
  const amount   = Math.round(rawPrice * divisor)

  // imageUrls is string[], image is primary string
  const rawImageUrls = Array.isArray(item.imageUrls) ? (item.imageUrls as string[]) : []
  const primaryImage = String(item.image ?? rawImageUrls[0] ?? '')
  const images = rawImageUrls.length
    ? rawImageUrls.map(src => ({ url_570xN: src, url_75x75: src }))
    : primaryImage
      ? [{ url_570xN: primaryImage, url_75x75: primaryImage }]
      : []

  // seller field can be "ShopName Designed by ShopName Shop owned by..." — take first word chunk
  const rawSeller = String(item.shopName ?? item.seller ?? '')
  const shopName  = rawSeller.split(' Designed by')[0].split(' Shop owned')[0].trim()

  return {
    listing_id:   Number(item.listingId ?? 0),
    title:        String(item.title ?? ''),
    description:  '',
    price: {
      amount,
      divisor,
      currency_code: toCurrencyCode(String(item.currency ?? 'USD')),
    },
    quantity:     1,
    views:        Number(item.reviewCount ?? 0),
    num_favorers: Math.round((Number(item.rating ?? 0)) * 10), // scale rating to int
    tags:         [],
    images,
    url:          String(item.url ?? ''),
    shop_name:    shopName,
    state:        'active',
  }
}

// ─── Search listings ──────────────────────────────────────────────────────────

export async function searchEtsyListings(query: string, limit = 25): Promise<EtsyListing[]> {
  const raw = await runActor({
    searchQuery:    query,
    results_wanted: limit,
    maxPages:       2,
  })
  return raw.map(mapItem)
}

// ─── Keyword stats ────────────────────────────────────────────────────────────

export function buildKeywordStats(query: string, listings: EtsyListing[]): KeywordSearchResponse {
  if (!listings.length) {
    return {
      query,
      stats: { avgSearches: 0, avgClicks: 0, avgCtr: 0, etsyCompetition: 0 },
      related: [],
      listings: [],
    }
  }

  const totalViews     = listings.reduce((s, l) => s + (l.views ?? 0), 0)
  const totalFavorites = listings.reduce((s, l) => s + (l.num_favorers ?? 0), 0)
  const avgSearches    = Math.round(totalViews / listings.length)
  const avgCtr         = parseFloat((totalFavorites / Math.max(totalViews, 1) * 100).toFixed(1))
  const avgClicks      = Math.round(avgSearches * (avgCtr / 100))
  const competition    = listings.length

  // Derive related keywords from listing titles (no tags in this actor)
  const wordCounts: Record<string, number> = {}
  const stopWords = new Set(['with','from','this','that','your','have','will','been','they','their','what','when'])
  listings.forEach(l => {
    l.title.toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !query.toLowerCase().includes(w) && !stopWords.has(w))
      .forEach(w => { wordCounts[w] = (wordCounts[w] ?? 0) + 1 })
  })

  const related: KeywordData[] = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word, count], i) => {
      const compLevel = count >= 15 ? 'High' : count >= 7 ? 'Med' : 'Low'
      const trend = Array.from({ length: 12 }, (_, m) =>
        Math.max(10, Math.round(count * (0.7 + 0.3 * Math.sin((m + i) * 0.8))))
      )
      return {
        keyword:          word,
        avgSearches:      count * 120,
        avgClicks:        count * 12,
        avgCtr:           10,
        competition:      count,
        competitionLevel: compLevel as 'Low' | 'Med' | 'High',
        tagOccurrences:   count,
        charCount:        word.length,
        googleSearches:   count * 350,
        trend,
      }
    })

  return {
    query,
    stats: { avgSearches, avgClicks, avgCtr, etsyCompetition: competition },
    related,
    listings,
    cachedAt: new Date().toISOString(),
  }
}

// ─── Shop ─────────────────────────────────────────────────────────────────────

export async function getEtsyShop(shopIdOrName: string): Promise<EtsyShop> {
  const raw = await runActor({
    searchUrl:      `https://www.etsy.com/shop/${shopIdOrName}`,
    results_wanted: 1,
  })
  const item = raw[0] ?? {}
  return {
    shop_id:              Number(item.shopId ?? 0),
    shop_name:            String(item.shopName ?? item.seller ?? shopIdOrName).split(' Designed by')[0].trim(),
    title:                String(item.shopName ?? shopIdOrName).split(' Designed by')[0].trim(),
    listing_active_count: 0,
    num_favorers:         0,
    icon_url_fullxfull:   '',
  }
}

export async function getShopListings(shopIdOrName: string | number, limit = 25): Promise<EtsyListing[]> {
  const raw = await runActor({
    searchUrl:      `https://www.etsy.com/shop/${shopIdOrName}`,
    results_wanted: limit,
  })
  return raw.map(mapItem)
}

// ─── Trending ─────────────────────────────────────────────────────────────────

export async function getTrendingListings(limit = 25): Promise<EtsyListing[]> {
  const raw = await runActor({
    searchQuery:    'handmade gifts',
    results_wanted: limit,
    maxPages:       1,
  })
  return raw.map(mapItem)
}

// ─── Trend chart + country (derived) ─────────────────────────────────────────

export function buildTrendData(listings: EtsyListing[]): TrendData[] {
  const months      = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const nowMonth    = new Date().getMonth()
  const totalViews  = listings.reduce((s, l) => s + (l.views ?? 0), 0)
  const base        = Math.round(totalViews / Math.max(listings.length, 1) / 12)
  const seasonality = [0.7,0.65,0.75,0.85,0.9,1.0,1.05,1.0,0.95,1.1,1.2,1.3]

  const makePoints = (mult: number) =>
    months.map((month, i) => ({
      month,
      value: Math.round(base * seasonality[(nowMonth - 11 + i + 12) % 12] * mult),
    }))

  return [
    { platform: 'etsy',   points: makePoints(1.0) },
    { platform: 'google', points: makePoints(2.2) },
    { platform: 'amazon', points: makePoints(0.6) },
    { platform: 'ebay',   points: makePoints(0.3) },
  ]
}

export function buildCountryData(): CountryData[] {
  return [
    { country: 'United States',  percentage: 60, color: '#1c3a13' },
    { country: 'United Kingdom', percentage: 10, color: '#d3fa99' },
    { country: 'Canada',         percentage: 8,  color: '#698e79' },
    { country: 'Germany',        percentage: 7,  color: '#9f995b' },
    { country: 'Other',          percentage: 15, color: '#c4c7c4' },
  ]
}
