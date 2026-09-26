import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { effectivePlan, PLAN_LABELS, type PlanSlug } from '@/lib/plans'
import { reconcileUserPlan } from '@/lib/plan-lifecycle'

// The signed-in user's CURRENT plan, read fresh from the DB (reflects a just-
// purchased upgrade or an expired subscription even before the JWT refreshes).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  await connectDB()
  const user = await User.findById(auth.id)
  if (!user) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  // A local-payment / admin-granted plan whose period just ended is switched to free
  // here (and remembered for the popup below) instead of waiting for the daily sweep.
  await reconcileUserPlan(user).catch(() => {})
  const doc = user.toObject()

  const plan = effectivePlan(doc)
  // SEBT NEXT students see their trial named "SEBT NEXT Agency Plan" while the
  // grant is live (plan still non-free); once it lapses to free they look like any
  // free user. The identity flag itself stays on for the "SEBT Student" badge.
  const sebtStudent = !!doc.sebtStudent
  const sebtActive = sebtStudent && plan !== 'free'
  // One-time "your plan expired" popup, until the user dismisses it.
  const expired = plan === 'free' && doc.lastExpiredPlan && doc.planExpiryNoticeSeen === false
    ? {
        plan: doc.lastExpiredPlan,
        label: PLAN_LABELS[doc.lastExpiredPlan as PlanSlug] ?? doc.lastExpiredPlan,
        at: doc.planExpiredAt ?? null,
      }
    : null
  return NextResponse.json({
    success: true,
    plan,
    label: sebtActive ? 'SEBT NEXT Enterprise Plan' : PLAN_LABELS[plan],
    status: doc.subscriptionStatus ?? null,
    renewsAt: doc.planRenewsAt ?? null,
    // When a local-payment / admin-granted plan ends (null for paid subscriptions).
    expiresAt: plan !== 'free' ? (doc.compExpiresAt ?? null) : null,
    sebtStudent,
    expired,
  })
}
