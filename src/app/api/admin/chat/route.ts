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
const THREADS_TTL_MS = 15_000
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

// The list used to group EVERY message (40k, mostly announcements) on each load: 30-44 s
// on a busy database, with several running at once (2026-10-08). Now three light steps:
//  1. the 200 most recently active users, read from the { userId, createdAt } index only
//     (one index entry per user, no documents);
//  2. the latest message and message count for just those users;
//  3. unread counts from the { sender, readByAdmin } index.
async function loadThreads() {
  const recent = await ChatMessage.aggregate<{ _id: string; lastAt: Date }>([
    // Same direction on both keys = the { userId, createdAt } index read backwards, which
    // lets the database jump straight to each user's newest entry (DISTINCT_SCAN).
    { $sort: { userId: -1, createdAt: -1 } },
    { $group: { _id: '$userId', lastAt: { $first: '$createdAt' } } },
    { $sort: { lastAt: -1 } },
    { $limit: 200 },
  ]).option({ maxTimeMS: 20_000 })
  const recentIds = recent.map(r => r._id)
  const [lastRows, unreadRows, totalUnread] = await Promise.all([
    ChatMessage.aggregate<{ _id: string; lastBody: string; lastAttachmentName: string | null; lastSender: 'user' | 'admin'; lastAt: Date; count: number }>([
      { $match: { userId: { $in: recentIds } } },
      { $sort: { userId: -1, createdAt: -1 } },
      { $group: {
        _id: '$userId',
        lastBody: { $first: '$body' },
        lastAttachmentName: { $first: '$attachmentName' },
        lastSender: { $first: '$sender' },
        lastAt: { $first: '$createdAt' },
        count: { $sum: 1 },
      } },
    ]).option({ maxTimeMS: 20_000 }),
    ChatMessage.aggregate<{ _id: string; n: number }>([
      { $match: { sender: 'user', readByAdmin: false } },
      { $group: { _id: '$userId', n: { $sum: 1 } } },
    ]).option({ maxTimeMS: 20_000 }),
    ChatMessage.countDocuments({ sender: 'user', readByAdmin: false }),
  ])
  const lastBy = new Map(lastRows.map(r => [String(r._id), r]))
  const unreadBy = new Map(unreadRows.map(r => [String(r._id), r.n]))
  const threads = recent.map(r => {
    const l = lastBy.get(String(r._id))
    return { _id: r._id, lastBody: l?.lastBody ?? '', lastAttachmentName: l?.lastAttachmentName ?? null, lastSender: l?.lastSender ?? 'admin', lastAt: l?.lastAt ?? r.lastAt, count: l?.count ?? 0, unread: unreadBy.get(String(r._id)) ?? 0 }
  })

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
