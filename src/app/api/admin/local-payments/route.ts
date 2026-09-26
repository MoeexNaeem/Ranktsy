import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { LocalPayment, User } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { effectivePlan } from '@/lib/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Admin list of local payments. ?status=pending|approved|rejected|expired|all.
 * "expired" = approved whose granted period has ended (the user is back on free).
 * Each row carries the user's CURRENT plan and expiry so the admin sees the effect.
 */
export async function GET(req: NextRequest) {
  const auth = await getCurrentUser().catch(() => null)
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const status = req.nextUrl.searchParams.get('status') || 'pending'
  const now = new Date()
  await connectDB()

  // Nav badge: just the pending count, polled from the admin sidebar.
  if (req.nextUrl.searchParams.get('countsOnly')) {
    const pending = await LocalPayment.countDocuments({ status: 'pending' })
    return NextResponse.json({ success: true, data: { counts: { pending } } })
  }

  const filter: Record<string, unknown> =
    status === 'all' ? {}
    : status === 'expired' ? { status: 'approved', grantedUntil: { $lte: now } }
    : status === 'approved' ? { status: 'approved', $or: [{ grantedUntil: null }, { grantedUntil: { $gt: now } }] }
    : { status }

  const [rows, pending, approvedActive, expired, rejected] = await Promise.all([
    LocalPayment.find(filter).sort({ createdAt: -1 }).limit(200).lean(),
    LocalPayment.countDocuments({ status: 'pending' }),
    LocalPayment.countDocuments({ status: 'approved', $or: [{ grantedUntil: null }, { grantedUntil: { $gt: now } }] }),
    LocalPayment.countDocuments({ status: 'approved', grantedUntil: { $lte: now } }),
    LocalPayment.countDocuments({ status: 'rejected' }),
  ])

  const users = await User.find({ _id: { $in: [...new Set(rows.map(r => r.userId))] } })
    .select('plan subscriptionStatus planRenewsAt compExpiresAt').lean()
  const byId = new Map(users.map(u => [String(u._id), u]))

  return NextResponse.json({
    success: true,
    data: {
      counts: { pending, approved: approvedActive, expired, rejected },
      rows: rows.map(r => {
        const u = byId.get(r.userId)
        const expiredNow = r.status === 'approved' && r.grantedUntil != null && new Date(r.grantedUntil) <= now
        return {
          id: String(r._id),
          userId: r.userId, userName: r.userName, userEmail: r.userEmail,
          plan: r.plan, method: r.method, amountPkr: r.amountPkr, reference: r.reference ?? null,
          hasProof: r.hasProof, status: expiredNow ? 'expired' : r.status,
          adminNote: r.adminNote ?? null, grantedPlan: r.grantedPlan ?? null, grantedUntil: r.grantedUntil ?? null,
          reviewedAt: r.reviewedAt ?? null, createdAt: r.createdAt,
          currentPlan: u ? effectivePlan(u) : null,
          currentPlanUntil: u?.compExpiresAt ?? null,
        }
      }),
    },
  })
}
