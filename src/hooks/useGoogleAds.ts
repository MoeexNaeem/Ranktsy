'use client'
import { useQuery } from '@tanstack/react-query'
import { GADS_PREFILL_KEY } from '@/lib/google-ads-constants'

/** Whether "Google Ads" campaign management is available to this user (admins/beta until verified). */
export function useGoogleAdsEnabled(): boolean {
  const { data } = useQuery({
    queryKey: ['google-ads-enabled'],
    queryFn: async () => {
      const r = await fetch('/api/google-ads/connection')
      const j = await r.json().catch(() => null)
      return !!j?.data?.enabled
    },
    staleTime: 10 * 60_000,
    retry: false,
    meta: { silent: true },
  })
  return !!data
}

/** Dashboard-wide event the layout listens to, so any tool can switch tabs. */
export const OPEN_TAB_EVENT = 'rk-open-tab'

/**
 * Hand keywords from a research tool to the Google Ads "New campaign" wizard and open
 * the Google Ads tab. The wizard reads and clears the handoff on mount.
 */
export function startGoogleAdsCampaign(keywords: string[], name?: string) {
  const clean = [...new Set(keywords.map(k => k.trim().toLowerCase()).filter(Boolean))].slice(0, 200)
  try { sessionStorage.setItem(GADS_PREFILL_KEY, JSON.stringify({ keywords: clean, name })) } catch { /* storage blocked */ }
  window.dispatchEvent(new CustomEvent(OPEN_TAB_EVENT, { detail: 'googleads' }))
}
