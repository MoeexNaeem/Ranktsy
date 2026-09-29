import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { verifyRecaptcha, isRecaptchaConfigured } from '@/lib/recaptcha'
import { takeSearch, takeHumanSearch, resetHumanSearch, SEARCH_LIMIT_EXT, HUMAN_CHECK_EVERY } from '@/lib/searchLimit'
import { detectExtension } from '@/lib/extension'
import type { ApiResponse } from '@/types'

/**
 * Search gate - call at the top of each user-facing SEARCH route:
 *
 *   const gate = await guardSearch(req); if (gate) return gate
 *
 * Every HUMAN_CHECK_EVERY (10) NEW searches, the next new search returns 429
 * `{ captchaRequired: true }`. The client shows a reCAPTCHA, posts the token to
 * /api/captcha/verify (verified with Google server-side, which resets the count),
 * then retries. A search is identified by `fingerprint` (default: the route path
 * plus its query minus paging/sort), so a refresh, paging, sorting or the side
 * panels of the same keyword never count twice. Pass the same fingerprint from
 * routes that serve ONE user search (keyword core, trends, ideas).
 *
 * The browser extension cannot show a captcha, so it gets its own hourly cap.
 */
const NOT_A_NEW_SEARCH = new Set(['limit', 'offset', 'page', 'sort', 'geo', '_', 't'])

export function searchFingerprint(req: NextRequest): string {
  try {
    const u = new URL(req.url)
    const params = [...u.searchParams.entries()]
      .filter(([k, v]) => !NOT_A_NEW_SEARCH.has(k) && v !== '')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v.trim().toLowerCase()}`)
    return `${u.pathname}?${params.join('&')}`
  } catch { return req.url }
}

export async function guardSearch<T = unknown>(req: NextRequest, fingerprint?: string): Promise<NextResponse<ApiResponse<T>> | null> {
  // Without reCAPTCHA keys there is no way for a human to continue, so the gate
  // stays off rather than locking everyone out.
  if (!isRecaptchaConfigured()) return null

  const user = await getCurrentUser().catch(() => null)
  const ip = req.headers.get('cf-connecting-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'anon'

  // The browser extension can't show a captcha, so its lookups have their own
  // hourly bucket and simply slow down when it is full.
  if (user?.id && detectExtension(req).isExt) {
    if (await takeSearch(`x:${user.id}`, SEARCH_LIMIT_EXT)) return null
    return NextResponse.json<ApiResponse<T>>(
      { success: false, error: 'Too many lookups this hour. Keyword data will resume shortly.' },
      { status: 429 },
    )
  }

  const key = user?.id ? `u:${user.id}` : `ip:${ip}`

  // Older clients send the solved token with the retried request itself.
  const token = req.headers.get('x-captcha-token')
  if (token && (await verifyRecaptcha(token, ip))) await resetHumanSearch(key).catch(() => {})

  let verdict: 'ok' | 'captcha' = 'ok'
  try {
    verdict = await takeHumanSearch(key, fingerprint ?? searchFingerprint(req))
  } catch (e) {
    // Database hiccup: never lock users out; the per-process hourly cap still applies.
    console.error('[searchGate] human check unavailable:', e)
    if (!(await takeSearch(key))) verdict = 'captcha'
  }
  if (verdict === 'captcha') {
    return NextResponse.json<ApiResponse<T>>(
      { success: false, captchaRequired: true, error: `Please confirm you're human to keep searching (every ${HUMAN_CHECK_EVERY} searches).` },
      { status: 429 },
    )
  }
  return null
}
