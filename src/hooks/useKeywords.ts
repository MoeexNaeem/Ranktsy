'use client'

import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import type { ApiResponse, KeywordSearchResponse } from '@/types'

// ─── Axios instance (shared, avoids creating new instance per component) ──────
const api = axios.create({ baseURL: '/api' })

// ─── Query key factories (stable references for React Query cache) ─────────────
export const queryKeys = {
  keywords: (q: string) => ['keywords', q.toLowerCase().trim()] as const,
  trends:   (q: string) => ['trends',   q.toLowerCase().trim()] as const,
}

// ─── useKeywordSearch ─────────────────────────────────────────────────────────
export function useKeywordSearch(query: string) {
  return useQuery({
    queryKey:  queryKeys.keywords(query),
    queryFn:   async ({ signal }) => {
      const { data } = await api.get<ApiResponse<KeywordSearchResponse>>(
        `/keywords?q=${encodeURIComponent(query)}`,
        { signal } // abort on unmount / query key change
      )
      if (!data.success || !data.data) throw new Error(data.error ?? 'Unknown error')
      return data.data
    },
    enabled:     query.trim().length >= 2, // don't fetch on empty input
    staleTime:   1000 * 60 * 30,           // 30 min — keyword data is stable
    gcTime:      1000 * 60 * 60,           // 1 hour in React Query cache
    placeholderData: (prev) => prev,       // keep previous data while fetching
    retry: (failureCount, error) => {
      // Don't retry 4xx errors
      if (axios.isAxiosError(error) && (error.response?.status ?? 0) < 500) return false
      return failureCount < 2
    },
  })
}

// ─── useTrends ────────────────────────────────────────────────────────────────
export function useTrends(query: string) {
  return useQuery({
    queryKey:  queryKeys.trends(query),
    queryFn:   async ({ signal }) => {
      const { data } = await api.get(`/trends?q=${encodeURIComponent(query)}`, { signal })
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
