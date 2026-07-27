'use client'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import type { ApiResponse } from '@/types'

interface FxData { from: string; to: 'USD'; rate: number | null }

/**
 * Live "1 `from` → USD" rate, for converting Google CPC (returned in the Ads
 * account currency) to USD. `rate` is null when unknown — callers must keep
 * showing the original currency rather than a converted guess.
 */
export function useFx(from: string | null | undefined) {
  return useQuery({
    queryKey: ['fx', (from ?? '').toUpperCase()] as const,
    queryFn: async ({ signal }) => {
      const { data } = await axios.get<ApiResponse<FxData>>(`/api/fx?from=${encodeURIComponent(from ?? '')}`, { signal })
      if (!data.success || !data.data) throw new Error(data.error ?? 'FX failed')
      return data.data
    },
    // Only fetch for a real, non-USD currency (USD needs no conversion).
    enabled:   !!from && from.toUpperCase() !== 'USD',
    staleTime: 1000 * 60 * 60 * 6,
    gcTime:    1000 * 60 * 60 * 12,
  })
}
