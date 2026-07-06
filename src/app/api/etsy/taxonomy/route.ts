import { NextResponse } from 'next/server'
import { getSellerTaxonomy } from '@/lib/etsy'

export async function GET() {
  try {
    const items = await getSellerTaxonomy()
    return NextResponse.json({ success: true, data: items })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Etsy API error'
    return NextResponse.json({ success: false, error: msg }, { status: 502 })
  }
}
