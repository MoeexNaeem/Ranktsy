import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Payment, User } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Monthly-equivalent list price per plan (USD), for estimating recurring revenue
// Full plan price (USD) - the actual amount a purchase of that plan is worth, used
// to value customers who bought BEFORE the payment webhook recorded exact amounts
// (pro-1yr is the full $99.99 yearly charge, not a monthly slice). Keep in sync with
// plans-data.ts. When a real payment IS recorded, we use the recorded amount instead.
const PLAN_PRICE_USD: Record<string, number> = {
  free: 0, starter: 0.99, basic: 2.99, pro: 6.99, 'pro-1yr': 99.99,
  business: 19.99, agency: 39.99, enterprise: 49.99, custom: 49.99,
}
const round2 = (n: number) => Math.round(n * 100) / 100

interface MonthRow { month: string; total: number; count: number }
interface BuyerRow {
  userId: string; email: string; plan: string; amount: number; payments: number
  renewed: boolean; firstPaidAt: string | null; lastPaidAt: string | null
  joinedAt: string | null; recorded: boolean
}

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

/**
 * Admin "Earnings" - real revenue from Lemon Squeezy payments.
 *   GET             → { totalEarned, thisMonth, payingCustomers, renewals, months[], buyers[] }
 *   GET ?format=csv → CSV of the per-buyer list
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const format = new URL(req.url).searchParams.get('format')

  try {
    await connectDB()

    // Monthly totals (paid only), newest first.
    const monthAgg = await Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: '$month', total: { $sum: '$amountUsd' }, count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 60 },
    ])
    const months: MonthRow[] = monthAgg.map((m: { _id: string; total: number; count: number }) => ({ month: m._id, total: Math.round(m.total * 100) / 100, count: m.count }))

    // Per-buyer rollup: total paid, number of payments, whether they renewed.
    const buyerAgg = await Payment.aggregate([
      { $match: { status: 'paid' } },
      { $sort: { paidAt: 1 } },
      {
        $group: {
          _id: '$userId',
          email: { $last: '$userEmail' },
          plan: { $last: '$plan' },
          total: { $sum: '$amountUsd' },
          payments: { $sum: 1 },
          renewalFlag: { $max: { $cond: [{ $eq: ['$billingReason', 'renewal'] }, 1, 0] } },
          firstPaidAt: { $min: '$paidAt' },
          lastPaidAt: { $max: '$paidAt' },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 5000 },
    ])
    // Real per-user payment rollup (accurate, grows via the webhook), keyed by id.
    const paidByUser = new Map<string, { total: number; payments: number; renewed: boolean; firstPaidAt: Date | null; lastPaidAt: Date | null; email?: string; plan?: string }>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const b of buyerAgg as any[]) {
      paidByUser.set(String(b._id ?? ''), {
        total: round2(b.total), payments: b.payments, renewed: b.payments > 1 || b.renewalFlag === 1,
        firstPaidAt: b.firstPaidAt ?? null, lastPaidAt: b.lastPaidAt ?? null, email: b.email, plan: b.plan,
      })
    }

    // Known paying customers from user records (a real Lemon Squeezy sub on a paid
    // plan). This populates the list even for purchases made BEFORE the payment
    // webhook started recording amounts, and drives an estimated recurring total.
    const payingUsers = await User.find({ lsSubscriptionId: { $exists: true, $ne: null }, plan: { $ne: 'free' } })
      .select('email plan createdAt')
      .lean<{ _id: unknown; email: string; plan: string; createdAt: Date | null }[]>()

    // Each customer's exact amount: the real recorded payment total when we have it,
    // otherwise the full price of the plan they hold (one purchase).
    const amountFor = (plan: string, recordedTotal: number, hasRecord: boolean) =>
      hasRecord && recordedTotal > 0 ? round2(recordedTotal) : round2(PLAN_PRICE_USD[plan] ?? 0)

    const byId = new Map<string, BuyerRow>()
    for (const u of payingUsers) {
      const id = String(u._id)
      const paid = paidByUser.get(id)
      byId.set(id, {
        userId: id, email: u.email ?? paid?.email ?? '', plan: u.plan ?? paid?.plan ?? '',
        amount: amountFor(u.plan, paid?.total ?? 0, !!paid), payments: paid?.payments ?? 0, renewed: paid?.renewed ?? false,
        firstPaidAt: paid?.firstPaidAt ? new Date(paid.firstPaidAt).toISOString() : null,
        lastPaidAt: paid?.lastPaidAt ? new Date(paid.lastPaidAt).toISOString() : null,
        joinedAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
        recorded: !!paid,
      })
    }
    // Anyone with recorded payments who isn't in the paying-users set (e.g. deleted
    // or reverted to free) still counts toward the total.
    for (const [id, paid] of paidByUser) {
      if (byId.has(id)) continue
      byId.set(id, {
        userId: id, email: paid.email ?? '', plan: paid.plan ?? '',
        amount: amountFor(paid.plan ?? '', paid.total, true), payments: paid.payments,
        renewed: paid.renewed, firstPaidAt: paid.firstPaidAt ? new Date(paid.firstPaidAt).toISOString() : null,
        lastPaidAt: paid.lastPaidAt ? new Date(paid.lastPaidAt).toISOString() : null,
        joinedAt: null, recorded: true,
      })
    }
    const buyers: BuyerRow[] = [...byId.values()].sort((a, b) => b.amount - a.amount)

    // Total earned = the sum of every customer's exact amount (real recorded amounts
    // where known, full plan price otherwise). Grows as new purchases come in.
    const totalEarned = round2(buyers.reduce((n, b) => n + b.amount, 0))
    const recordedTotal = round2(months.reduce((n, m) => n + m.total, 0))
    const thisMonthKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit' }).format(new Date())
    const thisMonth = months.find(m => m.month === thisMonthKey)?.total ?? 0
    const renewals = buyers.filter(b => b.renewed).length

    if (format === 'csv') {
      const head = ['Email', 'Plan', 'Amount (USD)', 'Recorded?', 'Payments', 'Renewed', 'Joined', 'Last Payment']
      const rows = buyers.map(b => [b.email, b.plan, b.amount.toFixed(2), b.recorded ? 'Yes' : 'No', b.payments, b.renewed ? 'Yes' : 'No',
        b.joinedAt ? b.joinedAt.slice(0, 10) : '', b.lastPaidAt ? b.lastPaidAt.slice(0, 10) : ''].map(csvCell).join(','))
      const csv = [head.map(csvCell).join(','), ...rows].join('\n')
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="earnings-buyers.csv"', 'Cache-Control': 'no-store' } })
    }

    return NextResponse.json({ success: true, data: { totalEarned, recordedTotal, thisMonth, payingCustomers: buyers.length, renewals, months, buyers } })
  } catch (e) {
    console.error('[Admin] earnings:', e)
    return NextResponse.json({ success: false, error: 'Could not load earnings.' }, { status: 500 })
  }
}
