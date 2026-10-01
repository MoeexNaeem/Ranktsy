/**
 * Route wrapper that attributes all API usage inside a handler to the caller.
 *
 *   export const GET = withUsage(async (req) => { ... })
 *
 * It resolves the current user once (logged-out → 'anonymous') and runs the
 * handler inside the usage AsyncLocalStorage context, so every recordEtsyCall /
 * recordGoogleCall fired deep in the pipeline lands on the right user's daily row.
 */
import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { runWithUsageContext } from '@/lib/usage'
import { isAdmin } from '@/lib/auth/roles'
import { rateLimit, tooManyResponse } from '@/lib/auth/rateLimit'
import { recordExtensionUsage } from '@/lib/extension'

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response> | Response

// Per-user request ceiling per route. A person clicking (or the extension browsing
// Etsy pages) stays far below it; it exists to stop a script looping on a
// data endpoint. The per-user DAILY Etsy budget (lib/usage.ts) is the real cap;
// this just blunts bursts. WITHUSAGE_PER_MINUTE=0 disables it.
const PER_MINUTE = Math.max(0, Number(process.env.WITHUSAGE_PER_MINUTE ?? 120))

export function withUsage<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req: NextRequest, ctx: C) => {
    const user = await getCurrentUser().catch(() => null)
    const admin = isAdmin(user)
    if (user && !admin && PER_MINUTE) {
      const rl = rateLimit(`wu:${new URL(req.url).pathname}:u:${user.id}`, PER_MINUTE, 60_000)
      if (!rl.allowed) return tooManyResponse(rl.retryAfterSec)
    }
    // Attribute extension traffic (chrome-extension origin / version header) to the user.
    if (user) void recordExtensionUsage(req, user.id)
    const uctx = user ? { userId: user.id, userEmail: user.email, exempt: admin, plan: user.plan } : { userId: 'anonymous' }
    return runWithUsageContext(uctx, () => handler(req, ctx))
  }
}
