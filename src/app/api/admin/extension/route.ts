import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ExtensionUsage, User } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'

export const runtime = 'nodejs'

/** How many user rows the table ships. The KPIs are NOT derived from this. */
const ROW_CAP = 1000

// Admin view of who is using the browser extension: one row per user, newest activity
// first, joined with the user's name / email / plan.
//
// The headline counts are real aggregates over the whole collection. They used to
// be computed from the (capped) row list, which pinned "Extension users" and
// "Active last 7 days" to exactly the cap once the collection outgrew it - so the
// dashboard read 200 while the true figure was several times that.
export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  await connectDB()

  const since7d = new Date(Date.now() - 7 * 864e5)
  const [total, active7d, captureAgg, rows] = await Promise.all([
    ExtensionUsage.countDocuments({}),
    ExtensionUsage.countDocuments({ lastSeenAt: { $gte: since7d } }),
    ExtensionUsage.aggregate<{ n: number }>([{ $group: { _id: null, n: { $sum: '$hits' } } }]),
    ExtensionUsage.find().sort({ lastSeenAt: -1 }).limit(ROW_CAP).lean(),
  ])
  const totalCaptures = captureAgg[0]?.n ?? 0

  const ids = rows.map(r => r.userId)
  const users = await User.find({ _id: { $in: ids } }).select('name email plan').lean<{ _id: unknown; name: string; email: string; plan: string }[]>()
  const byId = new Map(users.map(u => [String(u._id), u]))

  const data = rows.map(r => {
    const u = byId.get(r.userId)
    return {
      userId: r.userId,
      name: u?.name ?? '(deleted user)',
      email: u?.email ?? '-',
      plan: u?.plan ?? '-',
      version: r.version ?? null,
      hits: r.hits ?? 0,
      firstSeenAt: r.firstSeenAt ?? null,
      lastSeenAt: r.lastSeenAt ?? null,
      lastEndpoint: r.lastEndpoint ?? null,
    }
  })

  return NextResponse.json({
    success: true,
    // `total` / `active7d` / `totalCaptures` cover every row in the collection;
    // `listed` says how many the table below actually received.
    data: { total, active7d, totalCaptures, listed: data.length, rowCap: ROW_CAP, rows: data },
  })
}
