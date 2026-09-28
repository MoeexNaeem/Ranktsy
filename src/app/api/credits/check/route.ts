import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { connectDB } from '@/lib/db'
import { canAfford, getCreditState, isCreditTool, CREDIT_COST, alreadyPaidToday, paidKeyFor, publicState } from '@/lib/credits'
import { PLAN_LABELS } from '@/lib/plans'

/**
 * Can the user run this search? A read-only peek that NEVER charges.
 *
 * Step one of the two-step flow for the credit-metered tools: the client checks
 * here before it starts a search (so a user with no credits sees the upgrade
 * modal instead of a search that then can't be paid for), runs the search, and
 * only once the result has arrived calls /api/credits/charge. A search that fails
 * anywhere in between therefore costs nothing.
 *
 * A search already paid for today is always allowed, even on an empty balance,
 * because repeating it is free.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const tool = typeof body?.tool === 'string' ? body.tool : ''
  const paidKey = paidKeyFor(tool, body?.key)

  await connectDB()
  if (!isCreditTool(tool) || (paidKey && await alreadyPaidToday(auth.id, paidKey))) {
    const state = await getCreditState(auth.id)
    return NextResponse.json({ success: true, ok: true, free: true, state })
  }

  const a = await canAfford(auth.id, CREDIT_COST)
  if (!a) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  const state = publicState(a)
  if (!a.ok) {
    return NextResponse.json({
      success: false, code: 'credit_limit', plan: a.plan, state,
      error: `You've used all ${a.limit} of today's credits on the ${PLAN_LABELS[a.plan]} plan. Upgrade for a higher daily allowance, or come back tomorrow.`,
    }, { status: 402 })
  }
  return NextResponse.json({ success: true, ok: true, free: false, state })
}
