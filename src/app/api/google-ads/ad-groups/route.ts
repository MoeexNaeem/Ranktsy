import { adsRoute } from '@/lib/google-ads-route'
import { listAdGroups } from '@/lib/google-ads-manage'
import { withUsage } from '@/lib/track'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: ad groups (with their campaign) in the selected account.
async function handleGET() {
  return adsRoute(({ token, account }) => listAdGroups(token, account))
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const GET = withUsage(handleGET)
