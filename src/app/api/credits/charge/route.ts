import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { connectDB } from '@/lib/db'
import { consumeCredits, getCreditState, isCreditTool, CREDIT_COST, alreadyPaidToday, claimPaidToday, unclaimPaidToday, paidKeyFor, publicState } from '@/lib/credits'
import { withUsage } from '@/lib/track'
import { recordCredits } from '@/lib/usage'
import { PLAN_LABELS } from '@/lib/plans'

/**
 * Charge CREDIT_COST for one search in a credit-metered tool.
 *
 * Step two of the two-step flow (see /api/credits/check): the client calls this
 * only AFTER the search has delivered a usable result, passing `{ tool, key }` -
 * the dashboard tab id and what was searched. A search that errored, timed out
 * or came back empty never reaches this endpoint, so it is never charged.
 *
 * One search is paid ONCE per UTC day: repeating the same search, or re-opening
 * it, costs nothing. If the tool isn't credit-metered it's a no-op that just
 * returns the current balance. When the balance ran out in the meantime (another
 * tab spent the last credit) it returns 402 `credit_limit` without charging.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withUsage(async (req: NextRequest) => {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const tool = typeof body?.tool === 'string' ? body.tool : ''
  const paidKey = paidKeyFor(tool, body?.key)

  await connectDB()

  // Not a credit tool, or this exact search is already paid for today: free.
  if (!isCreditTool(tool) || (paidKey && await alreadyPaidToday(auth.id, paidKey))) {
    const state = await getCreditState(auth.id)
    return NextResponse.json({ success: true, charged: false, state })
  }
  // Claim first (atomic): two identical requests racing can only charge once.
  if (paidKey && !(await claimPaidToday(auth.id, paidKey))) {
    const state = await getCreditState(auth.id)
    return NextResponse.json({ success: true, charged: false, state })
  }

  const res = await consumeCredits(auth.id, CREDIT_COST).catch(() => null)
  if (!res || !res.allowed) {
    // Nothing was charged, so the search must not count as paid either.
    if (paidKey) await unclaimPaidToday(auth.id, paidKey)
    if (!res) return NextResponse.json({ success: false, error: 'Could not charge credits' }, { status: 500 })
    return NextResponse.json(
      {
        success: false,
        code: 'credit_limit',
        plan: res.plan,
        error: `You've used all ${res.limit} of today's credits on the ${PLAN_LABELS[res.plan]} plan. Upgrade for a higher daily allowance, or come back tomorrow.`,
        state: publicState(res),
      },
      { status: 402 },
    )
  }

  recordCredits(CREDIT_COST)
  return NextResponse.json({
    success: true,
    charged: true,
    state: publicState(res),
  })
})
