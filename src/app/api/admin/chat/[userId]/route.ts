import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ChatMessage, User } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { serializeChat, notifyUser } from '@/lib/notify'

export const runtime = 'nodejs'

async function guard() {
  const user = await getCurrentUser()
  if (!user) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }) }
  if (!isAdmin(user)) return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) }
  return { error: null }
}

// One user's thread. Opening it marks their messages as read by the admin.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { error } = await guard()
  if (error) return error
  const { userId } = await params

  await connectDB()
  const [msgs, u] = await Promise.all([
    ChatMessage.find({ userId }).sort({ createdAt: 1 }).limit(400).lean(),
    User.findById(userId).select('name email').lean<{ name: string; email: string }>(),
  ])
  await ChatMessage.updateMany({ userId, sender: 'user', readByAdmin: false }, { $set: { readByAdmin: true } })

  return NextResponse.json({ success: true, data: {
    user: u ? { name: u.name, email: u.email } : null,
    messages: msgs.map(serializeChat),
  } })
}

// Admin replies to a user. Delivered to that user in real time via the SSE stream.
export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { error } = await guard()
  if (error) return error
  const { userId } = await params

  const body = await req.json().catch(() => ({}))
  const text = String(body.body ?? '').trim()
  if (!text) return NextResponse.json({ success: false, error: 'Message is empty.' }, { status: 400 })
  if (text.length > 4000) return NextResponse.json({ success: false, error: 'Message is too long.' }, { status: 400 })

  await connectDB()
  const u = await User.findById(userId).select('_id').lean<{ _id: unknown }>()
  if (!u) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })

  const msg = await ChatMessage.create({ userId, sender: 'admin', body: text, readByUser: false, readByAdmin: true })
  // Surface the reply in the user's notification bell, not only the chat badge.
  const preview = text.length > 90 ? `${text.slice(0, 90)}…` : text
  void notifyUser(userId, 'New reply from Rankkw support', preview, undefined, 'chat')
  return NextResponse.json({ success: true, data: { message: serializeChat(msg) } })
}

// Delete a whole conversation (all messages for this user). Admin only.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { error } = await guard()
  if (error) return error
  const { userId } = await params
  await connectDB()
  const res = await ChatMessage.deleteMany({ userId })
  return NextResponse.json({ success: true, data: { deleted: res.deletedCount ?? 0 } })
}
