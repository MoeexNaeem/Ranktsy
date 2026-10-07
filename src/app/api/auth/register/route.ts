import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { hashPassword } from '@/lib/auth/password'
import { registerSchema } from '@/lib/auth/schemas'
import { resolveRole } from '@/lib/auth/roles'
import { verifyRecaptcha } from '@/lib/recaptcha'
import { rateLimit, clientIp, tooManyResponse } from '@/lib/auth/rateLimit'
import { REF_COOKIE } from '@/lib/affiliate'
import { PENDING_SIGNUP, cleanupPendingSignups } from '@/lib/auth/pendingSignups'
import { getSebtConfig, sebtGrantFields } from '@/lib/sebt'
import { sendVerificationCode, domainAcceptsMail } from '@/lib/auth/verification'
import { isDisposableEmail } from '@/lib/auth/disposable'
import { signupsToday, recordSignup, SIGNUPS_PER_IP_PER_DAY } from '@/lib/auth/signupLimit'
import { logFromRequest } from '@/lib/security/events'
import type { ApiResponse } from '@/types'

type RegisterResponse = ApiResponse<never> & { needsVerification?: boolean; email?: string; codeSent?: boolean; cooldownSec?: number }

export async function POST(req: NextRequest): Promise<NextResponse<RegisterResponse>> {
  try {
    const body   = await req.json()
    const ip = clientIp(req)

    // Cap account creation per IP (anti-abuse).
    const ipRL = rateLimit(`register:ip:${ip}`, 5, 60 * 60 * 1000)
    if (!ipRL.allowed) { logFromRequest('register_rate_limited', req); return tooManyResponse(ipRL.retryAfterSec) }

    // Bot protection - verify the reCAPTCHA token (a no-op if keys aren't set).
    if (!(await verifyRecaptcha(body?.captchaToken, ip))) {
      logFromRequest('captcha_failed', req, { email: typeof body?.email === 'string' ? body.email : null, detail: 'signup' })
      return NextResponse.json({ success: false, errors: { _: 'Please complete the “I’m not a robot” check.' } }, { status: 400 })
    }

    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      const errors: Record<string, string> = {}
      parsed.error.issues.forEach((e: import("zod").ZodIssue) => { errors[e.path[0] as string] = e.message })
      return NextResponse.json({ success: false, errors }, { status: 422 })
    }

    const { name, email, password } = parsed.data

    // Temp-mail sites can receive our code, so they are refused outright.
    if (isDisposableEmail(email)) {
      logFromRequest('register_temp_mail', req, { email })
      return NextResponse.json({ success: false, errors: { email: 'Temporary or throwaway email addresses can’t be used. Please sign up with your real email (Gmail, Outlook, Yahoo...) or use “Continue with Google”.' } }, { status: 422 })
    }

    // A few new accounts per connection per day (SEBT classrooms share one, so exempt).
    const isSebtSignup = body?.cohort === 'sebt'
    if (!isSebtSignup && (await signupsToday(ip)) >= SIGNUPS_PER_IP_PER_DAY) {
      logFromRequest('register_ip_limit', req, { email })
      return NextResponse.json({ success: false, errors: { _: 'Too many new accounts were created from this connection today. Please log in to your existing account, or try again tomorrow.' } }, { status: 429 })
    }

    // A domain with no mail servers (a typo like "gmial.com", or an invented one)
    // can never receive the verification code.
    if (!(await domainAcceptsMail(email))) {
      logFromRequest('register_bad_domain', req, { email })
      return NextResponse.json({ success: false, errors: { email: 'This email address can’t receive email. Please check the spelling.' } }, { status: 422 })
    }

    await connectDB()

    void cleanupPendingSignups().catch(() => null)

    const exists = await User.findOne({ email }).lean()
    // An earlier signup with this email that never confirmed its code is replaced:
    // only whoever can read the inbox can finish either one.
    if (exists && exists.emailVerifyRequired && !exists.isVerified) {
      await User.deleteOne({ _id: exists._id, ...PENDING_SIGNUP })
    } else if (exists) {
      return NextResponse.json({ success: false, errors: { email: 'An account with this email already exists' } }, { status: 409 })
    }

    const hashed  = await hashPassword(password)
    const role    = resolveRole(email)

    // SEBT NEXT education cohort: signups via the SEBT link (?cohort=sebt) are
    // stamped with the live batch number and, while the trial is on, granted the
    // plan the admin picked (Settings, SEBT NEXT) for the configured number of days. That runs on the comp
    // clock (compExpiresAt), so it auto-reverts to free with no webhook - see
    // plan-lifecycle. Only honoured while registration is open: defence in depth,
    // since the SEBT pages already show a "Batch N has ended" screen.
    const sebtCfg = body?.cohort === 'sebt' ? await getSebtConfig() : null
    const sebtGrant = sebtCfg?.registrationOpen ? sebtGrantFields(sebtCfg) : {}

    // Not usable until the emailed code is confirmed (/api/auth/verify-email).
    // Affiliate attribution: remembered now, credited once the email is confirmed
    // (verify-email), so fake signups never count as an affiliate's referrals.
    const refCode = req.cookies.get(REF_COOKIE)?.value || null
    await User.create({ name, email, password: hashed, role, ...sebtGrant, emailVerifyRequired: true, isVerified: false, signupRef: refCode, signupIp: ip })
    if (!isSebtSignup) void recordSignup(ip)

    // No session yet: the account opens once the code from the email is entered.
    const sent = await sendVerificationCode(email)
    return NextResponse.json({
      success: true,
      needsVerification: true,
      email,
      codeSent: sent.ok,
      cooldownSec: sent.cooldownSec,
    }, { status: 201 })
  } catch (err) {
    console.error('[Register]', err)
    return NextResponse.json({ success: false, error: 'Server error. Please try again.' }, { status: 500 })
  }
}
