import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User, OTP } from '@/lib/models'
import { hashPassword } from '@/lib/auth/password'
import { resetPasswordSchema } from '@/lib/auth/schemas'
import { rateLimit, clientIp, tooManyResponse } from '@/lib/auth/rateLimit'

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()

    const ipRL = rateLimit(`reset:ip:${clientIp(req)}`, 10, 15 * 60 * 1000)
    if (!ipRL.allowed) return tooManyResponse(ipRL.retryAfterSec)

    const parsed = resetPasswordSchema.safeParse(body)
    if (!parsed.success) {
      const errors: Record<string, string> = {}
      parsed.error.issues.forEach((e: import("zod").ZodIssue) => { errors[e.path[0] as string] = e.message })
      return NextResponse.json({ success: false, errors }, { status: 422 })
    }

    const { email, code, password } = parsed.data

    // Also cap reset attempts per target email - an IP cap alone is bypassable
    // with rotating IPs, so bound guesses against the 6-digit code per account.
    const emailRL = rateLimit(`reset:email:${email}`, 6, 15 * 60 * 1000)
    if (!emailRL.allowed) return tooManyResponse(emailRL.retryAfterSec)

    await connectDB()

    // Verify OTP one more time
    const otp = await OTP.findOne({ email, type: 'reset' }).sort({ createdAt: -1 }).lean()
    if (!otp || otp.code !== code || otp.expiresAt < new Date()) {
      return NextResponse.json({ success: false, error: 'Invalid or expired OTP.' }, { status: 400 })
    }

    const hashed = await hashPassword(password)
    // A new password also signs out every existing session (stolen refresh tokens included).
    // The reset code was read from this inbox, so the address is proven real too.
    await User.updateOne({ email }, { password: hashed, isVerified: true, sessionsValidAfter: new Date(Math.floor(Date.now() / 1000) * 1000) })

    // Consume OTP
    await OTP.deleteMany({ email, type: 'reset' })

    return NextResponse.json({ success: true, message: 'Password reset successfully. You can now log in.' })
  } catch (err) {
    console.error('[ResetPassword]', err)
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 })
  }
}
