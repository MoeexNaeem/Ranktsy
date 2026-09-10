import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { effectivePlan, PLAN_LABELS } from '@/lib/plans'

// The signed-in user's CURRENT plan, read fresh from the DB (reflects a just-
// purchased upgrade or an expired subscription even before the JWT refreshes).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  await connectDB()
  const doc = await User.findById(auth.id).lean()
  if (!doc) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  const plan = effectivePlan(doc)
  // SEBT NEXT students see their trial named "SEBT NEXT Agency Plan" while the
  // grant is live (plan still non-free); once it lapses to free they look like any
  // free user. The identity flag itself stays on for the "SEBT Student" badge.
  const sebtStudent = !!doc.sebtStudent
  const sebtActive = sebtStudent && plan !== 'free'
  return NextResponse.json({
    success: true,
    plan,
    label: sebtActive ? 'SEBT NEXT Agency Plan' : PLAN_LABELS[plan],
    status: doc.subscriptionStatus ?? null,
    renewsAt: doc.planRenewsAt ?? null,
    sebtStudent,
  })
}
