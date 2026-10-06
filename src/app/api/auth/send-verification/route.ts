import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { rateLimit, clientIp, tooManyResponse } from '@/lib/auth/rateLimit'
import { sendVerificationCode, RESEND_COOLDOWN_SEC } from '@/lib/auth/verification'

const schema = z.object({ email: z.string().email().toLowerCase() })

/**
 * "Resend code" on the verify screen. Only sends to an account that still needs
 * verifying; for any other address it answers the same way (no hint whether the
 * email is registered). One email per minute per address, enforced in the DB.
 */
export async function POST(req: NextRequest) {
  try {
    const ipRL = rateLimit(`send-verify:ip:${clientIp(req)}`, 10, 60 * 60 * 1000)
    if (!ipRL.allowed) return tooManyResponse(ipRL.retryAfterSec)

    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid email.' }, { status: 422 })
    const { email } = parsed.data

    const emailRL = rateLimit(`send-verify:email:${email}`, 6, 60 * 60 * 1000)
    if (!emailRL.allowed) return tooManyResponse(emailRL.retryAfterSec)

    await connectDB()
    const user = await User.findOne({ email }).select('isVerified emailVerifyRequired').lean()
    if (!user || user.isVerified) {
      return NextResponse.json({ success: true, cooldownSec: RESEND_COOLDOWN_SEC })
    }
    const sent = await sendVerificationCode(email)
    if (!sent.ok && sent.reason === 'send_failed') {
      return NextResponse.json({ success: false, error: 'We couldn’t send the email just now. Please try again in a minute.' }, { status: 502 })
    }
    return NextResponse.json({ success: true, cooldownSec: sent.cooldownSec })
  } catch (err) {
    console.error('[SendVerification]', err)
    return NextResponse.json({ success: false, error: 'Server error. Please try again.' }, { status: 500 })
  }
}
