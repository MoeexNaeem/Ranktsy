import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Payment } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface MonthRow { month: string; total: number; count: number }
interface BuyerRow {
  userId: string; email: string; plan: string; total: number; payments: number
  renewed: boolean; firstPaidAt: string | null; lastPaidAt: string | null
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
    const buyers: BuyerRow[] = buyerAgg.map((b: { _id: string; email: string; plan: string; total: number; payments: number; renewalFlag: number; firstPaidAt: Date; lastPaidAt: Date }) => ({
      userId: String(b._id ?? ''),
      email: b.email ?? '',
      plan: b.plan ?? '',
      total: Math.round(b.total * 100) / 100,
      payments: b.payments,
      renewed: b.payments > 1 || b.renewalFlag === 1,
      firstPaidAt: b.firstPaidAt ? new Date(b.firstPaidAt).toISOString() : null,
      lastPaidAt: b.lastPaidAt ? new Date(b.lastPaidAt).toISOString() : null,
    }))

    const totalEarned = Math.round(months.reduce((n, m) => n + m.total, 0) * 100) / 100
    const thisMonthKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit' }).format(new Date())
    const thisMonth = months.find(m => m.month === thisMonthKey)?.total ?? 0
    const renewals = buyers.filter(b => b.renewed).length

    if (format === 'csv') {
      const head = ['Email', 'Plan', 'Total Paid (USD)', 'Payments', 'Renewed', 'First Payment', 'Last Payment']
      const rows = buyers.map(b => [b.email, b.plan, b.total.toFixed(2), b.payments, b.renewed ? 'Yes' : 'No',
        b.firstPaidAt ? b.firstPaidAt.slice(0, 10) : '', b.lastPaidAt ? b.lastPaidAt.slice(0, 10) : ''].map(csvCell).join(','))
      const csv = [head.map(csvCell).join(','), ...rows].join('\n')
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="earnings-buyers.csv"', 'Cache-Control': 'no-store' } })
    }

    return NextResponse.json({ success: true, data: { totalEarned, thisMonth, payingCustomers: buyers.length, renewals, months, buyers } })
  } catch (e) {
    console.error('[Admin] earnings:', e)
    return NextResponse.json({ success: false, error: 'Could not load earnings.' }, { status: 500 })
  }
}
