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
export interface KeywordData {
  keyword: string
  avgSearches: number | null
  avgClicks: number | null
  avgCtr: number | null
  competition: number
  competitionLevel: 'Low' | 'Med' | 'High'
  tagOccurrences: number
  charCount: number
  googleSearches: number | null
  trend: number[]
}

export interface KeywordStats {
  avgSearches: number
  avgClicks: number
  avgCtr: number
  etsyCompetition: number
}

export interface KeywordSearchResponse {
  query: string
  stats: KeywordStats
  related: KeywordData[]
  listings: EtsyListing[]
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
}

export interface EtsyShop {
  shop_id: number
  shop_name: string
  title: string
  listing_active_count: number
  num_favorers: number
  icon_url_fullxfull?: string
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
