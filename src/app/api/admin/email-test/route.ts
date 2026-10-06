import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { sendDeliveryTest } from '@/lib/auth/email'

/**
 * Admin-only: send a test email to the signed-in admin through one path
 * (?via=resend or ?via=smtp), to confirm both work on the live server. The SMTP
 * backup otherwise only runs once Resend's daily free emails are used up.
 */
export async function POST(req: NextRequest) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const via = new URL(req.url).searchParams.get('via') === 'smtp' ? 'smtp' : 'resend'
  try {
    const r = await sendDeliveryTest(auth.email, via)
    return NextResponse.json({ success: true, data: { via, to: auth.email, from: r.from, detail: r.detail } })
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Send failed', data: { via } }, { status: 502 })
  }
}
