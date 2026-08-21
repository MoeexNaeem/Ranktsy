import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import type { IUserDoc } from '@/lib/models'

/**
 * Plan lifecycle for ADMIN-GRANTED (comp) plans — a plan an admin gave a user
 * without a Lemon Squeezy purchase (the Free→Pro promo or the admin plan
 * dropdown). Such a grant carries `compExpiresAt`; on/after it the user reverts
 * to 'free'. (Real PAID subscriptions expire via the LS webhook + planRenewsAt —
 * see effectivePlan; this file never touches those.)
 */

/** Exactly one CALENDAR month from `from` (default now) — a "1-month" grant. */
export function addOneMonth(from: Date = new Date()): Date {
  const d = new Date(from)
  d.setMonth(d.getMonth() + 1)
  return d
}

/** True while a paid subscription is genuinely active (never comp-expire these). */
function paidActive(status?: string | null): boolean {
  return status === 'active' || status === 'on_trial'
}

/**
 * Persist the comp-plan lifecycle for ONE loaded user doc (mutates + saves).
 * Returns true if anything changed. Safe to call on any user on a protected read.
 *  1. Expired comp grant → plan back to 'free', clear the expiry.
 *  2. Legacy admin grant with NO expiry recorded → start a fresh one-month clock
 *     (we can't know the original grant date, so it reverts one month from now).
 */
export async function reconcileUserPlan(user: IUserDoc): Promise<boolean> {
  const now = Date.now()
  const status = user.subscriptionStatus ?? ''
  let changed = false

  if (user.compExpiresAt && now > new Date(user.compExpiresAt).getTime() && !paidActive(status)) {
    if (user.plan !== 'free') { user.plan = 'free'; changed = true }
    if (user.compExpiresAt != null) { user.compExpiresAt = null; changed = true }
  } else if (user.plan !== 'free' && !user.lsSubscriptionId && !user.compExpiresAt && !status) {
    // Non-free, no paid sub, no status, no expiry → an admin gift with no clock.
    user.compExpiresAt = addOneMonth()
    changed = true
  }

  if (changed) await user.save()
  return changed
}

/** Give legacy admin grants (non-free, no paid sub, no expiry) a one-month clock
 *  from now — a one-off so pre-existing gifts also start reverting. Returns count. */
export async function backfillCompExpiries(): Promise<number> {
  await connectDB()
  const r = await User.updateMany(
    { plan: { $ne: 'free' }, compExpiresAt: null, lsSubscriptionId: null, subscriptionStatus: { $in: [null, ''] } },
    { $set: { compExpiresAt: addOneMonth() } },
  )
  return r.modifiedCount ?? 0
}

/** Downgrade every comp grant whose expiry has passed (skips active paid subs). */
export async function reconcileExpiredComps(): Promise<number> {
  await connectDB()
  const r = await User.updateMany(
    { compExpiresAt: { $ne: null, $lte: new Date() }, subscriptionStatus: { $nin: ['active', 'on_trial'] } },
    { $set: { plan: 'free', compExpiresAt: null } },
  )
  return r.modifiedCount ?? 0
}

/** One bulk pass (admin list + cron): backfill legacy grants, then expire the due
 *  ones. Backfill first so a freshly-clocked grant isn't expired the same tick. */
export async function sweepComps(): Promise<{ backfilled: number; expired: number }> {
  const backfilled = await backfillCompExpiries()
  const expired = await reconcileExpiredComps()
  return { backfilled, expired }
}
