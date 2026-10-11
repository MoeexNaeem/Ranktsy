import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { runBillingCheck, applySubscription } from '@/lib/billing-check'
import { memCache } from '@/lib/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Admin billing check: every Lemon Squeezy subscription against the account it
 * should have upgraded (lib/billing-check.ts).
 *   GET              -> the check (cached 2 minutes; ?fresh=1 to rerun)
 *   POST {subId, userId} -> give that account the subscription's plan
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const key = 'admin:billing-check'
    const hit = req.nextUrl.searchParams.get('fresh') === '1' ? null : memCache.get(key)
    const data = hit ?? await runBillingCheck()
    if (!hit) memCache.set(key, data, 120)
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error('[Admin] billing check:', e)
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Billing check failed' }, { status: 502 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as { subId?: string; userId?: string }
  if (!body.subId || !body.userId || !/^[a-f0-9]{24}$/i.test(body.userId)) {
    return NextResponse.json({ success: false, error: 'Missing subscription or account' }, { status: 400 })
  }
  const r = await applySubscription(String(body.subId), body.userId)
  console.info(`[Admin] billing fix by ${auth.email}: sub ${body.subId} -> user ${body.userId}: ${r.message}`)
  memCache.delete('admin:billing-check')
  return NextResponse.json({ success: r.ok, ...(r.ok ? { message: r.message } : { error: r.message }) }, { status: r.ok ? 200 : 400 })
}
