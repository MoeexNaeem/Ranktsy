'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import type { AuthUser, ApiResponse } from '@/types'

const api = axios.create({ baseURL: '/api' })

export function useAuth() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AuthUser>>('/auth/me')
      return data.data ?? null
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  })
}

export function useLogout() {
  const qc     = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      qc.clear()
      router.push('/login')
    },
  })
}

export function useShop(shopId?: string) {
  return useQuery({
    queryKey: ['shop', shopId ?? 'me'],
    queryFn: async () => {
      const url = shopId ? `/etsy/shop?id=${shopId}` : '/etsy/shop'
      const { data } = await api.get(url)
      return data.data
    },
    enabled: !!shopId,
    staleTime: 1000 * 60 * 15,
  })
}

export function useTrendingListings() {
  return useQuery({
    queryKey: ['trending'],
    queryFn: async () => {
      const { data } = await api.get('/etsy/trending')
      return data.data ?? []
    },
    staleTime: 1000 * 60 * 30,
  })
}
