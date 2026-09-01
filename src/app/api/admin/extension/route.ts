import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ExtensionUsage, User } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'

export const runtime = 'nodejs'

// Admin view of who is using the browser extension: one row per user, newest activity
// first, joined with the user's name / email / plan.
export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  await connectDB()
  const rows = await ExtensionUsage.find().sort({ lastSeenAt: -1 }).limit(200).lean()
  const ids = rows.map(r => r.userId)
  const users = await User.find({ _id: { $in: ids } }).select('name email plan').lean<{ _id: unknown; name: string; email: string; plan: string }[]>()
  const byId = new Map(users.map(u => [String(u._id), u]))

  const now = Date.now()
  const active7d = rows.filter(r => now - new Date(r.lastSeenAt).getTime() < 7 * 864e5).length

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

  return NextResponse.json({ success: true, data: { total: rows.length, active7d, rows: data } })
}
