import { User } from './models'
import { limitsFor } from './planLimits'
import { effectivePlan, type PlanSlug } from './plans'
import { activeBonus, activeSebtCredits } from './credits'

/**
 * Per-plan quota metering. Counters live on the User doc (daily searches reuse the
 * existing searchCount/lastSearchReset; monthly Listing-Pro images use their own
 * fields) and reset daily at 12:00 AM Pakistan time (monthly images: UTC month). Reads the plan fresh from the DB
 * so it reflects a just-purchased upgrade even before the JWT refreshes.
 */
import { sameCreditDay, creditDayStart } from './creditDay'
const sameUTCMonth = (a?: Date | null, b?: Date | null) =>
  !!a && !!b && a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()

export interface QuotaResult { allowed: boolean; used: number; limit: number; plan: PlanSlug }

/**
 * Can this user run another search today? A read-only peek: it never increments,
 * so a search that then fails upstream costs the user nothing. Mirrors
 * credits.ts canAfford → consumeCredits: check before the work, count after it
 * delivers. Two searches fired at once can both pass this, same as credits; the
 * cap is a fair-use limit, not a ledger.
 */
export async function peekDailySearch(userId: string): Promise<QuotaResult | null> {
  const user = await User.findById(userId).select('plan compExpiresAt subscriptionStatus planRenewsAt lsSubscriptionId searchCount lastSearchReset bonusCredits bonusCreditsGranted bonusExpiresAt sebtCreditsPerDay sebtCreditsPlan sebtCreditsExpiresAt').lean<{
    searchCount?: number; lastSearchReset?: Date | null; bonusCredits?: number; bonusCreditsGranted?: number; bonusExpiresAt?: Date | null
    sebtCreditsPerDay?: number; sebtCreditsPlan?: string | null; sebtCreditsExpiresAt?: Date | null
  } & Record<string, unknown>>()
  if (!user) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plan = effectivePlan(user as any)
  // A valid admin bonus pool lifts the cap by its GRANTED size, and SEBT free credits
  // by their daily amount; the credit balance is what actually limits the searches.
  const limit = limitsFor(plan).searchesPerDay + (activeBonus(user)?.granted ?? 0) + (activeSebtCredits(user)?.perDay ?? 0)
  // A stale counter from a previous day reads as zero; consume resets it.
  const used = sameCreditDay(user.lastSearchReset, new Date()) ? (user.searchCount ?? 0) : 0
  return { allowed: limit === Infinity || used < limit, used, limit, plan }
}

/**
 * Count one keyword search against the user's daily plan limit. Atomic (same
 * pattern as credits.ts consumeCredits) so two searches finishing together can
 * neither lose a count nor pass the cap.
 */
export async function consumeDailySearch(userId: string): Promise<QuotaResult | null> {
  const user = await User.findById(userId)
  if (!user) return null
  const plan = effectivePlan(user)
  const now = new Date()
  const limit = limitsFor(plan).searchesPerDay + (activeBonus(user, now)?.granted ?? 0) + (activeSebtCredits(user, now)?.perDay ?? 0)
  // Same day boundary as credits: 12:00 AM Pakistan time (creditDay.ts).
  const dayStart = creditDayStart(now)
  await User.updateOne(
    { _id: userId, $or: [{ lastSearchReset: { $lt: dayStart } }, { lastSearchReset: null }] },
    { $set: { searchCount: 0, lastSearchReset: now } },
  )
  const cap = limit === Infinity ? {} : { $or: [{ searchCount: { $lt: limit } }, { searchCount: null }] }
  const after = await User.findOneAndUpdate(
    { _id: userId, ...cap },
    [{ $set: { searchCount: { $add: [{ $ifNull: ['$searchCount', 0] }, 1] } } }],
    { returnDocument: 'after', updatePipeline: true },
  ).select('searchCount').lean<{ searchCount?: number }>()
  if (!after) return { allowed: false, used: limit, limit, plan }
  return { allowed: true, used: after.searchCount ?? 1, limit, plan }
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

/** Give back one monthly image credit - used when a consumed generation fails. */
export async function refundMonthlyImage(userId: string): Promise<void> {
  await User.updateOne({ _id: userId, listingImageCount: { $gt: 0 } }, { $inc: { listingImageCount: -1 } }).catch(() => {})
}

