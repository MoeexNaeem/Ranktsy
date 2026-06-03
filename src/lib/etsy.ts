/**
 * Etsy Open API v3 client
 * Docs: https://developers.etsy.com/documentation
 * Apply for key: https://www.etsy.com/developers/register
 */
import type { EtsyListing, EtsyShop, KeywordData, KeywordSearchResponse, TrendData, CountryData } from '@/types'

const ETSY_BASE = 'https://openapi.etsy.com/v3'
const API_KEY   = process.env.ETSY_API_KEY ?? ''

if (!API_KEY && process.env.NODE_ENV === 'production') {
  console.warn('[Etsy] ETSY_API_KEY is not set — API calls will fail.')
}

const etsyHeaders = {
  'x-api-key': API_KEY,
  'Content-Type': 'application/json',
}

/** Fetch with built-in Next.js caching */
async function etsyFetch(path: string, cacheTtl = 3600) {
  const url = `${ETSY_BASE}${path}`
  const res = await fetch(url, {
    headers: etsyHeaders,
    next:    { revalidate: cacheTtl },
  })
  if (!res.ok) throw new Error(`Etsy API ${res.status}: ${res.statusText} [${path}]`)
  return res.json()
}

// ─── Keyword / Listing Search ─────────────────────────────────────────────────

export async function searchEtsyListings(query: string, limit = 25): Promise<EtsyListing[]> {
  const encoded = encodeURIComponent(query)
  const data    = await etsyFetch(
    `/application/listings/active?keywords=${encoded}&limit=${limit}&includes=images,shop`,
    3600
  )

  return (data.results ?? []).map((l: Record<string, unknown>) => ({
    listing_id:    l.listing_id,
    title:         l.title,
    description:   l.description ?? '',
    price: {
      amount:        (l.price as Record<string,unknown>)?.amount,
      divisor:       (l.price as Record<string,unknown>)?.divisor,
      currency_code: (l.price as Record<string,unknown>)?.currency_code,
    },
    quantity:      l.quantity,
    views:         l.views,
    num_favorers:  l.num_favorers,
    tags:          l.tags ?? [],
    images:        ((l.images ?? []) as Record<string,unknown>[]).map(img => ({
      url_570xN: img.url_570xN,
      url_75x75: img.url_75x75,
    })),
    url:           l.url,
    shop_name:     (l.shop as Record<string,unknown>)?.shop_name ?? '',
    state:         l.state,
  }))
}

/** Build keyword research stats from listing results */
export function buildKeywordStats(query: string, listings: EtsyListing[]): KeywordSearchResponse {
  if (!listings.length) {
    return { query, stats: { avgSearches: 0, avgClicks: 0, avgCtr: 0, etsyCompetition: 0 }, related: [], listings: [] }
  }

  const totalViews     = listings.reduce((s, l) => s + (l.views ?? 0), 0)
  const totalFavorites = listings.reduce((s, l) => s + (l.num_favorers ?? 0), 0)
  const avgSearches    = Math.round(totalViews / listings.length)
  const avgCtr         = parseFloat((totalFavorites / Math.max(totalViews, 1) * 100).toFixed(1))
  const avgClicks      = Math.round(avgSearches * (avgCtr / 100))
  const competition    = listings.length

  // Build related keywords from tags across all listings
  const tagCounts: Record<string, number> = {}
  listings.forEach(l => l.tags.forEach(tag => {
    if (!tag.toLowerCase().includes(query.toLowerCase())) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
    }
  }))

  const related: KeywordData[] = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tag, count], i) => {
      const tagListings = listings.filter(l => l.tags.includes(tag))
      const tagViews    = tagListings.reduce((s, l) => s + (l.views ?? 0), 0)
      const tagFavs     = tagListings.reduce((s, l) => s + (l.num_favorers ?? 0), 0)
      const tagSearches = tagViews
      const tagCtr      = parseFloat((tagFavs / Math.max(tagViews, 1) * 100).toFixed(1))
      const tagClicks   = Math.round(tagSearches * (tagCtr / 100))
      const compLevel   = count >= 20 ? 'High' : count >= 10 ? 'Med' : 'Low'
      // Trend: distribute count across 12 months with some variation
      const trend = Array.from({ length: 12 }, (_, m) =>
        Math.max(10, Math.round(count * (0.7 + 0.3 * Math.sin((m + i) * 0.8))))
      )
      return {
        keyword:          tag,
        avgSearches:      tagSearches,
        avgClicks:        tagClicks,
        avgCtr:           tagCtr,
        competition:      count,
        competitionLevel: compLevel as 'Low' | 'Med' | 'High',
        tagOccurrences:   count,
        charCount:        tag.length,
        googleSearches:   tagSearches * 3, // estimate
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
  const data = await etsyFetch(`/application/shops/${shopIdOrName}`, 600)
  return data
}

export async function getShopListings(shopId: string | number, limit = 25): Promise<EtsyListing[]> {
  const data = await etsyFetch(
    `/application/shops/${shopId}/listings/active?limit=${limit}&includes=images`,
    600
  )
  return data.results ?? []
}

// ─── Trending ─────────────────────────────────────────────────────────────────

export async function getTrendingListings(limit = 25): Promise<EtsyListing[]> {
  // Etsy doesn't have a "trending" endpoint; use featured listings as proxy
  const data = await etsyFetch(
    `/application/listings/featured?limit=${limit}&includes=images,shop`,
    1800
  )
  return data.results ?? []
}

// ─── Trend chart data (derived from listing views over time, approximated) ────
// Etsy API doesn't expose search volume history, so we derive from listing data

export function buildTrendData(listings: EtsyListing[]): TrendData[] {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const now    = new Date()
  const nowMonth = now.getMonth()

  // Distribute total views across 12 months with a seasonal curve
  const totalViews = listings.reduce((s, l) => s + (l.views ?? 0), 0)
  const base       = Math.round(totalViews / listings.length / 12)

  const seasonality = [0.7,0.65,0.75,0.85,0.9,1.0,1.05,1.0,0.95,1.1,1.2,1.3] // e-commerce seasonal pattern

  const makePoints = (multiplier: number) =>
    months.map((month, i) => {
      const mIdx = (nowMonth - 11 + i + 12) % 12
      return { month, value: Math.round(base * seasonality[mIdx] * multiplier) }
    })

  return [
    { platform: 'etsy',   points: makePoints(1.0) },
    { platform: 'google', points: makePoints(2.2) },
    { platform: 'amazon', points: makePoints(0.6) },
    { platform: 'ebay',   points: makePoints(0.3) },
  ]
}

export function buildCountryData(): CountryData[] {
  // Etsy's buyer geography: US ~60%, UK ~10%, Canada ~8%, Germany ~7%, other ~15%
  return [
    { country: 'United States', percentage: 60, color: '#1c3a13' },
    { country: 'United Kingdom',percentage: 10, color: '#d3fa99' },
    { country: 'Canada',        percentage: 8,  color: '#698e79' },
    { country: 'Germany',       percentage: 7,  color: '#9f995b' },
    { country: 'Other',         percentage: 15, color: '#c4c7c4' },
  ]
}
