'use client'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import type { ApiResponse } from '@/types'

/** Compact measured summary for one listing (mirrors ListingVelocitySummary). */
export interface ListingVelocityRow {
  listingId: number
  measured: boolean
  soldLast30Est: number | null
  reviewsLast30: number | null
  favsLast30: number | null
  viewsLast30: number | null
  trackedSince: string | null
  spanDays: number
  days: number
}

/**
 * MEASURED 30-day sales for a page of listings, from our own snapshot history
 * (built by the extension's crowd capture plus the daily cron).
 *
 * This is the real thing rather than a model, so every surface that shows
 * monthly sales should prefer it and badge it "Measured" - which is also what
 * the extension does on Etsy, so the two now agree instead of showing a
 * measured number in one place and an estimate in the other.
 *
 * Only listings with enough tracked history come back; anything absent keeps its
 * estimate. A missing entry never means zero sales.
 */
export function useListingVelocity(ids: number[]) {
  const key = [...new Set(ids)].sort((a, b) => a - b).join(',')
  return useQuery({
    queryKey: ['listing-velocity-batch', key] as const,
    queryFn: async ({ signal }) => {
      const { data } = await axios.post<ApiResponse<Record<string, ListingVelocityRow>>>(
        '/api/etsy/listing-velocity-batch', { ids: key.split(',').map(Number) }, { signal })
      if (!data.success || !data.data) throw new Error(data.error ?? 'velocity failed')
      return data.data
    },
    enabled:   ids.length > 0,
    staleTime: 1000 * 60 * 60 * 3,
    gcTime:    1000 * 60 * 60 * 12,
    retry:     false,
  })
}
