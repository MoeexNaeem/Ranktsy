import { NextRequest, NextResponse } from 'next/server'
import { searchEtsyListings } from '@/lib/etsy'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '25'), 100)
  if (!q) return NextResponse.json({ success: false, error: 'Missing query' }, { status: 400 })

  try {
    const listings = await searchEtsyListings(q, limit)
    return NextResponse.json({ success: true, data: listings })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Etsy API error'
    return NextResponse.json({ success: false, error: msg }, { status: 502 })
  }
}
