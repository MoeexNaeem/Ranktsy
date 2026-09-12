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
    // etsyFetch throws on a non-OK Etsy response (e.g. "Etsy API error 404: ...").
    // Map it to the RIGHT status so the client can show an accurate reason: a real
    // 404 (listing gone/inactive) vs a transient 429/5xx (Etsy busy) vs anything else.
    const msg = err instanceof Error ? err.message : 'Etsy API error'
    if (/error 404/i.test(msg)) return NextResponse.json({ success: false, error: 'Listing not found or inactive' }, { status: 404 })
    if (/error 429|error 5\d\d/i.test(msg)) return NextResponse.json({ success: false, error: 'Etsy is busy right now. Please try again shortly.' }, { status: 429 })
    return NextResponse.json({ success: false, error: msg }, { status: 502 })
  }
}
