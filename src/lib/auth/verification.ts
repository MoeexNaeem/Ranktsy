import { resolveMx } from 'node:dns/promises'
import { OTP } from '@/lib/models'
import { generateOTP } from '@/lib/auth/password'
import { sendOtpEmail } from '@/lib/auth/email'

/**
 * Email verification for new email/password signups (2026-10-06).
 *
 * A 6-digit code is emailed to the address; the account opens only once that code
 * is typed in. An address nobody can read (a made-up Gmail, a typo) never gets
 * the code, so it can never become an account. Free: no paid email-checking
 * service, only the inbox itself. Google sign-ins skip this (Google already
 * proves the address).
 */
export const CODE_MINUTES = 15
export const RESEND_COOLDOWN_SEC = 60
export const MAX_CODE_ATTEMPTS = 5

export type SendResult =
  | { ok: true; cooldownSec: number }
  | { ok: false; reason: 'cooldown'; cooldownSec: number }
  | { ok: false; reason: 'send_failed'; cooldownSec: number }

/**
 * Email a fresh code (replacing any older one). At most one email per
 * RESEND_COOLDOWN_SEC per address, enforced in the database so it holds across
 * all server workers and can't be used to flood someone's inbox.
 */
export async function sendVerificationCode(email: string): Promise<SendResult> {
  const last = await OTP.findOne({ email, type: 'verify' }).sort({ createdAt: -1 }).select('createdAt').lean<{ createdAt?: Date }>()
  const since = last?.createdAt ? (Date.now() - new Date(last.createdAt).getTime()) / 1000 : Infinity
  if (since < RESEND_COOLDOWN_SEC) {
    return { ok: false, reason: 'cooldown', cooldownSec: Math.ceil(RESEND_COOLDOWN_SEC - since) }
  }
  await OTP.deleteMany({ email, type: 'verify' })
  const code = generateOTP()
  await OTP.create({ email, code, type: 'verify', expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000), attempts: 0 })
  try {
    await sendOtpEmail(email, code, 'verify', CODE_MINUTES)
    return { ok: true, cooldownSec: RESEND_COOLDOWN_SEC }
  } catch (e) {
    console.error('[verify] could not send code:', e instanceof Error ? e.message : e)
    // Drop the unsent code so "Resend" works straight away.
    await OTP.deleteMany({ email, type: 'verify' }).catch(() => {})
    return { ok: false, reason: 'send_failed', cooldownSec: 0 }
  }
}

export type CheckResult = 'ok' | 'wrong' | 'expired' | 'too_many' | 'none'

/**
 * Check a typed code. Wrong guesses are counted on the code itself (shared by all
 * workers): after MAX_CODE_ATTEMPTS the code is dropped and a new one is needed,
 * so the million combinations can't be guessed.
 */
export async function checkVerificationCode(email: string, code: string): Promise<CheckResult> {
  const otp = await OTP.findOne({ email, type: 'verify' }).sort({ createdAt: -1 })
  if (!otp) return 'none'
  if (otp.expiresAt < new Date()) { await OTP.deleteMany({ email, type: 'verify' }); return 'expired' }
  if ((otp.attempts ?? 0) >= MAX_CODE_ATTEMPTS) { await OTP.deleteMany({ email, type: 'verify' }); return 'too_many' }
  if (otp.code !== code) {
    const next = (otp.attempts ?? 0) + 1
    if (next >= MAX_CODE_ATTEMPTS) { await OTP.deleteMany({ email, type: 'verify' }); return 'too_many' }
    await OTP.updateOne({ _id: otp._id }, { $inc: { attempts: 1 } })
    return 'wrong'
  }
  await OTP.deleteMany({ email, type: 'verify' })
  return 'ok'
}

export const CHECK_MESSAGES: Record<Exclude<CheckResult, 'ok'>, string> = {
  wrong:    'That code is not right. Check the email and try again.',
  expired:  'That code has expired. Press "Resend code" to get a new one.',
  too_many: 'Too many wrong tries. Press "Resend code" to get a new code.',
  none:     'No code is active for this email. Press "Resend code" to get one.',
}

/**
 * Can this email domain receive mail at all? Catches typos such as "gmial.com"
 * and invented domains before a code is sent into the void. Only a definite
 * "no such domain / no mail servers" answer rejects; a slow or failing DNS lookup
 * lets the signup through (the code step still has to be passed).
 */
export async function domainAcceptsMail(email: string): Promise<boolean> {
  const domain = email.split('@')[1]?.trim().toLowerCase()
  if (!domain) return false
  try {
    const mx = await Promise.race([
      resolveMx(domain),
      new Promise<null>(r => setTimeout(() => r(null), 3000)),
    ])
    if (mx === null) return true   // DNS too slow: don't block a real person
    return mx.length > 0
  } catch (e) {
    const code = (e as { code?: string })?.code
    return !(code === 'ENOTFOUND' || code === 'ENODATA' || code === 'NXDOMAIN')
  }
}
