import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User, KeywordHistory, ConnectedShop } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin, resolveRole } from '@/lib/auth/roles'
import { creditLimitFor } from '@/lib/credits'
import { effectivePlan } from '@/lib/plans'
import { isFreeToProPromoOn } from '@/lib/promo'
import { sweepComps } from '@/lib/plan-lifecycle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000
const sameUTCDay = (a?: Date | null, b?: Date | null) =>
  !!a && !!b && a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()

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
  // Persist plan lifecycle before listing so the plans shown are truthful.
  await sweepComps().catch(() => null)

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20))
  const q = (searchParams.get('q') || '').trim()

  // Search filter: name / email (case-insensitive) or an exact Mongo _id.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let filter: Record<string, any> = {}
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const or: any[] = [{ name: rx }, { email: rx }]
    if (/^[a-f0-9]{24}$/i.test(q)) or.push({ _id: q })
    filter = { $or: or }
  }

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * DAY)
  const since14 = new Date(now.getTime() - 13 * DAY)   // 14-day window incl. today

  const [total, verified, admins, paying, newThisWeek, searches, signupAgg, planAgg, matched, docs, promoOn] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ isVerified: true }),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ lsSubscriptionId: { $exists: true, $ne: null }, plan: { $ne: 'free' } }),
    User.countDocuments({ createdAt: { $gte: weekAgo } }),
    KeywordHistory.estimatedDocumentCount(),
    User.aggregate([
      { $match: { createdAt: { $gte: since14 } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } },
    ]),
    User.aggregate([{ $group: { _id: '$plan', count: { $sum: 1 } } }]),
    q ? User.countDocuments(filter) : null,
    User.find(filter)
      .select('name email role plan subscriptionStatus planRenewsAt compExpiresAt isVerified restricted lsSubscriptionId createdAt listingImageCount creditsResetAt creditsUsedToday creditsUsedTotal')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    isFreeToProPromoOn(),
  ])

  const matchTotal = q ? (matched ?? 0) : total

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
    const creditsLimit = creditLimitFor(plan)
    const creditsUsedToday = sameUTCDay(u.creditsResetAt, now) ? (u.creditsUsedToday ?? 0) : 0
    return {
      id,
      name: u.name,
      email: u.email,
      role: resolveRole(u.email, u.role),
      plan: u.plan,
      isVerified: u.isVerified,
      restricted: u.restricted ?? false,
      paidViaLemonSqueezy: !!u.lsSubscriptionId,
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
    }
  })

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

  const stats = { total, admins, verified, searches, paying, newThisWeek, signups, planDist }

  return NextResponse.json({
    success: true,
    data: { users, stats, page, pageCount: Math.max(1, Math.ceil(matchTotal / limit)), matched: matchTotal, freeToProPromo: promoOn },
  })
}
