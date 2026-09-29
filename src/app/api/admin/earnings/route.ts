import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { revenueReport, type Customer } from '@/lib/revenue-report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

/**
 * Admin Earnings: paying customers, from the same full record as the totals
 * (card = Lemon Squeezy payments, local = approved bank / JazzCash payments), so
 * every number on the page agrees.
 *   GET ?page=1&limit=25&q=<name or email>&method=all|card|local&status=all|active|ended
 *   GET ?format=csv  → every matching customer
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  try {
    const report = await revenueReport(sp.get('fresh') === '1')
    const q = (sp.get('q') ?? '').trim().toLowerCase()
    const method = sp.get('method')
    const status = sp.get('status')
    const list: Customer[] = report.customers.filter(c =>
      (!q || c.email.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) &&
      (method !== 'card' && method !== 'local' ? true : c.method === method) &&
      (status === 'active' ? c.status !== 'ended' : status === 'ended' ? c.status === 'ended' : true))

    if (sp.get('format') === 'csv') {
      const head = ['Name', 'Email', 'Paid by', 'Plan', 'Total paid', 'Currency', 'Payments', 'Renewals', 'Status', 'First payment', 'Last payment']
      const rows = list.map(c => [c.name, c.email, c.method === 'card' ? 'Card' : 'Local', c.plan, c.method === 'card' ? c.amount.toFixed(2) : c.amount,
        c.currency, c.payments, c.renewals, c.status, c.firstPaidAt.slice(0, 10), c.lastPaidAt.slice(0, 10)].map(csvCell).join(','))
      return new NextResponse([head.map(csvCell).join(','), ...rows].join('\n'), {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="rankkw-customers.csv"', 'Cache-Control': 'no-store' },
      })
    }

    const limit = Math.min(100, Math.max(5, Number(sp.get('limit')) || 25))
    const pages = Math.max(1, Math.ceil(list.length / limit))
    const page = Math.min(pages, Math.max(1, Number(sp.get('page')) || 1))
    return NextResponse.json({
      success: true,
      data: { rows: list.slice((page - 1) * limit, page * limit), page, pages, total: list.length, limit },
    })
  } catch (e) {
    console.error('[Admin] earnings customers:', e)
    return NextResponse.json({ success: false, error: 'Could not load customers.' }, { status: 500 })
  }
}
