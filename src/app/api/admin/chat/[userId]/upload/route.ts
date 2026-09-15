import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ChatMessage, User } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { serializeChat, notifyUser } from '@/lib/notify'
import { validateUpload, saveAttachment } from '@/lib/chat-upload'

export const runtime = 'nodejs'

// Admin attaches an image or document into a user's thread. Delivered to that user
// live via SSE + a clickable toast, and surfaced in their notification bell.
export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const admin = await getCurrentUser()
  if (!admin) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(admin)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const { userId } = await params

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const caption = String(form?.get('body') ?? '').trim().slice(0, 4000)
  if (!(file instanceof File)) return NextResponse.json({ success: false, error: 'No file uploaded.' }, { status: 400 })

  const check = validateUpload(file.type, file.size)
  if (!check.ok) return NextResponse.json({ success: false, error: check.error }, { status: 400 })

  await connectDB()
  const u = await User.findById(userId).select('_id').lean<{ _id: unknown }>()
  if (!u) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })

  const buffer = Buffer.from(await file.arrayBuffer())
  // The attachment is owned by the THREAD (the user), so the user can fetch it too.
  const meta = await saveAttachment(userId, { name: file.name, type: file.type, size: file.size, buffer })
  const msg = await ChatMessage.create({ userId, sender: 'admin', body: caption, ...meta, readByUser: false, readByAdmin: true })
  void notifyUser(userId, 'New reply from Rankkw support', meta.attachmentName, undefined, 'chat')
  return NextResponse.json({ success: true, data: { message: serializeChat(msg) } })
}
