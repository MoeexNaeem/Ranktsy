import { User } from './models'
import { effectivePlan, type PlanSlug } from './plans'

/**
 * Credit system for the "other tools" - every dashboard feature that ISN'T
 * already governed by a hard per-plan limit (keyword searches, competitors
 * monitored, Etsy Listing Pro images, listing audits). Each such tool use costs
 * a flat CREDIT_COST. The daily allowance comes from the plan and resets on a UTC
 * day rollover; the balance is derived as `limit − creditsUsedToday`, so a plan
 * change or admin grant is reflected immediately with no stored-balance drift.
 *
 * Counters live on the User doc (creditsUsedToday / creditsResetAt / lifetime
 * creditsUsedTotal). Reads the plan fresh from the DB so a just-purchased upgrade
 * applies before the JWT refreshes - same pattern as lib/quota.ts.
 */

/** Flat cost charged for one use of a credit-metered tool. */
export const CREDIT_COST = 10

/** Daily credit allowance per plan (resets 00:00 UTC). */
export const CREDITS_PER_DAY: Record<PlanSlug, number> = {
  free:        50,
  starter:     100,   // the $0.99 plan
  basic:       200,
  pro:         400,
  'pro-1yr':   1000,  // the 1-Year plan
  business:    1000,
  agency:      2000,
  enterprise:  2500,
  custom:      2500,
}

export function creditLimitFor(plan: PlanSlug | undefined): number {
  return CREDITS_PER_DAY[plan ?? 'free'] ?? CREDITS_PER_DAY.free
}

/**
 * Tools that consume credits - the dashboard tab ids without a hard limit.
 *
 * DELIBERATELY EXCLUDED (already limit-gated, so never charged): keywords
 * (searches/day), competitors (competitors monitored), listingpro (Listing Pro
 * images/mo), audit (audits/day). Also excluded: overview/myshop/salesmap/
 * delivery (your own connected shop), and the purely client-side calculators
 * (fees, adsroi, calendar, lists, category) that make no metered API call.
 */
export const CREDIT_TOOLS = new Set<string>([
  'hotproducts', 'gap', 'listings', 'compsales', 'trends', 'buzz', 'monthly',
  'topsellers', 'catreport', 'shop', 'tags', 'ctags', 'compare', 'spell',
  'rank', 'bulk', 'titlegen', 'taggen', 'descgen', 'aihelper',
])

export function isCreditTool(tool: string | null | undefined): boolean {
  return !!tool && CREDIT_TOOLS.has(tool)
}

const sameUTCDay = (a?: Date | null, b?: Date | null) =>
  !!a && !!b && a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()

export interface CreditState {
  credits: number      // remaining today (limit − usedToday)
  limit: number        // daily allowance for the current plan
  usedToday: number
  plan: PlanSlug
}

export interface ConsumeResult extends CreditState { allowed: boolean }

/** Current credit balance for a user (with a lazy UTC-day reset applied to the read). */
export async function getCreditState(userId: string): Promise<(CreditState & { usedTotal: number }) | null> {
  const user = await User.findById(userId)
  if (!user) return null
  const plan = effectivePlan(user)
  const limit = creditLimitFor(plan)
  const now = new Date()
  const used = sameUTCDay(user.creditsResetAt, now) ? (user.creditsUsedToday ?? 0) : 0
  return { credits: Math.max(0, limit - used), limit, usedToday: used, plan, usedTotal: user.creditsUsedTotal ?? 0 }
}

/**
 * Charge `cost` credits for one tool use. Resets the daily counter on a UTC-day
 * rollover, then either records the spend or (when the balance is too low)
 * returns allowed:false without charging.
 */
export async function consumeCredits(userId: string, cost = CREDIT_COST): Promise<ConsumeResult | null> {
  const user = await User.findById(userId)
  if (!user) return null
  const plan = effectivePlan(user)
  const limit = creditLimitFor(plan)
  const now = new Date()
  if (!sameUTCDay(user.creditsResetAt, now)) { user.creditsUsedToday = 0; user.creditsResetAt = now }
  const used = user.creditsUsedToday ?? 0
  if (used + cost > limit) {
    return { allowed: false, credits: Math.max(0, limit - used), limit, usedToday: used, plan }
  }
  user.creditsUsedToday = used + cost
  user.creditsUsedTotal = (user.creditsUsedTotal ?? 0) + cost
  await user.save()
  return { allowed: true, credits: limit - (used + cost), limit, usedToday: used + cost, plan }
}
