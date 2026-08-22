import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { connectDB } from '@/lib/db'
import { consumeCredits, getCreditState, isCreditTool, CREDIT_COST } from '@/lib/credits'
import { withUsage } from '@/lib/track'
import { recordCredits } from '@/lib/usage'
import { PLAN_LABELS } from '@/lib/plans'

/**
 * Charge credits for one use of a credit-metered tool.
 *
 * The client calls this once when the user triggers a tool action (search /
 * generate / analyze), passing `{ tool }` - the dashboard tab id. If the tool
 * isn't credit-metered it's a no-op that just returns the current balance. When
 * the user is out of credits it returns 402 `credit_limit` so the client can open
 * the upgrade modal and abort the action.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withUsage(async (req: NextRequest) => {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const tool = typeof body?.tool === 'string' ? body.tool : ''

  await connectDB()

  // Not a credit tool → don't charge; just report the current balance.
  if (!isCreditTool(tool)) {
    const state = await getCreditState(auth.id)
    return NextResponse.json({ success: true, charged: false, state })
  }

  const res = await consumeCredits(auth.id, CREDIT_COST)
  if (!res) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  if (!res.allowed) {
    return NextResponse.json(
      {
        success: false,
        code: 'credit_limit',
        plan: res.plan,
        error: `You've used all ${res.limit} of today's credits on the ${PLAN_LABELS[res.plan]} plan. Upgrade for a higher daily allowance, or come back tomorrow.`,
        state: { credits: res.credits, limit: res.limit, usedToday: res.usedToday, plan: res.plan },
      },
      { status: 402 },
    )
  }

  recordCredits(CREDIT_COST)
  return NextResponse.json({
    success: true,
    charged: true,
    state: { credits: res.credits, limit: res.limit, usedToday: res.usedToday, plan: res.plan },
  })
})
