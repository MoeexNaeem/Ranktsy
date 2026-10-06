import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { comparePassword } from '@/lib/auth/password'
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt'
import { setAuthCookies } from '@/lib/auth/cookies'
import { loginSchema } from '@/lib/auth/schemas'
import { resolveRole } from '@/lib/auth/roles'
import { verifyRecaptcha } from '@/lib/recaptcha'
import { rateLimit, clientIp, tooManyResponse } from '@/lib/auth/rateLimit'
import { sendVerificationCode } from '@/lib/auth/verification'
import { isDisposableEmail } from '@/lib/auth/disposable'
import { wasDeletedTempAccount, DELETED_TEMP_MESSAGE, TEMP_LOGIN_MESSAGE } from '@/lib/auth/deletedAccounts'
import { logFromRequest } from '@/lib/security/events'
import type { ApiResponse, AuthUser } from '@/types'

const FIFTEEN_MIN = 15 * 60 * 1000

type LoginResponse = ApiResponse<AuthUser> & { needsVerification?: boolean; email?: string; codeSent?: boolean; cooldownSec?: number }

export async function POST(req: NextRequest): Promise<NextResponse<LoginResponse>> {
  try {
    const body   = await req.json()
    const ip = clientIp(req)

    // Brute-force protection: cap attempts per IP before doing any work.
    const ipRL = rateLimit(`login:ip:${ip}`, 10, FIFTEEN_MIN)
    if (!ipRL.allowed) { logFromRequest('login_rate_limited', req, { detail: 'too many attempts from this IP' }); return tooManyResponse(ipRL.retryAfterSec) }

    // Bot protection - verify the reCAPTCHA token (a no-op if keys aren't set).
    if (!(await verifyRecaptcha(body?.captchaToken, ip))) {
      logFromRequest('captcha_failed', req, { email: typeof body?.email === 'string' ? body.email : null, detail: 'login' })
      return NextResponse.json({ success: false, errors: { _: 'Please complete the “I’m not a robot” check.' } }, { status: 400 })
    }

    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      const errors: Record<string, string> = {}
      parsed.error.issues.forEach((e: import("zod").ZodIssue) => { errors[e.path[0] as string] = e.message })
      return NextResponse.json({ success: false, errors }, { status: 422 })
    }

    const { email, password } = parsed.data

    // Also cap attempts against a single account (targeted brute force).
    const emailRL = rateLimit(`login:email:${email}`, 6, FIFTEEN_MIN)
    if (!emailRL.allowed) { logFromRequest('login_rate_limited', req, { email, detail: 'too many attempts on this email' }); return tooManyResponse(emailRL.retryAfterSec) }

    await connectDB()

    // Use ONE generic message whether the email is unknown or the password is
    // wrong - distinct errors let an attacker enumerate which emails are
    // registered. (Signup's live email-check is the intended place to learn that.)
    const INVALID = 'Invalid email or password.'
    const user = await User.findOne({ email }).select('+password').lean()
    if (!user) {
      // A temp-mail address with no account: say why, instead of "invalid password".
      // (Only throwaway domains get this message, so real accounts stay unguessable.)
      if (isDisposableEmail(email)) {
        const deleted = await wasDeletedTempAccount(email)
        return NextResponse.json({ success: false, error: deleted ? DELETED_TEMP_MESSAGE : TEMP_LOGIN_MESSAGE }, { status: 403 })
      }
      logFromRequest('login_failed', req, { email, detail: 'no account with this email' })
      return NextResponse.json({ success: false, error: INVALID }, { status: 401 })
    }

    const valid = await comparePassword(password, user.password)
    if (!valid) {
      logFromRequest('login_failed', req, { email, userId: String(user._id), detail: 'wrong password' })
      return NextResponse.json({ success: false, error: INVALID }, { status: 401 })
    }

    // A new email/password account that never confirmed its code: send a code (at
    // most one a minute) and ask for it, instead of logging in.
    if (user.emailVerifyRequired && !user.isVerified) {
      const sent = await sendVerificationCode(user.email)
      return NextResponse.json({
        success: false,
        needsVerification: true,
        email: user.email,
        codeSent: sent.ok,
        cooldownSec: sent.cooldownSec,
        error: 'Please confirm your email first. We sent a 6-digit code to your inbox.',
      }, { status: 403 })
    }

    const authUser: AuthUser = { id: user._id.toString(), name: user.name, email: user.email, role: resolveRole(user.email, user.role), plan: user.plan, isVerified: user.isVerified }
    const [at, rt] = await Promise.all([signAccessToken(authUser), signRefreshToken(authUser.id)])
    await setAuthCookies(at, rt)

    return NextResponse.json({ success: true, data: authUser })
  } catch (err) {
    console.error('[Login]', err)
    return NextResponse.json({ success: false, error: 'Server error. Please try again.' }, { status: 500 })
  }
}
