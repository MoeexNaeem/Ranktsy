import { adsRoute } from '@/lib/google-ads-route'
import { listAdGroups } from '@/lib/google-ads-manage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: ad groups (with their campaign) in the selected account.
export async function GET() {
  return adsRoute(({ token, account }) => listAdGroups(token, account))
}
