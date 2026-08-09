import { User } from './models'
import { limitsFor } from './planLimits'
import { effectivePlan, type PlanSlug } from './plans'

/**
 * Per-plan quota metering. Counters live on the User doc (daily searches reuse the
 * existing searchCount/lastSearchReset; monthly Listing-Pro images use their own
 * fields) and reset on a UTC day/month rollover. Reads the plan fresh from the DB
 * so it reflects a just-purchased upgrade even before the JWT refreshes.
 */
const sameUTCDay = (a?: Date | null, b?: Date | null) =>
  !!a && !!b && a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()
const sameUTCMonth = (a?: Date | null, b?: Date | null) =>
  !!a && !!b && a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()

export interface QuotaResult { allowed: boolean; used: number; limit: number; plan: PlanSlug }

/** Count one keyword search against the user's daily plan limit. */
export async function consumeDailySearch(userId: string): Promise<QuotaResult | null> {
  const user = await User.findById(userId)
  if (!user) return null
  const plan = effectivePlan(user)
  const limit = limitsFor(plan).searchesPerDay
  const now = new Date()
  if (!sameUTCDay(user.lastSearchReset, now)) { user.searchCount = 0; user.lastSearchReset = now }
  const used = user.searchCount ?? 0
  if (limit !== Infinity && used >= limit) return { allowed: false, used, limit, plan }
  user.searchCount = used + 1
  await user.save()
  return { allowed: true, used: used + 1, limit, plan }
}

/** Count one Etsy Listing Pro image against the user's monthly plan allowance. */
export async function consumeMonthlyImage(userId: string): Promise<QuotaResult | null> {
  const user = await User.findById(userId)
  if (!user) return null
  const plan = effectivePlan(user)
  const limit = limitsFor(plan).listingImagesPerMonth
  const now = new Date()
  if (!sameUTCMonth(user.listingImageReset, now)) { user.listingImageCount = 0; user.listingImageReset = now }
  const used = user.listingImageCount ?? 0
  if (limit !== Infinity && used >= limit) return { allowed: false, used, limit, plan }
  user.listingImageCount = used + 1
  await user.save()
  return { allowed: true, used: used + 1, limit, plan }
}

/** Give back one monthly image credit — used when a consumed generation fails. */
export async function refundMonthlyImage(userId: string): Promise<void> {
  await User.updateOne({ _id: userId, listingImageCount: { $gt: 0 } }, { $inc: { listingImageCount: -1 } }).catch(() => {})
}

