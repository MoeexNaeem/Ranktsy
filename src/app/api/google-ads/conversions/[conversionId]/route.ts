import { NextRequest } from 'next/server'
import { adsRoute } from '@/lib/google-ads-route'
import { removeConversionAction } from '@/lib/google-ads-assets'

export const runtime = 'nodejs'

// DELETE: remove a conversion action.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ conversionId: string }> }) {
  const { conversionId } = await params
  return adsRoute(({ token, account }) => removeConversionAction(token, account, conversionId), { mutates: true })
}
