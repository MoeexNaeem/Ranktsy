import { NextRequest } from 'next/server'
import { adsRoute } from '@/lib/google-ads-route'
import { removeConversionAction } from '@/lib/google-ads-assets'
import { withUsage } from '@/lib/track'

export const runtime = 'nodejs'

// DELETE: remove a conversion action.
async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ conversionId: string }> }) {
  const { conversionId } = await params
  return adsRoute(({ token, account }) => removeConversionAction(token, account, conversionId), { mutates: true })
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const DELETE = withUsage(handleDELETE)
