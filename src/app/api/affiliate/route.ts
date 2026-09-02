import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Affiliate, ReferralConversion } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { generateUniqueCode, serializeAffiliate, PAYOUT_MIN_USD } from '@/lib/affiliate'

export const runtime = 'nodejs'

const PAYOUT_METHODS = ['bank', 'jazzcash', 'easypaisa'] as const

// The affiliate sees their own earnings but NOT the buyers' emails (that stays
// admin-only). Their conversion rows carry only plan, amount, status and date.
async function ownConversions(affiliateId: string) {
  const rows = await ReferralConversion.find({ affiliateId }).sort({ createdAt: -1 }).limit(100).lean()
  return rows.map(r => ({
    id: String(r._id),
    plan: r.plan,
    commissionUsd: r.commissionUsd,
    status: r.status,
    date: r.createdAt ?? null,
  }))
}

// GET - this user's affiliate record (or { enrolled: false }).
export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  await connectDB()
  const affiliate = await Affiliate.findOne({ userId: auth.id })
  if (!affiliate) return NextResponse.json({ success: true, data: { enrolled: false, payoutMin: PAYOUT_MIN_USD } })
  return NextResponse.json({
    success: true,
    data: { enrolled: true, payoutMin: PAYOUT_MIN_USD, ...serializeAffiliate(affiliate), conversions: await ownConversions(String(affiliate._id)) },
  })
}

// POST - enroll the current user as an affiliate (idempotent).
export async function POST() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  await connectDB()
  let affiliate = await Affiliate.findOne({ userId: auth.id })
  if (!affiliate) {
    const code = await generateUniqueCode(auth.name || auth.email?.split('@')[0])
    affiliate = await Affiliate.create({ userId: auth.id, code })
  }
  return NextResponse.json({ success: true, data: { enrolled: true, payoutMin: PAYOUT_MIN_USD, ...serializeAffiliate(affiliate), conversionList: [] } })
}

// PATCH - save payout details (where the affiliate wants to be paid).
export async function PATCH(req: NextRequest) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const method = String(body?.payoutMethod ?? '').trim().toLowerCase()
  if (!(PAYOUT_METHODS as readonly string[]).includes(method)) {
    return NextResponse.json({ success: false, error: 'Choose a valid payout method.' }, { status: 400 })
  }
  const name = String(body?.payoutName ?? '').trim().slice(0, 80)
  const number = String(body?.payoutNumber ?? '').trim().slice(0, 60)
  const bank = String(body?.payoutBank ?? '').trim().slice(0, 60)
  if (!name) return NextResponse.json({ success: false, error: 'Account holder name is required.' }, { status: 400 })
  if (!number) return NextResponse.json({ success: false, error: 'Account or wallet number is required.' }, { status: 400 })
  if (method === 'bank' && !bank) return NextResponse.json({ success: false, error: 'Bank name is required for a bank account.' }, { status: 400 })

  await connectDB()
  const affiliate = await Affiliate.findOneAndUpdate(
    { userId: auth.id },
    { $set: { payoutMethod: method, payoutName: name, payoutNumber: number, payoutBank: method === 'bank' ? bank : null } },
    { new: true },
  )
  if (!affiliate) return NextResponse.json({ success: false, error: 'Enroll first.' }, { status: 400 })
  return NextResponse.json({ success: true, data: { enrolled: true, payoutMin: PAYOUT_MIN_USD, ...serializeAffiliate(affiliate), conversionList: await ownConversions(String(affiliate._id)) } })
}
