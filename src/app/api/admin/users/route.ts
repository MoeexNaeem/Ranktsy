import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User, KeywordHistory, ConnectedShop } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin, resolveRole } from '@/lib/auth/roles'
import { creditLimitFor } from '@/lib/credits'
import { effectivePlan } from '@/lib/plans'
import { isFreeToProPromoOn } from '@/lib/promo'
import { sweepComps } from '@/lib/plan-lifecycle'

export const runtime = 'nodejs'

const sameUTCDay = (a?: Date | null, b?: Date | null) =>
  !!a && !!b && a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()

export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  await connectDB()
  // Persist plan lifecycle before listing: revert expired admin-granted (comp)
  // plans to free, and give legacy comp grants a one-month clock. So the list
  // always reflects the true current plan.
  await sweepComps().catch(() => null)
  const [users, activity, shopCounts, promoOn] = await Promise.all([
    User.find().sort({ createdAt: -1 }).lean(),
    KeywordHistory.aggregate([
      { $group: { _id: '$userId', count: { $sum: 1 }, last: { $max: '$searchedAt' } } },
    ]),
    ConnectedShop.aggregate([
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]),
    isFreeToProPromoOn(),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const act = new Map<string, { count: number; last: Date }>(activity.map((a: any) => [String(a._id), { count: a.count, last: a.last }]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shops = new Map<string, number>(shopCounts.map((s: any) => [String(s._id), s.count]))

  const rows = users.map(u => {
    const id = u._id.toString()
    const a = act.get(id)
    const plan = effectivePlan(u)
    const creditsLimit = creditLimitFor(plan)
    const now = new Date()
    const creditsUsedToday = sameUTCDay(u.creditsResetAt, now) ? (u.creditsUsedToday ?? 0) : 0
    return {
      id,
      name: u.name,
      email: u.email,
      role: resolveRole(u.email, u.role),
      plan: u.plan,
      isVerified: u.isVerified,
      restricted: u.restricted ?? false,
      // A REAL Lemon Squeezy purchase, not an admin-granted plan change — the
      // webhook is the only writer of lsSubscriptionId; the admin PATCH route
      // only ever touches role/plan/isVerified/restricted.
      paidViaLemonSqueezy: !!u.lsSubscriptionId,
      connectedShops: shops.get(id) ?? 0,
      createdAt: u.createdAt ?? null,
      searches: a?.count ?? 0,
      lastActive: a?.last ?? null,
      subscriptionStatus: u.subscriptionStatus ?? null,
      // When set (and no paid sub), this admin-granted plan reverts to free on this date.
      compExpiresAt: u.compExpiresAt ?? null,
      imagesThisMonth: u.listingImageCount ?? 0,
      creditsUsedToday,
      creditsLimit,
      creditsRemaining: Math.max(0, creditsLimit - creditsUsedToday),
      creditsUsedTotal: u.creditsUsedTotal ?? 0,
    }
  })

  const totalSearches = rows.reduce((s, r) => s + r.searches, 0)
  const stats = {
    total: rows.length,
    admins: rows.filter(r => r.role === 'admin').length,
    verified: rows.filter(r => r.isVerified).length,
    searches: totalSearches,
  }

  return NextResponse.json({ success: true, data: { users: rows, stats, freeToProPromo: promoOn } })
}
