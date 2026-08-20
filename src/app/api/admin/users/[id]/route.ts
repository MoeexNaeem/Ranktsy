import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User, KeywordHistory, ConnectedShop, ApiUsage } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin, resolveRole } from '@/lib/auth/roles'
import { PLAN_SLUGS, effectivePlan } from '@/lib/plans'
import { creditLimitFor } from '@/lib/credits'
import type { IApiUsage } from '@/types'

export const runtime = 'nodejs'

async function requireAdmin() {
  const auth = await getCurrentUser()
  if (!auth) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), auth: null }
  if (!isAdmin(auth)) return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }), auth: null }
  return { error: null, auth }
}

const sameUTCDay = (a?: Date | null, b?: Date | null) =>
  !!a && !!b && a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()
const dayKey = (d: Date) => d.toISOString().slice(0, 10)

// Full per-user detail for the admin user-detail panel — everything we hold about
// one account in a single call: profile, plan/billing, credits, connected shops,
// recent searches and a 14-day usage series.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id } = await params

  await connectDB()
  const u = await User.findById(id).lean()
  if (!u) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })

  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - i); return dayKey(d) })
  const [shops, recentSearches, searchTotal, usageRows] = await Promise.all([
    ConnectedShop.find({ userId: id }).select('shopName shopId createdAt').lean(),
    KeywordHistory.find({ userId: id }).sort({ searchedAt: -1 }).limit(25).select('keyword searchedAt').lean(),
    KeywordHistory.countDocuments({ userId: id }),
    ApiUsage.find({ userId: id, day: { $in: days } }).lean<IApiUsage[]>(),
  ])

  const plan = effectivePlan(u)
  const creditsLimit = creditLimitFor(plan)
  const creditsUsedToday = sameUTCDay(u.creditsResetAt, new Date()) ? (u.creditsUsedToday ?? 0) : 0
  const byDay = new Map(usageRows.map(r => [r.day, r]))
  const usage = days.slice().reverse().map(day => {
    const r = byDay.get(day)
    return {
      day,
      etsyCalls: r?.etsyCalls ?? 0, googleCalls: r?.googleCalls ?? 0, searches: r?.searches ?? 0,
      imageCalls: r?.imageCalls ?? 0, imageCostUsd: r?.imageCostUsd ?? 0, creditsSpent: r?.creditsSpent ?? 0,
    }
  })

  return NextResponse.json({ success: true, data: {
    id,
    name: u.name, email: u.email, authProvider: u.authProvider ?? null,
    role: resolveRole(u.email, u.role), plan: u.plan, effectivePlan: plan,
    isVerified: u.isVerified, restricted: u.restricted ?? false,
    paidViaLemonSqueezy: !!u.lsSubscriptionId, subscriptionStatus: u.subscriptionStatus ?? null,
    lsCustomerId: u.lsCustomerId ?? null, planRenewsAt: u.planRenewsAt ?? null,
    createdAt: u.createdAt ?? null,
    credits: { usedToday: creditsUsedToday, limit: creditsLimit, remaining: Math.max(0, creditsLimit - creditsUsedToday), usedTotal: u.creditsUsedTotal ?? 0 },
    imagesThisMonth: u.listingImageCount ?? 0,
    savedKeywords: (u.savedKeywords ?? []).length,
    searchTotal,
    shops: shops.map(s => ({ shopName: s.shopName, shopId: s.shopId })),
    recentSearches: recentSearches.map(s => ({ keyword: s.keyword, at: s.searchedAt ?? null })),
    usage,
  } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, auth } = await requireAdmin()
  if (error) return error
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  if (typeof body.restricted === 'boolean' && body.restricted && auth?.id === id) {
    return NextResponse.json({ success: false, error: "You can't restrict your own admin account." }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (body.role === 'user' || body.role === 'admin') update.role = body.role
  if ((PLAN_SLUGS as string[]).includes(body.plan)) update.plan = body.plan
  if (typeof body.isVerified === 'boolean') update.isVerified = body.isVerified
  if (typeof body.restricted === 'boolean') update.restricted = body.restricted
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 })
  }

  await connectDB()
  const u = await User.findByIdAndUpdate(id, update, { new: true }).lean()
  if (!u) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: { id, ...update } })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, auth } = await requireAdmin()
  if (error) return error
  const { id } = await params

  if (auth && auth.id === id) {
    return NextResponse.json({ success: false, error: "You can't delete your own admin account here." }, { status: 400 })
  }

  await connectDB()
  const deleted = await User.findByIdAndDelete(id).lean()
  if (!deleted) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  await KeywordHistory.deleteMany({ userId: id }).catch(() => {})
  return NextResponse.json({ success: true, data: { id } })
}
