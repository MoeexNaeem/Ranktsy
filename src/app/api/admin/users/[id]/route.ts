import { NextRequest, NextResponse } from 'next/server'
import { sameCreditDay } from '@/lib/creditDay'
import { rememberDeletedTempAccounts } from '@/lib/auth/deletedAccounts'
import { logFromRequest } from '@/lib/security/events'
import { forgetRestrictedCache } from '@/lib/security/restricted'
import { connectDB } from '@/lib/db'
import { User, KeywordHistory, ConnectedShop, ApiUsage } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin, resolveRole } from '@/lib/auth/roles'
import { PLAN_SLUGS, effectivePlan } from '@/lib/plans'
import { reconcileUserPlan } from '@/lib/plan-lifecycle'
import { getSebtConfig, sebtCreditFields } from '@/lib/sebt'
import { PLAN_LABELS } from '@/lib/plans'
import { addMonths, grantMonthsFor } from '@/lib/local-payments'
import { dailyLimitFor, activeBonus } from '@/lib/credits'
import type { IApiUsage } from '@/types'

export const runtime = 'nodejs'

async function requireAdmin() {
  const auth = await getCurrentUser()
  if (!auth) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), auth: null }
  if (!isAdmin(auth)) return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }), auth: null }
  return { error: null, auth }
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10)

// Full per-user detail for the admin user-detail panel - everything we hold about
// one account in a single call: profile, plan/billing, credits, connected shops,
// recent searches and a 14-day usage series.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id } = await params

  await connectDB()
  const u = await User.findById(id)
  if (!u) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  // Persist any comp-plan expiry/backfill so the admin sees the true current plan.
  await reconcileUserPlan(u).catch(() => {})

  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - i); return dayKey(d) })
  const [shops, recentSearches, searchTotal, usageRows] = await Promise.all([
    ConnectedShop.find({ userId: id }).select('shopName shopId createdAt').lean(),
    KeywordHistory.find({ userId: id }).sort({ searchedAt: -1 }).limit(25).select('keyword searchedAt').lean(),
    KeywordHistory.countDocuments({ userId: id }),
    ApiUsage.find({ userId: id, day: { $in: days } }).lean<IApiUsage[]>(),
  ])

  const plan = effectivePlan(u)
  const creditsLimit = dailyLimitFor(plan, u)
  const creditsUsedToday = sameCreditDay(u.creditsResetAt, new Date()) ? (u.creditsUsedToday ?? 0) : 0
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
    compExpiresAt: u.compExpiresAt ?? null,
    createdAt: u.createdAt ?? null,
    credits: { usedToday: creditsUsedToday, limit: creditsLimit, remaining: Math.max(0, creditsLimit - creditsUsedToday), usedTotal: u.creditsUsedTotal ?? 0, bonus: activeBonus(u) },
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
  // SEBT NEXT group. Adding someone treats them like a new SEBT signup: the current
  // batch number, plus the current free credits if they are switched on (only when
  // they have none running, so a re-add never extends someone's credits). Removing
  // ends their free credits today; their own plan is never touched either way.
  let sebtNote = ''
  if (typeof body.sebtStudent === 'boolean') {
    await connectDB()
    const now = new Date()
    if (body.sebtStudent) {
      const cfg = await getSebtConfig()
      const cur = await User.findById(id).select('sebtCreditsExpiresAt').lean<{ sebtCreditsExpiresAt?: Date | null }>()
      update.sebtStudent = true
      update.sebtBatch = cfg.batch
      const running = cur?.sebtCreditsExpiresAt && new Date(cur.sebtCreditsExpiresAt) > now
      if (cfg.trialEnabled && !running) {
        Object.assign(update, sebtCreditFields(cfg.trialPlan, cfg.trialDays))
        sebtNote = ` (+${PLAN_LABELS[cfg.trialPlan]} free credits for ${cfg.trialDays} days)`
      }
    } else {
      update.sebtStudent = false
      update.sebtBatch = null
      update.sebtCreditsExpiresAt = now
    }
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 })
  }

  await connectDB()

  // An admin PLAN change is a comp grant: setting a paid plan gives a gift for that
  // plan's own period (1 month; Pro · 1-Year 12 months, it was 1 month by mistake
  // until 2026-10-08) on compExpiresAt, so it auto-reverts to free unless the user
  // actually pays; setting 'free' clears it. A genuinely-active PAID subscriber is left
  // alone (no comp clock) - their plan is governed by the Lemon Squeezy webhook.
  if ('plan' in update) {
    if (update.plan === 'free') {
      update.compExpiresAt = null
    } else {
      const existing = await User.findById(id).select('subscriptionStatus').lean()
      const activePaid = existing?.subscriptionStatus === 'active' || existing?.subscriptionStatus === 'on_trial'
      if (!activePaid) update.compExpiresAt = addMonths(grantMonthsFor(String(update.plan)))
    }
  }

  const u = await User.findByIdAndUpdate(id, update, { returnDocument: 'after' }).lean()
  if (!u) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  if ('restricted' in update) {
    forgetRestrictedCache()   // enforced on this worker at once, others within 30 s
    logFromRequest('admin_action', req, { userId: auth?.id, email: auth?.email, detail: `${update.restricted ? 'restricted' : 'unrestricted'} ${u.email}` })
  }
  if ('role' in update) logFromRequest('admin_action', req, { userId: auth?.id, email: auth?.email, detail: `role of ${u.email} set to ${String(update.role)}` })
  if ('sebtStudent' in update) logFromRequest('admin_action', req, { userId: auth?.id, email: auth?.email, detail: `${update.sebtStudent ? `added ${u.email} to SEBT batch ${String(update.sebtBatch)}${sebtNote}` : `removed ${u.email} from SEBT`}` })
  return NextResponse.json({ success: true, data: { id, ...update } })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  await rememberDeletedTempAccounts([deleted.email])
  logFromRequest('admin_action', req, { userId: auth?.id, email: auth?.email, detail: `deleted user ${deleted.email}` })
  return NextResponse.json({ success: true, data: { id } })
}
