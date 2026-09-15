import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ChatAttachment } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'

export const runtime = 'nodejs'

// Streams a chat attachment's bytes. Access-gated: only the thread owner (the user
// the attachment belongs to) or an admin can read it - never a public URL.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  const { id } = await params

  await connectDB()
  const att = await ChatAttachment.findById(id).lean<{ userId: string; name: string; contentType: string; data: string } | null>()
  if (!att) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  if (att.userId !== user.id && !isAdmin(user)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const buf = Buffer.from(att.data, 'base64')
  const inline = att.contentType.startsWith('image/') || att.contentType === 'application/pdf'
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': att.contentType,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(att.name)}"`,
      'Content-Length': String(buf.length),
      'Cache-Control': 'private, max-age=86400',
    },
  })
}
