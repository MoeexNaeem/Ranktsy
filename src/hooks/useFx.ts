'use client'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import type { ApiResponse } from '@/types'

interface FxData { from: string; to: 'USD'; rate: number | null }

/**
 * Live "1 `from` → USD" rate, for converting Google CPC (returned in the Ads
 * account currency) to USD. `rate` is null when unknown - callers must keep
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

/**
 * Live "1 <code> → USD" rates for a whole SET of currencies at once - so a table
 * of listings priced in mixed currencies (USD, EUR, GBP, VND…) can show every
 * money value in one currency (USD). Returns a `{ CODE: rate|null }` map; a null
 * rate means "unknown" and callers keep the original currency rather than guess.
 */
export function useUsdRates(codes: (string | null | undefined)[]) {
  const distinct = [...new Set(codes.map(c => (c ?? 'USD').toUpperCase()).filter(c => c.length === 3))]
  return useQuery({
    queryKey: ['fx-usd-rates', [...distinct].sort().join(',')] as const,
    queryFn: async ({ signal }) => {
      const entries = await Promise.all(distinct.map(async code => {
        if (code === 'USD') return [code, 1] as const
        try {
          const { data } = await axios.get<ApiResponse<FxData>>(`/api/fx?from=${code}`, { signal })
          return [code, data.success && data.data ? data.data.rate : null] as const
        } catch { return [code, null] as const }
      }))
      return Object.fromEntries(entries) as Record<string, number | null>
    },
    enabled:   distinct.length > 0,
    staleTime: 1000 * 60 * 60 * 6,
    gcTime:    1000 * 60 * 60 * 12,
  })
}
