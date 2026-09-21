import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { effectivePlan } from '@/lib/plans'
import { sweepComps } from '@/lib/plan-lifecycle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000

interface StudentRow {
  id: string
  name: string
  email: string
  plan: string
  joinedAt: string | null
  expiresAt: string | null
  daysLeft: number
  active: boolean
  batch: number | null
}

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
const fmt = (iso: string | null) => (iso ? new Date(iso).toISOString().replace('T', ' ').slice(0, 16) : '')

function toCsv(rows: StudentRow[]): string {
  const head = ['Name', 'Email', 'Batch', 'Status', 'Plan', 'Signed up', 'Trial ends', 'Days left']
  const body = rows.map(r => [
    r.name, r.email, r.batch ?? '', r.active ? 'Active' : 'Expired', r.plan, fmt(r.joinedAt), fmt(r.expiresAt), r.active ? r.daysLeft : 0,
  ].map(csvCell).join(','))
  return [head.map(csvCell).join(','), ...body].join('\n')
}

/**
 * Admin "SEBT Students" - everyone who signed up through the SEBT link
 * (?cohort=sebt, flagged `sebtStudent`). Shows who they are, when they joined,
 * and whether their 7-day Enterprise trial is still active.
 *   GET               → { total, active, expired, students:[…] }
 *   GET ?format=csv   → CSV download of the list
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format')
  const isCsv = format === 'csv'
  // Server-side pagination for the table (CSV export still returns everyone).
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50))
  // ?batch=2 narrows the list (and the CSV) to one cohort.
  const batchParam = Number(searchParams.get('batch'))
  const batchFilter = Number.isFinite(batchParam) && batchParam > 0 ? { sebtBatch: batchParam } : {}

  try {
    // Revert any expired comp grants first, so the trial status shown is truthful.
    await sweepComps().catch(() => null)
    await connectDB()
    const now = Date.now()

    // Headline counts, computed with cheap countDocuments (no full-collection load).
    // A SEBT trial is "active" while its comp grant hasn't expired.
    const [total, activeCount, batches] = await Promise.all([
      User.countDocuments({ sebtStudent: true, ...batchFilter }),
      User.countDocuments({ sebtStudent: true, ...batchFilter, compExpiresAt: { $gt: new Date(now) } }),
      User.distinct('sebtBatch', { sebtStudent: true, sebtBatch: { $ne: null } }) as Promise<number[]>,
    ])

    // Only load the rows we actually return: the whole list for CSV, one page for UI.
    const q = User.find({ sebtStudent: true, ...batchFilter }).sort({ createdAt: -1 })
    if (!isCsv) q.skip((page - 1) * limit).limit(limit)
    const docs = await q.lean()

    const students: StudentRow[] = docs.map(u => {
      const plan = effectivePlan(u)
      const exp = u.compExpiresAt ? new Date(u.compExpiresAt).getTime() : 0
      const active = exp > now && plan !== 'free'
      return {
        id: String(u._id),
        name: u.name ?? '',
        email: u.email,
        plan,
        joinedAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
        expiresAt: u.compExpiresAt ? new Date(u.compExpiresAt).toISOString() : null,
        daysLeft: active ? Math.ceil((exp - now) / DAY) : 0,
        active,
        batch: u.sebtBatch ?? null,
      }
    })

    if (isCsv) {
      return new NextResponse(toCsv(students), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="sebt-students.csv"',
          'Cache-Control': 'no-store',
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        total, active: activeCount, expired: total - activeCount,
        students, page, limit, pageCount: Math.max(1, Math.ceil(total / limit)),
        batches: batches.sort((a, b) => b - a),
      },
    })
  } catch (e) {
    console.error('[Admin] sebt-students:', e)
    return NextResponse.json({ success: false, error: 'Could not load SEBT students.' }, { status: 500 })
  }
}
