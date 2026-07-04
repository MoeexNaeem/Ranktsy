import { NextRequest, NextResponse } from 'next/server'
import { getListingById } from '@/lib/etsy'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = parseInt(searchParams.get('id') ?? '', 10)
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ success: false, error: 'Missing or invalid listing id' }, { status: 400 })
  }
  try {
    const listing = await getListingById(id)
    if (!listing) return NextResponse.json({ success: false, error: 'Listing not found or inactive' }, { status: 404 })
    return NextResponse.json({ success: true, data: listing })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Etsy API error'
    return NextResponse.json({ success: false, error: msg }, { status: 502 })
  }
}
