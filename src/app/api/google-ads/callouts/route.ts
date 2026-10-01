import { NextRequest } from 'next/server'
import { adsRoute, parseBody } from '@/lib/google-ads-route'
import { listCallouts, createCallouts, createCalloutsSchema } from '@/lib/google-ads-assets'
import { withUsage } from '@/lib/track'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: account-level callouts.
async function handleGET() {
  return adsRoute(({ token, account }) => listCallouts(token, account))
}

// POST { texts: string[] }: add account-level callouts.
async function handlePOST(req: NextRequest) {
  return adsRoute(async ({ token, account }) => createCallouts(token, account, await parseBody(req, createCalloutsSchema)), { mutates: true })
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const GET = withUsage(handleGET)
export const POST = withUsage(handlePOST)
