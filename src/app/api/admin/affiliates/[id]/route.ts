import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Affiliate, ReferralConversion, User } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { affiliateLink, recomputeAffiliateTotals, serializeAffiliate } from '@/lib/affiliate'

export const runtime = 'nodejs'

async function requireAdmin() {
  const auth = await getCurrentUser()
  if (!auth) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), auth: null }
  if (!isAdmin(auth)) return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }), auth: null }
  return { error: null, auth }
}

const CONV_STATUS = ['pending', 'approved', 'paid', 'refunded'] as const

// GET - one affiliate's full record: owner, payout details, every referred user
// (emails included - admin only), and every commission with its status.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id } = await params

  await connectDB()
  const affiliate = await Affiliate.findById(id)
  if (!affiliate) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  const [owner, referredUsers, conversions] = await Promise.all([
    User.findById(affiliate.userId).select('name email').lean(),
    User.find({ referredBy: affiliate.code }).select('name email plan subscriptionStatus createdAt').sort({ createdAt: -1 }).lean(),
    ReferralConversion.find({ affiliateId: id }).sort({ createdAt: -1 }).lean(),
  ])

  return NextResponse.json({
    success: true,
    data: {
      ...serializeAffiliate(affiliate),
      id: String(affiliate._id),
      link: affiliateLink(affiliate.code),
      ownerName: owner?.name ?? '(unknown)',
      ownerEmail: owner?.email ?? '',
      referredUsers: referredUsers.map(u => ({
        id: String(u._id), name: u.name, email: u.email, plan: u.plan,
        subscriptionStatus: u.subscriptionStatus ?? null, joinedAt: u.createdAt ?? null,
      })),
      conversionList: conversions.map(c => ({
        id: String(c._id), email: c.referredEmail, name: c.referredName ?? null,
        plan: c.plan, grossUsd: c.grossUsd, commissionUsd: c.commissionUsd,
        status: c.status, date: c.createdAt ?? null, paidAt: c.paidAt ?? null,
      })),
    },
  })
}

// PATCH - change payout progress.
//   { conversionId, status }            → set one commission's status
//   { action: 'markAllPaid' }           → mark every approved/pending commission paid
//   { affiliateStatus: 'active'|'suspended' } → enable/disable the affiliate
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  await connectDB()
  const affiliate = await Affiliate.findById(id)
  if (!affiliate) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  if (body?.affiliateStatus === 'active' || body?.affiliateStatus === 'suspended') {
    affiliate.status = body.affiliateStatus
    await affiliate.save()
    return NextResponse.json({ success: true, data: { status: affiliate.status } })
  }

  if (body?.action === 'markAllPaid') {
    await ReferralConversion.updateMany(
      { affiliateId: id, status: { $in: ['pending', 'approved'] } },
      { $set: { status: 'paid', paidAt: new Date() } },
    )
    await recomputeAffiliateTotals(id)
    return NextResponse.json({ success: true, data: { ok: true } })
  }

  const conversionId = String(body?.conversionId ?? '')
  const status = String(body?.status ?? '')
  if (!conversionId || !(CONV_STATUS as readonly string[]).includes(status)) {
    return NextResponse.json({ success: false, error: 'Provide a conversionId and a valid status.' }, { status: 400 })
  }
  const conv = await ReferralConversion.findOne({ _id: conversionId, affiliateId: id })
  if (!conv) return NextResponse.json({ success: false, error: 'Conversion not found' }, { status: 404 })
  conv.status = status as typeof CONV_STATUS[number]
  if (status === 'paid') conv.paidAt = new Date()
  if (status === 'approved') conv.approvedAt = new Date()
  await conv.save()
  await recomputeAffiliateTotals(id)

  return NextResponse.json({ success: true, data: { id: conversionId, status } })
}
