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
import { canAfford, consumeCredits, isCreditTool, CREDIT_COST } from '@/lib/credits'
import { PLAN_LABELS } from '@/lib/plans'

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response> | Response

interface GuardOpts {
  /** Max requests per window for one user (default 30). */
  limit?: number
  /** Window length in ms (default 60s). */
  windowMs?: number
  /**
   * When set to a credit-metered tool id, the guard charges CREDIT_COST for the
   * call - but ONLY after the handler returns a successful response. A failed
   * generation (AI busy, bad output, error) costs the user nothing, and there is
   * no separate refund endpoint to abuse. Out-of-credits returns 402 credit_limit
   * BEFORE the handler runs, so no expensive AI work happens for a broke user.
   */
  tool?: string
}

export function withApiGuard<C = unknown>(handler: Handler<C>, opts: GuardOpts = {}): Handler<C> {
  const limit = opts.limit ?? 30
  const windowMs = opts.windowMs ?? 60_000
  const metered = !!opts.tool && isCreditTool(opts.tool)

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

    // Credit gate BEFORE the handler: don't run expensive AI work for a broke user.
    if (metered) {
      const afford = await canAfford(user.id, CREDIT_COST)
      if (afford && !afford.ok) {
        return NextResponse.json({
          success: false, code: 'credit_limit', plan: afford.plan,
          error: `You've used all ${afford.limit} of today's credits on the ${PLAN_LABELS[afford.plan]} plan. Upgrade for a higher daily allowance, or come back tomorrow.`,
          state: { credits: afford.credits, limit: afford.limit, usedToday: afford.usedToday, plan: afford.plan },
        }, { status: 402 })
      }
    }

    const res = await runWithUsageContext({ userId: user.id, userEmail: user.email }, () => handler(req, ctx))

    // Charge ONLY on a delivered success, then hand the fresh balance back so the
    // credit pill updates. A failed generation falls through uncharged.
    if (metered && res.ok) {
      const body = await res.clone().json().catch(() => null)
      if (body?.success) {
        const c = await consumeCredits(user.id, CREDIT_COST)
        const state = c ? { credits: c.credits, limit: c.limit, usedToday: c.usedToday, plan: c.plan } : undefined
        return NextResponse.json({ ...body, state }, { status: res.status })
      }
    }
    return res
  }
}
