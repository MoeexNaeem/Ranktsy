import { NextResponse } from 'next/server'
import { getActivePopupAd } from '@/lib/popupAd'
import type { ApiResponse, IPopupAd } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Public: the currently active popup ad (or null). Consumed by PopupAdHost.
export async function GET(): Promise<NextResponse<ApiResponse<IPopupAd | null>>> {
  try {
    const ad = await getActivePopupAd()
    return NextResponse.json({ success: true, data: ad })
  } catch {
    return NextResponse.json({ success: true, data: null })
  }
}
