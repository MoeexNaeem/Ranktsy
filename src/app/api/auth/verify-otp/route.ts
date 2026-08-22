import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { OTP } from '@/lib/models'
import { verifyOtpSchema } from '@/lib/auth/schemas'
import { rateLimit, clientIp, tooManyResponse } from '@/lib/auth/rateLimit'

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()

    // A 6-digit OTP is only ~1M combos - without a tight cap it's brute-forceable.
    // Limit by IP and (below) by target email so guesses can't be sprayed.
    const ipRL = rateLimit(`otp:ip:${clientIp(req)}`, 10, 15 * 60 * 1000)
    if (!ipRL.allowed) return tooManyResponse(ipRL.retryAfterSec)

    const parsed = verifyOtpSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 422 })
    }

    const { email, code, type } = parsed.data

    const emailRL = rateLimit(`otp:email:${email}`, 6, 15 * 60 * 1000)
    if (!emailRL.allowed) return tooManyResponse(emailRL.retryAfterSec)

    await connectDB()

    const otp = await OTP.findOne({ email, type }).sort({ createdAt: -1 }).lean()
    if (!otp) {
      return NextResponse.json({ success: false, error: 'No OTP found. Please request a new one.' }, { status: 404 })
    }
    if (otp.expiresAt < new Date()) {
      return NextResponse.json({ success: false, error: 'OTP has expired. Please request a new one.' }, { status: 410 })
    }
    if (otp.code !== code) {
      return NextResponse.json({ success: false, error: 'Incorrect OTP code.' }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'OTP verified.' })
  } catch (err) {
    console.error('[VerifyOTP]', err)
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 })
  }
}
