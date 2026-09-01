import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Notification } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { notifUnreadCount, notifAudienceFilter, serializeNotif } from '@/lib/notify'

export const runtime = 'nodejs'

// List this user's recent notifications (personal + broadcasts) with read state.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  await connectDB()
  const rows = await Notification
    .find(notifAudienceFilter(user))
    .sort({ createdAt: -1 }).limit(50).lean()

  const items = rows.map(n => ({ ...serializeNotif(n), read: (n.readBy ?? []).includes(user.id) }))
  const unread = items.filter(i => !i.read).length
  return NextResponse.json({ success: true, data: { items, unread } })
}

// Mark notifications read. Body { ids?: string[] }; omit ids to mark all read.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const ids: string[] | undefined = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string') : undefined

  await connectDB()
  const match: Record<string, unknown> = { ...notifAudienceFilter(user), readBy: { $ne: user.id } }
  if (ids && ids.length) match._id = { $in: ids }
  await Notification.updateMany(match, { $addToSet: { readBy: user.id } })

  return NextResponse.json({ success: true, data: { unread: await notifUnreadCount(user) } })
}
