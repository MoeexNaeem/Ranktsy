import { NextResponse, type NextRequest } from 'next/server'
import type { ApiResponse } from '@/types'

/**
 * Fixed-window rate limiter for auth endpoints - brute-force / abuse protection
 * on login, OTP verification, password reset, signup and the email-check.
 *
 * Storage is an in-process Map (same approach as searchLimit.ts) - correct for a
 * single Node host, which is this app's setup. If it ever runs multi-instance,
 * back this with Redis; until then each instance enforces its own window, which
 * fails safe (never lets more than `limit`×instances through, never over-blocks).
 */
interface Entry { count: number; windowStart: number }
const store = new Map<string, Entry>()

export interface RateResult { allowed: boolean; remaining: number; retryAfterSec: number }

/** Count one hit against `key` and report whether it's within `limit` per `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now()
  let e = store.get(key)
  if (!e || now - e.windowStart > windowMs) { e = { count: 0, windowStart: now }; store.set(key, e) }
  e.count++
  const allowed = e.count <= limit
  return {
    allowed,
    remaining: Math.max(0, limit - e.count),
    retryAfterSec: allowed ? 0 : Math.ceil((e.windowStart + windowMs - now) / 1000),
  }
}

/** Best-effort client IP from proxy headers (Vercel/most hosts set x-forwarded-for). */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Standard 429 response with a Retry-After header. Typed as ApiResponse<never>
 *  so it's assignable inside handlers that declare a specific data type. */
export function tooManyResponse(retryAfterSec: number): NextResponse<ApiResponse<never>> {
  const mins = Math.max(1, Math.ceil(retryAfterSec / 60))
  return NextResponse.json(
    { success: false as const, errors: { _: `Too many attempts. Please try again in about ${mins} minute${mins > 1 ? 's' : ''}.` } },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
  )
}

// Opportunistic cleanup so the Map can't grow unbounded over long uptime.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [k, e] of store) if (now - e.windowStart > 60 * 60 * 1000) store.delete(k)
  }, 60 * 60 * 1000).unref?.()
}
