import { NextRequest } from 'next/server'
import { adsRoute, parseBody } from '@/lib/google-ads-route'
import { addKeywords, addKeywordsSchema } from '@/lib/google-ads-manage'
import { withUsage } from '@/lib/track'

export const runtime = 'nodejs'

// POST { adGroupId, keywords: [{ text, matchType }] }: add keywords to an existing ad group.
async function handlePOST(req: NextRequest) {
  return adsRoute(async ({ token, account }) => addKeywords(token, account, await parseBody(req, addKeywordsSchema)), { mutates: true })
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const POST = withUsage(handlePOST)
