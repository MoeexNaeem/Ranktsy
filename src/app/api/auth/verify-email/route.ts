import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt'
import { setAuthCookies } from '@/lib/auth/cookies'
import { resolveRole } from '@/lib/auth/roles'
import { rateLimit, clientIp, tooManyResponse } from '@/lib/auth/rateLimit'
import { checkVerificationCode, CHECK_MESSAGES } from '@/lib/auth/verification'
import { applySignupReferral } from '@/lib/affiliate'
import type { ApiResponse, AuthUser } from '@/types'

const schema = z.object({
  email: z.string().email().toLowerCase(),
  code:  z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
})

/**
 * Confirm a new account's email with the code we sent, then log the user in.
 * Wrong guesses are limited per code (see checkVerificationCode) and per IP here.
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<AuthUser>>> {
  try {
    const ipRL = rateLimit(`verify-email:ip:${clientIp(req)}`, 20, 15 * 60 * 1000)
    if (!ipRL.allowed) return tooManyResponse(ipRL.retryAfterSec)

    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Enter the 6-digit code from the email.' }, { status: 422 })
    }
    const { email, code } = parsed.data

    await connectDB()
    const user = await User.findOne({ email }).lean()
    if (!user) return NextResponse.json({ success: false, error: CHECK_MESSAGES.none }, { status: 400 })

    if (!user.isVerified) {
      const result = await checkVerificationCode(email, code)
      if (result !== 'ok') {
        return NextResponse.json({ success: false, error: CHECK_MESSAGES[result] }, { status: 400 })
      }
      await User.updateOne({ _id: user._id }, { $set: { isVerified: true } })
      // The signup is real now: credit the affiliate whose link brought them.
      if (user.signupRef && !user.referredBy) {
        const doc = await User.findById(user._id)
        if (doc) {
          await applySignupReferral(doc, user.signupRef).catch(() => null)
          await User.updateOne({ _id: user._id }, { $unset: { signupRef: 1 } }).catch(() => null)
        }
      }
    }

    const authUser: AuthUser = { id: user._id.toString(), name: user.name, email: user.email, role: resolveRole(user.email, user.role), plan: user.plan, isVerified: true }
    const [at, rt] = await Promise.all([signAccessToken(authUser), signRefreshToken(authUser.id)])
    await setAuthCookies(at, rt)
    return NextResponse.json({ success: true, data: authUser })
  } catch (err) {
    console.error('[VerifyEmail]', err)
    return NextResponse.json({ success: false, error: 'Server error. Please try again.' }, { status: 500 })
  }
}
