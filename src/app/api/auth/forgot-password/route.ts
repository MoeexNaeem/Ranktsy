import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User, OTP } from '@/lib/models'
import { generateOTP } from '@/lib/auth/password'
import { sendOtpEmail } from '@/lib/auth/email'
import { forgotPasswordSchema } from '@/lib/auth/schemas'
import { rateLimit, clientIp, tooManyResponse } from '@/lib/auth/rateLimit'

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()

    // Throttle OTP requests per IP (prevents email-bombing a victim's inbox).
    const ipRL = rateLimit(`forgot:ip:${clientIp(req)}`, 5, 60 * 60 * 1000)
    if (!ipRL.allowed) return tooManyResponse(ipRL.retryAfterSec)

    const parsed = forgotPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid email' }, { status: 422 })
    }

    const { email } = parsed.data

    // ...and per target email.
    const emailRL = rateLimit(`forgot:email:${email}`, 5, 60 * 60 * 1000)
    if (!emailRL.allowed) return tooManyResponse(emailRL.retryAfterSec)

    await connectDB()

    const user = await User.findOne({ email }).lean()
    // Always return success to prevent email enumeration
    if (!user) return NextResponse.json({ success: true, message: 'If that email exists, an OTP has been sent.' })

    // Invalidate existing OTPs for this email+type
    await OTP.deleteMany({ email, type: 'reset' })

    const code      = generateOTP()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    await OTP.create({ email, code, type: 'reset', expiresAt })

    await sendOtpEmail(email, code, 'reset')

    return NextResponse.json({ success: true, message: 'OTP sent to your email.' })
  } catch (err) {
    console.error('[ForgotPassword]', err)
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 })
  }
}
