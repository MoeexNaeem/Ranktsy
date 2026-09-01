import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ChatMessage, User } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'

export const runtime = 'nodejs'

// All support threads for the admin, one row per user, most recent activity first,
// with an unread (unanswered) count.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  await connectDB()
  const threads = await ChatMessage.aggregate([
    { $sort: { createdAt: -1 } },
    { $group: {
      _id: '$userId',
      lastBody: { $first: '$body' },
      lastSender: { $first: '$sender' },
      lastAt: { $first: '$createdAt' },
      count: { $sum: 1 },
      unread: { $sum: { $cond: [{ $and: [{ $eq: ['$sender', 'user'] }, { $eq: ['$readByAdmin', false] }] }, 1, 0] } },
    } },
    { $sort: { lastAt: -1 } },
    { $limit: 200 },
  ])

  const ids = threads.map(t => t._id)
  const users = await User.find({ _id: { $in: ids } }).select('name email').lean<{ _id: unknown; name: string; email: string }[]>()
  const byId = new Map(users.map(u => [String(u._id), u]))

  const data = threads.map(t => {
    const u = byId.get(String(t._id))
    return {
      userId: String(t._id),
      name: u?.name ?? '(deleted user)',
      email: u?.email ?? '-',
      lastBody: t.lastBody as string,
      lastSender: t.lastSender as 'user' | 'admin',
      lastAt: t.lastAt ?? null,
      count: t.count as number,
      unread: t.unread as number,
    }
  })

  const totalUnread = data.reduce((s, t) => s + t.unread, 0)
  return NextResponse.json({ success: true, data: { threads: data, totalUnread } })
}
