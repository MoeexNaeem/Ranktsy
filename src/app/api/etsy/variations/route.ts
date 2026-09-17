import { NextRequest, NextResponse } from 'next/server'
import { getListingVariations } from '@/lib/etsy'
import { upstreamFailure } from '@/lib/upstream-errors'

export async function GET(req: NextRequest) {
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
