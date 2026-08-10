'use client'
import { useEffect, useState } from 'react'
import type { CreditState } from '@/lib/credits-client'

/**
 * The signed-in user's daily credit balance for the dashboard top bar. Fetches
 * once on mount, then updates live from the `rk-credits` events that
 * chargeCredits() broadcasts after every tool use — no polling, no refetch.
 */
export function useCredits(): CreditState | null {
  const [state, setState] = useState<CreditState | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/credits')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d?.success) setState(d.state) })
      .catch(() => {})

    const onEvt = (e: Event) => {
      const detail = (e as CustomEvent<CreditState>).detail
      if (detail) setState(detail)
    }
    window.addEventListener('rk-credits', onEvt)
    return () => { alive = false; window.removeEventListener('rk-credits', onEvt) }
  }, [])

  return state
}
