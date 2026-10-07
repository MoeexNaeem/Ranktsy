'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { attachCaptchaInterceptor } from '@/components/security/captchaController'
import { attachUpgradeInterceptor } from '@/lib/upgrade'
import { broadcastSearches, broadcastCredits, refundLastCharge, type SearchUsage, type CreditState } from '@/lib/credits-client'
import type { ApiResponse, KeywordSearchResponse, KeywordStats, KeywordData, NearMatch, EtsyListing, KeywordIdeasResponse } from '@/types'

// ─── Axios instance (shared, avoids creating new instance per component) ──────
const api = axios.create({ baseURL: '/api' })
// Search-limit → captcha → retry, for keyword/trends calls made through `api`.
attachCaptchaInterceptor(api)
// Plan-limit (402) → open the upgrade modal.
attachUpgradeInterceptor(api)

// ─── Query key factories (stable references for React Query cache) ─────────────
export const queryKeys = {
  keywords: (q: string) => ['keywords', q.toLowerCase().trim()] as const,
  related:  (q: string) => ['keywords-related', q.toLowerCase().trim()] as const,
  near:     (q: string) => ['keywords-near', q.toLowerCase().trim()] as const,
  trends:   (q: string) => ['trends',   q.toLowerCase().trim()] as const,
}

const dontRetry4xx = (failureCount: number, error: unknown) => {
  if (axios.isAxiosError(error) && (error.response?.status ?? 0) < 500) return false
  return failureCount < 2
}

/**
 * The keyword pipeline is deliberately three parallel requests, not one.
 *
 * A cold keyword needs ~33 Etsy calls and the rate gate makes that ~13s - but
 * only ~3 of them are needed to paint the page. `useKeywordSearch` is the fast
 * core (~1–2s); the two below carry the expensive per-keyword probes and fill in
 * behind it. Each owns its own loading state so the UI can show exactly which
 * part is still measuring rather than one long spinner.
 */

// ─── useKeywordSearch - fast core: stats, listings, analysis ──────────────────
export function useKeywordSearch(query: string, geo = 'US') {
  const core = useCoreSearch(query, geo)
  useGoogleFill(query, geo, core.data)
  return core
}

/**
 * The core answers without Google's volume when Google is slow ('pending'); this
 * fetches just the volume (uncharged) and writes it into the cached core result,
 * so the stats card fills in by itself a moment later.
 */
function useGoogleFill(query: string, geo: string, core?: KeywordSearchResponse) {
  const qc = useQueryClient()
  const pending = core?.stats?.googleStatus === 'pending'
  const fill = useQuery({
    queryKey: ['keywords-google', query.toLowerCase().trim(), geo] as const,
    queryFn: async ({ signal }) => {
      const { data } = await api.get<ApiResponse<Partial<KeywordStats>>>(
        `/keywords/google?q=${encodeURIComponent(query)}&geo=${geo}`, { signal })
      if (!data.success || !data.data) throw new Error(data.error ?? 'Unknown error')
      return data.data
    },
    enabled: pending && query.trim().length >= 2,
    staleTime: 1000 * 60 * 30,
    retry: 2,
    meta: { silent: true },
  })
  useEffect(() => {
    if (!fill.data) return
    qc.setQueryData<KeywordSearchResponse>([...queryKeys.keywords(query), geo], old =>
      old && old.stats.googleStatus === 'pending' ? { ...old, stats: { ...old.stats, ...fill.data } } : old)
  }, [fill.data, qc, query, geo])
}

function useCoreSearch(query: string, geo: string) {
  return useQuery({
    queryKey:  [...queryKeys.keywords(query), geo] as const,
    queryFn:   async ({ signal }) => {
      // The server charges once it has a good answer. If anything below this line
      // fails, the user never saw a result, so the charge is reversed - an error on
      // either side costs nothing.
      let charged = false
      try {
        const { data } = await api.get<ApiResponse<KeywordSearchResponse> & { searches?: SearchUsage; state?: CreditState }>(
          `/keywords?q=${encodeURIComponent(query)}&geo=${geo}`,
          { signal } // abort on unmount / query key change
        )
        charged = !!data.state || !!data.searches
        if (!data.success || !data.data) throw new Error(data.error ?? 'Unknown error')
        // The result is in hand: now the pills may move.
        broadcastSearches(data.searches)
        broadcastCredits(data.state)
        return data.data
      } catch (err) {
        // A 402/429/5xx never charged in the first place, so only reverse when the
        // server told us it had charged, or when the failure happened in transit
        // (aborted, dropped) and we cannot know.
        const status = (err as { response?: { status?: number } })?.response?.status
        if (charged || status == null) void refundLastCharge('keywords')
        throw err
      }
    },
    enabled:     query.trim().length >= 2, // don't fetch on empty input
    // This request is a CHARGED search. Only the user starts one: never re-run it
    // on its own when the tab regains focus or the connection comes back (after
    // the daily reset that would have cost credits for a search nobody made).
    refetchOnWindowFocus: false,
    refetchOnReconnect:   false,
    // 30 min - keyword data is stable; 1 min when Google couldn't answer, so volume fills in.
    staleTime:   q => (googleGap((q.state.data as { stats?: unknown } | undefined)?.stats) ? 60_000 : 1000 * 60 * 30),
    gcTime:      1000 * 60 * 60,           // 1 hour in React Query cache
    // NOTE: intentionally NO placeholderData. Keeping the previous keyword's data
    // while a new one loads made the stats swap silently (numbers changed with no
    // loading cue). Without it, a brand-new keyword falls back to the skeletons
    // (which mirror the layout, so nothing jumps), and the user clearly sees the
    // tool measuring. A cached keyword still returns instantly from React Query.
    retry: dontRetry4xx,
  })
}

// ─── useRelatedKeywords - the slow stage: one live search per keyword ─────────
// True when a response says Google data was unavailable (daily quota / error).
const googleGap = (d: unknown) => {
  const st = (d as { googleStatus?: string } | undefined)?.googleStatus
  return st === 'quota' || st === 'error'
}

export function useRelatedKeywords(query: string, geo = 'US') {
  return useQuery({
    queryKey: [...queryKeys.related(query), geo] as const,
    queryFn: async ({ signal }) => {
      const { data } = await api.get<ApiResponse<KeywordData[]>>(
        `/keywords/related?q=${encodeURIComponent(query)}&geo=${geo}`, { signal })
      if (!data.success || !data.data) throw new Error(data.error ?? 'Unknown error')
      return data.data
    },
    enabled:   query.trim().length >= 2,
    staleTime: 1000 * 60 * 30,
    gcTime:    1000 * 60 * 60,
    placeholderData: (prev) => prev,
    retry: dontRetry4xx,
  })
}

// ─── useKeywordListings - listings WITH images, only when the tab is opened ───
// Etsy needs a separate ~1.5s batch call for images and only this grid uses
// them, so it's fetched lazily rather than on every keyword search.
export function useKeywordListings(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ['keywords-listings', query.toLowerCase().trim()],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<ApiResponse<EtsyListing[]>>(
        `/keywords/listings?q=${encodeURIComponent(query)}`, { signal })
      if (!data.success || !data.data) throw new Error(data.error ?? 'Unknown error')
      return data.data
    },
    enabled:   enabled && query.trim().length >= 2,
    staleTime: 1000 * 60 * 30,
    gcTime:    1000 * 60 * 60,
    placeholderData: (prev) => prev,
    retry: dontRetry4xx,
  })
}

// ─── useNearMatches - morphological variants, each measured ───────────────────
export function useNearMatches(query: string) {
  return useQuery({
    queryKey: queryKeys.near(query),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<ApiResponse<NearMatch[]>>(
        `/keywords/near-matches?q=${encodeURIComponent(query)}`, { signal })
      if (!data.success || !data.data) throw new Error(data.error ?? 'Unknown error')
      return data.data
    },
    enabled:   query.trim().length >= 2,
    staleTime: 1000 * 60 * 30,
    gcTime:    1000 * 60 * 60,
    placeholderData: (prev) => prev,
    retry: dontRetry4xx,
  })
}

// ─── useKeywordIdeas - Google-suggested keywords (generateKeywordIdeas) ───────
// Genuine discovery: Google returns terms we never searched for. Returns an empty
// `ideas` array (not an error) when Google Ads isn't configured, so the panel can
// render a "connect Google Ads" state.
export function useKeywordIdeas(query: string, geo = 'US') {
  return useQuery({
    queryKey: ['keywords-ideas', query.toLowerCase().trim(), geo] as const,
    queryFn: async ({ signal }) => {
      const { data } = await api.get<ApiResponse<KeywordIdeasResponse>>(
        `/keywords/ideas?q=${encodeURIComponent(query)}&geo=${geo}`, { signal })
      if (!data.success || !data.data) throw new Error(data.error ?? 'Unknown error')
      return data.data
    },
    enabled:   query.trim().length >= 2,
    // A Google quota/error response must not sit in the browser for an hour.
    staleTime: q => (googleGap(q.state.data) ? 60_000 : 1000 * 60 * 60),
    gcTime:    1000 * 60 * 60,
    placeholderData: (prev) => prev,
    retry: dontRetry4xx,
  })
}

// ─── useTrends ────────────────────────────────────────────────────────────────
// While Google is still answering ('pending') or was busy ('error'), ask again every
// few seconds (for up to ~4 minutes) so the Google line appears by itself instead of
// the graph staying empty until the user searches again.
const TREND_MAX_TRIES = 40
const trendTries = new Map<string, number>()
export function useTrends(query: string, geo = 'US') {
  const k = `${query.toLowerCase().trim()}|${geo}`
  return useQuery({
    queryKey:  [...queryKeys.trends(query), geo] as const,
    queryFn:   async ({ signal }) => {
      const { data } = await api.get(`/trends?q=${encodeURIComponent(query)}&geo=${geo}`, { signal })
      if (!data.success) throw new Error(data.error)
      const d = data.data as { googleStatus?: string }
      const waiting = d.googleStatus === 'pending' || d.googleStatus === 'error'
      const tries = waiting ? (trendTries.get(k) ?? 0) + 1 : 0
      trendTries.set(k, tries)
      return { ...data.data, retrying: waiting && tries < TREND_MAX_TRIES }
    },
    enabled:   query.trim().length >= 2,
    staleTime: q => (googleGap(q.state.data) ? 60_000 : 1000 * 60 * 60), // 1 hour, 1 min when Google was unavailable
    refetchInterval: q => {
      const d = q.state.data as { retrying?: boolean; googleStatus?: string } | undefined
      return d?.retrying ? (d.googleStatus === 'pending' ? 3_000 : 6_000) : false
    },
    retry: dontRetry4xx,
  })
}

// ─── useTrendCountries - Searchers by Country, loaded beside the graphs ───────
export interface TrendCountries {
  countries: { country: string; percentage: number; color: string; selected?: boolean }[]
  /** Set when the split is for the closest broader phrase (no Google data for the exact one). */
  fallbackKeyword?: string | null
  googleStatus?: string
  googleRetryAt?: string | null
  /** Client-side: true while Google was busy and an automatic re-ask is still pending. */
  retrying?: boolean
}
// Busy answers in a row per keyword+country, so the automatic re-ask gives up after a
// while (~4 minutes: at busy hours Google's queue can take a couple of minutes).
const COUNTRY_MAX_TRIES = 50
const countryTries = new Map<string, number>()
export function useTrendCountries(query: string, geo = 'US', enabled = true) {
  const k = `${query.toLowerCase().trim()}|${geo}`
  return useQuery({
    queryKey:  ['trend-countries', query.toLowerCase().trim(), geo] as const,
    queryFn:   async ({ signal }) => {
      const { data } = await api.get(`/trends/countries?q=${encodeURIComponent(query)}&geo=${geo}`, { signal })
      if (!data.success) throw new Error(data.error)
      const d = data.data as TrendCountries
      const waiting = d.googleStatus === 'error' || d.googleStatus === 'pending'
      const tries = waiting ? (countryTries.get(k) ?? 0) + 1 : 0
      countryTries.set(k, tries)
      return { ...d, retrying: waiting && tries < COUNTRY_MAX_TRIES }
    },
    enabled:   enabled && query.trim().length >= 2,
    staleTime: q => (googleGap(q.state.data) ? 60_000 : 1000 * 60 * 60),
    // Google was busy: the countries that DID answer are stored server-side, so ask
    // again shortly and each retry only fills the gaps (no fabricated partial split).
    // A daily quota lock is not retried; it lasts far longer than a page view.
    // 'pending' = the server is still collecting the 7 countries: check back soon.
    refetchInterval: q => {
      const d = q.state.data as TrendCountries | undefined
      return d?.retrying ? (d.googleStatus === 'pending' ? 3_000 : 8_000) : false
    },
    retry: dontRetry4xx,
  })
}

// ─── useTopSellers ────────────────────────────────────────────────────────────
import type { TopSeller, BuzzItem } from '@/lib/etsy'

export function useTopSellers(query: string) {
  return useQuery({
    queryKey:  ['top-sellers', query.toLowerCase().trim()] as const,
    queryFn:   async ({ signal }) => {
      const { data } = await api.get<ApiResponse<TopSeller[]>>(`/etsy/top-sellers?q=${encodeURIComponent(query)}`, { signal })
      if (!data.success || !data.data) throw new Error(data.error ?? 'Failed to load top sellers')
      return data.data
    },
    enabled:   query.trim().length >= 2,
    staleTime: 1000 * 60 * 30,
    placeholderData: (prev) => prev,
  })
}

// ─── useTrendBuzz ─────────────────────────────────────────────────────────────
// Empty query = featured/trending buzz across Etsy.
export function useTrendBuzz(query: string) {
  return useQuery({
    queryKey:  ['trend-buzz', query.toLowerCase().trim()] as const,
    queryFn:   async ({ signal }) => {
      const { data } = await api.get<ApiResponse<BuzzItem[]>>(`/etsy/trend-buzz?q=${encodeURIComponent(query)}`, { signal })
      if (!data.success || !data.data) throw new Error(data.error ?? 'Failed to load trend buzz')
      return data.data
    },
    staleTime: 1000 * 60 * 30,
    placeholderData: (prev) => prev,
  })
}
