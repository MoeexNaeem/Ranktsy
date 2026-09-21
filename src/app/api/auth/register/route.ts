import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { hashPassword } from '@/lib/auth/password'
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt'
import { setAuthCookies } from '@/lib/auth/cookies'
import { registerSchema } from '@/lib/auth/schemas'
import { resolveRole } from '@/lib/auth/roles'
import { verifyRecaptcha } from '@/lib/recaptcha'
import { rateLimit, clientIp, tooManyResponse } from '@/lib/auth/rateLimit'
import { applySignupReferral, REF_COOKIE } from '@/lib/affiliate'
import { getSebtConfig, sebtGrantFields } from '@/lib/sebt'
import type { ApiResponse, AuthUser } from '@/types'

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<AuthUser>>> {
  try {
    const body   = await req.json()
    const ip = clientIp(req)

    // Cap account creation per IP (anti-abuse).
    const ipRL = rateLimit(`register:ip:${ip}`, 5, 60 * 60 * 1000)
    if (!ipRL.allowed) return tooManyResponse(ipRL.retryAfterSec)

    // Bot protection - verify the reCAPTCHA token (a no-op if keys aren't set).
    if (!(await verifyRecaptcha(body?.captchaToken, ip))) {
      return NextResponse.json({ success: false, errors: { _: 'Please complete the “I’m not a robot” check.' } }, { status: 400 })
    }

    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      const errors: Record<string, string> = {}
      parsed.error.issues.forEach((e: import("zod").ZodIssue) => { errors[e.path[0] as string] = e.message })
      return NextResponse.json({ success: false, errors }, { status: 422 })
    }

    const { name, email, password } = parsed.data

    await connectDB()

    const exists = await User.findOne({ email }).lean()
    if (exists) {
      return NextResponse.json({ success: false, errors: { email: 'An account with this email already exists' } }, { status: 409 })
    }

    const hashed  = await hashPassword(password)
    const role    = resolveRole(email)

    // SEBT NEXT education cohort: signups via the SEBT link (?cohort=sebt) are
    // stamped with the live batch number and, while the trial is on, granted the
    // Enterprise plan for the configured number of days. That runs on the comp
    // clock (compExpiresAt), so it auto-reverts to free with no webhook - see
    // plan-lifecycle. Only honoured while registration is open: defence in depth,
    // since the SEBT pages already show a "Batch N has ended" screen.
    const sebtCfg = body?.cohort === 'sebt' ? await getSebtConfig() : null
    const sebtGrant = sebtCfg?.registrationOpen ? sebtGrantFields(sebtCfg) : {}

    const user    = await User.create({ name, email, password: hashed, role, ...sebtGrant })

    // Affiliate attribution: if the visitor arrived through a ?ref link, credit
    // that affiliate (best-effort; never blocks signup).
    const refCode = req.cookies.get(REF_COOKIE)?.value
    if (refCode) await applySignupReferral(user, refCode).catch(() => null)

    const authUser: AuthUser = { id: user._id.toString(), name: user.name, email: user.email, role, plan: user.plan, isVerified: user.isVerified }

    const [at, rt] = await Promise.all([signAccessToken(authUser), signRefreshToken(authUser.id)])
    await setAuthCookies(at, rt)

    return NextResponse.json({ success: true, data: authUser }, { status: 201 })
  } catch (err) {
    console.error('[Register]', err)
    return NextResponse.json({ success: false, error: 'Server error. Please try again.' }, { status: 500 })
  }
}
