import { NextRequest } from 'next/server'
import { adsRoute } from '@/lib/google-ads-route'
import { removeCallout } from '@/lib/google-ads-assets'

export const runtime = 'nodejs'

// DELETE: remove an account-level callout.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params
  return adsRoute(({ token, account }) => removeCallout(token, account, assetId), { mutates: true })
}
