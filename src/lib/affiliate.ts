/**
 * Affiliate program - server-side logic.
 *
 * Attribution is first-touch at signup: when a visitor arrives via ?ref=CODE we
 * drop the `rk_ref` cookie (see /api/affiliate/click), and at registration we
 * stamp `referredBy` on the new user. A paid purchase by a referred user then
 * creates one ReferralConversion holding the commission and its payout status.
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
export const DEFAULT_COMMISSION_RATE = 0.20
export const PAYOUT_MIN_USD = 50

/**
 * USD monthly price per paid plan. Kept in sync with the display prices in
 * src/components/landing/plans-data.ts. Used to value a commission from the plan
 * the referred user bought (deterministic, so it matches what the seller sees).
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

/** A referral code candidate from a display name plus a short random suffix. */
export function makeCodeCandidate(name?: string | null): string {
  const base = String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 12) || 'ref'
  const rand = Math.random().toString(36).slice(2, 7) // 5 chars
  return `${base}${rand}`
}

/** Generate a code that is not already taken (a few tries, then a longer random). */
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

/**
 * Record a commission for a referred user's paid purchase. Idempotent per
 * subscription (a duplicate webhook delivery is a no-op). Skips self-referrals,
 * free/unknown plans, and users with no referrer.
 */
export async function recordConversion(user: {
  _id: unknown; email?: string; name?: string; referredBy?: string | null
}, subscriptionId: string | null | undefined, plan?: string | null): Promise<void> {
  const code = user.referredBy
  if (!code) return
  const price = planPriceUsd(plan)
  if (!price) return

  const affiliate = await Affiliate.findOne({ code })
  if (!affiliate || affiliate.status !== 'active') return
  if (String(affiliate.userId) === String(user._id)) return // no self-referral

  const commissionUsd = round2(price * (affiliate.commissionRate || DEFAULT_COMMISSION_RATE))
  const sub = subscriptionId ? String(subscriptionId) : null

  // One conversion per subscription. When a sub id is present the unique partial
  // index also guards against races; without one we fall back to per-user.
  const filter = sub
    ? { subscriptionId: sub }
    : { referredUserId: String(user._id), subscriptionId: null }
  const existing = await ReferralConversion.findOne(filter).select('_id').lean()
  if (existing) return

  try {
    await ReferralConversion.create({
      affiliateId: String(affiliate._id),
      code: affiliate.code,
      referredUserId: String(user._id),
      referredEmail: user.email ?? '',
      referredName: user.name ?? null,
      subscriptionId: sub,
      plan: String(plan),
      grossUsd: price,
      commissionUsd,
      status: 'pending',
    })
  } catch (err) {
    // Duplicate key from the unique index = a concurrent delivery already wrote it.
    if ((err as { code?: number })?.code === 11000) return
    throw err
  }
  await Affiliate.updateOne({ _id: affiliate._id }, { $inc: { conversions: 1, earnedTotal: commissionUsd } })
}

/** Void a commission when its purchase is refunded (does not touch paidTotal). */
export async function refundConversion(subscriptionId: string | null | undefined): Promise<void> {
  if (!subscriptionId) return
  const conv = await ReferralConversion.findOne({ subscriptionId: String(subscriptionId) })
  if (!conv || conv.status === 'paid' || conv.status === 'refunded') return
  conv.status = 'refunded'
  await conv.save()
  await Affiliate.updateOne({ _id: conv.affiliateId }, { $inc: { conversions: -1, earnedTotal: -conv.commissionUsd } })
}

/**
 * Recompute an affiliate's money counters from its conversions. Authoritative:
 * call after any admin status change so earnedTotal / paidTotal / conversions
 * can never drift. `refunded` rows count toward neither earned nor the count.
 */
export async function recomputeAffiliateTotals(affiliateId: string): Promise<void> {
  const rows = await ReferralConversion.find({ affiliateId }).select('commissionUsd status').lean()
  let earned = 0, paid = 0, count = 0
  for (const r of rows) {
    if (r.status === 'refunded') continue
    earned += r.commissionUsd
    count += 1
    if (r.status === 'paid') paid += r.commissionUsd
  }
  await Affiliate.updateOne({ _id: affiliateId }, { $set: { earnedTotal: round2(earned), paidTotal: round2(paid), conversions: count } })
}

/** Shape an affiliate doc for the client (never leaks other users' data). */
export function serializeAffiliate(a: IAffiliateDoc) {
  return {
    code: a.code,
    link: affiliateLink(a.code),
    commissionRate: a.commissionRate,
    status: a.status,
    payoutMethod: a.payoutMethod ?? null,
    payoutName: a.payoutName ?? null,
    payoutNumber: a.payoutNumber ?? null,
    payoutBank: a.payoutBank ?? null,
    clicks: a.clicks ?? 0,
    signups: a.signups ?? 0,
    conversions: a.conversions ?? 0,
    earnedTotal: round2(a.earnedTotal ?? 0),
    paidTotal: round2(a.paidTotal ?? 0),
  }
}
