import { NextResponse } from 'next/server'
import { getSellerTaxonomy } from '@/lib/etsy'
import { upstreamFailure } from '@/lib/upstream-errors'
import { withUsage } from '@/lib/track'

async function handleGET() {
  try {
    const items = await getSellerTaxonomy()
    return NextResponse.json({ success: true, data: items })
  } catch (err: unknown) {
    const fail = upstreamFailure(err)
    return NextResponse.json({ success: false, error: fail.message }, { status: fail.status })
  }
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const GET = withUsage(handleGET)
