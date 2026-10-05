'use client'
import { useEffect, useState } from 'react'
import { nextCreditReset, type CreditState, type SearchUsage } from '@/lib/credits-client'

/**
 * The signed-in user's daily allowances for the dashboard top bar: tool credits
 * and the separate keyword-search cap. Fetches on mount, updates live from
 * `rk-credits` (after a metered tool) and `rk-searches` (after a keyword search),
 * and re-reads the balance at the daily reset and when the user comes back to the
 * tab. It used to fetch only once, so a dashboard left open overnight kept
 * showing "0 left" after the reset and users reported credits never resetting.
 */
export function useCredits(): CreditState | null {
  const [state, setState] = useState<CreditState | null>(null)

  useEffect(() => {
    let alive = true
    let lastLoad = 0
    const load = () => {
      lastLoad = Date.now()
      fetch('/api/credits', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (alive && d?.success) setState(d.state) })
        .catch(() => {})
    }
    load()

    // Re-read just after the next reset (a few seconds' margin), then every day.
    let resetTimer: ReturnType<typeof setTimeout>
    const armReset = () => {
      const ms = nextCreditReset().getTime() - Date.now() + 5_000
      resetTimer = setTimeout(() => { load(); armReset() }, Math.min(ms, 2 ** 31 - 1))
    }
    armReset()

    // Coming back to the tab (or the laptop waking up): refresh if it has been a while.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad > 60_000) load()
    }
    document.addEventListener('visibilitychange', onVisible)

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
      clearTimeout(resetTimer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('rk-credits', onCredits)
      window.removeEventListener('rk-searches', onSearches)
    }
  }, [])

  return state
}
