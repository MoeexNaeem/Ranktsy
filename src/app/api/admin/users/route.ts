import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User, KeywordHistory } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin, resolveRole } from '@/lib/auth/roles'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  await connectDB()
  const [users, activity] = await Promise.all([
    User.find().sort({ createdAt: -1 }).lean(),
    KeywordHistory.aggregate([
      { $group: { _id: '$userId', count: { $sum: 1 }, last: { $max: '$searchedAt' } } },
    ]),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const act = new Map<string, { count: number; last: Date }>(activity.map((a: any) => [String(a._id), { count: a.count, last: a.last }]))

  const rows = users.map(u => {
    const id = u._id.toString()
    const a = act.get(id)
    return {
      id,
      name: u.name,
      email: u.email,
      role: resolveRole(u.email, u.role),
      plan: u.plan,
      isVerified: u.isVerified,
      etsyShopId: u.etsyShopId ?? null,
      createdAt: u.createdAt ?? null,
      searches: a?.count ?? 0,
      lastActive: a?.last ?? null,
    }
  })

  const totalSearches = rows.reduce((s, r) => s + r.searches, 0)
  const stats = {
    total: rows.length,
    admins: rows.filter(r => r.role === 'admin').length,
    verified: rows.filter(r => r.isVerified).length,
    searches: totalSearches,
  }

  return NextResponse.json({ success: true, data: { users: rows, stats } })
}
