'use client'
/**
 * Client-side helpers for a calm AI-generation UX.
 *
 * The backend queues + retries on the provider side; here on the client we keep
 * the experience smooth without ever showing a red error box:
 *   • auto-retry a transient failure a few times, SPACED OUT so we don't hammer
 *     the (single) key and waste requests,
 *   • distinguish a TERMINAL error (bad input, plan limit, auth) that no retry
 *     will fix, and
 *   • drive a time-based message: silent skeleton for the first ~30s, then
 *     "we're a little busy today", then a calm "try again" past ~2 min.
 *
 * No server imports - safe to use inside client components.
 */
import { useEffect, useState } from 'react'

/** An error thrown by a generation fetch, carrying the HTTP status + optional code. */
export class GenError extends Error {
  status?: number
  code?: string
  constructor(message: string, opts?: { status?: number; code?: string }) {
    super(message)
    this.name = 'GenError'
    this.status = opts?.status
    this.code = opts?.code
  }
}

/**
 * fetch → JSON, throwing a GenError (with status + code) when the API reports a
 * failure. Drop-in for the `queryFn` body every generation tab already writes by
 * hand, but it preserves the status so `busyRetry` can tell transient from terminal.
 */
export async function genFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const r = await fetch(input, init)
  const d = await r.json().catch(() => null)
  if (!r.ok || !d?.success) {
    throw new GenError(d?.error || 'Generation failed.', { status: r.status, code: d?.code })
  }
  return d.data as T
}

/** A terminal error won't be fixed by retrying: bad request, auth, or plan/quota-of-plan limits. */
export function isTerminal(err: unknown): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = err as any
  if (e?.code === 'plan_limit' || e?.response?.data?.code === 'plan_limit') return true
  // Our GenError carries `.status`; an axios error carries `.response.status`.
  const s: number | undefined = e?.status ?? e?.response?.status
  return s === 400 || s === 401 || s === 402 || s === 403 || s === 404 || s === 422
}

/**
 * React Query `retry`: keep trying transient failures (429/5xx/network); never
 * retry a terminal error. Capped at 4 so - combined with the SPACED delays below
 * - the auto-retry window lands around the ~2-minute "please try again" mark.
 */
export function busyRetry(failureCount: number, err: unknown): boolean {
  if (isTerminal(err)) return false
  return failureCount < 4
}

/**
 * React Query `retryDelay`: SPACED backoff (6s → 12s → 24s → 30s cap). Deliberately
 * slow so a single overloaded key isn't hammered with back-to-back calls - each
 * retry gives the provider real time to recover, wasting far fewer requests.
 */
export const busyRetryDelay = (attempt: number): number => Math.min(6000 * 2 ** attempt, 30000)

/** How long the current request has been running, in coarse phases. */
export type WaitPhase = 'normal' | 'busy' | 'long'

/**
 * Time-based wait phase for a generation in flight:
 *   • 'normal' - under `busyMs` (default 30s): show only the skeleton, no message.
 *   • 'busy'   - past 30s: "we're a little busy today".
 *   • 'long'   - past `longMs` (default 2 min): calm "please try again".
 * Resets to 'normal' the moment the request finishes (cleanup), so it never
 * leaves a stale message behind.
 */
export function useWaitPhase(active: boolean, busyMs = 30000, longMs = 120000): WaitPhase {
  const [phase, setPhase] = useState<WaitPhase>('normal')
  useEffect(() => {
    if (!active) return
    const t1 = setTimeout(() => setPhase('busy'), busyMs)
    const t2 = setTimeout(() => setPhase('long'), longMs)
    // Reset in cleanup (runs when `active` flips false / on unmount) - avoids a
    // synchronous setState in the effect body.
    return () => { clearTimeout(t1); clearTimeout(t2); setPhase('normal') }
  }, [active, busyMs, longMs])
  return phase
}
