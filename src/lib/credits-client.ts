import axios from 'axios'
import { useEffect, useRef } from 'react'
import { triggerUpgrade } from './upgrade'

/**
 * Client side of the credit system. Every credit-metered tool follows the same
 * two steps, so a search is charged ONLY when it actually delivered a result:
 *
 *   1. ensureCredits(tool, key) before the search starts. A read-only check: when
 *      the user is out of credits it opens the upgrade modal and returns false so
 *      the tool never starts. Nothing is charged here.
 *   2. commitCredits(tool, key) once the result is on screen (or, for query-based
 *      tools, useChargeOnSuccess). This is the only step that spends a credit
 *      (1 per search), and a failed, empty or errored search never reaches it.
 *
 * The same search is paid once per UTC day, so repeating it is free.
 */

/** `limit: null` means unlimited - JSON has no Infinity, so the API sends null. */
export interface SearchUsage { used: number; limit: number | null }
export interface CreditState {
  /** Spendable now: today's plan credits left + any admin bonus left. */
  credits: number; limit: number; usedToday: number; plan: string
  /** Admin-granted one-time bonus pool, only while it is still valid. */
  bonus?: { remaining: number; granted: number; expiresAt: string } | null
  /** The plan's own daily credits (`limit` also includes SEBT free credits). */
  planLimit?: number
  /** SEBT NEXT free daily credits on top of the plan, while valid. */
  sebt?: { perDay: number; plan: string | null; expiresAt: string } | null
  /** Keyword searches used today against the plan's own daily cap. */
  searches?: SearchUsage
}

/**
 * Ask the server to reverse the last Keyword Search charge, because the result
 * never reached the user. (Keyword Search is charged server-side on delivery, so
 * a failure in transit is the one case that needs undoing.) Best-effort and
 * silent: this runs on a path that has already failed.
 */
export async function refundLastCharge(tool: string): Promise<void> {
  try {
    const { data } = await axios.post('/api/credits/refund', { tool })
    if (data?.refunded) broadcastCredits(data.state)
  } catch { /* the charge stands; nothing more we can do from here */ }
}

/** Broadcast fresh keyword-search usage (the second top-bar pill). */
export function broadcastSearches(usage: SearchUsage | undefined | null) {
  if (usage && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<SearchUsage>('rk-searches', { detail: usage }))
  }
}

/** Broadcast a fresh credit balance to any mounted useCredits() listeners. */
export function broadcastCredits(state: CreditState | undefined | null) {
  if (state && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<CreditState>('rk-credits', { detail: state }))
  }
}

function openOutOfCredits(d: { error?: string; plan?: string }) {
  triggerUpgrade({
    title: 'You’re out of credits',
    message: d.error || 'You’ve used all of today’s credits. Upgrade for a higher daily allowance.',
    plan: d.plan,
  })
}

/**
 * Step 1: may the user start this search? Never charges. Returns false (and opens
 * the upgrade modal) only when the server says the balance is empty; network or
 * unexpected errors fail OPEN so a transient hiccup never blocks a paying user
 * (the charge after success is still enforced server-side).
 */
export async function ensureCredits(tool: string, key?: string): Promise<boolean> {
  try {
    const { data } = await axios.post('/api/credits/check', { tool, key })
    broadcastCredits(data?.state)
    return true
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 402 && e.response.data?.code === 'credit_limit') {
      broadcastCredits(e.response.data.state)
      openOutOfCredits(e.response.data)
      return false
    }
    return true
  }
}

/**
 * Step 2: the search delivered a result, so charge for it now. Fire-and-forget:
 * the user already has their result, so a failure here must never surface as an
 * error. Returns whether a credit was actually spent.
 */
export async function commitCredits(tool: string, key?: string): Promise<boolean> {
  try {
    const { data } = await axios.post('/api/credits/charge', { tool, key })
    broadcastCredits(data?.state)
    return !!data?.charged
  } catch (e) {
    // Out of credits by the time it finished (another tab spent the last one):
    // just refresh the pill. The result they are looking at stays.
    if (axios.isAxiosError(e) && e.response?.data?.state) broadcastCredits(e.response.data.state)
    return false
  }
}

/**
 * Charge a query-based tool once its search succeeds. Pass the key of the search
 * the user started (empty = nothing searched yet) and whether its result arrived
 * and is usable. Fires once per key per mount; a failed or empty search never
 * sets `delivered`, so it is never charged.
 */
export function useChargeOnSuccess(tool: string, key: string, delivered: boolean) {
  const charged = useRef<string | null>(null)
  useEffect(() => {
    if (!key || !delivered || charged.current === key) return
    charged.current = key
    void commitCredits(tool, key)
  }, [tool, key, delivered])
}

// ─── Daily reset time, shown in the viewer's own clock ─────────────────────────
// Credits and searches reset at 12:00 AM Pakistan time (see creditDay.ts).
export { nextCreditReset } from './creditDay'
import { nextCreditReset } from './creditDay'

/**
 * When the daily allowance resets, in the viewer's local time ("12:00 AM" in
 * Pakistan). "Midnight UTC" meant nothing to most users, who reported that
 * credits never reset (2026-10-06).
 */
export function creditResetLabel(): string {
  return nextCreditReset().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
