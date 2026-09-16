import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { memCache } from '@/lib/cache'
import { canUseGoogleAdsManager, requireSelectedAccount, accountStatus, adsErrorResponse } from '@/lib/google-ads-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: settings of the selected account that decide which campaign options work
// (e.g. conversion-based bidding needs conversion tracking). Cached 2 minutes.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!canUseGoogleAdsManager(user)) return NextResponse.json({ success: false, error: 'Google Ads management is not available for this account yet.' }, { status: 403 })
  try {
    const { token, account } = await requireSelectedAccount(user.id)
    const key = `gads-report:${user.id}:${account.customerId}:status`
    const hit = memCache.get(key)
    if (hit) return NextResponse.json({ success: true, data: hit })
    const data = await accountStatus(token, account)
    memCache.set(key, data, 120)
    return NextResponse.json({ success: true, data })
  } catch (e) {
    const er = adsErrorResponse(e)
    return NextResponse.json({ success: false, error: er.error, code: er.code }, { status: er.status })
  }
}
