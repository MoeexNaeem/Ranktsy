import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { memCache } from '@/lib/cache'
import { canUseGoogleAdsManager, requireSelectedAccount, adsErrorResponse } from '@/lib/google-ads-user'
import {
  REPORT_RANGES, REPORT_TYPES, type ReportRange, type ReportType,
  accountOverview, campaignReport, adReport, keywordReport, searchTermReport, biddingReport,
} from '@/lib/google-ads-reports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET ?type=overview|campaigns|ads|keywords|search_terms|bidding&range=LAST_30_DAYS[&campaignId=]
// Reports for the user's selected Google Ads account. Cached 2 minutes per
// (user, account, report, range, campaign) so tab switching doesn't spend API operations;
// pass fresh=1 to bypass (e.g. right after an edit).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!canUseGoogleAdsManager(user)) return NextResponse.json({ success: false, error: 'Google Ads management is not available for this account yet.' }, { status: 403 })

  const sp = new URL(req.url).searchParams
  const type = (REPORT_TYPES as readonly string[]).includes(sp.get('type') ?? '') ? sp.get('type') as ReportType : 'overview'
  const range = (REPORT_RANGES as readonly string[]).includes(sp.get('range') ?? '') ? sp.get('range') as ReportRange : 'LAST_30_DAYS'
  const campaignId = /^\d+$/.test(sp.get('campaignId') ?? '') ? sp.get('campaignId') : null

  try {
    const { token, account } = await requireSelectedAccount(user.id)
    const key = `gads-report:${user.id}:${account.customerId}:${type}:${range}:${campaignId ?? ''}`
    if (sp.get('fresh') !== '1') {
      const hit = memCache.get(key)
      if (hit) return NextResponse.json({ success: true, data: hit, cached: true })
    }

    let rows: unknown
    switch (type) {
      case 'overview':     rows = await accountOverview(token, account, range); break
      case 'campaigns':    rows = await campaignReport(token, account, range); break
      case 'ads':          rows = await adReport(token, account, range, campaignId); break
      case 'keywords':     rows = await keywordReport(token, account, range, campaignId); break
      case 'search_terms': rows = await searchTermReport(token, account, range, campaignId); break
      case 'bidding':      rows = await biddingReport(token, account, range); break
    }
    const data = {
      account: { customerId: account.customerId, name: account.name, currency: account.currency, testAccount: account.testAccount },
      type, range, campaignId, rows,
    }
    memCache.set(key, data, 120)
    return NextResponse.json({ success: true, data })
  } catch (e) {
    const er = adsErrorResponse(e)
    return NextResponse.json({ success: false, error: er.error, code: er.code }, { status: er.status })
  }
}
