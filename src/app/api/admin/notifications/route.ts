import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Notification, User } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { createNotification, serializeNotif } from '@/lib/notify'

export const runtime = 'nodejs'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }) }
  if (!isAdmin(user)) return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) }
  return { error: null }
}

// Recent notifications the admin has sent (broadcasts + targeted).
export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error
  await connectDB()
  const rows = await Notification.find().sort({ createdAt: -1 }).limit(50).lean()
  return NextResponse.json({ success: true, data: { items: rows.map(n => ({ ...serializeNotif(n), reads: (n.readBy ?? []).length })) } })
}

// Create a notification: broadcast to everyone (audience 'all') or target one user by
// id or email. Delivered in real time via the SSE stream.
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await req.json().catch(() => ({}))
  const title = String(body.title ?? '').trim()
  const message = String(body.body ?? '').trim()
  const link = String(body.link ?? '').trim() || undefined
  const audience = body.audience === 'user' ? 'user' : 'all'
  if (!title) return NextResponse.json({ success: false, error: 'Title is required.' }, { status: 400 })
  if (title.length > 160) return NextResponse.json({ success: false, error: 'Title is too long.' }, { status: 400 })

  let userId: string | null = null
  if (audience === 'user') {
    await connectDB()
    const who = String(body.userId ?? body.email ?? '').trim()
    if (!who) return NextResponse.json({ success: false, error: 'A user id or email is required for a targeted notification.' }, { status: 400 })
    const u = who.includes('@')
      ? await User.findOne({ email: who.toLowerCase() }).select('_id').lean<{ _id: unknown }>()
      : await User.findById(who).select('_id').lean<{ _id: unknown }>()
    if (!u) return NextResponse.json({ success: false, error: 'No user matches that id or email.' }, { status: 404 })
    userId = String(u._id)
  }

  const n = await createNotification({ audience, userId, title, body: message || undefined, link, type: body.type || 'info' })
  return NextResponse.json({ success: true, data: serializeNotif(n) })
}
