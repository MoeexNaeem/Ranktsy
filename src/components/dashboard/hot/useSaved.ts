'use client'
/** A user's Find Hot Products favorites, tracked products and saved filters. */
import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { toast } from '@/components/ui/toast'
import type { ApiResponse, SavedItem } from '@/types'

type Kind = SavedItem['kind']

export function useSaved(kind: Kind, expand = false) {
  return useQuery({
    queryKey: ['hot-saved', kind, expand],
    queryFn: async () => {
      const { data } = await axios.get<ApiResponse<SavedItem[]>>(`/api/etsy/hot-products/saved?kind=${kind}${expand ? '&expand=1' : ''}`)
      if (!data.success || !data.data) throw new Error(data.error ?? 'Failed')
      return data.data
    },
    staleTime: 1000 * 60 * 5,
  })
}

/** Ids in a list, for "is this one saved?" checks. */
export function useSavedIds(kind: 'fav' | 'track'): Set<number> {
  const q = useSaved(kind)
  return useMemo(() => new Set((q.data ?? []).map(s => s.listingId).filter((n): n is number => !!n)), [q.data])
}

export function useToggleSaved() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { kind: Kind; on: boolean; listingId?: number; shopId?: number; title?: string; image?: string | null; name?: string; params?: string }) => {
      if (v.on) {
        const { data } = await axios.post<ApiResponse<SavedItem>>('/api/etsy/hot-products/saved', v)
        if (!data.success) throw new Error(data.error ?? 'Failed')
      } else {
        const key = v.kind === 'filter' ? v.name ?? '' : String(v.listingId ?? '')
        await axios.delete(`/api/etsy/hot-products/saved?kind=${v.kind}&key=${encodeURIComponent(key)}`)
      }
      return v
    },
    onSuccess: v => {
      void qc.invalidateQueries({ queryKey: ['hot-saved', v.kind] })
      const what = v.kind === 'fav' ? 'Favorites' : v.kind === 'track' ? 'Tracking' : 'Saved filters'
      toast.success(v.on ? `Added to ${what}` : `Removed from ${what}`)
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? (e as Error)?.message
      toast.error(msg || 'Could not save that')
    },
  })
}
