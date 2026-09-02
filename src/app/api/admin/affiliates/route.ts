import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Affiliate, ReferralConversion, User } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { affiliateLink } from '@/lib/affiliate'

export const runtime = 'nodejs'

// Admin: every affiliate with their owner, counters, and pending/approved/paid
// commission split so payouts owed are visible at a glance.
export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  await connectDB()
  const affiliates = await Affiliate.find().sort({ earnedTotal: -1, createdAt: -1 }).lean()

  // Owner info + per-affiliate commission by status, in two batched queries.
  const userIds = affiliates.map(a => a.userId)
  const [owners, byStatus] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select('name email').lean(),
    ReferralConversion.aggregate([
      { $group: { _id: { affiliateId: '$affiliateId', status: '$status' }, total: { $sum: '$commissionUsd' }, n: { $sum: 1 } } },
    ]),
  ])
  const ownerMap = new Map(owners.map(o => [String(o._id), o]))
  const sums = new Map<string, { pending: number; approved: number; paid: number; refunded: number }>()
  for (const g of byStatus as { _id: { affiliateId: string; status: string }; total: number }[]) {
    const id = String(g._id.affiliateId)
    const cur = sums.get(id) ?? { pending: 0, approved: 0, paid: 0, refunded: 0 }
    ;(cur as Record<string, number>)[g._id.status] = g.total
    sums.set(id, cur)
  }

  const data = affiliates.map(a => {
    const owner = ownerMap.get(String(a.userId))
    const s = sums.get(String(a._id)) ?? { pending: 0, approved: 0, paid: 0, refunded: 0 }
    return {
      id: String(a._id),
      code: a.code,
      link: affiliateLink(a.code),
      ownerName: owner?.name ?? '(unknown)',
      ownerEmail: owner?.email ?? '',
      status: a.status,
      commissionRate: a.commissionRate,
      clicks: a.clicks ?? 0,
      signups: a.signups ?? 0,
      conversions: a.conversions ?? 0,
      earnedTotal: Math.round((a.earnedTotal ?? 0) * 100) / 100,
      paidTotal: Math.round((a.paidTotal ?? 0) * 100) / 100,
      pendingUsd: Math.round((s.pending + s.approved) * 100) / 100,   // owed but not yet paid
      payoutMethod: a.payoutMethod ?? null,
      hasPayout: !!(a.payoutMethod && a.payoutNumber),
    }
  })

  return NextResponse.json({ success: true, data })
}
