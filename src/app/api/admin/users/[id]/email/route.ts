import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { sendUserEmail } from '@/lib/auth/email'

export const runtime = 'nodejs'

// Admin composes a one-off email to a single user, delivered to their inbox via the
// same Resend/SMTP pipeline the OTP mails use. Guarded to admins only.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const subject = String(body.subject ?? '').trim()
  const message = String(body.message ?? '').trim()

  if (!subject || !message) {
    return NextResponse.json({ success: false, error: 'Subject and message are both required.' }, { status: 400 })
  }
  if (subject.length > 200) {
    return NextResponse.json({ success: false, error: 'Subject is too long (max 200 characters).' }, { status: 400 })
  }
  if (message.length > 5000) {
    return NextResponse.json({ success: false, error: 'Message is too long (max 5000 characters).' }, { status: 400 })
  }

  await connectDB()
  const u = await User.findById(id).select('email name').lean<{ email: string; name?: string }>()
  if (!u) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })

  try {
    await sendUserEmail(u.email, subject, message)
  } catch (e) {
    return NextResponse.json(
      { success: false, error: `Email could not be sent: ${(e as Error).message}` },
      { status: 502 },
    )
  }

  return NextResponse.json({ success: true, data: { to: u.email } })
}
