import { NextRequest, NextResponse } from 'next/server'
import { sameCreditDay } from '@/lib/creditDay'
import { PENDING_SIGNUP, NOT_PENDING_SIGNUP, cleanupPendingSignups } from '@/lib/auth/pendingSignups'
import { parseUserFilters, buildUserFilter, isFiltered, localPayers } from '@/lib/admin/userFilters'
import { isDisposableEmail } from '@/lib/auth/disposable'
import { connectDB } from '@/lib/db'
import { User, KeywordHistory, ConnectedShop, LocalPayment } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin, resolveRole } from '@/lib/auth/roles'
import { dailyLimitFor, activeBonus, activeSebtCredits, creditLimitFor } from '@/lib/credits'
import { effectivePlan } from '@/lib/plans'
import { isFreeToProPromoOn } from '@/lib/promo'
import { sweepComps } from '@/lib/plan-lifecycle'
import { sharedCached } from '@/lib/sharedCache'
import { memCache } from '@/lib/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000

/**
 * Customers who paid by bank / JazzCash (PKR) and whose paid period is still
 * running: an approved local payment with grantedUntil in the future, on an account
 * that still exists, is not on Free, and is not already counted as a card payer.
 */
async function countLocalPayers(now: Date): Promise<number> {
  const ids = (await LocalPayment.distinct('userId', { status: 'approved', grantedUntil: { $gt: now } }))
    .map(String).filter(id => /^[a-f0-9]{24}$/i.test(id))
  if (!ids.length) return 0
  return User.countDocuments({
    _id: { $in: ids }, plan: { $ne: 'free' },
    $or: [{ lsSubscriptionId: null }, { lsSubscriptionId: { $exists: false } }],
  })
}

/**
 * Admin users list - server-side PAGINATED + searched, so opening the admin no
 * longer loads every user (was the slow part at 4k+ users). The Overview headline
 * stats and charts are computed with cheap countDocuments / bounded aggregates and
 * returned in `stats`, so the client never needs the full list either. Per-user
 * activity (searches, connected shops) is aggregated only for the page's user ids.
 *
 *   GET ?page=1&limit=20&q=<search>
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  await connectDB()
  // Persist ended plans at most every 10 minutes per worker, in the background (the
  // daily cron does it too). It used to run, and be waited for, on every list load
  // (~4 s on a busy database). Plans shown are already correct: effectivePlan() below.
  if (!memCache.get('admin-sweep-comps')) {
    memCache.set('admin-sweep-comps', 1, 600)
    void sweepComps().catch(() => null)
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20))
  // Search + filters (plan, temp-mail or real email, paying / granted / restricted /
  // waiting for email code). Shared with bulk actions (lib/admin/userFilters.ts).
  const filters = parseUserFilters(searchParams)
  const pendingView = filters.account === 'pending'
  const filtered = !!isFiltered(filters)
  void cleanupPendingSignups().catch(() => null)
  const filter = await buildUserFilter(filters)
  const real = NOT_PENDING_SIGNUP

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * DAY)
  const since14 = new Date(now.getTime() - 13 * DAY)   // 14-day window incl. today

  // The Overview numbers (counts, charts, paying customers) are computed at most once
  // every 2 minutes for the whole site (sharedCached): recomputing them on every list
  // load, in every worker, took 10-30 s on a busy database (2026-10-08).
  const statsP = sharedCached('admin-users-stats', 2 * 60_000, async () => {
    const [sebtCount, total, verified, admins, payingCard, newThisWeek, searches, signupAgg, planAgg, pending, tempMail, payingLocal] = await Promise.all([
      User.countDocuments({ ...real, sebtStudent: true }),
      User.countDocuments(real),
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ lsSubscriptionId: { $exists: true, $ne: null }, plan: { $ne: 'free' } }),
      User.countDocuments({ ...real, createdAt: { $gte: weekAgo } }),
      KeywordHistory.estimatedDocumentCount(),
      User.aggregate([
        { $match: { ...real, createdAt: { $gte: since14 } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } },
      ]),
      User.aggregate([{ $match: real }, { $group: { _id: '$plan', count: { $sum: 1 } } }]),
      User.countDocuments(PENDING_SIGNUP),
      buildUserFilter({ emailType: 'temp' }).then(f => User.countDocuments(f)),
      // Paying = card (Lemon Squeezy) + bank/JazzCash customers whose paid time is still running.
      countLocalPayers(now),
    ])
    // 14-day signups series (UTC days, gaps filled) for the Overview chart.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byDay = new Map<string, number>((signupAgg as any[]).map(x => [String(x._id), x.count]))
    const signups: { label: string; value: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * DAY)
      signups.push({ label: String(d.getUTCDate()), value: byDay.get(d.toISOString().slice(0, 10)) ?? 0 })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const planDist = (planAgg as any[]).map(p => ({ plan: (p._id as string) ?? 'free', value: p.count as number }))
    return { total, admins, verified, searches, paying: payingCard + payingLocal, payingCard, payingLocal, newThisWeek, signups, planDist, pending, tempMail, sebt: sebtCount }
  })

  // Bank / JazzCash customers with paid time left count as paying customers too.
  const local = await localPayers(now).catch(() => new Map<string, { until: Date; method: 'bank' | 'jazzcash'; plan: string }>())
  const localIds = [...local.keys()]
  const [stats, matched, docs, promoOn] = await Promise.all([
    statsP,
    filtered ? User.countDocuments(filter) : null,
    // Paying customers FIRST (real Lemon Squeezy sub on a non-free plan), then by
    // plan tier, then newest - matching the old client sort but now applied
    // globally across ALL users so page 1 shows the payers, not just page order.
    User.aggregate([
      { $match: filter },
      { $addFields: {
        _paid: { $cond: [{ $and: [{ $ne: ['$plan', 'free'] }, { $or: [{ $ne: [{ $ifNull: ['$lsSubscriptionId', null] }, null] }, { $in: [{ $toString: '$_id' }, localIds] }] }] }, 1, 0] },
        _planRank: { $switch: { branches: [
          { case: { $eq: ['$plan', 'custom'] }, then: 9 },
          { case: { $eq: ['$plan', 'enterprise'] }, then: 8 },
          { case: { $eq: ['$plan', 'agency'] }, then: 7 },
          { case: { $eq: ['$plan', 'business'] }, then: 6 },
          { case: { $eq: ['$plan', 'pro-1yr'] }, then: 5 },
          { case: { $eq: ['$plan', 'pro'] }, then: 4 },
          { case: { $eq: ['$plan', 'basic'] }, then: 3 },
          { case: { $eq: ['$plan', 'starter'] }, then: 2 },
        ], default: 1 } },
      } },
      { $sort: { _paid: -1, _planRank: -1, createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $project: { name: 1, email: 1, role: 1, plan: 1, subscriptionStatus: 1, planRenewsAt: 1, compExpiresAt: 1, isVerified: 1, restricted: 1, lsSubscriptionId: 1, createdAt: 1, listingImageCount: 1, creditsResetAt: 1, creditsUsedToday: 1, creditsUsedTotal: 1, bonusCredits: 1, bonusCreditsGranted: 1, bonusExpiresAt: 1, sebtStudent: 1, sebtBatch: 1, sebtCreditsPerDay: 1, sebtCreditsPlan: 1, sebtCreditsExpiresAt: 1 } },
    ]),
    isFreeToProPromoOn(),
  ])
  void pendingView

  const matchTotal = filtered ? (matched ?? 0) : stats.total

  // Per-user activity + shop counts, ONLY for the users on this page.
  const pageIds = docs.map(u => String(u._id))
  const [activity, shopCounts] = await Promise.all([
    pageIds.length ? KeywordHistory.aggregate([
      { $match: { userId: { $in: pageIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 }, last: { $max: '$searchedAt' } } },
    ]) : [],
    pageIds.length ? ConnectedShop.aggregate([
      { $match: { userId: { $in: pageIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]) : [],
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const act = new Map<string, { count: number; last: Date }>(activity.map((a: any) => [String(a._id), { count: a.count, last: a.last }]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shops = new Map<string, number>(shopCounts.map((s: any) => [String(s._id), s.count]))

  const users = docs.map(u => {
    const id = u._id.toString()
    const a = act.get(id)
    const plan = effectivePlan(u)
    const creditsLimit = dailyLimitFor(plan, u, now)
    const creditsUsedToday = sameCreditDay(u.creditsResetAt, now) ? (u.creditsUsedToday ?? 0) : 0
    return {
      id,
      name: u.name,
      email: u.email,
      role: resolveRole(u.email, u.role),
      plan: u.plan,
      isVerified: u.isVerified,
      tempMail: isDisposableEmail(u.email),
      restricted: u.restricted ?? false,
      paidViaLemonSqueezy: !!u.lsSubscriptionId,
      // Paid by bank / JazzCash, with when that paid time ends.
      paidLocally: local.has(id) && u.plan !== 'free' ? { until: local.get(id)!.until, method: local.get(id)!.method } : null,
      connectedShops: shops.get(id) ?? 0,
      createdAt: u.createdAt ?? null,
      searches: a?.count ?? 0,
      lastActive: a?.last ?? null,
      subscriptionStatus: u.subscriptionStatus ?? null,
      compExpiresAt: u.compExpiresAt ?? null,
      imagesThisMonth: u.listingImageCount ?? 0,
      creditsUsedToday,
      creditsLimit,
      creditsRemaining: Math.max(0, creditsLimit - creditsUsedToday),
      creditsUsedTotal: u.creditsUsedTotal ?? 0,
      bonus: activeBonus(u, now),
      // SEBT NEXT: group membership, and the free daily credits on top of the plan.
      sebtStudent: !!u.sebtStudent,
      sebtBatch: u.sebtBatch ?? null,
      planCredits: creditLimitFor(plan),
      sebtCredits: activeSebtCredits(u, now),
    }
  })


  return NextResponse.json({
    success: true,
    data: { users, stats, page, pageCount: Math.max(1, Math.ceil(matchTotal / limit)), matched: matchTotal, freeToProPromo: promoOn },
  })
}
