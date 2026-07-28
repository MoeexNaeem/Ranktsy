'use client'

import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { attachCaptchaInterceptor } from '@/components/security/captchaController'
import type { ApiResponse, KeywordSearchResponse, KeywordData, NearMatch, EtsyListing, KeywordIdeasResponse } from '@/types'

// ─── Axios instance (shared, avoids creating new instance per component) ──────
const api = axios.create({ baseURL: '/api' })
// Search-limit → captcha → retry, for keyword/trends calls made through `api`.
attachCaptchaInterceptor(api)

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
 * A cold keyword needs ~33 Etsy calls and the rate gate makes that ~13s — but
 * only ~3 of them are needed to paint the page. `useKeywordSearch` is the fast
 * core (~1–2s); the two below carry the expensive per-keyword probes and fill in
 * behind it. Each owns its own loading state so the UI can show exactly which
 * part is still measuring rather than one long spinner.
 */

// ─── useKeywordSearch — fast core: stats, listings, analysis ──────────────────
export function useKeywordSearch(query: string, geo = 'US') {
  return useQuery({
    queryKey:  [...queryKeys.keywords(query), geo] as const,
    queryFn:   async ({ signal }) => {
      const { data } = await api.get<ApiResponse<KeywordSearchResponse>>(
        `/keywords?q=${encodeURIComponent(query)}&geo=${geo}`,
        { signal } // abort on unmount / query key change
      )
      if (!data.success || !data.data) throw new Error(data.error ?? 'Unknown error')
      return data.data
    },
    enabled:     query.trim().length >= 2, // don't fetch on empty input
    staleTime:   1000 * 60 * 30,           // 30 min — keyword data is stable
    gcTime:      1000 * 60 * 60,           // 1 hour in React Query cache
    placeholderData: (prev) => prev,       // keep previous data while fetching
    retry: dontRetry4xx,
  })
}

// ─── useRelatedKeywords — the slow stage: one live search per keyword ─────────
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

// ─── useKeywordListings — listings WITH images, only when the tab is opened ───
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

// ─── useNearMatches — morphological variants, each measured ───────────────────
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

// ─── useKeywordIdeas — Google-suggested keywords (generateKeywordIdeas) ───────
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
    staleTime: 1000 * 60 * 60,
    gcTime:    1000 * 60 * 60,
    placeholderData: (prev) => prev,
    retry: dontRetry4xx,
  })
}

// ─── useTrends ────────────────────────────────────────────────────────────────
export function useTrends(query: string, geo = 'US') {
  return useQuery({
    queryKey:  [...queryKeys.trends(query), geo] as const,
    queryFn:   async ({ signal }) => {
      const { data } = await api.get(`/trends?q=${encodeURIComponent(query)}&geo=${geo}`, { signal })
      if (!data.success) throw new Error(data.error)
      return data.data
    },
    enabled:   query.trim().length >= 2,
    staleTime: 1000 * 60 * 60, // 1 hour
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
