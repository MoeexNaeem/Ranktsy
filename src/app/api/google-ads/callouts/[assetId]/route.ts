import { NextRequest } from 'next/server'
import { adsRoute } from '@/lib/google-ads-route'
import { removeCallout } from '@/lib/google-ads-assets'
import { withUsage } from '@/lib/track'

export const runtime = 'nodejs'

// DELETE: remove an account-level callout.
async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params
  return adsRoute(({ token, account }) => removeCallout(token, account, assetId), { mutates: true })
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const DELETE = withUsage(handleDELETE)
