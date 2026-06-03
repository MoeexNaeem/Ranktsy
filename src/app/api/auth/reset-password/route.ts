import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User, OTP } from '@/lib/models'
import { hashPassword } from '@/lib/auth/password'
import { resetPasswordSchema } from '@/lib/auth/schemas'

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const parsed = resetPasswordSchema.safeParse(body)
    if (!parsed.success) {
      const errors: Record<string, string> = {}
      parsed.error.issues.forEach((e: import("zod").ZodIssue) => { errors[e.path[0] as string] = e.message })
      return NextResponse.json({ success: false, errors }, { status: 422 })
    }

    const { email, code, password } = parsed.data
    await connectDB()

    // Verify OTP one more time
    const otp = await OTP.findOne({ email, type: 'reset' }).sort({ createdAt: -1 }).lean()
    if (!otp || otp.code !== code || otp.expiresAt < new Date()) {
      return NextResponse.json({ success: false, error: 'Invalid or expired OTP.' }, { status: 400 })
    }

    const hashed = await hashPassword(password)
    await User.updateOne({ email }, { password: hashed })

    // Consume OTP
    await OTP.deleteMany({ email, type: 'reset' })

    return NextResponse.json({ success: true, message: 'Password reset successfully. You can now log in.' })
  } catch (err) {
    console.error('[ResetPassword]', err)
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 })
  }
}
