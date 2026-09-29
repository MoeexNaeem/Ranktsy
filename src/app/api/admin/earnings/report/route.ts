import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { revenueReport } from '@/lib/revenue-report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Admin: the full earnings record (card + local), month by month and per year.
 *   GET            → RevenueReport (cached 5 min)
 *   GET ?fresh=1   → rebuilt now
 *   GET ?format=csv → every month as CSV
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  try {
    const report = await revenueReport(sp.get('fresh') === '1')

    if (sp.get('format') === 'csv') {
      const head = ['Month', 'Card revenue (USD)', 'Card payments', 'New card subscriptions', 'Card renewals', 'Card plan changes',
        'Card not renewed', 'Card refunds', 'Refunded (USD)', 'Local revenue (PKR)', 'Local payments', 'Local new customers',
        'Local renewals', 'Local not renewed']
      const rows = report.months.map(m => [m.month, m.card.revenueUsd.toFixed(2), m.card.payments, m.card.newSubs, m.card.renewals,
        m.card.planChanges, m.card.notRenewed, m.card.refunds, m.card.refundedUsd.toFixed(2), m.local.revenuePkr, m.local.payments,
        m.local.newCustomers, m.local.renewals, m.local.notRenewed].join(','))
      return new NextResponse([head.join(','), ...rows].join('\n'), {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="rankkw-earnings-by-month.csv"', 'Cache-Control': 'no-store' },
      })
    }

    return NextResponse.json({ success: true, data: report })
  } catch (e) {
    console.error('[Admin] earnings report:', e)
    return NextResponse.json({ success: false, error: 'Could not build the earnings record.' }, { status: 500 })
  }
}
