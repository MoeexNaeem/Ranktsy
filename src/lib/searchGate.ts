import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { verifyRecaptcha, isRecaptchaConfigured } from '@/lib/recaptcha'
import { isSearchAllowed, recordSearch, clearSearchLimit } from '@/lib/searchLimit'
import type { ApiResponse } from '@/types'

/**
 * Search rate gate — call at the top of each user-facing SEARCH route:
 *
 *   const gate = await guardSearch(req); if (gate) return gate
 *
 * Behaviour: identifies the caller (logged-in user id, else IP). If the client
 * sent a valid `x-captcha-token` (the "verify to continue" flow), the window
 * resets. If the caller is over 25 searches/hour, returns a 429 with
 * `captchaRequired: true` so the client can prompt a reCAPTCHA and retry with
 * the token header. Otherwise it records the search and returns null (allowed).
 *
 * Only gate ONE endpoint per user "search" action — e.g. the core keyword route,
 * not its parallel sub-fetches — or a single search would burn several counts.
 */
export async function guardSearch<T = unknown>(req: NextRequest): Promise<NextResponse<ApiResponse<T>> | null> {
  // The gate is only meaningful with reCAPTCHA (that's how a blocked user
  // continues). Until keys are configured it's fully dormant — searches are
  // never blocked, so no dead-end and no behaviour change from today.
  if (!isRecaptchaConfigured()) return null

  const user = await getCurrentUser().catch(() => null)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'anon'
  const key = user?.id ? `u:${user.id}` : `ip:${ip}`

  // A supplied captcha token (from the client's "continue" prompt) resets the window.
  const token = req.headers.get('x-captcha-token')
  if (token && (await verifyRecaptcha(token, ip))) {
    clearSearchLimit(key)
  }

  if (!isSearchAllowed(key)) {
    return NextResponse.json<ApiResponse<T>>(
      { success: false, captchaRequired: true, error: 'You’ve hit 25 searches this hour. Please verify you’re human to continue.' },
      { status: 429 },
    )
  }

  recordSearch(key)
  return null
}
