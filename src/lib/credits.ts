import { User, PaidLookup } from './models'
import { effectivePlan, type PlanSlug } from './plans'

/**
 * Credit system for the "other tools" - every dashboard feature that ISN'T
 * already governed by a hard per-plan limit (competitors monitored, Etsy
 * Listing Pro images, listing audits). Each search costs a flat CREDIT_COST (1),
 * and it is charged only once the search has actually delivered a result: a
 * failed search, an empty result or a server error never costs anything. The daily allowance comes from the plan and resets on a UTC
 * day rollover; the balance is derived as `limit − creditsUsedToday`, so a plan
 * change or admin grant is reflected immediately with no stored-balance drift.
 *
 * Counters live on the User doc (creditsUsedToday / creditsResetAt / lifetime
 * creditsUsedTotal). Reads the plan fresh from the DB so a just-purchased upgrade
 * applies before the JWT refreshes - same pattern as lib/quota.ts.
 */

/** Flat cost charged for one search / use of a credit-metered tool. */
export const CREDIT_COST = 1

/**
 * Daily credit allowance per plan (resets 00:00 UTC). One credit = one search,
 * so these are also the plan's searches per day (planLimits.ts must match).
 */
export const CREDITS_PER_DAY: Record<PlanSlug, number> = {
  free:        5,
  starter:     20,    // the $0.99 plan
  basic:       60,
  pro:         120,
  'pro-1yr':   150,   // the 1-Year plan
  business:    500,
  agency:      1000,
  enterprise:  2000,
  custom:      2000,
}

export function creditLimitFor(plan: PlanSlug | undefined): number {
  return CREDITS_PER_DAY[plan ?? 'free'] ?? CREDITS_PER_DAY.free
}

/**
 * Tools that consume credits - the dashboard tab ids that charge CREDIT_COST.
 *
 * `keywords` carries BOTH meters on purpose: a keyword search costs credits and
 * counts against the plan's searches/day cap. The cap is set to exactly
 * credits / CREDIT_COST (planLimits.ts), e.g. Enterprise 2,000 credits = 2,000
 * searches, so the two meters always agree when only searching.
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
export async function recordCharge(userId: string, tool: string, credits: number, searchCounted: boolean, key?: string | null): Promise<void> {
  await User.updateOne(
    { _id: userId },
    { $set: { lastCharge: { tool, key: key ?? null, credits, searchCounted, at: new Date(), refunded: false } } },
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
    // Mongoose 9 rejects an update pipeline without this flag. Before it was set,
    // every refund threw here and was swallowed, so no refund ever happened.
    { returnDocument: 'after', updatePipeline: true },
  ).catch(e => { console.error('[credits] refund failed:', e); return null })

  if (!user) return null
  // The search was refunded, so it is no longer "paid today": searching it again
  // is a fresh, charged search rather than a free repeat.
  if (user.lastCharge?.key) await unclaimPaidToday(userId, user.lastCharge.key)
  const plan = effectivePlan(user)
  const limit = creditLimitFor(plan)
  const used = user.creditsUsedToday ?? 0
  return { credits: Math.max(0, limit - used), limit, usedToday: used, plan }
}

const utcDayStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

/**
 * Charge `cost` credits for one tool use, or return allowed:false without
 * charging when the balance is too low.
 *
 * Atomic on purpose. The old read-modify-save let two searches finishing at the
 * same moment both read "used = 4" and both write 5, and let a charge slip past
 * the limit. Now the day rollover and the charge are each a single conditional
 * update, so concurrent charges can neither be lost nor overspend the allowance.
 */
export async function consumeCredits(userId: string, cost = CREDIT_COST): Promise<ConsumeResult | null> {
  const user = await User.findById(userId)
  if (!user) return null
  const plan = effectivePlan(user)
  const limit = creditLimitFor(plan)
  const now = new Date()

  // 1) Lazy UTC-day reset. Matches only a stale counter, so of several requests
  //    racing across midnight exactly one resets it.
  await User.updateOne(
    { _id: userId, $or: [{ creditsResetAt: { $lt: utcDayStart(now) } }, { creditsResetAt: null }] },
    { $set: { creditsUsedToday: 0, creditsResetAt: now } },
  )

  // 2) Charge only if it still fits under today's limit.
  const after = await User.findOneAndUpdate(
    { _id: userId, $or: [{ creditsUsedToday: { $lte: limit - cost } }, { creditsUsedToday: null }] },
    [{ $set: {
      creditsUsedToday: { $add: [{ $ifNull: ['$creditsUsedToday', 0] }, cost] },
      creditsUsedTotal: { $add: [{ $ifNull: ['$creditsUsedTotal', 0] }, cost] },
    } }],
    { returnDocument: 'after', updatePipeline: true },
  ).select('creditsUsedToday').lean<{ creditsUsedToday?: number }>()

  if (!after) {
    const s = await getCreditState(userId)
    const used = s?.usedToday ?? limit
    return { allowed: false, credits: Math.max(0, limit - used), limit, usedToday: used, plan }
  }
  const used = after.creditsUsedToday ?? cost
  return { allowed: true, credits: Math.max(0, limit - used), limit, usedToday: used, plan }
}

// ─── Pay once per lookup per day ────────────────────────────────────────────────
// Credits reset each UTC day; so does this. `key` identifies the result (e.g.
// "keywords|GLO|silver necklace"): re-opening the same result that day is free.
const paidDay = () => new Date().toISOString().slice(0, 10)

/** Normalised "paid today" key for a tool search, or '' when there is no key. */
export function paidKeyFor(tool: string, rawKey: unknown): string {
  const key = typeof rawKey === 'string' ? rawKey.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 500) : ''
  return key ? `${tool}|${key}` : ''
}

/** Undo claimPaidToday (a refund, or a charge that could not go through). */
export async function unclaimPaidToday(userId: string, key: string): Promise<void> {
  await PaidLookup.deleteOne({ userId, key, day: paidDay() }).catch(() => {})
}

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
