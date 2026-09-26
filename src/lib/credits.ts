import { User, PaidLookup } from './models'
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
 * Tools that consume credits - the dashboard tab ids that charge CREDIT_COST.
 *
 * `keywords` carries BOTH meters on purpose: a keyword search costs credits and
 * counts against the plan's searches/day cap. Since credits run out first on
 * every paid plan (e.g. Enterprise: 2,500 credits = 250 searches, well under its
 * 2,000 cap), credits are the limit users will actually hit.
 *
 * DELIBERATELY EXCLUDED (already limit-gated, so never charged): competitors
 * (competitors monitored), listingpro (Listing Pro images/mo), audit
 * (audits/day). Also excluded: overview/myshop/salesmap/delivery (your own
 * connected shop), and the purely client-side calculators (fees, adsroi,
 * calendar, lists, category) that make no metered API call.
 */
export const CREDIT_TOOLS = new Set<string>([
  'keywords',
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
export interface AffordResult extends CreditState { ok: boolean }

/** Can the user afford `cost` right now? A read-only peek - it never charges. */
export async function canAfford(userId: string, cost = CREDIT_COST): Promise<AffordResult | null> {
  const s = await getCreditState(userId)
  if (!s) return null
  return { credits: s.credits, limit: s.limit, usedToday: s.usedToday, plan: s.plan, ok: s.credits >= cost }
}

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
 * Window during which a charge can still be reversed. Long enough for a client to
 * notice a failed render and report it, short enough that it can't be replayed
 * against an unrelated later charge.
 */
export const REFUND_WINDOW_MS = 2 * 60 * 1000

/**
 * Remember a charge so it can be undone if the result never reached the user.
 *
 * The server charges when it has produced a good answer, which is the only point
 * it can be sure of - but "produced" is not "delivered". If the client then fails
 * (network drop, aborted request, a render that throws), it calls the refund
 * endpoint and this is what gets reversed. Charging first and reversing on a
 * reported failure is deliberate: the opposite default (wait for the client to
 * confirm before charging) hands free usage to any client that simply stays quiet.
 */
export async function recordCharge(userId: string, tool: string, credits: number, searchCounted: boolean): Promise<void> {
  await User.updateOne(
    { _id: userId },
    { $set: { lastCharge: { tool, credits, searchCounted, at: new Date(), refunded: false } } },
  ).catch(() => {})
}

/**
 * Reverse the most recent unrefunded charge for `tool`, if it is still inside the
 * window. One atomic update guarded on `lastCharge.refunded: false`, so two
 * refund calls racing can only give the credits back once.
 * Returns the restored state, or null when there was nothing to reverse.
 */
export async function refundLastCharge(userId: string, tool: string): Promise<CreditState | null> {
  const since = new Date(Date.now() - REFUND_WINDOW_MS)
  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      'lastCharge.tool': tool,
      'lastCharge.refunded': false,
      'lastCharge.at': { $gte: since },
    },
    [{
      $set: {
        // Guard against a day rollover between charge and refund: never push the
        // counters below zero, or a user would gain allowance they never had.
        creditsUsedToday: { $max: [0, { $subtract: ['$creditsUsedToday', '$lastCharge.credits'] }] },
        creditsUsedTotal: { $max: [0, { $subtract: ['$creditsUsedTotal', '$lastCharge.credits'] }] },
        searchCount: {
          $cond: ['$lastCharge.searchCounted', { $max: [0, { $subtract: ['$searchCount', 1] }] }, '$searchCount'],
        },
        'lastCharge.refunded': true,
      },
    }],
    { new: true },
  ).catch(() => null)

  if (!user) return null
  const plan = effectivePlan(user)
  const limit = creditLimitFor(plan)
  const used = user.creditsUsedToday ?? 0
  return { credits: Math.max(0, limit - used), limit, usedToday: used, plan }
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

// ─── Pay once per lookup per day ────────────────────────────────────────────────
// Credits reset each UTC day; so does this. `key` identifies the result (e.g.
// "keywords|GLO|silver necklace"): re-opening the same result that day is free.
const paidDay = () => new Date().toISOString().slice(0, 10)

/** Has this user already paid for `key` today? (Read-only.) */
export async function alreadyPaidToday(userId: string, key: string): Promise<boolean> {
  try {
    return !!(await PaidLookup.exists({ userId, key, day: paidDay() }))
  } catch { return false }
}

/**
 * Record that the user is paying for `key` today. Returns true only for the FIRST
 * call of the day (the caller should charge); false if it was already paid, which
 * also covers two identical requests racing (the unique index lets only one win).
 */
export async function claimPaidToday(userId: string, key: string): Promise<boolean> {
  try {
    await PaidLookup.create({ userId, key, day: paidDay() })
    return true
  } catch (e) {
    if ((e as { code?: number })?.code === 11000) return false
    return true   // bookkeeping failed for another reason: charge as before
  }
}
