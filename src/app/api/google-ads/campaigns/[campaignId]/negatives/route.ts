import { NextRequest } from 'next/server'
import { adsRoute, parseBody } from '@/lib/google-ads-route'
import { listNegativeKeywords, updateNegativeKeywords, negativesSchema } from '@/lib/google-ads-manage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ campaignId: string }> }

// GET: the campaign's negative keywords.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { campaignId } = await params
  return adsRoute(({ token, account }) => listNegativeKeywords(token, account, campaignId))
}

// PATCH { add?: [{ text, matchType }], removeCriterionIds?: string[] }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { campaignId } = await params
  return adsRoute(async ({ token, account }) => updateNegativeKeywords(token, account, campaignId, await parseBody(req, negativesSchema)), { mutates: true })
}
