import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { memCache } from '@/lib/cache'
import { canUseGoogleAdsManager, requireSelectedAccount, adsErrorResponse } from '@/lib/google-ads-user'
import { createCampaignSchema, createSearchCampaign } from '@/lib/google-ads-create'

export const runtime = 'nodejs'

// POST: create a full Search campaign (PAUSED) in the selected account.
// Body = CreateCampaignInput; { validateOnly: true } checks it with Google without creating anything.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!canUseGoogleAdsManager(user)) return NextResponse.json({ success: false, error: 'Google Ads management is not available for this account yet.' }, { status: 403 })

  const parsed = createCampaignSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json({ success: false, error: issue?.message ?? 'Please check the form.', field: issue?.path?.join('.') }, { status: 400 })
  }

  try {
    const { token, account } = await requireSelectedAccount(user.id)
    const result = await createSearchCampaign(token, account.customerId, account.loginCustomerId, parsed.data)
    if (!result.validateOnly) memCache.deletePrefix(`gads-report:${user.id}:${account.customerId}:`)
    return NextResponse.json({ success: true, data: result })
  } catch (e) {
    const er = adsErrorResponse(e)
    return NextResponse.json({ success: false, error: er.error, code: er.code }, { status: er.status })
  }
}
