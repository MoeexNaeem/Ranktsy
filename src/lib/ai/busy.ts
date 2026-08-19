'use client'
/**
 * Client-side helpers for a calm AI-generation UX.
 *
 * The backend already rotates across multiple Gemini/OpenAI keys and fails over
 * when one is rate-limited (see lib/gemini.ts, lib/openai-image.ts), so a busy
 * moment is almost always transient. These helpers let every generation tab:
 *   • auto-retry a transient failure a few times (instead of surfacing an error),
 *   • distinguish a TERMINAL error (bad input, plan limit, auth) that no retry
 *     will fix, and
 *   • show a friendly "a little busy…" note while the result is on its way.
 *
 * No server imports — safe to use inside client components.
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
 * React Query `retry`: keep trying transient failures (429/5xx/network) up to a
 * few times so a busy provider rides through; never retry a terminal error.
 */
export function busyRetry(failureCount: number, err: unknown): boolean {
  if (isTerminal(err)) return false
  return failureCount < 3
}

/** React Query `retryDelay`: gentle exponential backoff, capped so it never feels stuck. */
export const busyRetryDelay = (attempt: number): number => Math.min(1200 * 2 ** attempt, 8000)

/**
 * True once `active` has stayed true for `delayMs` — i.e. the request is taking a
 * while. Used to show the "a little busy…" note even on a slow FIRST attempt (not
 * just after a retry). Resets the moment `active` goes false.
 */
export function useSlow(active: boolean, delayMs = 6000): boolean {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => setSlow(true), delayMs)
    // Reset in cleanup — runs when `active` flips back to false (or on unmount),
    // avoiding a synchronous setState in the effect body.
    return () => { clearTimeout(t); setSlow(false) }
  }, [active, delayMs])
  return slow
}
