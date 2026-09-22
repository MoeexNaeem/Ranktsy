import axios from 'axios'
import { triggerUpgrade } from './upgrade'

/**
 * Client side of the credit system. A credit-metered tool calls chargeCredits()
 * once when the user triggers its action; it deducts 10 credits server-side and
 * broadcasts the new balance (so the top-bar pill updates instantly). On a 402
 * it opens the upgrade modal and returns false so the caller aborts the action.
 */

/** `limit: null` means unlimited - JSON has no Infinity, so the API sends null. */
export interface SearchUsage { used: number; limit: number | null }
export interface CreditState {
  credits: number; limit: number; usedToday: number; plan: string
  /** Keyword searches used today against the plan's own daily cap. Not credits. */
  searches?: SearchUsage
}

/**
 * Ask the server to reverse the last charge for `tool`, because the result never
 * reached the user. Best-effort and silent: this runs on a path that has already
 * failed, so it must never surface a second error of its own.
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
// Backwards-compatible local alias.
const broadcast = broadcastCredits

/**
 * Charge one use of `tool`. Returns true when the action may proceed, false when
 * the user is out of credits (upgrade modal shown). Network/unexpected errors
 * fail OPEN (return true) so a transient hiccup never blocks a paying user.
 */
export async function chargeCredits(tool: string): Promise<boolean> {
  try {
    const { data } = await axios.post('/api/credits/charge', { tool })
    broadcast(data?.state)
    return true
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 402 && e.response.data?.code === 'credit_limit') {
      const d = e.response.data
      broadcast(d.state)
      triggerUpgrade({
        title: 'You’re out of credits',
        message: d.error || 'You’ve used all of today’s credits. Upgrade for a higher daily allowance.',
        plan: d.plan,
      })
      return false
    }
    return true
  }
}
