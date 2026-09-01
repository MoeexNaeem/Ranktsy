/**
 * Route guard for the metered API surface - a drop-in replacement for withUsage
 * that ALSO enforces a logged-in caller and a per-user rate cap.
 *
 *   export const GET = withApiGuard(async (req) => { ... }, { limit: 20, windowMs: 60_000 })
 *
 * Middleware already rejects anonymous callers on non-public /api routes, but the
 * expensive AI generators warrant a second, per-user throughput cap so a single
 * authenticated account can't script them in a tight loop and run up the AI bill.
 * The daily-credit / monthly-image quotas still apply on top of this.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { runWithUsageContext } from '@/lib/usage'
import { recordExtensionUsage } from '@/lib/extension'
import { rateLimit, clientIp, tooManyResponse } from '@/lib/auth/rateLimit'

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response> | Response

interface GuardOpts {
  /** Max requests per window for one user (default 30). */
  limit?: number
  /** Window length in ms (default 60s). */
  windowMs?: number
}

export function withApiGuard<C = unknown>(handler: Handler<C>, opts: GuardOpts = {}): Handler<C> {
  const limit = opts.limit ?? 30
  const windowMs = opts.windowMs ?? 60_000

  return async (req: NextRequest, ctx: C) => {
    const user = await getCurrentUser().catch(() => null)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
    }
    void recordExtensionUsage(req, user.id)

    // Per-user + per-route bucket so one heavy tool can't starve another.
    const bucket = new URL(req.url).pathname
    const rl = rateLimit(`api:${bucket}:u:${user.id}`, limit, windowMs)
    if (!rl.allowed) return tooManyResponse(rl.retryAfterSec)

    // Defence in depth: also cap by source IP (shared accounts / token replay).
    const ipRl = rateLimit(`api:${bucket}:ip:${clientIp(req)}`, limit * 3, windowMs)
    if (!ipRl.allowed) return tooManyResponse(ipRl.retryAfterSec)

    return runWithUsageContext({ userId: user.id, userEmail: user.email }, () => handler(req, ctx))
  }
}
