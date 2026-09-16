import { NextRequest } from 'next/server'
import { adsRoute, parseBody } from '@/lib/google-ads-route'
import { addKeywords, addKeywordsSchema } from '@/lib/google-ads-manage'

export const runtime = 'nodejs'

// POST { adGroupId, keywords: [{ text, matchType }] }: add keywords to an existing ad group.
export async function POST(req: NextRequest) {
  return adsRoute(async ({ token, account }) => addKeywords(token, account, await parseBody(req, addKeywordsSchema)), { mutates: true })
}
