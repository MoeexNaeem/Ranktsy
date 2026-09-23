import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { connectDB } from '@/lib/db'
import { Notification } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { notifUnreadCount, notifAudienceFilter, serializeNotif } from '@/lib/notify'

export const runtime = 'nodejs'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

// List this user's notifications (personal + broadcasts), newest first, with read state.
// Paged by cursor for the Notifications page: ?before=<ISO createdAt>&limit=N.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const params = req.nextUrl.searchParams
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get('limit')) || DEFAULT_LIMIT))
  const before = params.get('before')
  const beforeDate = before ? new Date(before) : null

  await connectDB()
  const match: Record<string, unknown> = { ...notifAudienceFilter(user) }
  if (beforeDate && !isNaN(beforeDate.getTime())) match.createdAt = { $lt: beforeDate }

  // One extra row tells us whether an older page exists.
  const rows = await Notification.find(match).sort({ createdAt: -1 }).limit(limit + 1).lean()
  const hasMore = rows.length > limit

  const items = rows.slice(0, limit).map(n => ({ ...serializeNotif(n), read: (n.readBy ?? []).includes(user.id) }))
  const unread = await notifUnreadCount(user)
  return NextResponse.json({ success: true, data: { items, unread, hasMore } })
}

// Mark notifications read (or unread). Body { ids?: string[], unread?: boolean };
// omit ids to mark all read.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const ids: string[] | undefined = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string' && isValidObjectId(x)) : undefined
  const markUnread = body.unread === true

  await connectDB()
  // An ids list that filtered down to nothing is a no-op, never "mark everything".
  if (ids && !ids.length) {
    return NextResponse.json({ success: true, data: { unread: await notifUnreadCount(user) } })
  }
  if (markUnread) {
    // Only targeted rows can be marked unread; "all unread" is not an action.
    if (ids) {
      await Notification.updateMany({ ...notifAudienceFilter(user), _id: { $in: ids } }, { $pull: { readBy: user.id } })
    }
  } else {
    const match: Record<string, unknown> = { ...notifAudienceFilter(user), readBy: { $ne: user.id } }
    if (ids && ids.length) match._id = { $in: ids }
    await Notification.updateMany(match, { $addToSet: { readBy: user.id } })
  }

  return NextResponse.json({ success: true, data: { unread: await notifUnreadCount(user) } })
}
