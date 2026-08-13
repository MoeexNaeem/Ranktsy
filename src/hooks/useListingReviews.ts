'use client'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import type { ApiResponse, ListingReviewStats } from '@/types'

/**
 * Real review stats per listing id — lifetime `count` (a verified units-sold floor)
 * plus trailing-30-day velocity (`last30d`). Both feed the per-listing sales ESTIMATE
 * (salesEstimate.ts). Fetched lazily (each id is its own Etsy call, cached 24h
 * server-side), so the table paints first and the columns fill in.
 */
export function useListingReviews(ids: number[]) {
  const key = [...ids].sort((a, b) => a - b).join(',')
  return useQuery({
    queryKey: ['listing-reviews', key] as const,
    queryFn: async ({ signal }) => {
      const { data } = await axios.get<ApiResponse<Record<number, ListingReviewStats>>>(
        `/api/etsy/listing-reviews?ids=${key}`, { signal })
      if (!data.success || !data.data) throw new Error(data.error ?? 'reviews failed')
      return data.data
    },
    enabled:   ids.length > 0,
    staleTime: 1000 * 60 * 60 * 6,
    gcTime:    1000 * 60 * 60 * 24,
  })
}
