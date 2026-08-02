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

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response> | Response

export function withUsage<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req: NextRequest, ctx: C) => {
    const user = await getCurrentUser().catch(() => null)
    const uctx = user ? { userId: user.id, userEmail: user.email } : { userId: 'anonymous' }
    return runWithUsageContext(uctx, () => handler(req, ctx))
  }
}
