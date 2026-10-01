import { NextRequest } from 'next/server'
import { adsRoute, parseBody } from '@/lib/google-ads-route'
import { listNegativeKeywords, updateNegativeKeywords, negativesSchema } from '@/lib/google-ads-manage'
import { withUsage } from '@/lib/track'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ campaignId: string }> }

// GET: the campaign's negative keywords.
async function handleGET(_req: NextRequest, { params }: Ctx) {
  const { campaignId } = await params
  return adsRoute(({ token, account }) => listNegativeKeywords(token, account, campaignId))
}

// PATCH { add?: [{ text, matchType }], removeCriterionIds?: string[] }
async function handlePATCH(req: NextRequest, { params }: Ctx) {
  const { campaignId } = await params
  return adsRoute(async ({ token, account }) => updateNegativeKeywords(token, account, campaignId, await parseBody(req, negativesSchema)), { mutates: true })
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const GET = withUsage(handleGET)
export const PATCH = withUsage(handlePATCH)
