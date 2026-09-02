/**
 * Affiliate program - server-side logic.
 *
 * Attribution is first-touch at signup: when a visitor arrives via ?ref=CODE we
 * drop the `rk_ref` cookie (see /api/affiliate/click), and at registration we
 * stamp `referredBy` on the new user.
 *
 * Commission is RECURRING: 30% of every successful payment a referred customer
 * makes, for up to 12 payments per subscription (RECURRING_MONTHS). The rate is
 * tiered by how many paying referrals the affiliate has when a customer is
 * acquired: referrals 1-100 earn 30%, referrals 101-200 earn 50%, and 201+ return
 * to 30%. Each customer LOCKS the rate they were acquired at, so their recurring
 * payments always pay the same rate.
 *
 * Money never moves on its own. The business collects the full sale via Lemon
 * Squeezy and pays the affiliate out of it, so a conversion is just an owed-amount
 * ledger the admin marks "paid" once settled.
 */
import { Affiliate, ReferralConversion, type IAffiliateDoc } from '@/lib/models'
import { siteUrl } from '@/lib/seo/site'
import type { PlanSlug } from '@/lib/plans'

export const REF_COOKIE = 'rk_ref'
export const REF_COOKIE_MAX_AGE = 60 * 24 * 60 * 60 // 60 days, in seconds
export const PAYOUT_MIN_USD = 50

// Commission policy. Base 30%; referrals 101-200 (the bonus window) earn 50%.
export const BASE_RATE = 0.30
export const BONUS_RATE = 0.50
export const TIER_THRESHOLD = 100        // bonus starts at referral 101
export const BONUS_WINDOW_END = 200      // bonus ends after referral 200
export const RECURRING_MONTHS = 12       // max commissioned payments per subscription

/**
 * USD price per paid plan. Kept in sync with the display prices in
 * src/components/landing/plans-data.ts. Used as a fallback when a webhook doesn't
 * carry the real charged amount.
 */
export const PLAN_PRICE_USD: Partial<Record<PlanSlug, number>> = {
  starter: 0.99,
  basic: 2.99,
  pro: 6.99,
  'pro-1yr': 99.99,
  business: 19.99,
  agency: 39.99,
  enterprise: 49.99,
}

export function planPriceUsd(slug?: string | null): number | null {
  if (!slug) return null
  return PLAN_PRICE_USD[slug as PlanSlug] ?? null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * The rate a referral earns by its acquisition rank (1-indexed): the bonus window
 * is ranks 101-200 at 50%, everything else 30%.
 */
export function rateForRank(rank: number): number {
  return rank > TIER_THRESHOLD && rank <= BONUS_WINDOW_END ? BONUS_RATE : BASE_RATE
}

/** The rate the affiliate's NEXT new referral would earn (for display). */
export function currentRate(payingReferrals: number): number {
  return rateForRank(payingReferrals + 1)
}

/** A referral code candidate from a display name plus a short random suffix. */
export function makeCodeCandidate(name?: string | null): string {
  const base = String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 12) || 'ref'
  const rand = Math.random().toString(36).slice(2, 7)
  return `${base}${rand}`
}

export async function generateUniqueCode(name?: string | null): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = makeCodeCandidate(name)
    const clash = await Affiliate.exists({ code })
    if (!clash) return code
  }
  return `ref${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** A public referral link for a code (uses the app's canonical site origin). */
export function affiliateLink(code: string): string {
  return `${siteUrl()}/?ref=${encodeURIComponent(code)}`
}

/**
 * First-touch attribution at signup: stamp the referrer on a brand-new user and
 * bump the affiliate's signup counter. No-op for an unknown/suspended code.
 */
export async function applySignupReferral(user: { _id: unknown; save: () => Promise<unknown>; referredBy?: string | null; referredByAffiliateId?: string | null }, code?: string | null): Promise<void> {
  if (!code) return
  const affiliate = await Affiliate.findOne({ code: code.toLowerCase(), status: 'active' })
  if (!affiliate) return
  if (String(affiliate.userId) === String(user._id)) return
  user.referredBy = affiliate.code
  user.referredByAffiliateId = String(affiliate._id)
  await user.save()
  await Affiliate.updateOne({ _id: affiliate._id }, { $inc: { signups: 1 } })
}

// Sync indexes once per process so an older subscriptionId-unique index (from the
// pre-recurring schema) is dropped and the invoiceId-unique index is created.
let indexesSynced: Promise<void> | null = null
function ensureReferralIndexes(): Promise<void> {
  if (!indexesSynced) {
    indexesSynced = ReferralConversion.syncIndexes().then(() => undefined).catch(() => { indexesSynced = null })
  }
  return indexesSynced
}

/** Count an affiliate's distinct paying referrals (customers with a live commission). */
async function payingReferralCount(affiliateId: string): Promise<number> {
  const ids = await ReferralConversion.distinct('referredUserId', { affiliateId, status: { $ne: 'refunded' } })
  return ids.length
}

/**
 * Record a commission for one successful payment by a referred customer.
 * Idempotent per invoice, capped at RECURRING_MONTHS payments per subscription,
 * and priced with the affiliate's current tier rate. Skips self-referrals and
 * unknown/suspended affiliates.
 */
export async function recordCommission(user: {
  _id: unknown; email?: string; name?: string; referredBy?: string | null
}, opts: { subscriptionId?: string | null; invoiceId?: string | null; plan?: string | null; amountUsd?: number | null }): Promise<void> {
  const code = user.referredBy
  if (!code || !opts.invoiceId) return

  await ensureReferralIndexes()

  const affiliate = await Affiliate.findOne({ code })
  if (!affiliate || affiliate.status !== 'active') return
  if (String(affiliate.userId) === String(user._id)) return // no self-referral

  // Already recorded this exact payment?
  const dup = await ReferralConversion.findOne({ invoiceId: String(opts.invoiceId) }).select('_id').lean()
  if (dup) return

  // Recurring cap: at most 12 commissioned payments per subscription.
  if (opts.subscriptionId) {
    const paid = await ReferralConversion.countDocuments({ affiliateId: String(affiliate._id), subscriptionId: String(opts.subscriptionId), status: { $ne: 'refunded' } })
    if (paid >= RECURRING_MONTHS) return
  }

  // Amount: prefer the real charged amount from the webhook, else the plan price.
  const amount = opts.amountUsd && opts.amountUsd > 0 ? round2(opts.amountUsd) : planPriceUsd(opts.plan)
  if (!amount) return

  // Rate: a returning customer keeps the rate they were acquired at; a new one is
  // priced by its acquisition rank (so the 101-200 bonus window is honoured).
  const prior = await ReferralConversion.findOne({ affiliateId: String(affiliate._id), referredUserId: String(user._id), status: { $ne: 'refunded' } }).select('rateApplied').lean()
  const rate = prior
    ? (prior.rateApplied ?? BASE_RATE)
    : rateForRank(await payingReferralCount(String(affiliate._id)) + 1)
  const commissionUsd = round2(amount * rate)

  try {
    await ReferralConversion.create({
      affiliateId: String(affiliate._id),
      code: affiliate.code,
      referredUserId: String(user._id),
      referredEmail: user.email ?? '',
      referredName: user.name ?? null,
      subscriptionId: opts.subscriptionId ? String(opts.subscriptionId) : null,
      invoiceId: String(opts.invoiceId),
      rateApplied: rate,
      plan: String(opts.plan ?? ''),
      grossUsd: amount,
      commissionUsd,
      status: 'pending',
    })
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) return // concurrent duplicate
    throw err
  }
  await recomputeAffiliateTotals(String(affiliate._id))
}

/** Void the commission for a refunded payment (found by its invoice). */
export async function refundCommission(invoiceId: string | null | undefined): Promise<void> {
  if (!invoiceId) return
  const conv = await ReferralConversion.findOne({ invoiceId: String(invoiceId) })
  if (!conv || conv.status === 'paid' || conv.status === 'refunded') return
  conv.status = 'refunded'
  await conv.save()
  await recomputeAffiliateTotals(String(conv.affiliateId))
}

/**
 * Recompute an affiliate's counters from its conversions. Authoritative: call
 * after any change. `conversions` = distinct paying customers (drives the tier);
 * earnedTotal / paidTotal sum every (non-refunded / paid) payment. `commissionRate`
 * is refreshed to the affiliate's current tier rate for display.
 */
export async function recomputeAffiliateTotals(affiliateId: string): Promise<void> {
  const rows = await ReferralConversion.find({ affiliateId }).select('referredUserId commissionUsd status').lean()
  let earned = 0, paid = 0
  const customers = new Set<string>()
  for (const r of rows) {
    if (r.status === 'refunded') continue
    earned += r.commissionUsd
    customers.add(String(r.referredUserId))
    if (r.status === 'paid') paid += r.commissionUsd
  }
  const conversions = customers.size
  await Affiliate.updateOne({ _id: affiliateId }, { $set: {
    earnedTotal: round2(earned), paidTotal: round2(paid), conversions,
    commissionRate: currentRate(conversions),   // rate the next new referral earns
  } })
}

/** Shape an affiliate doc for the client (never leaks other users' data). */
export function serializeAffiliate(a: IAffiliateDoc) {
  const paying = a.conversions ?? 0
  return {
    code: a.code,
    link: affiliateLink(a.code),
    commissionRate: currentRate(paying),
    status: a.status,
    payoutMethod: a.payoutMethod ?? null,
    payoutName: a.payoutName ?? null,
    payoutNumber: a.payoutNumber ?? null,
    payoutBank: a.payoutBank ?? null,
    clicks: a.clicks ?? 0,
    signups: a.signups ?? 0,
    conversions: paying,
    payingReferrals: paying,
    tierThreshold: TIER_THRESHOLD,
    bonusWindowEnd: BONUS_WINDOW_END,
    baseRate: BASE_RATE,
    bonusRate: BONUS_RATE,
    recurringMonths: RECURRING_MONTHS,
    earnedTotal: round2(a.earnedTotal ?? 0),
    paidTotal: round2(a.paidTotal ?? 0),
  }
}
