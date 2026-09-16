import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { memCache } from '@/lib/cache'
import { canUseGoogleAdsManager, requireSelectedAccount, adsErrorResponse } from '@/lib/google-ads-user'
import { portfolioSchema, updatePortfolioStrategy } from '@/lib/google-ads-manage'

export const runtime = 'nodejs'

// PATCH { type: TARGET_CPA|TARGET_ROAS, targetCpa | targetRoasPercent, name? }: edit a portfolio strategy.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ strategyId: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!canUseGoogleAdsManager(user)) return NextResponse.json({ success: false, error: 'Google Ads management is not available for this account yet.' }, { status: 403 })
  const { strategyId } = await params
  const parsed = portfolioSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 })
  try {
    const { token, account } = await requireSelectedAccount(user.id)
    const result = await updatePortfolioStrategy(token, account, strategyId, parsed.data)
    if (!parsed.data.validateOnly) memCache.deletePrefix(`gads-report:${user.id}:${account.customerId}:`)
    return NextResponse.json({ success: true, data: result })
  } catch (e) {
    const er = adsErrorResponse(e)
    return NextResponse.json({ success: false, error: er.error, code: er.code }, { status: er.status })
  }
}
