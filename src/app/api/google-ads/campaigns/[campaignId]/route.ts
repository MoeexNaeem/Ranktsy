import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { memCache } from '@/lib/cache'
import { canUseGoogleAdsManager, requireSelectedAccount, adsErrorResponse } from '@/lib/google-ads-user'
import { getCampaignSettings, updateCampaignSchema, updateCampaign } from '@/lib/google-ads-manage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ campaignId: string }> }

async function gate() {
  const user = await getCurrentUser()
  if (!user) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }) }
  if (!canUseGoogleAdsManager(user)) return { error: NextResponse.json({ success: false, error: 'Google Ads management is not available for this account yet.' }, { status: 403 }) }
  return { user }
}

// GET: current editable settings of one campaign.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const g = await gate()
  if (g.error) return g.error
  const { campaignId } = await params
  try {
    const { token, account } = await requireSelectedAccount(g.user.id)
    const data = await getCampaignSettings(token, account, campaignId)
    if (!data) return NextResponse.json({ success: false, error: 'Campaign not found.' }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    const er = adsErrorResponse(e)
    return NextResponse.json({ success: false, error: er.error, code: er.code }, { status: er.status })
  }
}

// PATCH: edit name, budget, networks, countries, languages and/or bidding (validateOnly supported).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await gate()
  if (g.error) return g.error
  const { campaignId } = await params
  const parsed = updateCampaignSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' }, { status: 400 })
  try {
    const { token, account } = await requireSelectedAccount(g.user.id)
    const result = await updateCampaign(token, account, campaignId, parsed.data)
    if (!parsed.data.validateOnly) memCache.deletePrefix(`gads-report:${g.user.id}:${account.customerId}:`)
    return NextResponse.json({ success: true, data: result })
  } catch (e) {
    const er = adsErrorResponse(e)
    return NextResponse.json({ success: false, error: er.error, code: er.code }, { status: er.status })
  }
}
