'use client'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import type { ApiResponse } from '@/types'

/**
 * Real review count per listing id — a verified lower bound on units sold, and the
 * honest stand-in for a per-listing "sales" figure Etsy never publishes. Fetched
 * lazily (each id is its own Etsy call, cached 24h server-side), so the table
 * paints first and the Reviews column fills in.
 */
export function useListingReviews(ids: number[]) {
  const key = [...ids].sort((a, b) => a - b).join(',')
  return useQuery({
    queryKey: ['listing-reviews', key] as const,
    queryFn: async ({ signal }) => {
      const { data } = await axios.get<ApiResponse<Record<number, number | null>>>(
        `/api/etsy/listing-reviews?ids=${key}`, { signal })
      if (!data.success || !data.data) throw new Error(data.error ?? 'reviews failed')
      return data.data
    },
    enabled:   ids.length > 0,
    staleTime: 1000 * 60 * 60 * 6,
    gcTime:    1000 * 60 * 60 * 24,
  })
}
