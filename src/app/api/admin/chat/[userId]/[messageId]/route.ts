import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { connectDB } from '@/lib/db'
import { ChatMessage, ChatAttachment } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { serializeChat } from '@/lib/notify'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ userId: string; messageId: string }> }

async function guard() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  return null
}

// Only messages the admin sent in this user's thread can be edited or deleted.
async function findOwn(userId: string, messageId: string) {
  if (!isValidObjectId(messageId)) return null
  await connectDB()
  return ChatMessage.findOne({ _id: messageId, userId, sender: 'admin' })
}

// Edit the text of an admin message. The user sees the new text (marked "edited")
// the next time their chat loads or refreshes.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const denied = await guard()
  if (denied) return denied
  const { userId, messageId } = await params

  const body = await req.json().catch(() => ({}))
  const text = String(body.body ?? '').trim()
  if (text.length > 4000) return NextResponse.json({ success: false, error: 'Message is too long.' }, { status: 400 })

  const msg = await findOwn(userId, messageId)
  if (!msg) return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 })
  // A text-only message can't be emptied (delete it instead); an attachment may drop its caption.
  if (!text && !msg.attachmentId) return NextResponse.json({ success: false, error: 'Message is empty. Delete it instead.' }, { status: 400 })

  if (text !== msg.body) {
    msg.body = text
    msg.editedAt = new Date()
    await msg.save()
  }
  return NextResponse.json({ success: true, data: { message: serializeChat(msg) } })
}

// Delete a single admin message (and its attachment bytes, if any).
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const denied = await guard()
  if (denied) return denied
  const { userId, messageId } = await params

  const msg = await findOwn(userId, messageId)
  if (!msg) return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 })

  if (msg.attachmentId && isValidObjectId(msg.attachmentId)) {
    await ChatAttachment.deleteOne({ _id: msg.attachmentId }).catch(() => {})
  }
  await msg.deleteOne()
  return NextResponse.json({ success: true, data: { id: messageId } })
}
