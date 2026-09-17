import { NextResponse } from 'next/server'
import { getSellerTaxonomy } from '@/lib/etsy'
import { upstreamFailure } from '@/lib/upstream-errors'

export async function GET() {
  try {
    const items = await getSellerTaxonomy()
    return NextResponse.json({ success: true, data: items })
  } catch (err: unknown) {
    const fail = upstreamFailure(err)
    return NextResponse.json({ success: false, error: fail.message }, { status: fail.status })
  }
}
