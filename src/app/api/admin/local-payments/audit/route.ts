import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { auditRows, auditPayers, auditCsv, auditPdf, parseFilters, PDF_MAX } from '@/lib/local-payment-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Admin → Earnings → Local payments. Filters: users (ids), plan, status, method,
 * from/to (PKT days), q. ?format=csv or ?format=pdf exports every matching row;
 * ?flagged=1 keeps only payments with a warning; ?payers=<text> feeds the picker.
 */
export async function GET(req: NextRequest) {
  const auth = await getCurrentUser().catch(() => null)
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  if (sp.has('payers')) {
    const payers = await auditPayers((sp.get('payers') ?? '').trim().slice(0, 100))
    return NextResponse.json({ success: true, data: payers.map(p => ({ userId: p._id, name: p.name, email: p.email, payments: p.payments })) })
  }

  const f = parseFilters(sp)
  const flaggedOnly = sp.get('flagged') === '1'
  const format = sp.get('format')
  const stamp = new Date().toISOString().slice(0, 10)

  if (format === 'csv') {
    const { rows } = await auditRows(f, { flaggedOnly })
    return new NextResponse(auditCsv(rows, req.nextUrl.origin), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="rankkw-local-payments-${stamp}.csv"`, 'Cache-Control': 'no-store' },
    })
  }

  if (format === 'pdf') {
    const { rows, summary } = await auditRows(f, { flaggedOnly })
    if (rows.length > PDF_MAX) {
      return NextResponse.json({ success: false, error: `${rows.length} payments match. A PDF with screenshots holds up to ${PDF_MAX}: narrow the dates or filters, or export CSV.` }, { status: 400 })
    }
    const bytes = await auditPdf(f, rows, summary)
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="rankkw-local-payments-${stamp}.pdf"`, 'Cache-Control': 'no-store' },
    })
  }

  const limit = Math.min(100, Math.max(5, Number(sp.get('limit')) || 25))
  const data = await auditRows(f, { page: Number(sp.get('page')) || 1, limit, flaggedOnly })
  return NextResponse.json({ success: true, data: { ...data, limit } })
}
