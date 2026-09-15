import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ChatMessage } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { serializeChat, notifyAdmins } from '@/lib/notify'
import { validateUpload, saveAttachment } from '@/lib/chat-upload'

export const runtime = 'nodejs'

// The user attaches an image or document to their support thread. Admins see it
// live via the SSE stream (which polls new messages) and in the bell.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const caption = String(form?.get('body') ?? '').trim().slice(0, 4000)
  if (!(file instanceof File)) return NextResponse.json({ success: false, error: 'No file uploaded.' }, { status: 400 })

  const check = validateUpload(file.type, file.size)
  if (!check.ok) return NextResponse.json({ success: false, error: check.error }, { status: 400 })

  await connectDB()
  const buffer = Buffer.from(await file.arrayBuffer())
  const meta = await saveAttachment(user.id, { name: file.name, type: file.type, size: file.size, buffer })
  const msg = await ChatMessage.create({ userId: user.id, sender: 'user', body: caption, ...meta, readByUser: true, readByAdmin: false })
  void notifyAdmins(`New ${meta.attachmentKind} from ${user.name || user.email}`, meta.attachmentName, '/admin', 'chat')
  return NextResponse.json({ success: true, data: { message: serializeChat(msg) } })
}
