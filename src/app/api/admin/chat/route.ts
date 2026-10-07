import { NextResponse, type NextRequest } from 'next/server'
import { singleFlight } from '@/lib/concurrency'
import { connectDB } from '@/lib/db'
import { ChatMessage, User, Notification } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'

export const runtime = 'nodejs'

// The thread list groups every chat message (9-14 s on a busy DB, 2026-10-08), and
// several admin tabs poll it. One run is shared by all callers on this worker and
// reused for a few seconds.
const THREADS_TTL_MS = 5_000
let threadsCache: { at: number; data: unknown } | null = null

// All support threads for the admin, one row per user, most recent activity first,
// with an unread (unanswered) count. `?countOnly=1` returns just the unread total
// (an indexed count): that is all the sidebar badge needs.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  await connectDB()
  if (req.nextUrl.searchParams.get('countOnly') === '1') {
    const totalUnread = await ChatMessage.countDocuments({ sender: 'user', readByAdmin: false })
    return NextResponse.json({ success: true, data: { totalUnread } })
  }
  if (threadsCache && Date.now() - threadsCache.at < THREADS_TTL_MS) {
    return NextResponse.json({ success: true, data: threadsCache.data })
  }
  const data = await singleFlight('admin-chat-threads', loadThreads)
  threadsCache = { at: Date.now(), data }
  return NextResponse.json({ success: true, data })
}

async function loadThreads() {
  const threads = await ChatMessage.aggregate([
    { $sort: { createdAt: -1 } },
    { $group: {
      _id: '$userId',
      lastBody: { $first: '$body' },
      lastAttachmentName: { $first: '$attachmentName' },
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
      lastBody: (t.lastBody as string) || (t.lastAttachmentName ? `📎 ${t.lastAttachmentName}` : ''),
      lastSender: t.lastSender as 'user' | 'admin',
      lastAt: t.lastAt ?? null,
      count: t.count as number,
      unread: t.unread as number,
    }
  })

  const totalUnread = data.reduce((s, t) => s + t.unread, 0)
  return { threads: data, totalUnread }
}

// "Mark all read": every unread user message in every thread, plus this admin's
// matching "New message from ..." bell notifications.
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  await connectDB()
  threadsCache = null   // the next list read shows the new unread counts
  const [msgs] = await Promise.all([
    ChatMessage.updateMany({ sender: 'user', readByAdmin: false }, { $set: { readByAdmin: true } }),
    Notification.updateMany({ audience: 'admin', type: 'chat', readBy: { $ne: user.id } }, { $addToSet: { readBy: user.id } }),
  ])
  return NextResponse.json({ success: true, data: { marked: msgs.modifiedCount ?? 0 } })
}
