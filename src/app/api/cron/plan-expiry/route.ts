import { NextRequest, NextResponse } from 'next/server'
import { sweepComps } from '@/lib/plan-lifecycle'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Daily plan-expiry job — reverts ADMIN-GRANTED (comp) plans to free once their
 * one-month gift period is over, and gives legacy comp grants a one-month clock.
 * (PAID subscriptions expire via the Lemon Squeezy webhook, not here.)
 *
 * The admin dashboard also runs this sweep on every load, and effectivePlan()
 * enforces the expiry at read time — so access is always correct even without a
 * cron. This job is the belt-and-braces for deployments that idle overnight.
 *
 * Schedule daily. On Vercel it's wired in vercel.json. Auth: set CRON_SECRET and
 * send `Authorization: Bearer <secret>` (Vercel Cron does this automatically).
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ success: false, error: 'CRON_SECRET is not configured — refusing to run unauthenticated.' }, { status: 503 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { backfilled, expired } = await sweepComps()
    return NextResponse.json({ success: true, data: { backfilled, expired } })
  } catch (e) {
    console.error('[Cron] plan-expiry job failed:', e)
    return NextResponse.json({ success: false, error: 'Plan-expiry job failed' }, { status: 500 })
  }
}
