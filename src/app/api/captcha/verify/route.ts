import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { verifyRecaptcha } from '@/lib/recaptcha'
import { resetHumanSearch } from '@/lib/searchLimit'
import { rateLimit, clientIp, tooManyResponse } from '@/lib/auth/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The "I'm not a robot" check between searches. The client posts the reCAPTCHA
 * token here once; Google confirms it server-side and the account's search count
 * resets, so every search request that was waiting can simply retry. (A token is
 * single-use, which is why it is verified once here rather than sent with each
 * of the parallel retries.)
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser().catch(() => null)
  const ip = clientIp(req)
  const rl = rateLimit(`captcha:${user?.id ?? ip}`, 30, 60 * 60 * 1000)
  if (!rl.allowed) return tooManyResponse(rl.retryAfterSec)

  const body = await req.json().catch(() => ({}))
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!token || !(await verifyRecaptcha(token, ip))) {
    return NextResponse.json({ success: false, error: 'Verification failed. Please try again.' }, { status: 400 })
  }

  const key = user?.id ? `u:${user.id}` : `ip:${ip}`
  try {
    await resetHumanSearch(key)
  } catch (e) {
    console.error('[captcha/verify] reset failed:', e)
    return NextResponse.json({ success: false, error: 'Could not save the check. Please try again.' }, { status: 503 })
  }
  return NextResponse.json({ success: true })
}
