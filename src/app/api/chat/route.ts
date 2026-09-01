import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ChatMessage } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { serializeChat, notifyAdmins } from '@/lib/notify'

export const runtime = 'nodejs'

// The signed-in user's own support thread.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  await connectDB()
  const msgs = await ChatMessage.find({ userId: user.id }).sort({ createdAt: 1 }).limit(300).lean()
  // Opening the thread clears the user's unread badge for admin replies.
  await ChatMessage.updateMany({ userId: user.id, sender: 'admin', readByUser: false }, { $set: { readByUser: true } })

  return NextResponse.json({ success: true, data: { messages: msgs.map(serializeChat) } })
}

// User sends a message to support. Admins see it in real time via the SSE stream.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const text = String(body.body ?? '').trim()
  if (!text) return NextResponse.json({ success: false, error: 'Message is empty.' }, { status: 400 })
  if (text.length > 4000) return NextResponse.json({ success: false, error: 'Message is too long.' }, { status: 400 })

  await connectDB()
  const msg = await ChatMessage.create({ userId: user.id, sender: 'user', body: text, readByUser: true, readByAdmin: false })
  // Raise an admin notification so a new support message shows in the bell, not just the chat badge.
  const preview = text.length > 90 ? `${text.slice(0, 90)}…` : text
  void notifyAdmins(`New message from ${user.name || user.email}`, preview, '/admin', 'chat')
  return NextResponse.json({ success: true, data: { message: serializeChat(msg) } })
}
