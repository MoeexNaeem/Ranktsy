import { NextRequest, NextResponse } from 'next/server'
import { getShopReviews } from '@/lib/etsy'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')?.trim()
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '12'), 1), 100)
  if (!id) return NextResponse.json({ success: false, error: 'Missing shop id/name' }, { status: 400 })

  try {
    const reviews = await getShopReviews(id, limit)
    return NextResponse.json({ success: true, data: reviews })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Etsy API error'
    return NextResponse.json({ success: false, error: msg }, { status: 502 })
  }
}
