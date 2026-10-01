import { NextRequest, NextResponse } from 'next/server'
import { getListingVariations } from '@/lib/etsy'
import { upstreamFailure } from '@/lib/upstream-errors'
import { withUsage } from '@/lib/track'

async function handleGET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = Number(searchParams.get('id'))
  if (!id) return NextResponse.json({ success: false, error: 'Missing listing id' }, { status: 400 })

  try {
    const data = await getListingVariations(id)
    return NextResponse.json({ success: true, data })
  } catch (err: unknown) {
    const fail = upstreamFailure(err)
    return NextResponse.json({ success: false, error: fail.message }, { status: fail.status })
  }
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const GET = withUsage(handleGET)
