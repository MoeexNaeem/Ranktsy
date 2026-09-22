'use client'
import { useEffect, useState } from 'react'
import type { CreditState, SearchUsage } from '@/lib/credits-client'

/**
 * The signed-in user's daily allowances for the dashboard top bar: tool credits
 * and the separate keyword-search cap. Fetches once on mount, then updates live
 * from `rk-credits` (after a metered tool) and `rk-searches` (after a keyword
 * search) - no polling, no refetch.
 */
export function useCredits(): CreditState | null {
  const [state, setState] = useState<CreditState | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/credits')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d?.success) setState(d.state) })
      .catch(() => {})

    // A credit charge knows nothing about searches (and vice versa), so each
    // event merges into the existing state rather than replacing it.
    const onCredits = (e: Event) => {
      const d = (e as CustomEvent<CreditState>).detail
      if (d) setState(prev => (prev ? { ...prev, ...d } : d))
    }
    const onSearches = (e: Event) => {
      const d = (e as CustomEvent<SearchUsage>).detail
      if (d) setState(prev => (prev ? { ...prev, searches: d } : prev))
    }
    window.addEventListener('rk-credits', onCredits)
    window.addEventListener('rk-searches', onSearches)
    return () => {
      alive = false
      window.removeEventListener('rk-credits', onCredits)
      window.removeEventListener('rk-searches', onSearches)
    }
  }, [])

  return state
}
